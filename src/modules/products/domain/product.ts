/**
 * Produto — entidade de domínio.
 *
 * Representa o produto como o negócio o entende, independente de onde ele está
 * guardado. As fontes divergem (tabela `products` no PostgreSQL local,
 * `pv_products` no Supabase); traduzir uma na outra é responsabilidade da
 * camada de infraestrutura, nunca daqui.
 *
 * No projeto anterior este tipo vivia dentro do arquivo de dados falsos.
 */
export interface Product {
  id: string;
  description: string;
  barcode: string;
  salePrice: number;
  stockQuantity: number;
  unitName: string | null;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ActiveFilter = "all" | "active" | "inactive";
export type StockFilter = "all" | "in_stock" | "out_of_stock";
export type ProductSortKey =
  | "description"
  | "barcode"
  | "salePrice"
  | "stockQuantity"
  | "isActive";
export type SortDirection = "asc" | "desc";

/** Critérios de consulta. `page` começa em 1. */
export interface ProductQuery {
  search: string;
  activeFilter: ActiveFilter;
  stockFilter: StockFilter;
  priceMin: number | null;
  priceMax: number | null;
  sortKey: ProductSortKey;
  sortDirection: SortDirection;
  page: number;
  pageSize: number;
}

/** Uma página de resultados. `total` é a contagem do filtro inteiro, não da página. */
export interface ProductPage {
  items: Product[];
  total: number;
}

export const DEFAULT_PRODUCT_QUERY: ProductQuery = {
  search: "",
  activeFilter: "all",
  stockFilter: "all",
  priceMin: null,
  priceMax: null,
  sortKey: "description",
  sortDirection: "asc",
  page: 1,
  pageSize: 50,
};

/** Converte página (base 1) no intervalo de índices que os repositórios usam. */
export function pageToRange(page: number, pageSize: number): { from: number; to: number } {
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.max(1, Math.floor(pageSize));
  const from = (safePage - 1) * safeSize;
  return { from, to: from + safeSize - 1 };
}
