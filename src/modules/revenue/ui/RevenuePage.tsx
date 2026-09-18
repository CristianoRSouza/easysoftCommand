import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import {
  METHOD_LABEL,
  type RevenueMethod,
  type RevenueReport,
  type RevenueTransaction,
} from "../domain/revenue";
import { csvFileName, toCsv } from "../domain/revenue-csv";
import { METHOD_COLOR } from "./charts";
import { useContainer } from "@/shared/container/container-context";
import { presetRange } from "@/shared/domain/date-presets";
import type { DateRange } from "@/shared/domain/paging";
import { PlanWindowNotice, useOutsidePlanWindow } from "@/shared/plan/PlanWindowNotice";
import { DatePresets } from "@/shared/ui/DatePresets";
import { formatCurrency, formatDateTime } from "@/shared/ui/format";
import { Empty, ErrorNotice, FIELD, Loading, PageHeader, Panel } from "@/shared/ui/primitives";

// Os gráficos vêm de uma biblioteca grande, e a maior parte das visitas ao
// painel não passa por esta tela. Carregá-los só quando ela abre mantém a
// abertura do sistema leve.
const RevenueCharts = lazy(() => import("./RevenueCharts"));

/** Quantas transações a lista mostra por vez. */
const PAGINA = 50;

function Stat({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: string;
}) {
  return (
    <Panel className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-heading text-2xl font-bold" style={color ? { color } : undefined}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Panel>
  );
}

function baixarCsv(transactions: RevenueTransaction[], range: DateRange) {
  const blob = new Blob([toCsv(transactions)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = csvFileName(range.from, range.to);
  link.click();
  URL.revokeObjectURL(url);
}

export function RevenuePage() {
  const { revenue } = useContainer();
  const [range, setRange] = useState<DateRange>(() => presetRange("30d"));
  const [visiveis, setVisiveis] = useState(PAGINA);

  const foraDoPlano = useOutsidePlanWindow(range);

  const { data, isPending, error } = useQuery<RevenueReport>({
    queryKey: ["revenue", range],
    queryFn: () => revenue.report(range),
    enabled: !foraDoPlano,
  });

  function trocarPeriodo(novo: DateRange) {
    setRange(novo);
    setVisiveis(PAGINA);
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Receitas" />

      <div className="flex flex-wrap items-center gap-3">
        <DatePresets range={range} onChange={trocarPeriodo} />

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">De</label>
          <input
            type="date"
            value={range.from ?? ""}
            onChange={(e) => trocarPeriodo({ ...range, from: e.target.value || null })}
            className={FIELD}
          />
          <label className="text-sm text-muted-foreground">até</label>
          <input
            type="date"
            value={range.to ?? ""}
            onChange={(e) => trocarPeriodo({ ...range, to: e.target.value || null })}
            className={FIELD}
          />
        </div>
      </div>

      {error && <ErrorNotice error={error} fallback="Não foi possível somar a receita." />}

      {foraDoPlano ? (
        <PlanWindowNotice range={range} subject="receitas" onAdjust={trocarPeriodo} />
      ) : isPending ? (
        <Loading label="Somando o período..." />
      ) : !data || data.total.count === 0 ? (
        <Empty label="Nenhuma transação aprovada no período." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Receita aprovada"
              value={formatCurrency(data.total.amount)}
              hint={`${data.total.count.toLocaleString("pt-BR")} transações · dinheiro não entra aqui`}
            />
            {data.byMethod.map((entry) => (
              <Stat
                key={entry.method}
                label={METHOD_LABEL[entry.method]}
                value={formatCurrency(entry.amount)}
                hint={`${(entry.share * 100).toFixed(1)}% da receita · ${entry.count} venda(s)`}
                color={METHOD_COLOR[entry.method as RevenueMethod]}
              />
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Stat label="Ticket médio" value={formatCurrency(data.averageTicket)} />
            <Stat
              label="NFC-e emitidas"
              value={data.authorizedNotes.toLocaleString("pt-BR")}
              hint={
                data.authorizedNotes < data.total.count
                  ? `${data.total.count - data.authorizedNotes} transações sem nota`
                  : "Vinculadas às transações do período"
              }
            />
          </div>

          <Suspense fallback={<Loading label="Carregando os gráficos..." />}>
            <RevenueCharts report={data} />
          </Suspense>

          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Transações aprovadas no período
              </h2>
              <button
                onClick={() => baixarCsv(data.transactions, range)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
              >
                <Download size={14} />
                Exportar CSV
              </button>
            </div>

            <table className="w-full text-sm">
              <thead className="border-y border-border/60 text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Data e hora</th>
                  <th className="px-5 py-3 text-left font-medium">Forma de pagamento</th>
                  <th className="px-5 py-3 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.slice(0, visiveis).map((tx) => (
                  <tr key={tx.id} className="border-t border-border/40">
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">
                      {formatDateTime(tx.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: METHOD_COLOR[tx.method] }}
                        />
                        {METHOD_LABEL[tx.method]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {visiveis < data.transactions.length && (
              <div className="border-t border-border/40 px-5 py-4 text-center">
                <button
                  onClick={() => setVisiveis((atual) => atual + PAGINA)}
                  className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-secondary"
                >
                  Carregar mais ({data.transactions.length - visiveis} restantes)
                </button>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
