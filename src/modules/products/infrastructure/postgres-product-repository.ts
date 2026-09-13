import type { ProductRepository } from "../application/product-repository";
import {
  pageToRange,
  type Product,
  type ProductPage,
  type ProductQuery,
} from "../domain/product";
import type { ElectronApi } from "@/shared/runtime/electron-api";

/**
 * Coluna correspondente a cada chave de ordenação.
 *
 * Lista fechada de propósito: a ordenação entra no SQL por concatenação, então
 * o valor jamais pode vir da entrada do usuário. Os filtros, esses sim, entram
 * como parâmetros ($1, $2, …).
 */
const SORT_COLUMN: Record<ProductQuery["sortKey"], string> = {
  description: "p.description",
  barcode: "p.barcode",
  salePrice: "p.sale_price",
  stockQuantity: "p.stock_quantity",
  isActive: "p.is_active",
};

interface Row {
  id: string;
  description: string | null;
  barcode: string | null;
  sale_price: string | number | null;
  stock_quantity: string | number | null;
  unit_name: string | null;
  image_url: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  total: string | number;
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Converte a linha do PostgreSQL local no `Product` do domínio. */
function toProduct(row: Row): Product {
  return {
    id: row.id,
    description: row.description ?? "",
    barcode: row.barcode ?? "",
    salePrice: toNumber(row.sale_price),
    stockQuantity: toNumber(row.stock_quantity),
    unitName: row.unit_name,
    imageUrl: row.image_url,
    isActive: row.is_active ?? false,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

/**
 * Lê produtos do PostgreSQL local, via IPC.
 *
 * A tabela local (`products`) não tem a unidade resolvida nem coluna de loja —
 * daí o JOIN e a ausência de filtro de tenant, ao contrário do Supabase.
 * Essa diferença termina aqui: quem chama recebe o mesmo `Product`.
 */
export class PostgresProductRepository implements ProductRepository {
  constructor(private readonly api: ElectronApi) {}

  async list(query: ProductQuery): Promise<ProductPage> {
    const { from } = pageToRange(query.page, query.pageSize);
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.activeFilter === "active") conditions.push("p.is_active = true");
    else if (query.activeFilter === "inactive") conditions.push("p.is_active = false");

    if (query.stockFilter === "in_stock") conditions.push("p.stock_quantity > 0");
    else if (query.stockFilter === "out_of_stock") conditions.push("p.stock_quantity <= 0");

    if (query.priceMin !== null) {
      params.push(query.priceMin);
      conditions.push(`p.sale_price >= $${params.length}`);
    }
    if (query.priceMax !== null) {
      params.push(query.priceMax);
      conditions.push(`p.sale_price <= $${params.length}`);
    }

    const term = query.search.trim();
    if (term) {
      params.push(`%${term}%`);
      conditions.push(
        `(p.description ILIKE $${params.length} OR p.barcode ILIKE $${params.length})`,
      );
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const orderColumn = SORT_COLUMN[query.sortKey];
    const direction = query.sortDirection === "asc" ? "ASC" : "DESC";

    params.push(query.pageSize, from);
    const limitParam = params.length - 1;
    const offsetParam = params.length;

    // COUNT(*) OVER () devolve o total do filtro junto das linhas da página,
    // evitando uma segunda ida ao banco.
    const sql = `
      SELECT p.id, p.description, p.barcode, p.sale_price, p.stock_quantity,
             p.image_url, p.is_active, p.created_at, p.updated_at,
             u.short_description AS unit_name,
             COUNT(*) OVER () AS total
      FROM products p
      LEFT JOIN units u ON u.id = p.unit_id
      ${where}
      ORDER BY ${orderColumn} ${direction}
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const result = await this.api.query<Row>(sql, params);
    if (!result.ok) throw new Error(`Falha ao listar produtos: ${result.error}`);

    const rows = result.rows;
    const first = rows[0];
    return {
      items: rows.map(toProduct),
      // Sem linhas não há janela de contagem: a página está além do fim do filtro.
      total: first ? toNumber(first.total) : 0,
    };
  }
}
