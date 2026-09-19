import { asNumber, asText } from "@/shared/infrastructure/convert";
import {
  toQueueStatus,
  type ActiveRetry,
  type BacklogEntry,
  type EntityStatus,
  type FailureGroup,
  type QueueDirection,
  type QueueEvent,
  type QueueSummary,
} from "../domain/sync-activity";

type Row = Record<string, unknown>;

/**
 * As funções das duas filas devolvem as mesmas colunas com nomes trocados
 * onde a direção muda o sentido: aplicado/despachado, recebido/alterado.
 */
const COLUNA = {
  inbox: {
    done: "applied_total",
    status: "apply_status",
    doneAt: "applied_at",
    queuedAt: "received_at",
    error: "apply_error",
  },
  outbox: {
    done: "dispatched_total",
    status: "dispatch_status",
    doneAt: "dispatched_at",
    queuedAt: "changed_at",
    error: "dispatch_error",
  },
} as const;

export function toSummary(direction: QueueDirection, row: Row, rate: Row[]): QueueSummary {
  const porMinuto = direction === "inbox" ? "aplicados_por_minuto" : "despachados_por_minuto";
  return {
    newPending: asNumber(row.pending_novos),
    retrying: asNumber(row.pending_em_retry),
    done: asNumber(row[COLUNA[direction].done]),
    failed: asNumber(row.failed_terminal),
    doneLastHour: rate.reduce((soma, ponto) => soma + asNumber(ponto[porMinuto]), 0),
  };
}

export function toEntityStatus(direction: QueueDirection, row: Row): EntityStatus {
  return {
    entity: asText(row.entity_name) ?? "—",
    status: toQueueStatus(row[COLUNA[direction].status]),
    count: asNumber(row.qtd),
    retrying: asNumber(row.em_retry),
    maxRetry: asNumber(row.max_retry),
    oldestAt: asText(row.mais_antigo),
    newestAt: asText(row.mais_recente),
  };
}

export function toBacklogEntry(row: Row): BacklogEntry {
  return {
    entity: asText(row.entity_name) ?? "—",
    count: asNumber(row.pendentes_nunca_tentados),
    oldestAt: asText(row.mais_antigo),
  };
}

export function toActiveRetry(row: Row): ActiveRetry {
  return {
    eventId: asText(row.event_id) ?? "",
    entity: asText(row.entity_name) ?? "—",
    operation: asText(row.op) ?? "",
    retryCount: asNumber(row.retry_count),
    nextRetryAt: asText(row.next_retry_after),
    lastError: asText(row.ultimo_erro),
  };
}

export function toFailureGroup(row: Row): FailureGroup {
  return {
    entity: asText(row.entity_name) ?? "—",
    error: asText(row.erro_resumido) ?? "",
    count: asNumber(row.qtd),
    retriesSpent: asNumber(row.retries_gastos),
    lastAt: asText(row.ultimo),
  };
}

/** Linha de evento. As falhas recentes trazem o erro em `erro` e sem status. */
export function toQueueEvent(direction: QueueDirection, row: Row): QueueEvent {
  const coluna = COLUNA[direction];
  return {
    eventId: asText(row.event_id) ?? "",
    entity: asText(row.entity_name) ?? "—",
    entityId: asText(row.entity_id),
    operation: asText(row.op) ?? "",
    status: row[coluna.status] === undefined ? "failed" : toQueueStatus(row[coluna.status]),
    retryCount: asNumber(row.retry_count),
    queuedAt: asText(row[coluna.queuedAt]) ?? "",
    doneAt: asText(row[coluna.doneAt]),
    error: asText(row[coluna.error]) ?? asText(row.erro),
    payload: row.payload ?? null,
  };
}
