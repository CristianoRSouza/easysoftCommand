import { useQuery } from "@tanstack/react-query";
import { useContainer } from "@/shared/container/container-context";
import type { DashboardSummary } from "../domain/dashboard-summary";

function Card({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl border border-base-border bg-base-raised p-5">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold">
        {value === null ? "—" : value.toLocaleString("pt-BR")}
      </p>
    </div>
  );
}

export function DashboardPage() {
  const { dashboard } = useContainer();
  const { data, isPending, error } = useQuery<DashboardSummary>({
    queryKey: ["dashboard-summary"],
    queryFn: () => dashboard.summary(),
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {error && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error instanceof Error ? error.message : "Não foi possível carregar os indicadores."}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card label="Produtos ativos" value={isPending ? null : (data?.activeProducts ?? null)} />
        <Card label="Comandas abertas" value={isPending ? null : (data?.openOrders ?? null)} />
        <Card label="Transações hoje" value={isPending ? null : (data?.todayTransactions ?? null)} />
      </div>
    </div>
  );
}
