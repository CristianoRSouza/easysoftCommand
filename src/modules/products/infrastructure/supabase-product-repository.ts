import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductRepository } from "../application/product-repository";
import type { Product, ProductQuery } from "../domain/product";
import { pageToRange, type Page } from "@/shared/domain/paging";
import { asIsoDate, asNumber } from "@/shared/infrastructure/convert";
import type { Tenant } from "@/shared/tenant/tenant";

/** Colunas de `pv_products`, com a unidade resolvida por relação. */
const COLUMNS =
  "id, description, sale_price, barcode, stock_quantity, image_url, is_active, created_at, updated_at, pv_product_units:unit_id(short_description)";

/** Coluna correspondente a cada chave de ordenação do domínio. */
const SORT_COLUMN: Record<ProductQuery["sortKey"], string> = {
  description: "description",
  barcode: "barcode",
  salePrice: "sale_price",
  stockQuantity: "stock_quantity",
  isActive: "is_active",
};

interface Row {
  id: string;
  description: string | null;
  sale_price: number | string | null;
  barcode: string | null;
  stock_quantity: number | string | null;
  image_url: string | null;
  is_active: boolean | null;
  created_at: unknown;
  updated_at: unknown;
  pv_product_units: { short_description: string | null } | null;
}

/** Converte a linha do Supabase no `Product` do domínio. */
function toProduct(row: Row): Product {
  return {
    id: row.id,
    description: row.description ?? "",
    barcode: row.barcode ?? "",
    salePrice: asNumber(row.sale_price),
    stockQuantity: asNumber(row.stock_quantity),
    unitName: row.pv_product_units?.short_description ?? null,
    imageUrl: row.image_url,
    isActive: row.is_active ?? false,
    createdAt: asIsoDate(row.created_at),
    updatedAt: asIsoDate(row.updated_at),
  };
}

/**
 * Lê produtos do Supabase, sempre restrito à loja selecionada.
 *
 * O `storeId` é injetado na construção: sem loja não existe repositório. Isso
 * torna impossível, por construção, consultar sem filtro de tenant — a
 * garantia não depende de ninguém lembrar de passar o filtro.
 */
export class SupabaseProductRepository implements ProductRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  async list(query: ProductQuery): Promise<Page<Product>> {
    const { from, to } = pageToRange(query.page, query.pageSize);

    let request = this.client
      .from("pv_products")
      .select(COLUMNS, { count: "exact" })
      .eq("store_id", this.tenant.storeId);

    if (query.activeFilter === "active") request = request.eq("is_active", true);
    else if (query.activeFilter === "inactive") request = request.eq("is_active", false);

    if (query.stockFilter === "in_stock") request = request.gt("stock_quantity", 0);
    else if (query.stockFilter === "out_of_stock") request = request.lte("stock_quantity", 0);

    if (query.priceMin !== null) request = request.gte("sale_price", query.priceMin);
    if (query.priceMax !== null) request = request.lte("sale_price", query.priceMax);

    const term = query.search.trim();
    if (term) {
      // `%`, `,` e parênteses quebram a sintaxe do filtro `or` do PostgREST.
      const safe = term.replace(/[%,()]/g, " ");
      request = request.or(`description.ilike.%${safe}%,barcode.ilike.%${safe}%`);
    }

    const column = SORT_COLUMN[query.sortKey];
    const { data, error, count } = await request
      .order(column, { ascending: query.sortDirection === "asc" })
      .range(from, to);

    // Lança em vez de devolver vazio. No projeto anterior uma falha de permissão
    // virava "loja sem produtos" — o erro se disfarçava de resposta válida.
    if (error) throw new Error(`Falha ao listar produtos: ${error.message}`);

    return {
      items: (data as unknown as Row[] | null)?.map(toProduct) ?? [],
      total: count ?? 0,
    };
  }
}
