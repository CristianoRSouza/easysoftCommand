import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  DEFAULT_NFCE_QUERY,
  NFCE_STATUS_LABEL,
  NFCE_STATUS_TONE,
  needsAttention,
  type NfceNote,
  type NfceQuery,
  type NfceStatus,
  type NfceStatusFilter,
  type NfceTotals,
} from "../domain/nfce-note";
import { exportNfceXml } from "../application/export-nfce-xml";
import { useContainer } from "@/shared/container/container-context";
import { lastPageOf, type Page } from "@/shared/domain/paging";
import { PlanWindowNotice, useOutsidePlanWindow } from "@/shared/plan/PlanWindowNotice";
import { DatePresets } from "@/shared/ui/DatePresets";
import { formatCurrency, formatDateTime } from "@/shared/ui/format";
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

const STATUS_OPTIONS: NfceStatus[] = [
  "authorized",
  "rejected",
  "denied",
  "manual_review",
  "unusable",
  "cancelled",
  "sending",
  "draft",
  "inutilized",
];

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "warning";
}) {
  return (
    <Panel className={`p-5 ${tone === "warning" ? "border-warning/40" : ""}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`mt-2 font-heading text-2xl font-bold ${tone === "warning" ? "text-warning" : ""}`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Panel>
  );
}

export function NfcePage() {
  const { nfce } = useContainer();
  const navigate = useNavigate();
  // O Dashboard aponta para cá já filtrado; sem isto, o número clicado abriria
  // a lista inteira e a pessoa teria de refazer o filtro à mão.
  const [parametros] = useSearchParams();
  const [exportadas, setExportadas] = useState(0);
  const [query, setQuery] = useState<NfceQuery>(() => ({
    ...DEFAULT_NFCE_QUERY,
    status: (parametros.get("status") as NfceStatusFilter | null) ?? DEFAULT_NFCE_QUERY.status,
    reconcileFailed: parametros.get("reconciliacao") === "falhou",
  }));

  // Período além do plano não é consultado: o aviso substitui o resultado.
  const foraDoPlano = useOutsidePlanWindow(query.range);

  const lista = useQuery<Page<NfceNote>>({
    queryKey: ["nfce", "lista", query],
    queryFn: () => nfce.list(query),
    enabled: !foraDoPlano,
    placeholderData: (previous) => previous,
  });

  // Os cartões somam o PERÍODO inteiro, não as linhas desta página. Somar o que
  // está na tela e chamar de total do período é um número que parece certo e
  // está errado — foi um bug real no projeto anterior.
  const totais = useQuery<NfceTotals>({
    queryKey: ["nfce", "totais", query.status, query.reconcileFailed, query.range, query.search],
    queryFn: () => nfce.totals(query),
    enabled: !foraDoPlano,
  });

  const patch = (next: Partial<NfceQuery>) =>
    setQuery((current) => ({ ...current, ...next }));

  const exportacao = useMutation({
    mutationFn: () => exportNfceXml(nfce)(query, setExportadas),
    onSuccess: ({ blob, fileName }) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    },
    onSettled: () => setExportadas(0),
  });

  const total = lista.data?.total ?? 0;
  const t = totais.data;
  const emAtencao = t
    ? (t.byStatus.rejected ?? 0) + (t.byStatus.denied ?? 0) + (t.byStatus.manual_review ?? 0)
    : 0;

  return (
    <div className="space-y-5">
      <PageHeader title="NFC-e" count={total} unit={["nota", "notas"]} />

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          onClick={() => exportacao.mutate()}
          disabled={exportacao.isPending || foraDoPlano || total === 0}
          title="Baixa os XML de todas as notas do filtro, não só as desta página"
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-secondary disabled:opacity-50"
        >
          <Download size={14} />
          {exportacao.isPending
            ? `Montando o pacote... (${exportadas} notas)`
            : "Baixar XML (.zip)"}
        </button>
      </div>

      {exportacao.error && (
        <ErrorNotice error={exportacao.error} fallback="Não foi possível montar o pacote." />
      )}

      {exportacao.data && exportacao.data.stats.inStorage.length > 0 && (
        <p className="text-sm text-warning">
          {exportacao.data.stats.inStorage.length} nota(s) têm o XML guardado no armazenamento de
          arquivos da nuvem, que este painel não tem permissão de ler — por isso ficaram fora do
          pacote. Não é falta de documento: é preciso liberar esse acesso no servidor.
        </p>
      )}

      {exportacao.data && exportacao.data.stats.withoutXml.length > 0 && (
        <p className="text-sm text-warning">
          {exportacao.data.stats.withoutXml.length} nota(s) do filtro não têm XML e ficaram de fora.
          O arquivo _RESUMO.txt dentro do pacote lista quais.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Notas no período"
          value={totais.isPending ? "—" : (t?.count ?? 0).toLocaleString("pt-BR")}
        />
        <SummaryCard
          label="Autorizadas"
          value={totais.isPending ? "—" : (t?.byStatus.authorized ?? 0).toLocaleString("pt-BR")}
        />
        <SummaryCard
          label="Valor autorizado"
          value={totais.isPending ? "—" : formatCurrency(t?.authorizedAmount ?? 0)}
          hint="Soma do período, não da página"
        />
        <SummaryCard
          label="Sem solução"
          value={totais.isPending ? "—" : emAtencao.toLocaleString("pt-BR")}
          hint="Rejeitadas, denegadas ou em revisão"
          tone={emAtencao > 0 ? "warning" : undefined}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query.search}
            onChange={(e) => patch({ search: e.target.value, page: 1 })}
            placeholder="Buscar por chave, protocolo ou número..."
            className={`${FIELD} w-full pl-9`}
          />
        </div>

        <select
          value={query.status}
          onChange={(e) => patch({ status: e.target.value as NfceStatusFilter, page: 1 })}
          className={FIELD}
        >
          <option value="all">Todos os status</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {NFCE_STATUS_LABEL[status]}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={query.reconcileFailed}
            onChange={(e) => patch({ reconcileFailed: e.target.checked, page: 1 })}
            className="accent-primary"
          />
          Só reconciliação falhou
        </label>

        <DatePresets range={query.range} onChange={(range) => patch({ range, page: 1 })} />

        <input
          type="date"
          value={query.range.from ?? ""}
          onChange={(e) =>
            patch({ range: { ...query.range, from: e.target.value || null }, page: 1 })
          }
          className={FIELD}
        />
        <input
          type="date"
          value={query.range.to ?? ""}
          onChange={(e) => patch({ range: { ...query.range, to: e.target.value || null }, page: 1 })}
          className={FIELD}
        />
      </div>

      {lista.error && (
        <ErrorNotice error={lista.error} fallback="Não foi possível carregar as notas." />
      )}
      {totais.error && (
        <ErrorNotice error={totais.error} fallback="Não foi possível somar o período." />
      )}

      {foraDoPlano ? (
        <PlanWindowNotice
          range={query.range}
          subject="NFC-e"
          onAdjust={(range) => patch({ range, page: 1 })}
        />
      ) : lista.isPending ? (
        <Loading label="Carregando notas..." />
      ) : (lista.data?.items.length ?? 0) === 0 ? (
        <Empty label="Nenhuma nota encontrada com os filtros atuais." />
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-right font-medium">Número</th>
                <th className="px-4 py-3 text-right font-medium">Série</th>
                <th className="px-4 py-3 text-left font-medium">Emissão</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Chave de acesso</th>
                <th className="px-4 py-3 text-left font-medium">Retorno SEFAZ</th>
              </tr>
            </thead>
            <tbody>
              {lista.data?.items.map((note) => (
                <tr
                  key={note.id}
                  onClick={() => navigate(`/nfce/${note.id}`)}
                  className={`cursor-pointer border-t border-border/40 transition-colors hover:bg-secondary/40 ${
                    needsAttention(note.status) ? "bg-warning/5" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-right tabular-nums">{note.number || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {note.serie || "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {formatDateTime(note.issuedAt)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCurrency(note.totalValue)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={NFCE_STATUS_TONE[note.status]}>
                      {NFCE_STATUS_LABEL[note.status]}
                    </Badge>
                    {note.retryCount > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {note.retryCount} tentativa{note.retryCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {note.accessKey ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {note.sefazStatusCode ? (
                      <>
                        <span className="font-mono">{note.sefazStatusCode}</span>
                        {note.sefazStatusReason && ` · ${note.sefazStatusReason}`}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {!foraDoPlano && (
        <Pagination
          page={query.page}
          lastPage={lastPageOf(total, query.pageSize)}
          onChange={(page) => patch({ page })}
        />
      )}
    </div>
  );
}
