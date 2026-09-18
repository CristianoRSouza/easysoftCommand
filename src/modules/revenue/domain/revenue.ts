import type { DateRange } from "@/shared/domain/paging";

/**
 * Receita aprovada do período.
 *
 * Conta apenas transações aprovadas nos três meios eletrônicos — crédito,
 * débito e PIX. Dinheiro não passa pelo TEF e por isso não aparece aqui; era
 * assim no projeto anterior, e mudar o critério mudaria todo número que a loja
 * já conhece.
 *
 * Somar pendentes e negadas infla o faturamento com dinheiro que não entrou —
 * o erro que faz o lojista fechar o mês achando que vendeu mais do que vendeu.
 */
export const REVENUE_METHODS = ["credit", "debit", "pix"] as const;
export type RevenueMethod = (typeof REVENUE_METHODS)[number];

export const METHOD_LABEL: Record<RevenueMethod, string> = {
  credit: "Crédito",
  debit: "Débito",
  pix: "PIX",
};

export function isRevenueMethod(value: string): value is RevenueMethod {
  return (REVENUE_METHODS as readonly string[]).includes(value);
}

/** Uma transação aprovada, como as agregações precisam dela. */
export interface RevenueTransaction {
  id: string;
  createdAt: string;
  method: RevenueMethod;
  amount: number;
  orderIds: string[];
}

/** Um item de comanda, para o ranking de produtos. */
export interface RevenueOrderItem {
  orderId: string;
  product: string;
  quantity: number;
  subtotal: number;
}

export interface RevenueAmount {
  amount: number;
  count: number;
}

export interface MethodTotal extends RevenueAmount {
  method: RevenueMethod;
  /** Fatia do total, de 0 a 1. */
  share: number;
}

export interface DayTotal {
  day: string;
  label: string;
  credit: number;
  debit: number;
  pix: number;
  total: number;
  /** Soma progressiva do período até este dia. */
  cumulative: number;
}

export interface HourTotal {
  hour: number;
  label: string;
  credit: number;
  debit: number;
  pix: number;
  total: number;
}

export interface TotemTotal extends RevenueAmount {
  totem: string;
}

export interface ProductTotal {
  product: string;
  quantity: number;
  amount: number;
  transactions: number;
}

export interface MonthComparison {
  month: string;
  label: string;
  current: number;
  previous: number;
}

export interface RevenueReport {
  range: DateRange;
  total: RevenueAmount;
  byMethod: MethodTotal[];
  averageTicket: number;
  /** Notas autorizadas ligadas às transações do período, para confronto. */
  authorizedNotes: number;
  byDay: DayTotal[];
  byHour: HourTotal[];
  byTotem: TotemTotal[];
  topProducts: ProductTotal[];
  byMonth: MonthComparison[];
  /** As transações do período, da mais recente para a mais antiga. */
  transactions: RevenueTransaction[];
}

/** Ticket médio. Zero transações devolve zero, não divisão por zero. */
export function averageTicketOf(total: RevenueAmount): number {
  return total.count > 0 ? total.amount / total.count : 0;
}

function zeroByMethod(): Record<RevenueMethod, number> {
  return { credit: 0, debit: 0, pix: 0 };
}

