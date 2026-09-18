import type { Page } from "@/shared/domain/paging";
import type { Transaction, TransactionQuery } from "../domain/transaction";
import type { TransactionDetail } from "../domain/transaction-detail";

export interface TransactionRepository {
  list(query: TransactionQuery): Promise<Page<Transaction>>;

  /**
   * O detalhe técnico de um pagamento. `null` quando a transação não existe
   * ou é de outra loja.
   *
   * Separado da listagem porque o retorno do TEF é um objeto grande: trazê-lo
   * em cada linha da tabela custaria muito para uma informação que só se olha
   * quando algo deu errado.
   */
  detail(transactionId: string): Promise<TransactionDetail | null>;
}
