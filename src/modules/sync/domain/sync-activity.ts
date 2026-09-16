import type { DateRange } from "@/shared/domain/paging";

/**
 * Fila de sincronização entre o PDV da loja e a nuvem.
 *
 * O PDV publica as mudanças; a nuvem as aplica. Enquanto um item não é
 * aplicado, o painel mostra dados mais velhos que a loja — e sem esta tela
 * ninguém saberia por quê.
 */

export interface SyncQuery {
  status: "all" | "error";
  range: DateRange;
  page: number;
  pageSize: number;
}

export const DEFAULT_SYNC_QUERY: SyncQuery = {
  status: "all",
  range: { from: null, to: null },
  page: 1,
  pageSize: 50,
};

/**
 * Um item da fila de entrada da nuvem.
 *
 * O PDV publica mudanças; a nuvem aplica. Um item preso em `pending` com muitas
 * tentativas é dado que existe na loja e ainda não existe na nuvem — a origem
 * silenciosa de "o painel não mostra a venda de ontem".
 */
export interface InboxItem {
  id: string;
  entity: string;
  entityId: string | null;
  operation: string | null;
  applyStatus: InboxStatus;
  retryCount: number;
  lastError: string | null;
  receivedAt: string;
  appliedAt: string | null;
}

export type InboxStatus = "applied" | "pending" | "failed";

export function toInboxStatus(value: unknown): InboxStatus {
  if (value === "applied" || value === "done" || value === "ok") return "applied";
  if (value === "failed" || value === "error") return "failed";
  return "pending";
}

export const INBOX_STATUS_LABEL: Record<InboxStatus, string> = {
  applied: "Aplicado",
  pending: "Na fila",
  failed: "Falhou",
};

/** Resumo da fila, para dizer se ela está andando ou entupida. */
export interface InboxSummary {
  applied: number;
  pending: number;
  failed: number;
  /** Item mais antigo ainda não aplicado — o atraso real da fila. */
  oldestPendingAt: string | null;
}

/** Minutos de atraso do item mais antigo na fila. */
export function backlogMinutes(summary: InboxSummary, now: Date = new Date()): number | null {
  if (!summary.oldestPendingAt) return null;
  const at = new Date(summary.oldestPendingAt);
  if (Number.isNaN(at.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - at.getTime()) / 60_000));
}
