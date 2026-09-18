import type { Page } from "@/shared/domain/paging";
import type { Order, OrderQuery } from "../domain/order";
import type { OrderDetail } from "../domain/order-detail";

export interface OrderRepository {
  list(query: OrderQuery): Promise<Page<Order>>;

  /**
   * Itens, pagamentos e situação do fechamento de uma comanda. `null` quando
   * ela não existe ou é de outra loja.
   */
  detail(orderId: string): Promise<OrderDetail | null>;
}
