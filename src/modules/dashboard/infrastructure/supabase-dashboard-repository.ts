import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardRepository } from "../application/dashboard-repository";
import type { DashboardSummary } from "../domain/dashboard-summary";
import type { Tenant } from "@/shared/tenant/tenant";

function startOfToday(): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

/** Três contagens em paralelo, todas restritas à loja selecionada. */
export class SupabaseDashboardRepository implements DashboardRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  async summary(): Promise<DashboardSummary> {
    const { storeId } = this.tenant;

    const [products, orders, transactions] = await Promise.all([
      this.client
        .from("pv_products")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("is_active", true),
      this.client
        .from("vw_command_orders")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("status", "open"),
      this.client
        .from("vw_command_transactions")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .gte("created_at", startOfToday()),
    ]);

    const failure = products.error ?? orders.error ?? transactions.error;
    if (failure) throw new Error(`Falha ao carregar indicadores: ${failure.message}`);

    return {
      activeProducts: products.count ?? 0,
      openOrders: orders.count ?? 0,
      todayTransactions: transactions.count ?? 0,
    };
  }
}
