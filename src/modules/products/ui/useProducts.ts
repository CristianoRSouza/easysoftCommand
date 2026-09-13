import { useQuery } from "@tanstack/react-query";
import { useContainer } from "@/shared/container/container-context";
import { listProducts } from "../application/list-products";
import type { ProductQuery, Product } from "../domain/product";
import type { Page } from "@/shared/domain/paging";

export function useProducts(query: ProductQuery) {
  const { products } = useContainer();
  return useQuery<Page<Product>>({
    queryKey: ["products", query],
    queryFn: () => listProducts(products)(query),
    // Mantém a página anterior visível enquanto a próxima carrega, em vez de
    // piscar a tabela vazia a cada troca de filtro.
    placeholderData: (previous) => previous,
  });
}
