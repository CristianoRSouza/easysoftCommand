import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NfceRepository } from "../application/nfce-repository";
import {
  toNfceStatus,
  type NfceNote,
  type NfceQuery,
  type NfceTotals,
} from "../domain/nfce-note";
import {
  pageToRange,
  startOfDayIso,
  startOfNextDayIso,
  type Page,
} from "@/shared/domain/paging";
import type { Tenant } from "@/shared/tenant/tenant";
import { asIsoDate, asNumber, asText } from "@/shared/infrastructure/convert";

const COLUMNS =
  "id, number, serie, access_key, status, total_value, issued_at, authorized_at, authorization_protocol, sefaz_status_code, sefaz_status_reason, emission_type, reconcile_status, retry_count";

/** Lote da varredura de totais. O PostgREST não agrega, então soma-se no cliente. */
const BATCH = 1000;

function toNote(row: Record<string, unknown>): NfceNote {
  return {
    id: asText(row.id) ?? "",
    number: asNumber(row.number),
    serie: asNumber(row.serie),
    accessKey: asText(row.access_key),
    status: toNfceStatus(row.status),
    totalValue: asNumber(row.total_value),
    issuedAt: asIsoDate(row.issued_at),
    authorizedAt: asText(row.authorized_at) ? asIsoDate(row.authorized_at) : null,
    protocol: asText(row.authorization_protocol),
    sefazStatusCode: asText(row.sefaz_status_code),
    sefazStatusReason: asText(row.sefaz_status_reason),
    emissionType: row.emission_type == null ? null : asNumber(row.emission_type),
    reconcileStatus: asText(row.reconcile_status),
    retryCount: asNumber(row.retry_count),
  };
}

export class SupabaseNfceRepository implements NfceRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  /** Aplica os filtros comuns a `list` e `totals`, para os dois nunca divergirem. */
  private applyFilters<T extends PostgrestFilterBuilder<any, any, any, any, any>>(
    request: T,
    query: NfceQuery,
  ): T {
    let result = request.eq("store_id", this.tenant.storeId) as T;

    if (query.status !== "all") result = result.eq("status", query.status) as T;
    if (query.range.from) result = result.gte("issued_at", startOfDayIso(query.range.from)) as T;
    if (query.range.to) result = result.lt("issued_at", startOfNextDayIso(query.range.to)) as T;

    const term = query.search.trim();
    if (term) {
      const safe = term.replace(/[%,()]/g, " ");
      // O número é inteiro: comparar com `ilike` daria erro de tipo.
      const asInteger = Number(term);
      const conditions = [
        `access_key.ilike.%${safe}%`,
        `authorization_protocol.ilike.%${safe}%`,
        ...(Number.isInteger(asInteger) && asInteger > 0 ? [`number.eq.${asInteger}`] : []),
      ];
      result = result.or(conditions.join(",")) as T;
    }

    return result;
  }

  async list(query: NfceQuery): Promise<Page<NfceNote>> {
    const { from, to } = pageToRange(query.page, query.pageSize);

    const request = this.applyFilters(
      this.client.from("vw_nfce_notes").select(COLUMNS, { count: "exact" }),
      query,
    );

    const { data, error, count } = await request
      .order("issued_at", { ascending: false })
      .order("number", { ascending: false })
      .range(from, to);

    if (error) throw new Error(`Falha ao listar notas fiscais: ${error.message}`);

    return {
      items: ((data ?? []) as unknown as Record<string, unknown>[]).map(toNote),
      total: count ?? 0,
    };
  }

  /**
   * Soma o período inteiro, varrendo em lotes.
   *
   * O PostgREST não faz `SUM`, então não há como pedir o total numa consulta só.
   * A paginação usa `id` como cursor em vez de `range`: com deslocamento, uma
   * nota inserida durante a varredura empurraria linhas e faria a soma pular
   * registros.
   */
  async totals(query: NfceQuery): Promise<NfceTotals> {
    const byStatus: Record<string, number> = {};
    let count = 0;
    let authorizedAmount = 0;
    let afterId: string | null = null;

    for (;;) {
      let request = this.applyFilters(
        this.client.from("vw_nfce_notes").select("id, status, total_value"),
        query,
      );
      if (afterId) request = request.gt("id", afterId);

      const { data, error } = await request.order("id", { ascending: true }).limit(BATCH);
      if (error) throw new Error(`Falha ao somar notas fiscais: ${error.message}`);

      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      if (rows.length === 0) break;

      for (const row of rows) {
        const status = asText(row.status) ?? "draft";
        byStatus[status] = (byStatus[status] ?? 0) + 1;
        count += 1;
        if (status === "authorized") authorizedAmount += asNumber(row.total_value);
      }

      if (rows.length < BATCH) break;
      afterId = asText(rows[rows.length - 1]?.id);
      if (!afterId) break;
    }

    return { count, byStatus, authorizedAmount };
  }
}
