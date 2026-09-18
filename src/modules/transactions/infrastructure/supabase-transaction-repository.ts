import type { SupabaseClient } from "@supabase/supabase-js";
import type { TransactionRepository } from "../application/transaction-repository";
import type { Transaction, TransactionQuery } from "../domain/transaction";
import type {
  PixTracking,
  TefSnapshot,
  TransactionDetail,
} from "../domain/transaction-detail";
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

const DETAIL_COLUMNS = [
  COLUMNS,
  "tef_transaction_id, order_ids, tef_result",
  "pix_status, pix_qrcode_id, pix_txid, pix_e2e_id, pix_paid_at, pix_last_poll_at, pix_provider_url",
].join(", ");

/**
 * O retorno do TEF chega como objeto do banco, mas já chegou como texto em
 * instalações antigas. As duas formas são aceitas — e o que não se entende
 * vira `null`, em vez de derrubar a tela por causa de um campo técnico.
 */
function toTefSnapshot(raw: unknown): TefSnapshot | null {
  const objeto = typeof raw === "string" ? parseJson(raw) : raw;
  if (!objeto || typeof objeto !== "object") return null;

  const snapshot = objeto as Record<string, unknown>;
  return {
    merchantReceipt: asLines(snapshot.merchantReceipt),
    cardholderReceipt: asLines(snapshot.cardholderReceipt),
    authorizationResponse: snapshot.authorizationResponse ?? null,
  };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const QUEBRA_DE_LINHA = /\r?\n/;

/** As vias vêm como lista de linhas; texto solto é aceito como linha única. */
function asLines(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((line) => String(line));
  const texto = asText(value);
  return texto ? texto.split(QUEBRA_DE_LINHA) : [];
}

function toPixTracking(row: Record<string, unknown>): PixTracking {
  return {
    status: asText(row.pix_status),
    qrcodeId: asText(row.pix_qrcode_id),
    txid: asText(row.pix_txid),
    endToEndId: asText(row.pix_e2e_id),
    paidAt: row.pix_paid_at == null ? null : asIsoDate(row.pix_paid_at),
    lastPollAt: row.pix_last_poll_at == null ? null : asIsoDate(row.pix_last_poll_at),
    providerUrl: asText(row.pix_provider_url),
  };
}

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

  /**
   * O detalhe técnico, buscado só quando alguém abre a transação.
   *
   * O filtro de loja vem junto: sem ele, um identificador de outra loja
   * devolveria o retorno da operadora de um pagamento que não é desta loja.
   */
  async detail(transactionId: string): Promise<TransactionDetail | null> {
    const { data, error } = await this.client
      .from("vw_command_transactions")
      .select(DETAIL_COLUMNS)
      .eq("store_id", this.tenant.storeId)
      .eq("id", transactionId)
      .maybeSingle();

    if (error) throw new Error(`Falha ao carregar a transação: ${error.message}`);
    if (!data) return null;

    const row = data as unknown as Record<string, unknown>;

    return {
      transaction: toTransaction(row),
      tefTransactionId: asText(row.tef_transaction_id),
      orderIds: Array.isArray(row.order_ids) ? row.order_ids.map(String) : [],
      tef: toTefSnapshot(row.tef_result),
      pix: toPixTracking(row),
    };
  }
}
