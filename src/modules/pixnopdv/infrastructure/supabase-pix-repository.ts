import type { SupabaseClient } from "@supabase/supabase-js";
import type { PixRepository } from "../application/pix-repository";
import {
  normalizeDraft,
  secretToColumn,
  type PixCredentials,
  type PixCredentialsDraft,
} from "../domain/pix-credentials";
import type { Tenant } from "@/shared/tenant/tenant";
import { toPixCredentials } from "./pix-mapper";

/**
 * A tabela mora no esquema `devices`, não no `public`.
 *
 * Procurá-la no `public` devolve 404 do PostgREST, que é indistinguível de
 * "esta instalação não tem PIXnoPDV" para quem só olha o resultado. A tela
 * dizia "não configurado" para uma loja que tinha as credenciais gravadas.
 */
const ESQUEMA = "devices";
const TABELA = "pixnopdv_store_credentials";

/** Colunas que podem ser lidas: nenhuma delas é segredo. */
const COLUNAS = "environment, api_base_url, basic_user, insecure_tls, enabled, updated_at";

/** Quando há mais de um ambiente gravado, é o de produção que interessa. */
const PREFERIDO = "producao";

export class SupabasePixRepository implements PixRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  private tabela() {
    return this.client.schema(ESQUEMA).from(TABELA);
  }

  /**
   * Existe conteúdo nesta coluna?
   *
   * A pergunta vai como filtro e a resposta vem como contagem: o segredo é
   * avaliado dentro do banco e não trafega. O projeto anterior trazia
   * `basic_token` e `secret_key` em claro até o navegador só para comparar com
   * string vazia — qualquer extensão, log de rede ou erro capturado no cliente
   * passava a conter a credencial do provedor de pagamento.
   */
  private async preenchido(coluna: string, environment: string): Promise<boolean> {
    const { count, error } = await this.tabela()
      .select("environment", { count: "exact", head: true })
      .eq("company_id", this.tenant.companyId)
      .eq("store_id", this.tenant.storeId)
      .eq("environment", environment)
      .not(coluna, "is", null)
      .neq(coluna, "");

    if (error) throw new Error(`Falha ao verificar as credenciais: ${error.message}`);
    return (count ?? 0) > 0;
  }

  async get(): Promise<PixCredentials | null> {
    const { data, error } = await this.tabela()
      .select(COLUNAS)
      .eq("company_id", this.tenant.companyId)
      .eq("store_id", this.tenant.storeId);
    if (error) throw new Error(`Falha ao carregar o PIXnoPDV: ${error.message}`);

    const linhas = (data ?? []) as unknown as Array<Record<string, unknown>>;
    const linha = linhas.find((l) => l.environment === PREFERIDO) ?? linhas[0];
    if (!linha) return null;

    const environment = String(linha.environment ?? PREFERIDO);

    const [basicTokenSet, secretKeySet] = await Promise.all([
      this.preenchido("basic_token", environment),
      this.preenchido("secret_key", environment),
    ]);

    return toPixCredentials(linha, { basicTokenSet, secretKeySet });
  }

  /**
   * Grava as credenciais do ambiente indicado.
   *
   * Há uma linha por (empresa, loja, ambiente). Quando ela existe é UPDATE —
   * e as colunas de segredo só entram no comando se o operador pediu para
   * trocá-las ou apagá-las, que é como o valor atual é preservado sem ser lido.
   */
  async save(draft: PixCredentialsDraft): Promise<PixCredentials> {
    const campos = normalizeDraft(draft);
    const basicToken = secretToColumn(draft.basicToken);
    const secretKey = secretToColumn(draft.secretKey);
    const updated_at = new Date().toISOString();

    const { count, error: erroConsulta } = await this.tabela()
      .select("environment", { count: "exact", head: true })
      .eq("company_id", this.tenant.companyId)
      .eq("store_id", this.tenant.storeId)
      .eq("environment", campos.environment);
    if (erroConsulta) throw new Error(`Falha ao gravar o PIXnoPDV: ${erroConsulta.message}`);

    if ((count ?? 0) > 0) {
      const patch: Record<string, unknown> = { ...campos, updated_at };
      if (basicToken !== undefined) patch.basic_token = basicToken;
      if (secretKey !== undefined) patch.secret_key = secretKey;

      const { error } = await this.tabela()
        .update(patch)
        .eq("company_id", this.tenant.companyId)
        .eq("store_id", this.tenant.storeId)
        .eq("environment", campos.environment);
      if (error) throw new Error(`Falha ao gravar o PIXnoPDV: ${error.message}`);
    } else {
      // Numa linha nova não há segredo anterior a preservar: "manter" é nulo.
      const { error } = await this.tabela().insert({
        ...campos,
        company_id: this.tenant.companyId,
        store_id: this.tenant.storeId,
        basic_token: basicToken ?? null,
        secret_key: secretKey ?? null,
        updated_at,
      });
      if (error) throw new Error(`Falha ao gravar o PIXnoPDV: ${error.message}`);
    }

    const salvo = await this.get();
    if (!salvo) throw new Error("As credenciais foram gravadas mas não puderam ser lidas de volta.");
    return salvo;
  }
}
