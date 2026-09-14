import type { DateRange } from "@/shared/domain/paging";

/**
 * Sincronização entre o Firebird do PDV e o PostgreSQL do painel.
 *
 * É o que mantém as duas bases coerentes. Quando para, o painel continua
 * mostrando dados — só que velhos, e ninguém percebe olhando a tela.
 */
export interface SyncLogEntry {
  id: string;
  direction: SyncDirection;
  tableName: string;
  recordsAffected: number;
  status: SyncStatus;
  errorMessage: string | null;
  createdAt: string;
}

export type SyncDirection = "fb_to_pg" | "pg_to_fb" | "unknown";
export type SyncStatus = "ok" | "error";

export const DIRECTION_LABEL: Record<SyncDirection, string> = {
  fb_to_pg: "PDV → Painel",
  pg_to_fb: "Painel → PDV",
  unknown: "—",
};

export function toDirection(value: unknown): SyncDirection {
  return value === "fb_to_pg" || value === "pg_to_fb" ? value : "unknown";
}

/** O banco grava tanto `ok` quanto `success`; para o negócio é a mesma coisa. */
export function toSyncStatus(value: unknown): SyncStatus {
  return value === "error" ? "error" : "ok";
}

/**
 * Sinal de vida de um serviço.
 *
 * Cada serviço em segundo plano grava periodicamente um carimbo de hora. O
 * painel lê o último e calcula há quanto tempo foi — é o monitor cardíaco da
 * operação: enquanto bipa, está vivo.
 */
export interface ServiceHeartbeat {
  serviceName: string;
  lastPing: string | null;
}

export type HeartbeatHealth = "healthy" | "warning" | "critical" | "unknown";

/** Minutos de silêncio a partir dos quais o serviço deixa de ser confiável. */
export const HEARTBEAT_WARNING_MINUTES = 5;
export const HEARTBEAT_CRITICAL_MINUTES = 15;

export function heartbeatHealth(
  lastPing: string | null,
  now: Date = new Date(),
): { health: HeartbeatHealth; minutes: number | null } {
  if (!lastPing) return { health: "unknown", minutes: null };

  const at = new Date(lastPing);
  if (Number.isNaN(at.getTime())) return { health: "unknown", minutes: null };

  const minutes = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 60_000));
  if (minutes <= HEARTBEAT_WARNING_MINUTES) return { health: "healthy", minutes };
  if (minutes <= HEARTBEAT_CRITICAL_MINUTES) return { health: "warning", minutes };
  return { health: "critical", minutes };
}

export const HEARTBEAT_LABEL: Record<HeartbeatHealth, string> = {
  healthy: "Operacional",
  warning: "Atraso",
  critical: "Serviço parado",
  // Sem linha na tabela não prova que o processo morreu — pode nunca ter
  // gravado. Dizer "parado" aqui seria afirmar mais do que se sabe.
  unknown: "Sem sinal",
};

export interface SyncQuery {
  direction: "all" | SyncDirection;
  status: "all" | SyncStatus;
  range: DateRange;
  page: number;
  pageSize: number;
}

export const DEFAULT_SYNC_QUERY: SyncQuery = {
  direction: "all",
  status: "all",
  range: { from: null, to: null },
  page: 1,
  pageSize: 50,
};

/** Panorama da sincronização: os serviços e quantos erros houve. */
export interface SyncOverview {
  heartbeats: ServiceHeartbeat[];
  recentErrors: number;
  lastSuccessAt: string | null;
}

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
