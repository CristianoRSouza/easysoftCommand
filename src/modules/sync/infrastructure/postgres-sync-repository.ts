import type { SyncRepository } from "../application/sync-repository";
import type { InboxItem, InboxSummary } from "../domain/sync-activity";
import { INBOX_COLUMNS, toInboxItem } from "./inbox-mapper";
import {
  toDirection,
  toSyncStatus,
  type SyncLogEntry,
  type SyncOverview,
  type SyncQuery,
} from "../domain/sync-activity";
import {
  pageToRange,
  startOfDayIso,
  startOfNextDayIso,
  type Page,
} from "@/shared/domain/paging";
import type { ElectronApi } from "@/shared/runtime/electron-api";
import { asIsoDate, asNumber, asText } from "@/shared/infrastructure/convert";

type Row = Record<string, unknown>;

function toEntry(row: Row): SyncLogEntry {
  return {
    id: asText(row.id) ?? "",
    direction: toDirection(row.direction),
    tableName: asText(row.table_name) ?? "",
    recordsAffected: asNumber(row.records_affected),
    status: toSyncStatus(row.status),
    errorMessage: asText(row.error_message),
    createdAt: asIsoDate(row.created_at),
  };
}

export class PostgresSyncRepository implements SyncRepository {
  constructor(private readonly api: ElectronApi) {}

  isAvailable(): boolean {
    return true;
  }

  /**
   * Panorama dos serviços.
   *
   * Só existe no modo local: `sync_heartbeat` e `sync_log` vivem no PostgreSQL
   * da loja e não são replicados para a nuvem.
   */
  async overview(): Promise<SyncOverview> {
    const [batimentos, erros, ultimo] = await Promise.all([
      this.api.query<Row>(
        `SELECT service_name, MAX(last_ping) AS last_ping
         FROM sync_heartbeat
         WHERE last_ping >= NOW() - INTERVAL '90 days'
         GROUP BY service_name
         ORDER BY service_name`,
      ),
      this.api.query<Row>(
        `SELECT COUNT(*)::int AS total
         FROM sync_log
         WHERE status = 'error' AND created_at >= NOW() - INTERVAL '24 hours'`,
      ),
      this.api.query<Row>(
        `SELECT MAX(created_at) AS at FROM sync_log WHERE status <> 'error'`,
      ),
    ]);

    if (!batimentos.ok) throw new Error(`Falha ao ler os serviços: ${batimentos.error}`);
    if (!erros.ok) throw new Error(`Falha ao contar erros: ${erros.error}`);
    if (!ultimo.ok) throw new Error(`Falha ao ler a última sincronização: ${ultimo.error}`);

    return {
      heartbeats: batimentos.rows.map((row) => ({
        serviceName: asText(row.service_name) ?? "",
        lastPing: row.last_ping == null ? null : asIsoDate(row.last_ping),
      })),
      recentErrors: erros.rows[0] ? asNumber(erros.rows[0].total) : 0,
      lastSuccessAt: ultimo.rows[0]?.at == null ? null : asIsoDate(ultimo.rows[0].at),
    };
  }

  async logs(query: SyncQuery): Promise<Page<SyncLogEntry>> {
    const { from } = pageToRange(query.page, query.pageSize);
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.direction !== "all") {
      params.push(query.direction);
      conditions.push(`l.direction = $${params.length}`);
    }
    if (query.status === "error") conditions.push("l.status = 'error'");
    else if (query.status === "ok") conditions.push("l.status <> 'error'");

    if (query.range.from) {
      params.push(startOfDayIso(query.range.from));
      conditions.push(`l.created_at >= $${params.length}`);
    }
    if (query.range.to) {
      params.push(startOfNextDayIso(query.range.to));
      conditions.push(`l.created_at < $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(query.pageSize, from);

    const result = await this.api.query<Row>(
      `SELECT l.id, l.direction, l.table_name, l.records_affected, l.status,
              l.error_message, l.created_at,
              COUNT(*) OVER () AS total
       FROM sync_log l
       ${where}
       ORDER BY l.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    if (!result.ok) throw new Error(`Falha ao listar a sincronização: ${result.error}`);

    return {
      items: result.rows.map(toEntry),
      total: result.rows[0] ? asNumber(result.rows[0].total) : 0,
    };
  }

  /**
   * A fila de entrada existe nos dois modos: ela mora na nuvem, e o programa da
   * loja consulta o mesmo esquema replicado em `ecb_sync.inbox`.
   */
  async inboxSummary(): Promise<InboxSummary> {
    const result = await this.api.query<Row>(
      `SELECT
         COUNT(*) FILTER (WHERE i.apply_status IN ('applied','done','ok'))   AS applied,
         COUNT(*) FILTER (WHERE i.apply_status IN ('pending','queued'))      AS pending,
         COUNT(*) FILTER (WHERE i.apply_status IN ('failed','error'))        AS failed,
         MIN(i.received_at) FILTER (WHERE i.apply_status IN ('pending','queued')) AS oldest
       FROM ecb_sync.inbox i`,
    );
    if (!result.ok) throw new Error(`Falha ao ler a fila: ${result.error}`);

    const row = result.rows[0];
    return {
      applied: row ? asNumber(row.applied) : 0,
      pending: row ? asNumber(row.pending) : 0,
      failed: row ? asNumber(row.failed) : 0,
      oldestPendingAt: row?.oldest == null ? null : asIsoDate(row.oldest),
    };
  }

  async inbox(query: SyncQuery): Promise<Page<InboxItem>> {
    const { from } = pageToRange(query.page, query.pageSize);
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.status === "error") conditions.push("i.apply_status IN ('failed','error')");
    if (query.range.from) {
      params.push(startOfDayIso(query.range.from));
      conditions.push(`i.received_at >= $${params.length}`);
    }
    if (query.range.to) {
      params.push(startOfNextDayIso(query.range.to));
      conditions.push(`i.received_at < $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(query.pageSize, from);

    const result = await this.api.query<Row>(
      `SELECT ${INBOX_COLUMNS.split(", ").map((c) => `i.${c}`).join(", ")},
              COUNT(*) OVER () AS total
       FROM ecb_sync.inbox i
       ${where}
       ORDER BY i.received_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    if (!result.ok) throw new Error(`Falha ao ler a fila: ${result.error}`);

    return {
      items: result.rows.map(toInboxItem),
      total: result.rows[0] ? asNumber(result.rows[0].total) : 0,
    };
  }
}
