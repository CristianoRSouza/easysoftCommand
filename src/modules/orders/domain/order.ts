import type { DateRange, SortDirection } from "@/shared/domain/paging";

/**
 * Comanda — a conta de uma mesa, aberta no PDV e fechada pelo totem.
 *
 * `syncClosePending` é o campo que importa na operação: quando verdadeiro, a
 * comanda foi paga mas o fechamento ainda não chegou ao PDV. É a situação que
 * exige alguém olhar.
 */
export interface Order {
  id: string;
  barcode: string;
  customerName: string | null;
  tableName: string;
  status: OrderStatus;
  totemName: string | null;
  syncClosePending: boolean;
  syncCloseAttempts: number;
  syncCloseLastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = "open" | "closed" | "cancelled";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  open: "Aberta",
  closed: "Fechada",
  cancelled: "Cancelada",
};

/** Interpreta o texto vindo do banco. Valor desconhecido conta como aberta. */
export function toOrderStatus(value: unknown): OrderStatus {
  return value === "closed" || value === "cancelled" ? value : "open";
}

export type OrderStatusFilter = "all" | OrderStatus;
export type OrderSortKey = "createdAt" | "tableName" | "status";

export interface OrderQuery {
  search: string;
  status: OrderStatusFilter;
  /** Quando verdadeiro, mostra apenas comandas com fechamento pendente de sincronização. */
  onlyPendingSync: boolean;
  range: DateRange;
  sortKey: OrderSortKey;
  sortDirection: SortDirection;
  page: number;
  pageSize: number;
}

export const DEFAULT_ORDER_QUERY: OrderQuery = {
  search: "",
  status: "all",
  onlyPendingSync: false,
  range: { from: null, to: null },
  sortKey: "createdAt",
  sortDirection: "desc",
  page: 1,
  pageSize: 50,
};
