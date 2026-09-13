import type { TransactionRepository } from "../application/transaction-repository";
import type { Transaction, TransactionQuery } from "../domain/transaction";
import {
  pageToRange,
  startOfDayIso,
  startOfNextDayIso,
  type Page,
} from "@/shared/domain/paging";
import type { ElectronApi } from "@/shared/runtime/electron-api";
import { asNumber, asText, asIsoDate } from "@/shared/infrastructure/convert";

const SORT_COLUMN: Record<TransactionQuery["sortKey"], string> = {
  createdAt: "created_at",
  amount: "amount",
  status: "status",
};

function toTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: asText(row.id) ?? "",
    paymentMethod: asText(row.payment_method) ?? "",
    amount: asNumber(row.amount),
    installments: asNumber(row.installments),
    nsu: asText(row.nsu),
    authorizationCode: asText(row.authorization_code),
    status: asText(row.status) ?? "",
    createdAt: asIsoDate(row.created_at),
  };
}

export class PostgresTransactionRepository implements TransactionRepository {
  constructor(private readonly api: ElectronApi) {}

  async list(query: TransactionQuery): Promise<Page<Transaction>> {
    const { from } = pageToRange(query.page, query.pageSize);
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.status) {
      params.push(query.status);
      // `status` é um enum no PostgreSQL: o texto precisa ser convertido.
      conditions.push(`t.status::text = $${params.length}`);
    }
    if (query.paymentMethod) {
      params.push(query.paymentMethod);
      conditions.push(`t.payment_method::text = $${params.length}`);
    }
    if (query.range.from) {
      params.push(startOfDayIso(query.range.from));
      conditions.push(`t.created_at >= $${params.length}`);
    }
    if (query.range.to) {
      params.push(startOfNextDayIso(query.range.to));
      conditions.push(`t.created_at < $${params.length}`);
    }

    const term = query.search.trim();
    if (term) {
      params.push(`%${term}%`);
      const p = params.length;
      conditions.push(`(t.nsu ILIKE $${p} OR t.authorization_code ILIKE $${p})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const direction = query.sortDirection === "asc" ? "ASC" : "DESC";

    params.push(query.pageSize, from);
    const limitParam = params.length - 1;
    const offsetParam = params.length;

    const sql = `
      SELECT t.id, t.payment_method, t.amount, t.installments, t.nsu,
             t.authorization_code, t.status, t.created_at,
             COUNT(*) OVER () AS total
      FROM transactions t
      ${where}
      ORDER BY t.${SORT_COLUMN[query.sortKey]} ${direction}
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const result = await this.api.query<Record<string, unknown>>(sql, params);
    if (!result.ok) throw new Error(`Falha ao listar transações: ${result.error}`);

    const rows = result.rows;
    return {
      items: rows.map(toTransaction),
      total: rows[0] ? asNumber(rows[0].total) : 0,
    };
  }
}
