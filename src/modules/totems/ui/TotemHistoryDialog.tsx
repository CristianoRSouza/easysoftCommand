import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, X } from "lucide-react";
import type { Totem } from "../domain/totem";
import {
  ACTION_LABEL,
  DEFAULT_AUDIT_QUERY,
  type AuditEntry,
  type AuditQuery,
} from "@/modules/audit/domain/audit-entry";
import { useContainer } from "@/shared/container/container-context";
import type { Page } from "@/shared/domain/paging";
import { formatDateTime } from "@/shared/ui/format";
import { Badge, Empty, ErrorNotice, Loading } from "@/shared/ui/primitives";

const ACTION_TONE = {
  created: "success",
  updated: "info",
  toggled: "warning",
  deleted: "destructive",
  unknown: "muted",
} as const;

/** O histórico deste totem — a mesma trilha da tela de auditoria, filtrada. */
export function TotemHistoryDialog({ totem, onClose }: { totem: Totem; onClose: () => void }) {
  const { audit } = useContainer();

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  const query: AuditQuery = {
    ...DEFAULT_AUDIT_QUERY,
    source: "totem",
    entityId: totem.id,
    pageSize: 100,
  };

  const { data, isPending, error } = useQuery<Page<AuditEntry>>({
    queryKey: ["audit", "totem", totem.id],
    queryFn: () => audit.list(query),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel my-8 w-full max-w-2xl space-y-4 rounded-lg p-6 shadow-elegant"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold">Histórico de alterações</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{totem.name || "Sem nome"}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {error && <ErrorNotice error={error} fallback="Não foi possível carregar o histórico." />}

        {isPending ? (
          <Loading label="Carregando o histórico..." />
        ) : (data?.items.length ?? 0) === 0 ? (
          <Empty label="Nenhuma alteração registrada para este totem." />
        ) : (
          <ul className="max-h-[60vh] space-y-3 overflow-y-auto">
            {data?.items.map((entry) => (
              <li key={entry.id} className="border-t border-border/40 pt-3 first:border-0 first:pt-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </span>
                  <Badge tone={ACTION_TONE[entry.action]}>{ACTION_LABEL[entry.action]}</Badge>
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
            ))}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">
          Valores de campos sensíveis (tokens, chaves) aparecem ocultos.
        </p>
      </div>
    </div>
  );
}
