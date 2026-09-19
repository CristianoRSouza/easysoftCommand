/**
 * As duas filas de sincronização entre a loja e a nuvem.
 *
 * Na entrada, a loja publica as mudanças e a nuvem as aplica. Na saída, o que
 * é alterado no painel — configuração de totem, usuários — espera a loja
 * buscar. Item preso em qualquer uma é dado que existe de um lado e ainda não
 * existe do outro, e sem esta tela ninguém saberia por quê.
 */
export type QueueDirection = "inbox" | "outbox";

export const DIRECTION_LABEL: Record<QueueDirection, string> = {
  inbox: "Da loja para a nuvem",
  outbox: "Da nuvem para a loja",
};

/** O que "concluído" quer dizer em cada direção. */
export const DONE_LABEL: Record<QueueDirection, string> = {
  inbox: "Aplicados",
  outbox: "Despachados",
};

/**
 * O estado de um evento. A entrada chama o sucesso de `applied` e a saída, de
 * `dispatched`; para quem lê a tela é a mesma coisa: chegou.
 */
export type QueueStatus = "done" | "pending" | "failed";

export function toQueueStatus(value: unknown): QueueStatus {
  if (value === "applied" || value === "dispatched") return "done";
  if (value === "failed") return "failed";
  return "pending";
}

export const QUEUE_STATUS_LABEL: Record<QueueStatus, string> = {
  done: "Concluído",
  pending: "Na fila",
  failed: "Falhou",
};

export interface QueueSummary {
  newPending: number;
  retrying: number;
  done: number;
  /** Desistiu depois de esgotar as tentativas. Não anda sozinho. */
  failed: number;
  /** Concluídos na última hora — diz se a fila está andando. */
  doneLastHour: number;
}

export interface EntityStatus {
  entity: string;
  status: QueueStatus;
  count: number;
  retrying: number;
  maxRetry: number;
  oldestAt: string | null;
  newestAt: string | null;
}

/** Pendentes que nem chegaram a ser tentados, por entidade. */
export interface BacklogEntry {
  entity: string;
  count: number;
  oldestAt: string | null;
}

export interface ActiveRetry {
  eventId: string;
  entity: string;
  operation: string;
  retryCount: number;
  nextRetryAt: string | null;
  lastError: string | null;
}

/** Falhas terminais agrupadas pela mensagem de erro. */
export interface FailureGroup {
  entity: string;
  error: string;
  count: number;
  retriesSpent: number;
  lastAt: string | null;
}

export interface QueueEvent {
  eventId: string;
  entity: string;
  entityId: string | null;
  operation: string;
  status: QueueStatus;
  retryCount: number;
  /** Quando entrou na fila. */
  queuedAt: string;
  /** Quando foi aplicado ou despachado. */
  doneAt: string | null;
  error: string | null;
  payload: unknown;
}

/** Tudo o que a tela mostra de uma direção, menos a lista de eventos. */
export interface QueueOverview {
  summary: QueueSummary;
  byEntity: EntityStatus[];
  backlog: BacklogEntry[];
  activeRetries: ActiveRetry[];
  failureGroups: FailureGroup[];
  recentFailures: QueueEvent[];
}

/** A operação gravada na fila, em palavras. `U` sozinho não diz nada a quem opera. */
export function operationLabel(op: string): string {
  const chave = op.trim().toLowerCase();
  if (chave === "i" || chave === "insert") return "Inclusão";
  if (chave === "u" || chave === "update") return "Alteração";
  if (chave === "d" || chave === "delete") return "Exclusão";
  if (chave === "upsert") return "Inclusão ou alteração";
  return op.trim() || "—";
}

/** Quando o próximo retry acontece, relativo a agora. */
export function nextRetryLabel(nextRetryAt: string | null, now: Date = new Date()): string {
  if (!nextRetryAt) return "imediato";
  const segundos = Math.ceil((new Date(nextRetryAt).getTime() - now.getTime()) / 1000);
  if (Number.isNaN(segundos)) return "—";
  if (segundos <= 0) return "pronto agora";
  if (segundos < 60) return `em ${segundos}s`;
  return `em ${Math.ceil(segundos / 60)} min`;
}

/** Há quanto tempo, em texto curto. */
export function timeAgo(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "—";
  const segundos = Math.floor((now.getTime() - new Date(iso).getTime()) / 1000);
  if (Number.isNaN(segundos)) return "—";
  if (segundos < 60) return `${Math.max(0, segundos)}s atrás`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `${minutos} min atrás`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas}h atrás`;
  return `${Math.floor(horas / 24)}d atrás`;
}
