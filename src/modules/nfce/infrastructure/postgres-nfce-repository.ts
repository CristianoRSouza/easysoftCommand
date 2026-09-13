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
import type { ElectronApi } from "@/shared/runtime/electron-api";
import { asIsoDate, asNumber, asText } from "@/shared/infrastructure/convert";
import type { NfceDetail } from "../domain/nfce-detail";
import {
  sortHistory,
  toEventEntry,
  toIssuer,
  toItem,
  toLogEntry,
  toPayment,
  toRecipient,
  toTotals,
} from "./nfce-detail-mapper";

function toNote(row: Record<string, unknown>): NfceNote {
  return {
    id: asText(row.id) ?? "",
    number: asNumber(row.number),
    serie: asNumber(row.serie),
    accessKey: asText(row.access_key),
    status: toNfceStatus(row.status),
    totalValue: asNumber(row.total_value),
    issuedAt: asIsoDate(row.issued_at),
    authorizedAt: row.authorized_at == null ? null : asIsoDate(row.authorized_at),
    protocol: asText(row.authorization_protocol),
    sefazStatusCode: asText(row.sefaz_status_code),
    sefazStatusReason: asText(row.sefaz_status_reason),
    emissionType: row.emission_type == null ? null : asNumber(row.emission_type),
    reconcileStatus: asText(row.reconcile_status),
    retryCount: asNumber(row.retry_count),
  };
}

/** Condições e parâmetros comuns a `list` e `totals`, para os dois nunca divergirem. */
function buildFilters(query: NfceQuery): { where: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.status !== "all") {
    params.push(query.status);
    // `status` é enum no PostgreSQL: comparar com texto exige conversão.
    conditions.push(`n.status::text = $${params.length}`);
  }
  if (query.range.from) {
    params.push(startOfDayIso(query.range.from));
    conditions.push(`n.issued_at >= $${params.length}`);
  }
  if (query.range.to) {
    params.push(startOfNextDayIso(query.range.to));
    conditions.push(`n.issued_at < $${params.length}`);
  }

  const term = query.search.trim();
  if (term) {
    params.push(`%${term}%`);
    const like = params.length;
    const asInteger = Number(term);
    if (Number.isInteger(asInteger) && asInteger > 0) {
      params.push(asInteger);
      conditions.push(
        `(n.access_key ILIKE $${like} OR n.authorization_protocol ILIKE $${like} OR n.number = $${params.length})`,
      );
    } else {
      conditions.push(
        `(n.access_key ILIKE $${like} OR n.authorization_protocol ILIKE $${like})`,
      );
    }
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

export class PostgresNfceRepository implements NfceRepository {
  constructor(private readonly api: ElectronApi) {}

  async list(query: NfceQuery): Promise<Page<NfceNote>> {
    const { from } = pageToRange(query.page, query.pageSize);
    const { where, params } = buildFilters(query);

    params.push(query.pageSize, from);
    const limitParam = params.length - 1;
    const offsetParam = params.length;

    const sql = `
      SELECT n.id, n.number, n.serie, n.access_key, n.status, n.total_value,
             n.issued_at, n.authorized_at, n.authorization_protocol,
             n.sefaz_status_code, n.sefaz_status_reason, n.emission_type,
             n.reconcile_status, n.retry_count,
             COUNT(*) OVER () AS total
      FROM nfce_notes n
      ${where}
      ORDER BY n.issued_at DESC NULLS LAST, n.serie DESC, n.number DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const result = await this.api.query<Record<string, unknown>>(sql, params);
    if (!result.ok) throw new Error(`Falha ao listar notas fiscais: ${result.error}`);

    const rows = result.rows;
    return {
      items: rows.map(toNote),
      total: rows[0] ? asNumber(rows[0].total) : 0,
    };
  }

  /**
   * Soma o período inteiro numa consulta só.
   *
   * Aqui há SQL de verdade, então a agregação acontece no banco — ao contrário
   * do Supabase, onde é preciso varrer em lotes porque o PostgREST não agrega.
   */
  async totals(query: NfceQuery): Promise<NfceTotals> {
    const { where, params } = buildFilters(query);

    const sql = `
      SELECT n.status::text AS status,
             COUNT(*)::int AS quantidade,
             COALESCE(SUM(n.total_value), 0) AS soma
      FROM nfce_notes n
      ${where}
      GROUP BY n.status
    `;

    const result = await this.api.query<Record<string, unknown>>(sql, params);
    if (!result.ok) throw new Error(`Falha ao somar notas fiscais: ${result.error}`);

    const byStatus: Record<string, number> = {};
    let count = 0;
    let authorizedAmount = 0;

    for (const row of result.rows) {
      const status = asText(row.status) ?? "draft";
      const quantidade = asNumber(row.quantidade);
      byStatus[status] = quantidade;
      count += quantidade;
      if (status === "authorized") authorizedAmount = asNumber(row.soma);
    }

    return { count, byStatus, authorizedAmount };
  }

  /**
   * Monta o detalhe a partir das tabelas que compõem a nota.
   *
   * São seis consultas em vez de um JOIN gigante: itens, pagamentos, registros
   * e eventos têm cardinalidades diferentes, e juntá-los numa consulta só
   * multiplicaria as linhas — o erro clássico que faz um pagamento aparecer
   * uma vez por item.
   */
  async detail(noteId: string): Promise<NfceDetail | null> {
    const notas = await this.api.query<Record<string, unknown>>(
      "SELECT * FROM nfce_notes WHERE id = $1",
      [noteId],
    );
    if (!notas.ok) throw new Error(`Falha ao carregar a nota: ${notas.error}`);

    const nota = notas.rows[0];
    if (!nota) return null;

    const porNota = async (sql: string) => {
      const resultado = await this.api.query<Record<string, unknown>>(sql, [noteId]);
      if (!resultado.ok) throw new Error(`Falha ao carregar a nota: ${resultado.error}`);
      return resultado.rows;
    };

    const [issuer, recipient, items, payments, logs, events] = await Promise.all([
      porNota("SELECT * FROM nfce_issuer WHERE note_id = $1"),
      porNota("SELECT * FROM nfce_recipient WHERE note_id = $1"),
      porNota("SELECT * FROM nfce_items WHERE note_id = $1 ORDER BY item_number"),
      porNota("SELECT * FROM nfce_payments WHERE note_id = $1 ORDER BY sequence"),
      porNota("SELECT * FROM nfce_logs WHERE note_id = $1 ORDER BY created_at DESC"),
      porNota("SELECT * FROM nfce_events WHERE note_id = $1 ORDER BY event_at DESC"),
    ]);

    return {
      note: toNote(nota),
      issuer: toIssuer(issuer[0] ?? {}),
      recipient: toRecipient(recipient[0]),
      totals: toTotals(nota),
      items: items.map(toItem),
      payments: payments.map(toPayment),
      history: sortHistory([...logs.map(toLogEntry), ...events.map(toEventEntry)]),
      authorizedXml: asText(nota.authorized_xml),
    };
  }
}
