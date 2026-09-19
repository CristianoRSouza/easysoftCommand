import type { SupabaseClient } from "@supabase/supabase-js";
import type { RevenueRepository } from "../application/revenue-repository";
import {
  buildReport,
  isRevenueMethod,
  REVENUE_METHODS,
  type RevenueOrderItem,
  type RevenueReport,
  type RevenueTransaction,
} from "../domain/revenue";
import { startOfDayIso, startOfNextDayIso, type DateRange } from "@/shared/domain/paging";
import type { Tenant } from "@/shared/tenant/tenant";
import { asNumber, asText } from "@/shared/infrastructure/convert";

/** Tamanho do lote nas varreduras paginadas. */
const BATCH = 1000;

/**
 * Quantos identificadores cabem num filtro `in`.
 *
 * O filtro do PostgREST viaja na URL, e URL tem limite de tamanho. O projeto
 * anterior manda até cinco mil de uma vez; acima de algumas centenas a
 * requisição passa a ser recusada pelo servidor, e o erro não diz que o
 * problema foi o tamanho.
 */
const ID_CHUNK = 150;

type Row = Record<string, unknown>;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Receita aprovada.
 *
 * O PostgREST não agrega, então a soma acontece aqui. A varredura é em lotes
 * com `id` como cursor: com deslocamento, uma transação nova durante a leitura
 * empurraria linhas e a soma pularia registros, produzindo um faturamento
 * silenciosamente menor.
 *
 * O projeto anterior busca no máximo cinco mil transações e corta o resto sem
 * avisar — em loja movimentada, o total do mês simplesmente vem errado.
 */
export class SupabaseRevenueRepository implements RevenueRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  async report(range: DateRange): Promise<RevenueReport> {
    const transactions = await this.approvedTransactions(range);
    const previousYear = await this.approvedTransactions(shiftYear(range, -1));

    const orderIds = [...new Set(transactions.flatMap((tx) => tx.orderIds))];
    const [totemByOrder, itemsByOrder, authorizedNotes] = await Promise.all([
      this.totemByOrder(orderIds),
      this.itemsByOrder(orderIds),
      this.countAuthorizedNotes(transactions.map((tx) => tx.id)),
    ]);

    return buildReport({
      range,
      transactions,
      previousYear,
      totemByOrder,
      itemsByOrder,
      authorizedNotes,
    });
  }

  /** Todas as transações aprovadas do período, sem corte. */
  private async approvedTransactions(range: DateRange): Promise<RevenueTransaction[]> {
    const encontradas: RevenueTransaction[] = [];
    let afterId: string | null = null;

    for (;;) {
      let request = this.client
        .from("vw_command_transactions")
        .select("id, created_at, payment_method, amount, order_ids")
        .eq("store_id", this.tenant.storeId)
        // Só aprovadas: somar pendentes e negadas infla o faturamento com
        // dinheiro que não entrou.
        .eq("status", "approved")
        .in("payment_method", [...REVENUE_METHODS]);

      if (range.from) request = request.gte("created_at", startOfDayIso(range.from));
      if (range.to) request = request.lt("created_at", startOfNextDayIso(range.to));
      if (afterId) request = request.gt("id", afterId);

      const { data, error } = await request.order("id", { ascending: true }).limit(BATCH);
      if (error) throw new Error(`Falha ao somar a receita: ${error.message}`);

      const rows = (data ?? []) as unknown as Row[];
      if (rows.length === 0) break;

      for (const row of rows) {
        const method = asText(row.payment_method) ?? "";
        if (!isRevenueMethod(method)) continue;
        encontradas.push({
          id: asText(row.id) ?? "",
          createdAt: asText(row.created_at) ?? "",
          method,
          amount: asNumber(row.amount),
          orderIds: Array.isArray(row.order_ids) ? row.order_ids.map(String) : [],
        });
      }

      if (rows.length < BATCH) break;
      afterId = asText(rows[rows.length - 1]?.id);
      if (!afterId) break;
    }

    return encontradas;
  }

  /** Em que totem cada comanda foi aberta. */
  private async totemByOrder(orderIds: string[]): Promise<Map<string, string>> {
    const mapa = new Map<string, string>();

    for (const lote of chunks(orderIds, ID_CHUNK)) {
      const { data, error } = await this.client
        .from("vw_command_orders")
        .select("id, totem_name")
        .in("id", lote);

      if (error) throw new Error(`Falha ao ler as comandas: ${error.message}`);

      for (const row of (data ?? []) as unknown as Row[]) {
        const id = asText(row.id);
        if (id) mapa.set(id, asText(row.totem_name) ?? "Sem totem");
      }
    }

    return mapa;
  }

  /** Os itens de cada comanda, para o ranking de produtos. */
  private async itemsByOrder(orderIds: string[]): Promise<Map<string, RevenueOrderItem[]>> {
    const mapa = new Map<string, RevenueOrderItem[]>();

    for (const lote of chunks(orderIds, ID_CHUNK)) {
      const { data, error } = await this.client
        .from("vw_command_order_items")
        .select("order_id, product_name, quantity, unit_price, subtotal, status")
        .in("order_id", lote);

      if (error) throw new Error(`Falha ao ler os itens das comandas: ${error.message}`);

      for (const row of (data ?? []) as unknown as Row[]) {
        // Item cancelado não foi vendido: entrar no ranking daria a um produto
        // uma saída que não houve.
        if ((asText(row.status) ?? "").toLowerCase() === "cancelled") continue;

        const orderId = asText(row.order_id);
        if (!orderId) continue;

        const lista = mapa.get(orderId) ?? [];
        lista.push({
          orderId,
          product: asText(row.product_name) ?? "Produto sem nome",
          quantity: asNumber(row.quantity),
          unitPrice: asNumber(row.unit_price),
          subtotal: asNumber(row.subtotal),
        });
        mapa.set(orderId, lista);
      }
    }

    return mapa;
  }

  /**
   * Notas ligadas às transações do período.
   *
   * A contagem é por vínculo, e não por data de emissão: a nota de uma venda
   * das 23h50 pode ser autorizada depois da meia-noite, e contá-la por data
   * faria a loja parecer ter vendido sem emitir.
   *
   * Notas em revisão manual e inutilizadas não contam — elas existem, mas não
   * documentaram a venda.
   */
  private async countAuthorizedNotes(transactionIds: string[]): Promise<number> {
    let total = 0;

    for (const lote of chunks(transactionIds, ID_CHUNK)) {
      const { count, error } = await this.client
        .from("vw_nfce_notes")
        .select("id", { count: "exact", head: true })
        .eq("store_id", this.tenant.storeId)
        .in("transaction_id", lote)
        .not("status", "in", "(manual_review,unusable)");

      if (error) throw new Error(`Falha ao contar as notas: ${error.message}`);
      total += count ?? 0;
    }

    return total;
  }
}

/** O mesmo período, deslocado em anos — para a comparação com o ano anterior. */
function shiftYear(range: DateRange, years: number): DateRange {
  const shift = (day: string | null) => {
    if (!day) return null;
    const [ano, mes, dia] = day.split("-");
    return `${Number(ano) + years}-${mes}-${dia}`;
  };
  return { from: shift(range.from), to: shift(range.to) };
}
