import type { DateRange, SortDirection } from "@/shared/domain/paging";

/**
 * Transação — um pagamento processado pelo totem, via TEF ou PIX.
 *
 * `nsu` e `authorizationCode` são o que a operadora devolve e o que o lojista
 * usa para conferir com a maquininha. Por isso aparecem na listagem, mesmo
 * sendo campos técnicos.
 */
export interface Transaction {
  id: string;
  paymentMethod: string;
  amount: number;
  installments: number;
  nsu: string | null;
  authorizationCode: string | null;
  status: string;
  createdAt: string;
}

/** Rótulos dos meios de pagamento. Valor fora da lista aparece como veio do banco. */
const PAYMENT_LABEL: Record<string, string> = {
  credit: "Crédito",
  debit: "Débito",
  pix: "PIX",
  voucher: "Voucher",
  cash: "Dinheiro",
};

export function paymentMethodLabel(method: string): string {
  return PAYMENT_LABEL[method] ?? method;
}

type StatusTone = "success" | "warning" | "info" | "destructive" | "muted";

/**
 * Os status que a transação assume, com rótulo e cor — os mesmos do projeto
 * anterior.
 *
 * É a fonte única do rótulo, da cor e das opções do filtro. Quando eram três
 * listas, `processing` e `aborted` ficaram de fora das três: apareciam em
 * inglês e não podiam ser filtrados, e são justamente os pagamentos que
 * travaram no meio do caminho.
 */
export const TRANSACTION_STATUSES: { value: string; label: string; tone: StatusTone }[] = [
  { value: "approved", label: "Aprovada", tone: "success" },
  { value: "pending", label: "Pendente", tone: "warning" },
  { value: "tef_requested", label: "TEF solicitado", tone: "warning" },
  { value: "processing", label: "Em processamento", tone: "info" },
  { value: "declined", label: "Recusada", tone: "muted" },
  { value: "failed", label: "Falha", tone: "destructive" },
  { value: "cancelled", label: "Cancelada", tone: "destructive" },
  { value: "aborted", label: "Abortada", tone: "muted" },
  { value: "rejected", label: "Rejeitada", tone: "destructive" },
  { value: "error", label: "Erro", tone: "destructive" },
];

const POR_VALOR = new Map(TRANSACTION_STATUSES.map((status) => [status.value, status]));

/** Valor fora da lista aparece como veio do banco — esconder seria pior. */
export function transactionStatusLabel(status: string): string {
  return POR_VALOR.get(status)?.label ?? status;
}

export function transactionStatusTone(status: string): StatusTone {
  return POR_VALOR.get(status)?.tone ?? "muted";
}

export type TransactionSortKey = "createdAt" | "amount" | "status";

export interface TransactionQuery {
  search: string;
  /** Vazio significa todos. */
  status: string;
  paymentMethod: string;
  range: DateRange;
  sortKey: TransactionSortKey;
  sortDirection: SortDirection;
  page: number;
  pageSize: number;
}

export const DEFAULT_TRANSACTION_QUERY: TransactionQuery = {
  search: "",
  status: "",
  paymentMethod: "",
  range: { from: null, to: null },
  sortKey: "createdAt",
  sortDirection: "desc",
  page: 1,
  pageSize: 50,
};
