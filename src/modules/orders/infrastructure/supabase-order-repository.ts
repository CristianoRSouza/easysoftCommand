import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderRepository } from "../application/order-repository";
import { toOrderStatus, type Order, type OrderQuery } from "../domain/order";
import {
  pageToRange,
  startOfDayIso,
  startOfNextDayIso,
  type Page,
} from "@/shared/domain/paging";
import type { Tenant } from "@/shared/tenant/tenant";
import { asBoolean, asNumber, asText, asIsoDate } from "@/shared/infrastructure/convert";

const COLUMNS =
  "id, barcode, customer_name, table_name, status, totem_name, sync_close_pending, sync_close_attempts, sync_close_last_error, created_at, updated_at";

const SORT_COLUMN: Record<OrderQuery["sortKey"], string> = {
  createdAt: "created_at",
  tableName: "table_name",
  status: "status",
};

function toOrder(row: Record<string, unknown>): Order {
  return {
    id: asText(row.id) ?? "",
    barcode: asText(row.barcode) ?? "",
    customerName: asText(row.customer_name),
    tableName: asText(row.table_name) ?? "",
    status: toOrderStatus(row.status),
    totemName: asText(row.totem_name),
    syncClosePending: asBoolean(row.sync_close_pending),
    syncCloseAttempts: asNumber(row.sync_close_attempts),
    syncCloseLastError: asText(row.sync_close_last_error),
    createdAt: asIsoDate(row.created_at),
    updatedAt: asIsoDate(row.updated_at),
  };
}

export class SupabaseOrderRepository implements OrderRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  async list(query: OrderQuery): Promise<Page<Order>> {
    const { from, to } = pageToRange(query.page, query.pageSize);

    let request = this.client
      .from("vw_command_orders")
      .select(COLUMNS, { count: "exact" })
      .eq("store_id", this.tenant.storeId);

    if (query.status !== "all") request = request.eq("status", query.status);
    if (query.onlyPendingSync) request = request.eq("sync_close_pending", true);
    if (query.range.from) request = request.gte("created_at", startOfDayIso(query.range.from));
    if (query.range.to) request = request.lt("created_at", startOfNextDayIso(query.range.to));

    const term = query.search.trim();
    if (term) {
      const safe = term.replace(/[%,()]/g, " ");
      request = request.or(
        `barcode.ilike.%${safe}%,table_name.ilike.%${safe}%,customer_name.ilike.%${safe}%`,
      );
    }

    const { data, error, count } = await request
      .order(SORT_COLUMN[query.sortKey], { ascending: query.sortDirection === "asc" })
      .range(from, to);

    if (error) throw new Error(`Falha ao listar comandas: ${error.message}`);

    return {
      items: ((data ?? []) as unknown as Record<string, unknown>[]).map(toOrder),
      total: count ?? 0,
    };
  }
}
