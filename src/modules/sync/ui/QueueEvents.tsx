import { useInfiniteQuery } from "@tanstack/react-query";
import {
  operationLabel,
  QUEUE_STATUS_LABEL,
  type QueueDirection,
  type QueueEvent,
} from "../domain/sync-activity";
import { PayloadView } from "./PayloadView";
import { SyncErrorText } from "./SyncErrorText";
import { useContainer } from "@/shared/container/container-context";
import { formatDateTime } from "@/shared/ui/format";
import { Badge, ErrorNotice, Loading, Panel } from "@/shared/ui/primitives";

const LOTE = 50;

export const STATUS_TONE = {
  done: "success",
  pending: "warning",
  failed: "destructive",
} as const;

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="break-all text-xs">{children}</p>
    </div>
  );
}

function Evento({ evento, direction }: { evento: QueueEvent; direction: QueueDirection }) {
  return (
    <details className="group border-t border-border/40">
      <summary
        className={`grid cursor-pointer grid-cols-2 items-center gap-2 px-4 py-3 text-sm transition-colors hover:bg-secondary/40 sm:grid-cols-12 ${
          evento.status === "failed" ? "bg-destructive/5" : ""
        }`}
      >
        <span className="truncate font-mono text-xs sm:col-span-3">{evento.entity}</span>
        <span className="text-right text-muted-foreground sm:col-span-2 sm:text-left">
          {operationLabel(evento.operation)}
        </span>
        <span className="sm:col-span-2">
          <Badge tone={STATUS_TONE[evento.status]}>{QUEUE_STATUS_LABEL[evento.status]}</Badge>
        </span>
        <span className="text-right tabular-nums text-xs text-muted-foreground sm:col-span-3 sm:text-left">
          {formatDateTime(evento.doneAt ?? evento.queuedAt)}
        </span>
        <span className="text-xs text-muted-foreground sm:col-span-2 sm:text-right">
          {evento.retryCount > 0 ? `${evento.retryCount} tentativa(s)` : ""}
        </span>
      </summary>

      <div className="space-y-3 border-l-4 border-primary bg-primary/5 px-4 py-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Campo label="Evento">
            <span className="font-mono">{evento.eventId}</span>
          </Campo>
          <Campo label="Registro">
            <span className="font-mono">{evento.entityId ?? "—"}</span>
          </Campo>
          <Campo label="Entrou na fila">{formatDateTime(evento.queuedAt)}</Campo>
          <Campo label={direction === "inbox" ? "Aplicado" : "Despachado"}>
            {evento.doneAt ? formatDateTime(evento.doneAt) : "—"}
          </Campo>
        </div>
        {evento.error && (
          <div className="text-xs">
            <SyncErrorText erro={evento.error} comDica />
          </div>
        )}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Conteúdo
          </p>
          <div className="rounded-lg border border-border/50 bg-background/40 p-3">
            <PayloadView data={evento.payload} />
          </div>
        </div>
      </div>
    </details>
  );
}

/**
 * Os eventos mais recentes da fila, em lotes.
 *
 * As funções do banco devolvem uma janela e não o total, então a lista cresce
 * com "Carregar mais" em vez de páginas numeradas: numerar exigiria um total
 * que ninguém contou.
 */
export function QueueEvents({ direction }: { direction: QueueDirection }) {
  const { sync } = useContainer();

  const eventos = useInfiniteQuery({
    queryKey: ["fila", direction, "eventos"],
    queryFn: ({ pageParam }) => sync.events(direction, pageParam, LOTE),
    initialPageParam: 0,
    getNextPageParam: (ultimo, todos) =>
      ultimo.length === LOTE ? todos.reduce((soma, lote) => soma + lote.length, 0) : undefined,
  });

  const lista = eventos.data?.pages.flat() ?? [];

  return (
    <Panel className="overflow-hidden">
      <h2 className="px-4 py-3 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Últimos eventos
        <span className="ml-2 font-normal normal-case tracking-normal">
          ({lista.length} carregados)
        </span>
      </h2>

      {eventos.error && (
        <div className="px-4 pb-3">
          <ErrorNotice error={eventos.error} fallback="Não foi possível ler os eventos." />
        </div>
      )}

      {eventos.isPending ? (
        <Loading label="Carregando eventos..." />
      ) : lista.length === 0 ? (
        <p className="border-t border-border/40 px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum evento registrado.
        </p>
      ) : (
        lista.map((evento) => (
          <Evento key={evento.eventId} evento={evento} direction={direction} />
        ))
      )}

      {lista.length > 0 && (
        <div className="border-t border-border/40 py-3 text-center">
          {eventos.hasNextPage ? (
            <button
              onClick={() => void eventos.fetchNextPage()}
              disabled={eventos.isFetchingNextPage}
              className="rounded-lg px-3 py-1.5 text-sm text-primary transition-colors hover:bg-secondary disabled:opacity-50"
            >
              {eventos.isFetchingNextPage ? "Carregando..." : "Carregar mais"}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">Fim da lista</span>
          )}
        </div>
      )}
    </Panel>
  );
}
