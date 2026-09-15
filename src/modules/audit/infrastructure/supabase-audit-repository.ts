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
  "id, action, changed_fields, previous_values, new_values, performed_by, created_at";

/** Quantos registros buscar de cada origem antes de juntar e paginar. */
const LIMITE_POR_ORIGEM = 500;

type Row = Record<string, unknown>;

/**
 * A auditoria da nuvem vem de duas views, uma por origem.
 *
 * Não existe view unificada: totens e agentes gravam em tabelas separadas. A
 * junção acontece aqui, porque para quem investiga a pergunta é "o que mudou",
 * não "em qual tabela foi gravado".
 *
 * A consequência honesta é que a paginação opera sobre os últimos registros de
 * cada origem, não sobre o histórico inteiro — juntar dois conjuntos paginados
 * separadamente daria uma ordem errada. Quem precisa ir mais fundo usa o filtro
 * de data.
 */
export class SupabaseAuditRepository implements AuditRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  private async fetchSource(
    view: string,
    entityColumn: string,
    source: "totem" | "agent",
    query: AuditQuery,
  ): Promise<Row[]> {
    let request = this.client
      .from(view)
      .select(`${COLUMNS}, ${entityColumn}`)
      .eq("company_id", this.tenant.companyId);

    if (query.range.from) request = request.gte("created_at", startOfDayIso(query.range.from));
    if (query.range.to) request = request.lt("created_at", startOfNextDayIso(query.range.to));

    const { data, error } = await request
      .order("created_at", { ascending: false })
      .limit(LIMITE_POR_ORIGEM);

    if (error) throw new Error(`Falha ao listar a auditoria: ${error.message}`);

    return ((data ?? []) as unknown as Row[]).map((row) => ({
      ...row,
      source,
      entity_id: row[entityColumn],
    }));
  }

  async list(query: AuditQuery): Promise<Page<AuditEntry>> {
    const origens: Row[] = [];

    if (query.source === "all" || query.source === "totem") {
      origens.push(
        ...(await this.fetchSource(
          "vw_devices_totem_config_audit",
          "totem_config_id",
          "totem",
          query,
        )),
      );
    }
    if (query.source === "all" || query.source === "agent") {
      origens.push(
        ...(await this.fetchSource(
          "vw_nfce_service_agent_audit",
          "agent_config_id",
          "agent",
          query,
        )),
      );
    }

    let entradas = origens
      .map(toAuditEntry)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

    const termo = query.search.trim().toLowerCase();
    if (termo) {
      entradas = entradas.filter(
        (e) =>
          (e.entityName ?? "").toLowerCase().includes(termo) ||
          (e.performedBy ?? "").toLowerCase().includes(termo),
      );
    }

    const { from, to } = pageToRange(query.page, query.pageSize);
    return { items: entradas.slice(from, to + 1), total: entradas.length };
  }
}
