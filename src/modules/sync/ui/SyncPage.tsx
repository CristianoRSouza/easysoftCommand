import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Info } from "lucide-react";
import {
  DEFAULT_SYNC_QUERY,
  DIRECTION_LABEL,
  HEARTBEAT_LABEL,
  heartbeatHealth,
  type HeartbeatHealth,
  type SyncLogEntry,
  type SyncOverview,
  type SyncQuery,
} from "../domain/sync-activity";
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

const HEALTH_TONE: Record<HeartbeatHealth, "success" | "warning" | "destructive" | "muted"> = {
  healthy: "success",
  warning: "warning",
  critical: "destructive",
  unknown: "muted",
};

function ServiceCard({ name, lastPing }: { name: string; lastPing: string | null }) {
  const { health, minutes } = heartbeatHealth(lastPing);
  return (
    <Panel className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-xs text-muted-foreground">{name}</p>
        <Badge tone={HEALTH_TONE[health]}>{HEARTBEAT_LABEL[health]}</Badge>
      </div>
      <p className="mt-2 text-sm">
        {lastPing ? formatDateTime(lastPing) : "Nunca registrou sinal"}
      </p>
      {minutes !== null && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          há {minutes} minuto{minutes === 1 ? "" : "s"}
        </p>
      )}
    </Panel>
  );
}

export function SyncPage() {
  const { sync } = useContainer();
  const [query, setQuery] = useState<SyncQuery>(DEFAULT_SYNC_QUERY);
  const disponivel = sync.isAvailable();

  const panorama = useQuery<SyncOverview>({
    queryKey: ["sync", "panorama"],
    queryFn: () => sync.overview(),
    enabled: disponivel,
    // Sinal de vida envelhece rápido: releitura a cada minuto.
    refetchInterval: 60_000,
  });

  const registros = useQuery<Page<SyncLogEntry>>({
    queryKey: ["sync", "registros", query],
    queryFn: () => sync.logs(query),
    enabled: disponivel,
    placeholderData: (previous) => previous,
  });

  if (!disponivel) {
    return (
      <div className="space-y-5">
        <PageHeader title="Sincronização" />
        <Panel className="flex items-start gap-3 p-5 text-sm text-muted-foreground">
          <Info size={18} className="mt-0.5 shrink-0 text-primary" />
          <span>
            A sincronização é medida no PostgreSQL da loja e não é replicada para a nuvem. Abra o
            programa instalado na loja para acompanhá-la.
          </span>
        </Panel>
      </div>
    );
  }

  const patch = (next: Partial<SyncQuery>) => setQuery((c) => ({ ...c, ...next }));
  const total = registros.data?.total ?? 0;
  const p = panorama.data;

  return (
    <div className="space-y-5">
      <PageHeader title="Sincronização" count={total} unit={["registro", "registros"]} />

      {panorama.error && (
        <ErrorNotice error={panorama.error} fallback="Não foi possível ler os serviços." />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel className={`p-5 ${(p?.recentErrors ?? 0) > 0 ? "border-destructive/40" : ""}`}>
          <p className="text-sm text-muted-foreground">Erros nas últimas 24h</p>
          <p
            className={`mt-2 font-heading text-3xl font-bold ${(p?.recentErrors ?? 0) > 0 ? "text-destructive" : ""}`}
          >
            {panorama.isPending ? "—" : (p?.recentErrors ?? 0).toLocaleString("pt-BR")}
          </p>
        </Panel>
        <Panel className="p-5 sm:col-span-2">
          <p className="text-sm text-muted-foreground">Última sincronização bem-sucedida</p>
          <p className="mt-2 font-heading text-lg font-semibold">
            {panorama.isPending ? "—" : p?.lastSuccessAt ? formatDateTime(p.lastSuccessAt) : "Nenhuma"}
          </p>
        </Panel>
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Activity size={15} /> Serviços
        </h2>
        {panorama.isPending ? (
          <Loading label="Lendo os serviços..." />
        ) : (p?.heartbeats.length ?? 0) === 0 ? (
          <Empty label="Nenhum serviço registrou sinal de vida nos últimos 90 dias." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {p?.heartbeats.map((h) => (
              <ServiceCard key={h.serviceName} name={h.serviceName} lastPing={h.lastPing} />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={query.direction}
          onChange={(e) => patch({ direction: e.target.value as SyncQuery["direction"], page: 1 })}
          className={FIELD}
        >
          <option value="all">Todos os sentidos</option>
          <option value="fb_to_pg">PDV → Painel</option>
          <option value="pg_to_fb">Painel → PDV</option>
        </select>
        <select
          value={query.status}
          onChange={(e) => patch({ status: e.target.value as SyncQuery["status"], page: 1 })}
          className={FIELD}
        >
          <option value="all">Todos os status</option>
          <option value="ok">Sucesso</option>
          <option value="error">Erro</option>
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

      {registros.error && (
        <ErrorNotice error={registros.error} fallback="Não foi possível ler os registros." />
      )}

      {registros.isPending ? (
        <Loading label="Carregando registros..." />
      ) : (registros.data?.items.length ?? 0) === 0 ? (
        <Empty label="Nenhum registro com os filtros atuais." />
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Quando</th>
                <th className="px-4 py-3 text-left font-medium">Sentido</th>
                <th className="px-4 py-3 text-left font-medium">Tabela</th>
                <th className="px-4 py-3 text-right font-medium">Registros</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Erro</th>
              </tr>
            </thead>
            <tbody>
              {registros.data?.items.map((entry) => (
                <tr
                  key={entry.id}
                  className={`border-t border-border/40 ${entry.status === "error" ? "bg-destructive/5" : ""}`}
                >
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </td>
                  <td className="px-4 py-3">{DIRECTION_LABEL[entry.direction]}</td>
                  <td className="px-4 py-3 font-mono text-xs">{entry.tableName || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{entry.recordsAffected}</td>
                  <td className="px-4 py-3">
                    <Badge tone={entry.status === "error" ? "destructive" : "success"}>
                      {entry.status === "error" ? "Erro" : "Sucesso"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {entry.errorMessage ?? "—"}
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
