import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { useContainer } from "@/shared/container/container-context";
import {
  totalNeedingAttention,
  type DashboardSummary,
  type NfceAttention,
} from "../domain/dashboard-summary";
import { ErrorNotice, PageHeader, Panel, StatCard } from "@/shared/ui/primitives";

/**
 * As três situações de NFC-e sem solução, com o filtro que cada uma abre.
 *
 * Clicar leva à consulta já filtrada: quem vê "8 notas exigem atenção" quer
 * saber quais são, e pedir que refaça o filtro à mão é trabalho repetido.
 */
const ATENCAO: {
  key: keyof NfceAttention;
  label: string;
  link: string;
  hint: string;
}[] = [
  {
    key: "manualReview",
    label: "Correção manual",
    link: "/nfce?status=manual_review",
    hint: "Rejeitadas pela SEFAZ; a correção é feita na loja",
  },
  {
    key: "reconcileFailed",
    label: "Reconciliação falhou",
    link: "/nfce?reconciliacao=falhou",
    hint: "Emitidas, mas a conferência com a venda não fechou",
  },
  {
    key: "unusable",
    label: "Contingência pendente",
    link: "/nfce?status=unusable",
    hint: "Emitidas em contingência e ainda não transmitidas",
  },
];

/** Barra proporcional simples — a maior das três define a largura cheia. */
function Barra({ valor, maximo }: { valor: number; maximo: number }) {
  const largura = maximo > 0 ? Math.max((valor / maximo) * 100, valor > 0 ? 4 : 0) : 0;
  return (
    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
      <div className="h-full rounded-full bg-warning" style={{ width: `${largura}%` }} />
    </div>
  );
}

export function DashboardPage() {
  const { dashboard } = useContainer();
  const navigate = useNavigate();

  const { data, isPending, error } = useQuery<DashboardSummary>({
    queryKey: ["dashboard-summary"],
    queryFn: () => dashboard.summary(),
  });

  const valor = (n: number | undefined) => (isPending ? null : (n ?? null));
  const atencao = data?.nfceAttention;
  const total = atencao ? totalNeedingAttention(atencao) : 0;
  const maiorDia = Math.max(1, ...(data?.transactionsByDay ?? []).map((d) => d.count));

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" />

      {error && <ErrorNotice error={error} fallback="Não foi possível carregar os indicadores." />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Produtos ativos" value={valor(data?.activeProducts)} />
        <StatCard label="Comandas abertas" value={valor(data?.openOrders)} />
        <StatCard label="Transações hoje" value={valor(data?.todayTransactions)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className={`p-5 ${total > 0 ? "border-warning/40" : ""}`}>
          <h2 className="flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <TriangleAlert size={15} className={total > 0 ? "text-warning" : ""} />
            NFC-e sem solução
          </h2>

          {isPending ? (
            <p className="mt-4 text-sm text-muted-foreground">Contando...</p>
          ) : total === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Nenhuma nota pendente de ação no momento.
            </p>
          ) : (
            <>
              <p className="mt-3 text-sm">
                <span className="font-semibold">{total}</span>{" "}
                {total === 1 ? "nota exige" : "notas exigem"} atenção.
              </p>
              <div className="mt-4 space-y-3">
                {ATENCAO.map((item) => {
                  const quantidade = atencao?.[item.key] ?? 0;
                  return (
                    <button
                      key={item.key}
                      onClick={() => navigate(item.link)}
                      className="block w-full text-left"
                      title={`${item.hint} — clique para ver a lista`}
                    >
                      <span className="flex items-baseline justify-between text-sm">
                        <span>{item.label}</span>
                        <span className="tabular-nums">{quantidade}</span>
                      </span>
                      <Barra valor={quantidade} maximo={total} />
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </Panel>

        <Panel className="p-5">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Transações (7 dias)
          </h2>

          {isPending ? (
            <p className="mt-4 text-sm text-muted-foreground">Contando...</p>
          ) : (
            <div className="mt-5 flex h-40 items-end gap-2">
              {(data?.transactionsByDay ?? []).map((dia) => (
                <div key={dia.day} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-xs tabular-nums text-muted-foreground">{dia.count}</span>
                  <div
                    className="w-full rounded-t bg-gradient-primary"
                    style={{ height: `${Math.max((dia.count / maiorDia) * 100, 2)}%` }}
                    title={`${dia.count} transações em ${dia.label}`}
                  />
                  <span className="text-xs text-muted-foreground">{dia.label}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Batimentos dos serviços e erros de sincronização não aparecem aqui, e
          não é omissão: as tabelas que os alimentam existem só no PostgreSQL da
          loja. O projeto anterior esconde esses blocos na nuvem pelo mesmo
          motivo — e, quando não escondia, mostrava zero fixo escrito no código,
          que parecia medição e não era. */}
      <p className="text-xs text-muted-foreground">
        O estado dos serviços da loja (sincronização, TEF, PIX) é medido no servidor dela e não
        chega até aqui. A fila da nuvem mostra o que já chegou.
      </p>
    </div>
  );
}
