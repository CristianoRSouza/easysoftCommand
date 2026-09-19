import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import {
  backlogMinutes,
  DEFAULT_SYNC_QUERY,
  INBOX_STATUS_LABEL,
  type InboxItem,
  type InboxSummary,
  type SyncQuery,
} from "../domain/sync-activity";
import {
  groupByCategory,
  parseSyncError,
  SYNC_ERROR_HINT,
  SYNC_ERROR_LABEL,
} from "../domain/sync-error";
import { useContainer } from "@/shared/container/container-context";
import { lastPageOf, type Page } from "@/shared/domain/paging";
import { formatDateTime } from "@/shared/ui/format";
import {
  Badge,
  Empty,
  ErrorNotice,
  FIELD,
  Loading,
  PageHeader,
  Pagination,
  Panel,
} from "@/shared/ui/primitives";

const STATUS_TONE = {
  applied: "success",
  pending: "info",
  failed: "destructive",
} as const;

/** Atraso a partir do qual a fila deixa de ser "andando devagar". */
const ATRASO_PREOCUPANTE_MINUTOS = 30;

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warning" | "danger" }) {
  return (
    <Panel className={`p-5 ${tone === "danger" ? "border-destructive/40" : tone === "warning" ? "border-warning/40" : ""}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`mt-2 font-heading text-3xl font-bold ${tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning" : ""}`}
      >
        {value}
      </p>
    </Panel>
  );
}

/**
 * O erro, traduzido — com o texto original a um clique.
 *
 * A causa em português resolve a maioria dos casos; a mensagem crua continua
 * disponível porque é dela que o desenvolvedor precisa quando a categoria não
 * basta.
 */
function ErroDaFila({ erro }: { erro: string | null }) {
  const analisado = parseSyncError(erro);
  if (!analisado) return <>—</>;

  const detalhes = [analisado.table, analisado.column, analisado.constraint].filter(Boolean);

  return (
    <details>
      <summary className="cursor-pointer text-destructive">
        {SYNC_ERROR_LABEL[analisado.category]}
        {detalhes.length > 0 && (
          <span className="ml-1 font-mono text-muted-foreground">({detalhes.join(" · ")})</span>
        )}
      </summary>
      <p className="mt-1 max-w-xl whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">
        {analisado.raw}
      </p>
    </details>
  );
}

export function CloudQueuePage() {
  const { sync } = useContainer();
  const [query, setQuery] = useState<SyncQuery>(DEFAULT_SYNC_QUERY);

  const resumo = useQuery<InboxSummary>({
    queryKey: ["inbox", "resumo"],
    queryFn: () => sync.inboxSummary(),
    refetchInterval: 60_000,
  });

  const itens = useQuery<Page<InboxItem>>({
    queryKey: ["inbox", "itens", query],
    queryFn: () => sync.inbox(query),
    placeholderData: (previous) => previous,
  });

  const patch = (next: Partial<SyncQuery>) => setQuery((c) => ({ ...c, ...next }));
  const porCategoria = groupByCategory((itens.data?.items ?? []).map((item) => item.lastError));
  const total = itens.data?.total ?? 0;
  const s = resumo.data;
  const atraso = s ? backlogMinutes(s) : null;

  return (
    <div className="space-y-5">
      <PageHeader title="Fila da nuvem" count={total} unit={["item", "itens"]} />

      <p className="text-sm text-muted-foreground">
        O PDV publica as mudanças e a nuvem as aplica. Item preso na fila é dado que já existe na
        loja e ainda não existe aqui.
      </p>

      {resumo.error && <ErrorNotice error={resumo.error} fallback="Não foi possível ler a fila." />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Aplicados" value={resumo.isPending ? "—" : (s?.applied ?? 0).toLocaleString("pt-BR")} />
        <Stat
          label="Na fila"
          value={resumo.isPending ? "—" : (s?.pending ?? 0).toLocaleString("pt-BR")}
          tone={(s?.pending ?? 0) > 0 ? "warning" : undefined}
        />
        <Stat
          label="Falharam"
          value={resumo.isPending ? "—" : (s?.failed ?? 0).toLocaleString("pt-BR")}
          tone={(s?.failed ?? 0) > 0 ? "danger" : undefined}
        />
        <Stat
          label="Atraso da fila"
          value={resumo.isPending ? "—" : atraso == null ? "—" : `${atraso} min`}
          tone={atraso != null && atraso > ATRASO_PREOCUPANTE_MINUTOS ? "danger" : undefined}
        />
      </div>

      {atraso != null && atraso > ATRASO_PREOCUPANTE_MINUTOS && (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          <span>
            O item mais antigo está esperando há {atraso} minutos. O painel está mostrando dados
            mais velhos que isso.
          </span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={query.status}
          onChange={(e) => patch({ status: e.target.value as SyncQuery["status"], page: 1 })}
          className={FIELD}
        >
          <option value="all">Todos</option>
          <option value="error">Só os que falharam</option>
        </select>
        <input
          type="date"
          value={query.range.from ?? ""}
          onChange={(e) => patch({ range: { ...query.range, from: e.target.value || null }, page: 1 })}
          className={FIELD}
        />
        <input
          type="date"
          value={query.range.to ?? ""}
          onChange={(e) => patch({ range: { ...query.range, to: e.target.value || null }, page: 1 })}
          className={FIELD}
        />
      </div>

      {/* O erro cru do PostgreSQL é preciso e ilegível. Agrupá-lo por causa
          responde a pergunta que o operador tem — é dado faltando, duplicado
          ou permissão? — sem precisar mandar a mensagem para alguém traduzir. */}
      {porCategoria.length > 0 && (
        <Panel className="p-5">
          <h2 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Por que falharam
          </h2>
          <ul className="space-y-2">
            {porCategoria.map((grupo) => (
              <li key={grupo.category} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                <span className="font-medium">{SYNC_ERROR_LABEL[grupo.category]}</span>
                <span className="tabular-nums text-muted-foreground">{grupo.count}</span>
                <span className="w-full text-xs text-muted-foreground sm:w-auto sm:flex-1">
                  {SYNC_ERROR_HINT[grupo.category]}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {itens.error && <ErrorNotice error={itens.error} fallback="Não foi possível ler a fila." />}

      {itens.isPending ? (
        <Loading label="Carregando a fila..." />
      ) : (itens.data?.items.length ?? 0) === 0 ? (
        <Empty label="Nenhum item na fila com os filtros atuais." />
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Recebido</th>
                <th className="px-4 py-3 text-left font-medium">Entidade</th>
                <th className="px-4 py-3 text-left font-medium">Operação</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Tentativas</th>
                <th className="px-4 py-3 text-left font-medium">Erro</th>
              </tr>
            </thead>
            <tbody>
              {itens.data?.items.map((item) => (
                <tr
                  key={item.id}
                  className={`border-t border-border/40 ${item.applyStatus === "failed" ? "bg-destructive/5" : ""}`}
                >
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {formatDateTime(item.receivedAt)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{item.entity || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.operation ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[item.applyStatus]}>
                      {INBOX_STATUS_LABEL[item.applyStatus]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{item.retryCount}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <ErroDaFila erro={item.lastError} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <Pagination
        page={query.page}
        lastPage={lastPageOf(total, query.pageSize)}
        onChange={(page) => patch({ page })}
      />
    </div>
  );
}
