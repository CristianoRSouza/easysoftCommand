import type { DashboardRepository } from "../application/dashboard-repository";
import type { DashboardSummary } from "../domain/dashboard-summary";
import type { ElectronApi } from "@/shared/runtime/electron-api";

interface CountRow {
  active_products: string | number;
  open_orders: string | number;
  today_transactions: string | number;
}

function toNumber(value: string | number | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Uma consulta só: três subconsultas de contagem numa ida ao banco. */
const SUMMARY_SQL = `
  SELECT
    (SELECT COUNT(*) FROM products WHERE is_active = true) AS active_products,
    (SELECT COUNT(*) FROM orders WHERE status = 'open') AS open_orders,
    (SELECT COUNT(*) FROM transactions WHERE created_at >= CURRENT_DATE) AS today_transactions
`;

export class PostgresDashboardRepository implements DashboardRepository {
  constructor(private readonly api: ElectronApi) {}

  async summary(): Promise<DashboardSummary> {
    const result = await this.api.query<CountRow>(SUMMARY_SQL);
    if (!result.ok) throw new Error(`Falha ao carregar indicadores: ${result.error}`);

    const row = result.rows[0];
    return {
      activeProducts: toNumber(row?.active_products),
      openOrders: toNumber(row?.open_orders),
      todayTransactions: toNumber(row?.today_transactions),
    };
  }
}
