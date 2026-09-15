import type { AuditRepository } from "../application/audit-repository";
import type { AuditEntry, AuditQuery } from "../domain/audit-entry";
import {
  pageToRange,
  startOfDayIso,
  startOfNextDayIso,
  type Page,
} from "@/shared/domain/paging";
import type { ElectronApi } from "@/shared/runtime/electron-api";
import { asNumber } from "@/shared/infrastructure/convert";
import { toAuditEntry } from "./audit-mapper";

/**
 * A auditoria local vem de duas tabelas com o mesmo formato — uma por origem.
 * O UNION as apresenta como uma coisa só, que é como quem investiga pensa:
 * "o que mudou", não "em qual tabela foi gravado".
 *
 * O nome vem por JOIN porque as tabelas de auditoria guardam só o
 * identificador. O LEFT é proposital: um totem excluído depois não pode apagar
 * o registro do que ele fez — é justamente aí que a auditoria serve.
 */
const BASE = `
  SELECT a.id, 'totem' AS source, a.totem_config_id AS entity_id, t.totem_name AS entity_name,
         a.action, a.changed_fields, a.previous_values, a.new_values,
         a.performed_by, a.created_at
  FROM nfce_totem_config_audit a
  LEFT JOIN nfce_totem_config t ON t.id = a.totem_config_id
  UNION ALL
  SELECT b.id, 'agent' AS source, b.agent_config_id AS entity_id, g.agent_name AS entity_name,
         b.action, b.changed_fields, b.previous_values, b.new_values,
         b.performed_by, b.created_at
  FROM nfce_service_agent_audit b
  LEFT JOIN nfce_service_agent g ON g.id = b.agent_config_id
`;

export class PostgresAuditRepository implements AuditRepository {
  constructor(private readonly api: ElectronApi) {}

  async list(query: AuditQuery): Promise<Page<AuditEntry>> {
    const { from } = pageToRange(query.page, query.pageSize);
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.source !== "all") {
      params.push(query.source);
      conditions.push(`u.source = $${params.length}`);
    }
    if (query.range.from) {
      params.push(startOfDayIso(query.range.from));
      conditions.push(`u.created_at >= $${params.length}`);
    }
    if (query.range.to) {
      params.push(startOfNextDayIso(query.range.to));
      conditions.push(`u.created_at < $${params.length}`);
    }

    const term = query.search.trim();
    if (term) {
      params.push(`%${term}%`);
      const p = params.length;
      conditions.push(`(u.entity_name ILIKE $${p} OR u.performed_by ILIKE $${p})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(query.pageSize, from);

    const result = await this.api.query<Record<string, unknown>>(
      `SELECT u.*, COUNT(*) OVER () AS total
       FROM (${BASE}) u
       ${where}
       ORDER BY u.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    if (!result.ok) throw new Error(`Falha ao listar a auditoria: ${result.error}`);

    return {
      items: result.rows.map(toAuditEntry),
      total: result.rows[0] ? asNumber(result.rows[0].total) : 0,
    };
  }
}
