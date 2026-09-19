import { useState } from "react";
import {
  DEFAULT_PRODUCT_QUERY,
  type Product,
  type ProductQuery,
  type ProductSortKey,
} from "../domain/product";
import { useProducts } from "./useProducts";
import { ProductFilters } from "./ProductFilters";
import { ProductTable } from "./ProductTable";
import { ProductFiscalDialog } from "./ProductFiscalDialog";
import { ErrorNotice, Loading, PageHeader, Pagination } from "@/shared/ui/primitives";

export function ProductsPage() {
  const [query, setQuery] = useState<ProductQuery>(DEFAULT_PRODUCT_QUERY);
  const [aberto, setAberto] = useState<Product | null>(null);
  const { data, isPending, error } = useProducts(query);

  const patch = (next: Partial<ProductQuery>) =>
    setQuery((current) => ({ ...current, ...next }));

  // Clicar na coluna já ordenada inverte a direção; em outra, começa ascendente.
  const sortBy = (key: ProductSortKey) =>
    patch({
      sortKey: key,
      sortDirection: query.sortKey === key && query.sortDirection === "asc" ? "desc" : "asc",
      page: 1,
    });

  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / query.pageSize));

  return (
    <div className="space-y-5">
      <PageHeader title="Produtos" count={total} unit={["produto", "produtos"]} />
      <ProductFilters query={query} onChange={patch} />

      {error && <ErrorNotice error={error} fallback="Não foi possível carregar os produtos." />}

      {isPending ? (
        <Loading label="Carregando produtos..." />
      ) : (
        <ProductTable items={data?.items ?? []} query={query} onSort={sortBy} onOpen={setAberto} />
      )}

      <Pagination page={query.page} lastPage={lastPage} onChange={(page) => patch({ page })} />

      {aberto && <ProductFiscalDialog product={aberto} onClose={() => setAberto(null)} />}
    </div>
  );
}
