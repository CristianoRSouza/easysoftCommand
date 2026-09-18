import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderRepository } from "../application/order-repository";
import { toOrderStatus, type Order, type OrderQuery } from "../domain/order";
import type {
  OrderClosing,
  OrderDetail,
  OrderItem,
  OrderPayment,
} from "../domain/order-detail";
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

const DETAIL_COLUMNS = [
  COLUMNS,
  "sync_close_requested_at, sync_closed_to_fb_at, fb_sale_id, fb_cash_register_id",
].join(", ");

function toOrderItem(row: Record<string, unknown>): OrderItem {
  return {
    id: asText(row.id) ?? "",
    productName: asText(row.product_name) ?? "Produto sem nome",
    barcode: asText(row.product_barcode),
    unitName: asText(row.unit_name),
    quantity: asNumber(row.quantity),
    unitPrice: asNumber(row.unit_price),
    subtotal: asNumber(row.subtotal),
    origin: asText(row.origin),
    status: asText(row.status),
    syncedToFirebird: row.synced_to_fb === true,
    firebirdId: asText(row.fb_id),
  };
}

function toPayment(row: Record<string, unknown>): OrderPayment {
  return {
    id: asText(row.id) ?? "",
    method: asText(row.payment_method) ?? "",
    amount: asNumber(row.amount),
    status: asText(row.status) ?? "",
    createdAt: asIsoDate(row.created_at),
  };
}

function toClosing(row: Record<string, unknown>): OrderClosing {
  return {
    pending: row.sync_close_pending === true,
    attempts: asNumber(row.sync_close_attempts),
    lastError: asText(row.sync_close_last_error),
    requestedAt:
      row.sync_close_requested_at == null ? null : asIsoDate(row.sync_close_requested_at),
    closedAt: row.sync_closed_to_fb_at == null ? null : asIsoDate(row.sync_closed_to_fb_at),
    firebirdSaleId: asText(row.fb_sale_id),
    firebirdCashRegisterId: asText(row.fb_cash_register_id),
  };
}

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
  /**
   * Itens, pagamentos e fechamento de uma comanda.
   *
   * A comanda vem com filtro de loja; se não é desta loja, nada mais é lido.
   * Os pagamentos são encontrados por `order_ids`, que é uma lista — uma
   * transação pode fechar várias comandas de uma vez.
   */
  async detail(orderId: string): Promise<OrderDetail | null> {
    const { data: orderRow, error } = await this.client
      .from("vw_command_orders")
      .select(DETAIL_COLUMNS)
      .eq("store_id", this.tenant.storeId)
      .eq("id", orderId)
      .maybeSingle();

    if (error) throw new Error(`Falha ao carregar a comanda: ${error.message}`);
    if (!orderRow) return null;

    const [itens, pagamentos] = await Promise.all([
      this.client
        .from("vw_command_order_items")
        .select(
          "id, product_name, product_barcode, unit_name, quantity, unit_price, subtotal, origin, status, synced_to_fb, fb_id, created_at",
        )
        .eq("order_id", orderId)
        .order("created_at", { ascending: true }),
      this.client
        .from("vw_command_transactions")
        .select("id, payment_method, amount, status, created_at")
        .eq("store_id", this.tenant.storeId)
        .contains("order_ids", [orderId])
        .order("created_at", { ascending: true }),
    ]);

    if (itens.error) throw new Error(`Falha ao ler os itens: ${itens.error.message}`);
    if (pagamentos.error)
      throw new Error(`Falha ao ler os pagamentos: ${pagamentos.error.message}`);

    const row = orderRow as unknown as Record<string, unknown>;

    return {
      order: toOrder(row),
      items: ((itens.data ?? []) as unknown as Record<string, unknown>[]).map(toOrderItem),
      payments: ((pagamentos.data ?? []) as unknown as Record<string, unknown>[]).map(toPayment),
      closing: toClosing(row),
    };
  }
}
