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

const STATUS_LABEL: Record<string, string> = {
  approved: "Aprovada",
  pending: "Pendente",
  declined: "Negada",
  cancelled: "Cancelada",
  refunded: "Estornada",
  error: "Erro",
};

export function transactionStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

/** Como o status deve ser colorido na listagem. */
export function transactionStatusTone(
  status: string,
): "success" | "warning" | "destructive" | "muted" {
  if (status === "approved") return "success";
  if (status === "pending") return "warning";
  if (status === "declined" || status === "error") return "destructive";
  return "muted";
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
