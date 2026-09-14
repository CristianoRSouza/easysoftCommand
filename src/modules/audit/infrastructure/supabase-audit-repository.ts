import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditRepository } from "../application/audit-repository";
import type { AuditEntry, AuditQuery } from "../domain/audit-entry";
import {
  pageToRange,
  startOfDayIso,
  startOfNextDayIso,
  type Page,
} from "@/shared/domain/paging";
import type { Tenant } from "@/shared/tenant/tenant";
import { toAuditEntry } from "./audit-mapper";

const COLUMNS =
  "id, source, entity_id, entity_name, action, changed_fields, previous_values, new_values, performed_by, created_at";

export class SupabaseAuditRepository implements AuditRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  async list(query: AuditQuery): Promise<Page<AuditEntry>> {
    const { from, to } = pageToRange(query.page, query.pageSize);

    let request = this.client
      .from("vw_unified_audit_logs")
      .select(COLUMNS, { count: "exact" })
      .eq("company_id", this.tenant.companyId);

    if (query.source !== "all") request = request.eq("source", query.source);
    if (query.range.from) request = request.gte("created_at", startOfDayIso(query.range.from));
    if (query.range.to) request = request.lt("created_at", startOfNextDayIso(query.range.to));

    const term = query.search.trim();
    if (term) {
      const safe = term.replace(/[%,()]/g, " ");
      request = request.or(`entity_name.ilike.%${safe}%,performed_by.ilike.%${safe}%`);
    }

    const { data, error, count } = await request
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw new Error(`Falha ao listar a auditoria: ${error.message}`);

    return {
      items: ((data ?? []) as unknown as Record<string, unknown>[]).map(toAuditEntry),
      total: count ?? 0,
    };
  }
}
