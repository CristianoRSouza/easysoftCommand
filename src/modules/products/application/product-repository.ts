import type { Page } from "@/shared/domain/paging";
import type { ProductFiscal } from "../domain/product-fiscal";
import type { Product, ProductQuery } from "../domain/product";

/**
 * Porta de acesso a produtos.
 *
 * A interface de usuário depende deste contrato, nunca de uma implementação.
 * Quem decide qual implementação usar é `src/composition/container.ts`, uma
 * única vez, na inicialização.
 */
export interface ProductRepository {
  list(query: ProductQuery): Promise<Page<Product>>;

  /**
   * A classificação fiscal do produto. `null` quando o cadastro fiscal não
   * existe para ele — o que é comum em item recém-criado no PDV.
   */
  fiscal(productId: string): Promise<ProductFiscal | null>;
}
