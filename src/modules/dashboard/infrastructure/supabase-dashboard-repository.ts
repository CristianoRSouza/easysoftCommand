import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardRepository } from "../application/dashboard-repository";
import {
  DASHBOARD_DAYS,
  type DashboardSummary,
  type DayCount,
  type NfceAttention,
} from "../domain/dashboard-summary";
import { onlyReconcileFailed } from "@/modules/nfce/infrastructure/nfce-filters";
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

    const [nfceAttention, transactionsByDay] = await Promise.all([
      this.nfceAttention(),
      this.transactionsByDay(),
    ]);

    return {
      activeProducts: products.count ?? 0,
      openOrders: orders.count ?? 0,
      todayTransactions: transactions.count ?? 0,
      nfceAttention,
      transactionsByDay,
    };
  }

  /**
   * As três contagens de notas sem solução.
   *
   * Os filtros são os mesmos do projeto anterior. O de "reconciliação falhou"
   * vem do módulo de NFC-e, o mesmo que a lista usa ao abrir pelo link.
   */
  private async nfceAttention(): Promise<NfceAttention> {
    const notas = () =>
      this.client
        .from("vw_nfce_notes")
        .select("id", { count: "exact", head: true })
        .eq("store_id", this.tenant.storeId);

    const [manual, reconcile, unusable] = await Promise.all([
      notas().eq("status", "manual_review"),
      onlyReconcileFailed(notas()),
      notas().eq("status", "unusable"),
    ]);

    const falha = manual.error ?? reconcile.error ?? unusable.error;
    if (falha) throw new Error(`Falha ao contar as NFC-e pendentes: ${falha.message}`);

    return {
      manualReview: manual.count ?? 0,
      reconcileFailed: reconcile.count ?? 0,
      unusable: unusable.count ?? 0,
    };
  }

  /**
   * Transações por dia na última semana.
   *
   * Os dias sem venda entram com zero: um gráfico que pula o dia parado dá a
   * impressão de que a loja vendeu todos os dias.
   */
  private async transactionsByDay(): Promise<DayCount[]> {
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(inicio.getDate() - (DASHBOARD_DAYS - 1));

    const { data, error } = await this.client
      .from("vw_command_transactions")
      .select("created_at")
      .eq("store_id", this.tenant.storeId)
      .gte("created_at", inicio.toISOString());

    if (error) throw new Error(`Falha ao contar as transações da semana: ${error.message}`);

    const contagem = new Map<string, number>();
    for (let i = 0; i < DASHBOARD_DAYS; i += 1) {
      const dia = new Date(inicio);
      dia.setDate(dia.getDate() + i);
      contagem.set(ymd(dia), 0);
    }

    for (const linha of (data ?? []) as unknown as Record<string, unknown>[]) {
      const dia = ymd(new Date(String(linha.created_at)));
      if (contagem.has(dia)) contagem.set(dia, (contagem.get(dia) ?? 0) + 1);
    }

    return [...contagem.entries()].map(([day, count]) => ({
      day,
      label: `${day.slice(8, 10)}/${day.slice(5, 7)}`,
      count,
    }));
  }
}

/** O dia civil no fuso de quem olha — o "ontem" que o lojista reconhece. */
function ymd(date: Date): string {
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mes}-${dia}`;
}
