import { useQuery } from "@tanstack/react-query";
import { useContainer } from "@/shared/container/container-context";
import type { DashboardSummary } from "../domain/dashboard-summary";
import { ErrorNotice, PageHeader, StatCard } from "@/shared/ui/primitives";

export function DashboardPage() {
  const { dashboard } = useContainer();
  const { data, isPending, error } = useQuery<DashboardSummary>({
    queryKey: ["dashboard-summary"],
    queryFn: () => dashboard.summary(),
  });

  const valor = (n: number | undefined) => (isPending ? null : (n ?? null));

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" />

      {error && <ErrorNotice error={error} fallback="Não foi possível carregar os indicadores." />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Produtos ativos" value={valor(data?.activeProducts)} />
        <StatCard label="Comandas abertas" value={valor(data?.openOrders)} />
        <StatCard label="Transações hoje" value={valor(data?.todayTransactions)} />
      </div>
    </div>
  );
}