/** `AAAA-MM-DD` no fuso de quem olha — o dia que o lojista chama de "ontem". */
function localDay(iso: string): string {
  const d = new Date(iso);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function dayLabel(day: string): string {
  const [, mes, dia] = day.split("-");
  return `${dia}/${mes}`;
}

function monthLabel(month: string): string {
  const [ano, mes] = month.split("-");
  return `${mes}/${(ano ?? "").slice(-2)}`;
}

function totalsByMethod(transactions: RevenueTransaction[]): MethodTotal[] {
  const somas = new Map<RevenueMethod, RevenueAmount>();
  for (const method of REVENUE_METHODS) somas.set(method, { amount: 0, count: 0 });

  for (const tx of transactions) {
    const atual = somas.get(tx.method)!;
    atual.amount += tx.amount;
    atual.count += 1;
  }

  const total = [...somas.values()].reduce((acc, v) => acc + v.amount, 0);

  // A ordem é fixa — crédito, débito, PIX — e não segue o valor: ordenar por
  // tamanho faria a cor de cada meio trocar de lugar a cada período.
  return REVENUE_METHODS.map((method) => {
    const soma = somas.get(method)!;
    return { method, ...soma, share: total > 0 ? soma.amount / total : 0 };
  });
}

function totalsByDay(transactions: RevenueTransaction[]): DayTotal[] {
  const dias = new Map<string, Record<RevenueMethod, number>>();
  for (const tx of transactions) {
    const dia = localDay(tx.createdAt);
    const bucket = dias.get(dia) ?? zeroByMethod();
    bucket[tx.method] += tx.amount;
    dias.set(dia, bucket);
  }

  let acumulado = 0;
  return [...dias.keys()].sort().map((day) => {
    const b = dias.get(day)!;
    const total = b.credit + b.debit + b.pix;
    acumulado += total;
    return { day, label: dayLabel(day), ...b, total, cumulative: acumulado };
  });
}

function totalsByHour(transactions: RevenueTransaction[]): HourTotal[] {
  // As 24 horas sempre existem, mesmo vazias: um gráfico que pula as horas sem
  // venda esconde justamente o que se quer ver — quando a loja fica parada.
  const horas: HourTotal[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}h`,
    ...zeroByMethod(),
    total: 0,
  }));

  for (const tx of transactions) {
    const h = new Date(tx.createdAt).getHours();
    const slot = horas[h];
    if (!slot) continue;
    slot[tx.method] += tx.amount;
    slot.total = slot.credit + slot.debit + slot.pix;
  }

  return horas;
}

const SEM_TOTEM = "Sem totem";
const TOTEM_LIMIT = 12;

/**
 * Receita por totem.
 *
 * Uma transação pode fechar comandas de mais de um totem. O valor é dividido
 * em partes iguais entre eles: atribuir tudo ao primeiro inventaria receita
 * num totem e tiraria de outro.
 */
function totalsByTotem(
  transactions: RevenueTransaction[],
  totemByOrder: Map<string, string>,
): TotemTotal[] {
  const somas = new Map<string, RevenueAmount>();

  for (const tx of transactions) {
    const totens = new Set(tx.orderIds.map((id) => totemByOrder.get(id) ?? SEM_TOTEM));
    if (totens.size === 0) totens.add(SEM_TOTEM);
    const parte = tx.amount / totens.size;

    for (const totem of totens) {
      const atual = somas.get(totem) ?? { amount: 0, count: 0 };
      atual.amount += parte;
      atual.count += 1;
      somas.set(totem, atual);
    }
  }

  return [...somas.entries()]
    .map(([totem, soma]) => ({ totem, ...soma }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, TOTEM_LIMIT);
}

const PRODUCT_LIMIT = 10;

/**
 * Os produtos que mais saíram.
 *
 * O valor da transação é repartido entre os itens na proporção do subtotal de
 * cada um: é o que aproxima o quanto daquele dinheiro veio de cada produto,
 * já considerando desconto e acréscimo aplicados na comanda inteira.
 */
function topProductsOf(
  transactions: RevenueTransaction[],
  itemsByOrder: Map<string, RevenueOrderItem[]>,
): ProductTotal[] {
  const somas = new Map<string, { quantity: number; amount: number; txIds: Set<string> }>();

  for (const tx of transactions) {
    const itens = tx.orderIds.flatMap((id) => itemsByOrder.get(id) ?? []);
    const subtotalDaTransacao = itens.reduce((acc, item) => acc + item.subtotal, 0);
    if (subtotalDaTransacao <= 0) continue;

    for (const item of itens) {
      const atual = somas.get(item.product) ?? { quantity: 0, amount: 0, txIds: new Set<string>() };
      atual.quantity += item.quantity;
      atual.amount += tx.amount * (item.subtotal / subtotalDaTransacao);
      atual.txIds.add(tx.id);
      somas.set(item.product, atual);
    }
  }

  return [...somas.entries()]
    .map(([product, v]) => ({
      product,
      quantity: v.quantity,
      amount: v.amount,
      transactions: v.txIds.size,
    }))
    .sort((a, b) => b.quantity - a.quantity || b.amount - a.amount)
    .slice(0, PRODUCT_LIMIT);
}

/**
 * Mês a mês, contra os mesmos meses do ano anterior.
 *
 * Todos os meses do período aparecem, inclusive os sem venda — um mês que some
 * do gráfico é lido como mês que não existiu, e não como mês parado.
 */
function monthsOf(range: DateRange, current: Map<string, number>, previous: Map<string, number>) {
  const meses = new Set<string>([...current.keys(), ...previous.keys()]);

  if (range.from && range.to) {
    const inicio = new Date(`${range.from}T00:00:00`);
    const fim = new Date(`${range.to}T00:00:00`);
    const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
    while (cursor <= fim) {
      meses.add(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  return [...meses].sort().map((month) => ({
    month,
    label: monthLabel(month),
    current: current.get(month) ?? 0,
    previous: previous.get(month) ?? 0,
  }));
}

/** Soma por mês, com o ano anterior deslocado para casar com o mês atual. */
function amountByMonth(transactions: RevenueTransaction[], shiftYears = 0): Map<string, number> {
  const somas = new Map<string, number>();
  for (const tx of transactions) {
    const base = new Date(tx.createdAt);
    const data = new Date(base.getFullYear() + shiftYears, base.getMonth(), 1);
    const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
    somas.set(chave, (somas.get(chave) ?? 0) + tx.amount);
  }
  return somas;
}

export interface RevenueSources {
  range: DateRange;
  transactions: RevenueTransaction[];
  /** Mesmo período do ano anterior, para a comparação mensal. */
  previousYear: RevenueTransaction[];
  totemByOrder: Map<string, string>;
  itemsByOrder: Map<string, RevenueOrderItem[]>;
  authorizedNotes: number;
}

/**
 * Monta o relatório inteiro a partir das linhas lidas do banco.
 *
 * Tudo aqui é cálculo puro sobre as mesmas transações — as fatias, as somas
 * por dia e o ticket médio saem do mesmo conjunto, e por isso não podem
 * discordar entre si.
 */
export function buildReport(sources: RevenueSources): RevenueReport {
  const { transactions } = sources;

  const total = transactions.reduce<RevenueAmount>(
    (acc, tx) => ({ amount: acc.amount + tx.amount, count: acc.count + 1 }),
    { amount: 0, count: 0 },
  );

  return {
    range: sources.range,
    total,
    byMethod: totalsByMethod(transactions),
    averageTicket: averageTicketOf(total),
    authorizedNotes: sources.authorizedNotes,
    byDay: totalsByDay(transactions),
    byHour: totalsByHour(transactions),
    byTotem: totalsByTotem(transactions, sources.totemByOrder),
    topProducts: topProductsOf(transactions, sources.itemsByOrder),
    byMonth: monthsOf(
      sources.range,
      amountByMonth(transactions),
      amountByMonth(sources.previousYear, 1),
    ),
    transactions: [...transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}
