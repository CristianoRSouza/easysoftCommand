import type { RevenueRepository } from "../application/revenue-repository";
import { buildReport, type MethodAmount, type RevenueReport } from "../domain/revenue";
import { startOfDayIso, startOfNextDayIso, type DateRange } from "@/shared/domain/paging";
import type { ElectronApi } from "@/shared/runtime/electron-api";
import { asNumber, asText } from "@/shared/infrastructure/convert";

type Row = Record<string, unknown>;

/** Condições de período compartilhadas pelas duas consultas. */
function periodFilter(range: DateRange, column: string): { where: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (range.from) {
    params.push(startOfDayIso(range.from));
    conditions.push(`${column} >= $${params.length}`);
  }
  if (range.to) {
    params.push(startOfNextDayIso(range.to));
    conditions.push(`${column} < $${params.length}`);
  }
  return { where: conditions.length ? ` AND ${conditions.join(" AND ")}` : "", params };
}

/**
 * Soma a receita no banco.
 *
 * Aqui há SQL de verdade, então `GROUP BY` resolve numa consulta — ao contrário
 * da nuvem, onde é preciso varrer em lotes.
 */
export class PostgresRevenueRepository implements RevenueRepository {
  constructor(private readonly api: ElectronApi) {}

  async report(range: DateRange): Promise<RevenueReport> {
    const transacoes = periodFilter(range, "t.created_at");
    const notas = periodFilter(range, "n.issued_at");

    const [porMetodo, autorizadas] = await Promise.all([
      this.api.query<Row>(
        `SELECT t.payment_method::text AS method,
                COUNT(*)::int AS count,
                COALESCE(SUM(t.amount), 0) AS amount
         FROM transactions t
         WHERE t.status::text = 'approved'${transacoes.where}
         GROUP BY t.payment_method`,
        transacoes.params,
      ),
      this.api.query<Row>(
        `SELECT COUNT(*)::int AS total
         FROM nfce_notes n
         WHERE n.status::text = 'authorized'${notas.where}`,
        notas.params,
      ),
    ]);

    if (!porMetodo.ok) throw new Error(`Falha ao somar a receita: ${porMetodo.error}`);
    if (!autorizadas.ok) throw new Error(`Falha ao contar as notas: ${autorizadas.error}`);

    const entries: MethodAmount[] = porMetodo.rows.map((row) => ({
      method: asText(row.method) ?? "outros",
      amount: asNumber(row.amount),
      count: asNumber(row.count),
    }));

    return buildReport(
      range,
      entries,
      autorizadas.rows[0] ? asNumber(autorizadas.rows[0].total) : 0,
    );
  }
}
