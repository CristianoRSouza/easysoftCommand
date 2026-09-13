import { useQuery } from "@tanstack/react-query";
import { useContainer } from "@/shared/container/container-context";
import { listProducts } from "../application/list-products";
import type { ProductPage, ProductQuery } from "../domain/product";

export function useProducts(query: ProductQuery) {
  const { products } = useContainer();
  return useQuery<ProductPage>({
    queryKey: ["products", query],
    queryFn: () => listProducts(products)(query),
    // Mantém a página anterior visível enquanto a próxima carrega, em vez de
    // piscar a tabela vazia a cada troca de filtro.
    placeholderData: (previous) => previous,
  });
}
