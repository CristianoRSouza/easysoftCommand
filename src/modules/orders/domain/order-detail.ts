import type { Order } from "./order";

/**
 * O detalhe de uma comanda.
 *
 * Reúne o que foi consumido, o que foi pago e em que pé está o fechamento no
 * PDV. As três coisas juntas respondem à pergunta que leva alguém a abrir esta
 * tela: o cliente pagou, e por que a venda não fechou no caixa?
 */
export interface OrderDetail {
  order: Order;
  items: OrderItem[];
  payments: OrderPayment[];
  closing: OrderClosing;
}

export interface OrderItem {
  id: string;
  productName: string;
  barcode: string | null;
  unitName: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  /** De onde o item veio — lançado no PDV ou pedido no totem. */
  origin: string | null;
  status: string | null;
  /** `true` quando o item já foi espelhado no Firebird do PDV. */
  syncedToFirebird: boolean;
  firebirdId: string | null;
}

/** Item cancelado continua na comanda, mas não é venda. */
export function isCancelled(item: OrderItem): boolean {
  return (item.status ?? "").toLowerCase() === "cancelled";
}

/** Soma dos itens que valem — os cancelados ficam de fora. */
export function sumItems(items: OrderItem[]): number {
  return items.filter((item) => !isCancelled(item)).reduce((total, i) => total + i.subtotal, 0);
}

export interface OrderPayment {
  id: string;
  method: string;
  amount: number;
  status: string;
  createdAt: string;
}

/** Só o que foi aprovado entrou no caixa. */
export function sumApproved(payments: OrderPayment[]): number {
  return payments
    .filter((payment) => payment.status === "approved")
    .reduce((total, payment) => total + payment.amount, 0);
}

/**
 * O fechamento da comanda no PDV.
 *
 * O totem cobra e a venda precisa ser espelhada no Firebird do PDV. Enquanto
 * isso não acontece, o dinheiro entrou e o caixa não sabe — é exatamente o
 * estado que o painel existe para mostrar.
 */
export interface OrderClosing {
  pending: boolean;
  attempts: number;
  lastError: string | null;
  requestedAt: string | null;
  closedAt: string | null;
  /** Identificadores da venda e do caixa no Firebird, quando já existem. */
  firebirdSaleId: string | null;
  firebirdCashRegisterId: string | null;
}

export type ClosingState = "closed" | "pending" | "failing" | "open";

/**
 * Em que pé está o fechamento.
 *
 * `failing` separa a espera normal da espera com erro: as duas parecem iguais
 * na tela ("pendente"), mas só uma precisa de alguém agora.
 */
export function closingState(closing: OrderClosing): ClosingState {
  if (closing.closedAt) return "closed";
  if (closing.lastError) return "failing";
  if (closing.pending) return "pending";
  return "open";
}

export const CLOSING_LABEL: Record<ClosingState, string> = {
  closed: "Fechada no PDV",
  pending: "Aguardando o PDV",
  failing: "Falhando ao fechar",
  open: "Sem fechamento pedido",
};
