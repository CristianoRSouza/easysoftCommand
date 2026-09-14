import type { DateRange } from "@/shared/domain/paging";

/**
 * Receita aprovada do período.
 *
 * Conta apenas transações aprovadas. Somar pendentes e negadas infla o
 * faturamento com dinheiro que não entrou — o erro que faz o lojista fechar o
 * mês achando que vendeu mais do que vendeu.
 */
export interface RevenueReport {
  range: DateRange;
  byMethod: RevenueByMethod[];
  total: RevenueAmount;
  averageTicket: number;
  /** Notas fiscais autorizadas no mesmo período, para confronto. */
  authorizedNotes: number;
}

export interface RevenueAmount {
  amount: number;
  count: number;
}

export interface RevenueByMethod extends RevenueAmount {
  method: string;
  /** Fatia do total, de 0 a 1. */
  share: number;
}

/** Ticket médio. Zero transações devolve zero, não divisão por zero. */
export function averageTicketOf(total: RevenueAmount): number {
  return total.count > 0 ? total.amount / total.count : 0;
}

/** Soma de um meio de pagamento, antes de a fatia ser calculada. */
export interface MethodAmount extends RevenueAmount {
  method: string;
}

/**
 * Monta o relatório a partir das somas por meio de pagamento.
 *
 * A fatia de cada meio é derivada aqui, e não pedida ao banco: são dois
 * números que precisam concordar, e derivá-los do mesmo total garante que
 * concordem.
 */
export function buildReport(
  range: DateRange,
  entries: MethodAmount[],
  authorizedNotes: number,
): RevenueReport {
  const total: RevenueAmount = entries.reduce(
    (acc, entry) => ({ amount: acc.amount + entry.amount, count: acc.count + entry.count }),
    { amount: 0, count: 0 },
  );

  return {
    range,
    byMethod: entries
      .map((entry) => ({
        ...entry,
        share: total.amount > 0 ? entry.amount / total.amount : 0,
      }))
      .sort((a, b) => b.amount - a.amount),
    total,
    averageTicket: averageTicketOf(total),
    authorizedNotes,
  };
}
