import type { Page } from "@/shared/domain/paging";
import type { Order, OrderQuery } from "../domain/order";

export interface OrderRepository {
  list(query: OrderQuery): Promise<Page<Order>>;
}
