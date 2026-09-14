import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { paymentMethodLabel } from "@/modules/transactions/domain/transaction";
import type { RevenueReport } from "../domain/revenue";
import { useContainer } from "@/shared/container/container-context";
import type { DateRange } from "@/shared/domain/paging";
import { formatCurrency } from "@/shared/ui/format";
import { Empty, ErrorNotice, FIELD, Loading, PageHeader, Panel } from "@/shared/ui/primitives";

/** Últimos 30 dias, em `AAAA-MM-DD`. */
function defaultRange(): DateRange {
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - 29);
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: ymd(inicio), to: ymd(hoje) };
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Panel className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-heading text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Panel>
  );
}

export function RevenuePage() {
  const { revenue } = useContainer();
  const [range, setRange] = useState<DateRange>(defaultRange);

  const { data, isPending, error } = useQuery<RevenueReport>({
    queryKey: ["revenue", range],
    queryFn: () => revenue.report(range),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Receitas" />

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted-foreground">De</label>
        <input
          type="date"
          value={range.from ?? ""}
          onChange={(e) => setRange((r) => ({ ...r, from: e.target.value || null }))}
          className={FIELD}
        />
        <label className="text-sm text-muted-foreground">até</label>
        <input
          type="date"
          value={range.to ?? ""}
          onChange={(e) => setRange((r) => ({ ...r, to: e.target.value || null }))}
          className={FIELD}
        />
      </div>

      {error && <ErrorNotice error={error} fallback="Não foi possível somar a receita." />}

      {isPending ? (
        <Loading label="Somando o período..." />
      ) : !data || data.total.count === 0 ? (
        <Empty label="Nenhuma transação aprovada no período." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Receita aprovada"
              value={formatCurrency(data.total.amount)}
              hint="Só transações aprovadas"
            />
            <Stat label="Transações" value={data.total.count.toLocaleString("pt-BR")} />
            <Stat label="Ticket médio" value={formatCurrency(data.averageTicket)} />
            <Stat
              label="NFC-e autorizadas"
              value={data.authorizedNotes.toLocaleString("pt-BR")}
              hint={
                data.authorizedNotes < data.total.count
                  ? `${data.total.count - data.authorizedNotes} transações sem nota`
                  : "Uma nota por transação"
              }
            />
          </div>

          <Panel className="p-5">
            <h2 className="mb-4 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Por meio de pagamento
            </h2>
            <div className="space-y-3">
              {data.byMethod.map((entry) => (
                <div key={entry.method}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span>{paymentMethodLabel(entry.method)}</span>
                    <span className="tabular-nums">
                      {formatCurrency(entry.amount)}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {entry.count} {entry.count === 1 ? "transação" : "transações"} ·{" "}
                        {(entry.share * 100).toFixed(1)}%
                      </span>
                    </span>
                  </div>
                  {/* Barra proporcional: a fatia já vem calculada do domínio,
                      para o número e o desenho nunca discordarem. */}
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-primary"
                      style={{ width: `${Math.max(entry.share * 100, 1)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
