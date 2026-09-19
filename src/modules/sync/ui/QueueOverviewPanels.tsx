import type { ReactNode } from "react";
import {
  DONE_LABEL,
  nextRetryLabel,
  operationLabel,
  QUEUE_STATUS_LABEL,
  timeAgo,
  type QueueDirection,
  type QueueOverview,
} from "../domain/sync-activity";
import { STATUS_TONE } from "./QueueEvents";
import { SyncErrorText } from "./SyncErrorText";
import { formatDateTime } from "@/shared/ui/format";
import { Badge, Panel } from "@/shared/ui/primitives";

function Numero({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warning" | "danger" | "success";
}) {
  const cor =
    tone === "danger" && value > 0
      ? "text-destructive"
      : tone === "warning" && value > 0
        ? "text-warning"
        : tone === "success"
          ? "text-success"
          : "";
  return (
    <Panel className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 font-heading text-3xl font-bold ${cor}`}>{value.toLocaleString("pt-BR")}</p>
    </Panel>
  );
}

function Secao({
  titulo,
  vazio,
  colunas,
  children,
}: {
  titulo: string;
  vazio: string | null;
  colunas: string[];
  children: ReactNode;
}) {
  return (
    <Panel className="overflow-x-auto">
      <h2 className="px-4 py-3 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {titulo}
      </h2>
      {vazio ? (
        <p className="border-t border-border/40 px-4 py-6 text-center text-sm text-muted-foreground">
          {vazio}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-t border-border/60 text-muted-foreground">
            <tr>
              {colunas.map((coluna) => (
                <th key={coluna} className="px-4 py-2 text-left font-medium">
                  {coluna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      )}
    </Panel>
  );
}

const CELULA = "px-4 py-2.5";

/** Os painéis de diagnóstico de uma direção da fila. */
export function QueueOverviewPanels({
  direction,
  overview,
}: {
  direction: QueueDirection;
  overview: QueueOverview;
}) {
  const { summary, byEntity, backlog, activeRetries, failureGroups, recentFailures } = overview;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Numero label="Pendentes novos" value={summary.newPending} tone="warning" />
        <Numero label="Em nova tentativa" value={summary.retrying} tone="warning" />
        <Numero label={DONE_LABEL[direction]} value={summary.done} tone="success" />
        <Numero label="Falhas definitivas" value={summary.failed} tone="danger" />
        <Numero label={`${DONE_LABEL[direction]} na última hora`} value={summary.doneLastHour} />
      </div>

      {summary.failed > 0 && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {summary.failed} evento(s) esgotaram as tentativas e não serão reprocessados sozinhos.
          {direction === "inbox"
            ? " O que eles traziam da loja não está na nuvem."
            : " O que eles levavam da nuvem não chegou à loja."}
        </p>
      )}

      <Secao
        titulo="Por entidade e situação"
        vazio={byEntity.length === 0 ? "Sem registros." : null}
        colunas={["Entidade", "Situação", "Qtd", "Em nova tentativa", "Máx. tentativas", "Mais antigo", "Mais recente"]}
      >
        {byEntity.map((linha) => (
          <tr key={`${linha.entity}-${linha.status}`} className="border-t border-border/40">
            <td className={`${CELULA} font-mono text-xs`}>{linha.entity}</td>
            <td className={CELULA}>
              <Badge tone={STATUS_TONE[linha.status]}>{QUEUE_STATUS_LABEL[linha.status]}</Badge>
            </td>
            <td className={`${CELULA} tabular-nums font-medium`}>{linha.count}</td>
            <td className={`${CELULA} tabular-nums`}>{linha.retrying}</td>
            <td className={`${CELULA} tabular-nums`}>{linha.maxRetry}</td>
            <td className={`${CELULA} text-xs text-muted-foreground`}>{timeAgo(linha.oldestAt)}</td>
            <td className={`${CELULA} text-xs text-muted-foreground`}>{timeAgo(linha.newestAt)}</td>
          </tr>
        ))}
      </Secao>

      <Secao
        titulo="Pendentes nunca tentados"
        vazio={backlog.length === 0 ? "Nada esperando a primeira tentativa." : null}
        colunas={["Entidade", "Qtd", "Mais antigo"]}
      >
        {backlog.map((linha) => (
          <tr key={linha.entity} className="border-t border-border/40">
            <td className={`${CELULA} font-mono text-xs`}>{linha.entity}</td>
            <td className={`${CELULA} tabular-nums font-medium`}>{linha.count}</td>
            <td className={`${CELULA} text-xs text-muted-foreground`}>{timeAgo(linha.oldestAt)}</td>
          </tr>
        ))}
      </Secao>

      <Secao
        titulo="Em nova tentativa"
        vazio={activeRetries.length === 0 ? "Nenhum evento sendo tentado de novo." : null}
        colunas={["Evento", "Entidade", "Operação", "Tentativas", "Próxima", "Último erro"]}
      >
        {activeRetries.map((linha) => (
          <tr key={linha.eventId} className="border-t border-border/40 align-top">
            <td className={`${CELULA} font-mono text-xs`} title={linha.eventId}>
              {linha.eventId.slice(0, 8)}…
            </td>
            <td className={`${CELULA} font-mono text-xs`}>{linha.entity}</td>
            <td className={`${CELULA} text-muted-foreground`}>{operationLabel(linha.operation)}</td>
            <td className={`${CELULA} tabular-nums`}>{linha.retryCount}</td>
            <td className={`${CELULA} text-xs text-muted-foreground`}>
              {nextRetryLabel(linha.nextRetryAt)}
            </td>
            <td className={`${CELULA} text-xs`}>
              <SyncErrorText erro={linha.lastError} />
            </td>
          </tr>
        ))}
      </Secao>

      {/* O erro cru do PostgreSQL é preciso e ilegível. Traduzi-lo responde a
          pergunta que o operador tem — é dado faltando, duplicado ou
          permissão? — sem mandar a mensagem para alguém traduzir. */}
      <Secao
        titulo="Falhas definitivas por erro"
        vazio={failureGroups.length === 0 ? "Sem falhas." : null}
        colunas={["Entidade", "Erro", "Qtd", "Tentativas gastas", "Última"]}
      >
        {failureGroups.map((linha) => (
          <tr key={`${linha.entity}-${linha.error}`} className="border-t border-border/40 align-top">
            <td className={`${CELULA} font-mono text-xs`}>{linha.entity}</td>
            <td className={`${CELULA} text-xs`}>
              <SyncErrorText erro={linha.error} comDica />
            </td>
            <td className={`${CELULA} tabular-nums font-medium`}>{linha.count}</td>
            <td className={`${CELULA} tabular-nums`}>{linha.retriesSpent}</td>
            <td className={`${CELULA} text-xs text-muted-foreground`}>{timeAgo(linha.lastAt)}</td>
          </tr>
        ))}
      </Secao>

      <Secao
        titulo="Últimas falhas"
        vazio={recentFailures.length === 0 ? "Sem falhas recentes." : null}
        colunas={["Entrou na fila", "Entidade", "Operação", "Tentativas", "Erro"]}
      >
        {recentFailures.map((linha) => (
          <tr key={linha.eventId} className="border-t border-border/40 bg-destructive/5 align-top">
            <td className={`${CELULA} tabular-nums text-xs text-muted-foreground`}>
              {formatDateTime(linha.queuedAt)}
            </td>
            <td className={`${CELULA} font-mono text-xs`}>{linha.entity}</td>
            <td className={`${CELULA} text-muted-foreground`}>{operationLabel(linha.operation)}</td>
            <td className={`${CELULA} tabular-nums`}>{linha.retryCount}</td>
            <td className={`${CELULA} text-xs`}>
              <SyncErrorText erro={linha.error} />
            </td>
          </tr>
        ))}
      </Secao>
    </>
  );
}
