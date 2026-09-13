import { useState } from "react";
import {
  DEFAULT_PRODUCT_QUERY,
  type ProductQuery,
  type ProductSortKey,
} from "../domain/product";
import { useProducts } from "./useProducts";
import { ProductFilters } from "./ProductFilters";
import { ProductTable } from "./ProductTable";

export function ProductsPage() {
  const [query, setQuery] = useState<ProductQuery>(DEFAULT_PRODUCT_QUERY);
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
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Produtos</h1>
        <span className="text-sm text-ink-muted">
          {total.toLocaleString("pt-BR")} {total === 1 ? "produto" : "produtos"}
        </span>
      </div>

      <ProductFilters query={query} onChange={patch} />

      {error && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error instanceof Error ? error.message : "Não foi possível carregar os produtos."}
        </p>
      )}

      {isPending ? (
        <p className="px-4 py-10 text-center text-sm text-ink-muted">Carregando produtos…</p>
      ) : (
        <ProductTable items={data?.items ?? []} query={query} onSort={sortBy} />
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-muted">
          Página {query.page} de {lastPage}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => patch({ page: query.page - 1 })}
            disabled={query.page <= 1}
            className="rounded-lg border border-base-border px-3 py-1.5 transition hover:bg-base-raised disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            onClick={() => patch({ page: query.page + 1 })}
            disabled={query.page >= lastPage}
            className="rounded-lg border border-base-border px-3 py-1.5 transition hover:bg-base-raised disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
