import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssistantRepository } from "../application/assistant-repository";
import {
  APP_NAME,
  chatErrorMessage,
  deltaOf,
  todayKey,
  type ChatMessage,
  type ChatSession,
} from "../domain/chat";
import type { UsageEntry } from "../domain/credits";
import type { Tenant } from "@/shared/tenant/tenant";
import { asBoolean, asNumber, asText } from "@/shared/infrastructure/convert";

type Row = Record<string, unknown>;

/**
 * O EasyAI não usa cookie: quem se identifica é o token do usuário, no
 * cabeçalho. Por isso ele aceita chamada de qualquer origem sem risco — não
 * há credencial que o navegador anexe sozinho.
 */
const EASYAI = "https://easyai.easysoftcloud.com.br/api/v1/chat";

/** Conversas, uso e créditos vivem no esquema `billing`, compartilhado com o EasyBilling. */
const ESQUEMA = "billing";

/** Quantas conversas o histórico carrega — as do projeto anterior. */
const HISTORICO = 30;
/** O uso recente basta para a cota do dia. */
const EXTRATO = 200;
/** O teto de linhas por consulta do PostgREST. */
const LOTE_DO_EXTRATO = 1000;

function toSession(row: Row): ChatSession {
  return {
    id: asText(row.id) ?? "",
    userId: asText(row.user_id) ?? "",
    day: asText(row.day) ?? "",
    app: asText(row.app),
    messages: Array.isArray(row.messages) ? (row.messages as ChatMessage[]) : [],
    startedAt: asText(row.started_at) ?? "",
    endedAt: asText(row.ended_at) ?? "",
  };
}

export class SupabaseAssistantRepository implements AssistantRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  private billing() {
    return this.client.schema(ESQUEMA);
  }

  async currentUserId(): Promise<string | null> {
    const { data } = await this.client.auth.getSession();
    return data.session?.user.id ?? null;
  }

  async sessions(): Promise<ChatSession[]> {
    const { data, error } = await this.billing()
      .from("ai_chat_sessions")
      .select("id, user_id, day, app, messages, started_at, ended_at")
      .eq("company_id", this.tenant.companyId)
      .order("day", { ascending: false })
      // Folga para a conversa de hoje de cada usuário, que não entra no histórico.
      .limit((HISTORICO + 1) * 5);
    if (error) throw new Error(`Falha ao ler as conversas: ${error.message}`);
    return ((data ?? []) as Row[]).map(toSession);
  }

  async saveToday(messages: ChatMessage[]): Promise<void> {
    const userId = await this.currentUserId();
    if (!userId) throw new Error("Sessão encerrada. Entre de novo.");

    const agora = new Date().toISOString();
    const primeira = messages[0]?.ts;
    const ultima = messages[messages.length - 1]?.ts;

    const { error } = await this.billing()
      .from("ai_chat_sessions")
      .upsert(
        {
          user_id: userId,
          company_id: this.tenant.companyId,
          app: APP_NAME,
          day: todayKey(),
          messages,
          started_at: primeira ? new Date(primeira).toISOString() : agora,
          ended_at: ultima ? new Date(ultima).toISOString() : agora,
        },
        { onConflict: "user_id,day" },
      );
    if (error) throw new Error(`Falha ao gravar a conversa: ${error.message}`);
  }

  async deleteSession(id: string): Promise<void> {
    const { error } = await this.billing().from("ai_chat_sessions").delete().eq("id", id);
    if (error) throw new Error(`Falha ao apagar a conversa: ${error.message}`);
  }

  async clearHistory(): Promise<void> {
    const userId = await this.currentUserId();
    if (!userId) return;
    const { error } = await this.billing()
      .from("ai_chat_sessions")
      .delete()
      .eq("user_id", userId)
      .neq("day", todayKey());
    if (error) throw new Error(`Falha ao apagar o histórico: ${error.message}`);
  }

  async ask(
    messages: Pick<ChatMessage, "role" | "content">[],
    onDelta: (texto: string) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const { data } = await this.client.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sessão encerrada. Entre de novo.");

    const resposta = await fetch(EASYAI, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messages,
        company_id: this.tenant.companyId,
        store_id: this.tenant.storeId,
        app: APP_NAME,
      }),
      signal,
    });

    if (!resposta.ok) {
      const corpo = await resposta.json().catch(() => ({}));
      throw new Error(chatErrorMessage(resposta.status, corpo));
    }
    if (!resposta.body) throw new Error("O assistente não devolveu resposta.");

    // A resposta chega em pedaços que não respeitam o fim da linha: o que
    // sobra de um pedaço espera o próximo para virar linha inteira.
    const leitor = resposta.body.getReader();
    const decodificador = new TextDecoder();
    let pendente = "";
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      pendente += decodificador.decode(value, { stream: true });
      const linhas = pendente.split("\n");
      pendente = linhas.pop() ?? "";
      for (const linha of linhas) {
        const texto = deltaOf(linha.replace(/\r$/, ""));
        if (texto) onDelta(texto);
      }
    }
    const resto = deltaOf(pendente.trim());
    if (resto) onDelta(resto);
  }

  async usage(): Promise<UsageEntry[]> {
    const { data, error } = await this.billing()
      .from("usage_log")
      .select("created_at, was_free, action")
      .eq("company_id", this.tenant.companyId)
      .eq("store_id", this.tenant.storeId)
      .order("created_at", { ascending: false })
      .limit(EXTRATO);
    if (error) throw new Error(`Falha ao ler o uso do assistente: ${error.message}`);
    return ((data ?? []) as Row[]).map((row) => ({
      createdAt: asText(row.created_at) ?? "",
      wasFree: asBoolean(row.was_free),
      action: asText(row.action),
    }));
  }

  /**
   * O extrato inteiro, em lotes. O projeto anterior somava só os 200
   * movimentos mais recentes: passada essa conta, o saldo mostrado deixava de
   * ser o saldo.
   */
  async creditMovements(): Promise<number[]> {
    const valores: number[] = [];
    for (let inicio = 0; ; inicio += LOTE_DO_EXTRATO) {
      const { data, error } = await this.billing()
        .from("credit_transactions")
        .select("amount")
        .eq("company_id", this.tenant.companyId)
        .eq("store_id", this.tenant.storeId)
        .order("id")
        .range(inicio, inicio + LOTE_DO_EXTRATO - 1);
      if (error) throw new Error(`Falha ao ler os créditos: ${error.message}`);
      const linhas = (data ?? []) as Row[];
      valores.push(...linhas.map((row) => asNumber(row.amount)));
      if (linhas.length < LOTE_DO_EXTRATO) return valores;
    }
  }
}
