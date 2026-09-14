import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search } from "lucide-react";
import {
  ACTION_LABEL,
  DEFAULT_AUDIT_QUERY,
  SOURCE_LABEL,
  type AuditEntry,
  type AuditQuery,
} from "../domain/audit-entry";
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

const ACTION_TONE = {
  created: "success",
  updated: "info",
  toggled: "warning",
  deleted: "destructive",
  unknown: "muted",
} as const;

function EntryRow({ entry }: { entry: AuditEntry }) {
  return (
    <li className="border-t border-border/40 px-5 py-4 first:border-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="tabular-nums text-xs text-muted-foreground">
          {formatDateTime(entry.createdAt)}
        </span>
        <Badge tone={ACTION_TONE[entry.action]}>{ACTION_LABEL[entry.action]}</Badge>
        <span className="text-sm font-medium">{entry.entityName ?? entry.entityId}</span>
        <span className="text-xs text-muted-foreground">{SOURCE_LABEL[entry.source]}</span>
        {entry.performedBy && (
          <span className="text-xs text-muted-foreground">por {entry.performedBy}</span>
        )}
      </div>

      {entry.changes.length > 0 && (
        <ul className="mt-2 space-y-1">
          {entry.changes.map((change) => (
            <li key={change.field} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono text-muted-foreground">{change.field}</span>
              <span className="text-muted-foreground/70 line-through">
                {change.previous ?? "vazio"}
              </span>
              <ArrowRight size={12} className="text-muted-foreground" />
              <span>{change.next ?? "vazio"}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function AuditPage() {
  const { audit } = useContainer();
  const [query, setQuery] = useState<AuditQuery>(DEFAULT_AUDIT_QUERY);

  const { data, isPending, error } = useQuery<Page<AuditEntry>>({
    queryKey: ["audit", query],
    queryFn: () => audit.list(query),
    placeholderData: (previous) => previous,
  });

  const patch = (next: Partial<AuditQuery>) => setQuery((c) => ({ ...c, ...next }));
  const total = data?.total ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Auditoria" count={total} unit={["registro", "registros"]} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query.search}
            onChange={(e) => patch({ search: e.target.value, page: 1 })}
            placeholder="Buscar por nome ou por quem alterou..."
            className={`${FIELD} w-full pl-9`}
          />
        </div>
        <select
          value={query.source}
          onChange={(e) => patch({ source: e.target.value as AuditQuery["source"], page: 1 })}
          className={FIELD}
        >
          <option value="all">Todas as origens</option>
          <option value="totem">Totem</option>
          <option value="agent">Agente de serviço</option>
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

      <p className="text-xs text-muted-foreground">
        Valores de campos sensíveis (tokens, chaves, senhas) aparecem ocultos.
      </p>

      {error && <ErrorNotice error={error} fallback="Não foi possível carregar a auditoria." />}

      {isPending ? (
        <Loading label="Carregando a auditoria..." />
      ) : (data?.items.length ?? 0) === 0 ? (
        <Empty label="Nenhum registro com os filtros atuais." />
      ) : (
        <Panel>
          <ul>
            {data?.items.map((entry) => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </ul>
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
