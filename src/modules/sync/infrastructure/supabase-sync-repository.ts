import type { SupabaseClient } from "@supabase/supabase-js";
import type { SyncRepository } from "../application/sync-repository";
import type { InboxItem, InboxSummary, SyncQuery } from "../domain/sync-activity";
import { pageToRange, type Page } from "@/shared/domain/paging";
import type { Tenant } from "@/shared/tenant/tenant";
import { asNumber } from "@/shared/infrastructure/convert";
import { toInboxItem } from "./inbox-mapper";

/**
 * A fila de entrada da nuvem.
 *
 * O PDV publica as mudanças e a nuvem as aplica. Item preso na fila é dado que
 * já existe na loja e ainda não existe aqui — a origem silenciosa de "o painel
 * não mostra a venda de ontem".
 *
 * A fila vive em `ecb_sync.inbox`, um esquema que o PostgREST não expõe. O
 * acesso é por funções no banco, que recebem a empresa e a loja e devolvem
 * apenas o que pertence a elas. É mais seguro que expor a tabela: o filtro de
 * tenant fica dentro do banco, onde o cliente não alcança.
 */
type Row = Record<string, unknown>;

export class SupabaseSyncRepository implements SyncRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  /** Toda função recebe a empresa e a loja; o resto varia. */
  private async rpc(nome: string, extras: Record<string, unknown> = {}): Promise<Row[]> {
    const { data, error } = await this.client.rpc(nome, {
      p_company_id: this.tenant.companyId,
      p_store_id: this.tenant.storeId,
      ...extras,
    });
    if (error) throw new Error(`Falha ao ler a fila: ${error.message}`);
    return (data ?? []) as Row[];
  }

  async inboxSummary(): Promise<InboxSummary> {
    const linhas = await this.rpc("cloud_sync_inbox_summary");
    const row = linhas[0] ?? {};

    // A função separa os pendentes em novos e em nova tentativa. Para a tela o
    // que importa é que ainda não foram aplicados: as duas somam "na fila".
    const pending = asNumber(row.pending_novos) + asNumber(row.pending_em_retry);

    const backlog = await this.rpc("cloud_sync_inbox_backlog").catch(() => [] as Row[]);
    const maisAntigo = backlog[0]?.oldest_received_at ?? backlog[0]?.received_at ?? null;

    return {
      applied: asNumber(row.applied_total),
      pending,
      failed: asNumber(row.failed_terminal),
      oldestPendingAt: typeof maisAntigo === "string" ? maisAntigo : null,
    };
  }

  async inbox(query: SyncQuery): Promise<Page<InboxItem>> {
    const { from } = pageToRange(query.page, query.pageSize);

    // Há uma função por recorte; a de falhas existe porque é o recorte que
    // alguém procura quando algo não chegou.
    const nome =
      query.status === "error" ? "cloud_sync_inbox_recent_failures" : "cloud_sync_inbox_recent_all";

    const linhas = await this.rpc(nome, { p_limit: query.pageSize, p_offset: from });

    return {
      items: linhas.map(toInboxItem),
      // As funções devolvem uma janela, não o total. O resumo já informa quantos
      // há em cada estado — repetir aqui um número que não foi contado seria
      // inventar precisão.
      total: from + linhas.length + (linhas.length === query.pageSize ? query.pageSize : 0),
    };
  }
}
