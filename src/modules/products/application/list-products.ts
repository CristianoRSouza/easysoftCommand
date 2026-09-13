import type { Page } from "@/shared/domain/paging";
import type { Product, ProductQuery } from "../domain/product";
import type { ProductRepository } from "./product-repository";

/**
 * Lista produtos conforme os critérios informados.
 *
 * Não sabe — e não pode saber — se os dados vêm do PostgreSQL local ou do
 * Supabase. É exatamente essa ignorância que elimina as 101 repetições de
 * `if (isElectron())` do projeto anterior.
 */
export function listProducts(repository: ProductRepository) {
  return (query: ProductQuery): Promise<Page<Product>> => repository.list(query);
}
