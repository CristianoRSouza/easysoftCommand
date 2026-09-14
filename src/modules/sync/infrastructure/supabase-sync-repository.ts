import type { SupabaseClient } from "@supabase/supabase-js";
import type { SyncRepository } from "../application/sync-repository";
import type {
  InboxItem,
  InboxSummary,
  SyncLogEntry,
  SyncOverview,
  SyncQuery,
} from "../domain/sync-activity";
import { pageToRange, startOfDayIso, startOfNextDayIso, type Page } from "@/shared/domain/paging";
import type { Tenant } from "@/shared/tenant/tenant";
import { asIsoDate } from "@/shared/infrastructure/convert";
import { INBOX_COLUMNS, toInboxItem } from "./inbox-mapper";

const MOTIVO =
  "A sincronização do PDV é medida no PostgreSQL da loja e não é replicada para a nuvem. Abra o programa instalado na loja para acompanhá-la.";

/**
 * Na nuvem só existe metade deste módulo.
 *
 * `sync_log` e `sync_heartbeat` moram no banco da loja — daí `isAvailable()`
 * falso e o erro explícito. Já a fila de entrada (`sync_inbox`) é da nuvem, e
 * funciona nos dois modos: preferir o erro claro ao zero inventado vale para
 * o que não dá para medir, não para o que dá.
 */
export class SupabaseSyncRepository implements SyncRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  isAvailable(): boolean {
    return false;
  }

  async overview(): Promise<SyncOverview> {
    throw new Error(MOTIVO);
  }

  async logs(): Promise<Page<SyncLogEntry>> {
    throw new Error(MOTIVO);
  }

  async inboxSummary(): Promise<InboxSummary> {
    const contar = async (status: string[] | null) => {
      let request = this.client
        .from("vw_sync_inbox")
        .select("id", { count: "exact", head: true })
        .eq("store_id", this.tenant.storeId);
      if (status) request = request.in("apply_status", status);
      const { count, error } = await request;
      if (error) throw new Error(`Falha ao ler a fila: ${error.message}`);
      return count ?? 0;
    };

    const [applied, pending, failed, maisAntigo] = await Promise.all([
      contar(["applied", "done", "ok"]),
      contar(["pending", "queued"]),
      contar(["failed", "error"]),
      this.client
        .from("vw_sync_inbox")
        .select("received_at")
        .eq("store_id", this.tenant.storeId)
        .in("apply_status", ["pending", "queued"])
        .order("received_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    const row = maisAntigo.data as Record<string, unknown> | null;
    return {
      applied,
      pending,
      failed,
      oldestPendingAt: row?.received_at == null ? null : asIsoDate(row.received_at),
    };
  }

  async inbox(query: SyncQuery): Promise<Page<InboxItem>> {
    const { from, to } = pageToRange(query.page, query.pageSize);

    let request = this.client
      .from("vw_sync_inbox")
      .select(INBOX_COLUMNS, { count: "exact" })
      .eq("store_id", this.tenant.storeId);

    if (query.status === "error") request = request.in("apply_status", ["failed", "error"]);
    if (query.range.from) request = request.gte("received_at", startOfDayIso(query.range.from));
    if (query.range.to) request = request.lt("received_at", startOfNextDayIso(query.range.to));

    const { data, error, count } = await request
      .order("received_at", { ascending: false })
      .range(from, to);

    if (error) throw new Error(`Falha ao ler a fila: ${error.message}`);

    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    return { items: rows.map(toInboxItem), total: count ?? 0 };
  }
}
