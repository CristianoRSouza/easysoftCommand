import type { Page } from "@/shared/domain/paging";
import type { Transaction, TransactionQuery } from "../domain/transaction";

export interface TransactionRepository {
  list(query: TransactionQuery): Promise<Page<Transaction>>;
}
