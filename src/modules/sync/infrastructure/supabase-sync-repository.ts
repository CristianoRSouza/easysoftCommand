import type { SupabaseClient } from "@supabase/supabase-js";
import type { SyncRepository } from "../application/sync-repository";
import type { QueueDirection, QueueEvent, QueueOverview } from "../domain/sync-activity";
import type { Tenant } from "@/shared/tenant/tenant";
import {
  toActiveRetry,
  toBacklogEntry,
  toEntityStatus,
  toFailureGroup,
  toQueueEvent,
  toSummary,
} from "./queue-mapper";

type Row = Record<string, unknown>;

/** Quantas linhas os painéis de amostra trazem — os mesmos números do projeto anterior. */
const RETRIES_ATIVOS = 100;
const FALHAS_RECENTES = 30;

/**
 * As filas da nuvem.
 *
 * Vivem em `ecb_sync.inbox` e `ecb_sync.outbox`, um esquema que o PostgREST
 * não expõe. O acesso é por funções no banco, que recebem a empresa e a loja e
 * devolvem apenas o que pertence a elas. É mais seguro que expor as tabelas: o
 * filtro de tenant fica dentro do banco, onde o cliente não alcança.
 */
export class SupabaseSyncRepository implements SyncRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  private async rpc(
    direction: QueueDirection,
    funcao: string,
    extras: Record<string, unknown> = {},
  ): Promise<Row[]> {
    const { data, error } = await this.client.rpc(`cloud_sync_${direction}_${funcao}`, {
      p_company_id: this.tenant.companyId,
      p_store_id: this.tenant.storeId,
      ...extras,
    });
    if (error) throw new Error(`Falha ao ler a fila: ${error.message}`);
    return (data ?? []) as Row[];
  }

  async overview(direction: QueueDirection): Promise<QueueOverview> {
    const [resumo, taxa, porEntidade, backlog, retries, grupos, recentes] = await Promise.all([
      this.rpc(direction, "summary"),
      this.rpc(direction, direction === "inbox" ? "apply_rate" : "dispatch_rate"),
      this.rpc(direction, "by_entity"),
      this.rpc(direction, "backlog"),
      this.rpc(direction, "active_retries", { p_limit: RETRIES_ATIVOS }),
      this.rpc(direction, "failures_by_error"),
      this.rpc(direction, "recent_failures", { p_limit: FALHAS_RECENTES }),
    ]);

    return {
      summary: toSummary(direction, resumo[0] ?? {}, taxa),
      byEntity: porEntidade.map((row) => toEntityStatus(direction, row)),
      backlog: backlog.map(toBacklogEntry),
      activeRetries: retries.map(toActiveRetry),
      failureGroups: grupos.map(toFailureGroup),
      recentFailures: recentes.map((row) => toQueueEvent(direction, row)),
    };
  }

  async events(direction: QueueDirection, offset: number, limit: number): Promise<QueueEvent[]> {
    const linhas = await this.rpc(direction, "recent_all", { p_limit: limit, p_offset: offset });
    return linhas.map((row) => toQueueEvent(direction, row));
  }
}
