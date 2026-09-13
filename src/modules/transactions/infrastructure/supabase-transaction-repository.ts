import type { SupabaseClient } from "@supabase/supabase-js";
import type { TransactionRepository } from "../application/transaction-repository";
import type { Transaction, TransactionQuery } from "../domain/transaction";
import {
  pageToRange,
  startOfDayIso,
  startOfNextDayIso,
  type Page,
} from "@/shared/domain/paging";
import type { Tenant } from "@/shared/tenant/tenant";
import { asNumber, asText, asIsoDate } from "@/shared/infrastructure/convert";

const COLUMNS =
  "id, payment_method, amount, installments, nsu, authorization_code, status, created_at";

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

export class SupabaseTransactionRepository implements TransactionRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  async list(query: TransactionQuery): Promise<Page<Transaction>> {
    const { from, to } = pageToRange(query.page, query.pageSize);

    let request = this.client
      .from("vw_command_transactions")
      .select(COLUMNS, { count: "exact" })
      .eq("store_id", this.tenant.storeId);

    if (query.status) request = request.eq("status", query.status);
    if (query.paymentMethod) request = request.eq("payment_method", query.paymentMethod);
    if (query.range.from) request = request.gte("created_at", startOfDayIso(query.range.from));
    if (query.range.to) request = request.lt("created_at", startOfNextDayIso(query.range.to));

    const term = query.search.trim();
    if (term) {
      const safe = term.replace(/[%,()]/g, " ");
      request = request.or(`nsu.ilike.%${safe}%,authorization_code.ilike.%${safe}%`);
    }

    const { data, error, count } = await request
      .order(SORT_COLUMN[query.sortKey], { ascending: query.sortDirection === "asc" })
      .range(from, to);

    if (error) throw new Error(`Falha ao listar transações: ${error.message}`);

    return {
      items: ((data ?? []) as unknown as Record<string, unknown>[]).map(toTransaction),
      total: count ?? 0,
    };
  }
}
