import type { OrderRepository } from "../application/order-repository";
import { toOrderStatus, type Order, type OrderQuery } from "../domain/order";
import {
  pageToRange,
  startOfDayIso,
  startOfNextDayIso,
  type Page,
} from "@/shared/domain/paging";
import type { ElectronApi } from "@/shared/runtime/electron-api";
import { asBoolean, asNumber, asText, asIsoDate } from "@/shared/infrastructure/convert";

/** Lista fechada: a ordenação entra no SQL por concatenação, nunca vinda do usuário. */
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

export class PostgresOrderRepository implements OrderRepository {
  constructor(private readonly api: ElectronApi) {}

  async list(query: OrderQuery): Promise<Page<Order>> {
    const { from } = pageToRange(query.page, query.pageSize);
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.status !== "all") {
      params.push(query.status);
      conditions.push(`o.status = $${params.length}`);
    }
    if (query.onlyPendingSync) conditions.push("o.sync_close_pending = true");

    if (query.range.from) {
      params.push(startOfDayIso(query.range.from));
      conditions.push(`o.created_at >= $${params.length}`);
    }
    if (query.range.to) {
      params.push(startOfNextDayIso(query.range.to));
      conditions.push(`o.created_at < $${params.length}`);
    }

    const term = query.search.trim();
    if (term) {
      params.push(`%${term}%`);
      const p = params.length;
      conditions.push(
        `(o.barcode ILIKE $${p} OR o.table_name ILIKE $${p} OR o.customer_name ILIKE $${p})`,
      );
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const direction = query.sortDirection === "asc" ? "ASC" : "DESC";

    params.push(query.pageSize, from);
    const limitParam = params.length - 1;
    const offsetParam = params.length;

    const sql = `
      SELECT o.id, o.barcode, o.customer_name, o.table_name, o.status, o.totem_name,
             o.sync_close_pending, o.sync_close_attempts, o.sync_close_last_error,
             o.created_at, o.updated_at,
             COUNT(*) OVER () AS total
      FROM orders o
      ${where}
      ORDER BY o.${SORT_COLUMN[query.sortKey]} ${direction}
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const result = await this.api.query<Record<string, unknown>>(sql, params);
    if (!result.ok) throw new Error(`Falha ao listar comandas: ${result.error}`);

    const rows = result.rows;
    return {
      items: rows.map(toOrder),
      total: rows[0] ? asNumber(rows[0].total) : 0,
    };
  }
}
