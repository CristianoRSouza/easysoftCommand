import type { Product, ProductQuery, ProductSortKey } from "../domain/product";
import { formatCurrency } from "@/shared/ui/format";

interface Props {
  items: Product[];
  query: ProductQuery;
  onSort: (key: ProductSortKey) => void;
}

const COLUMNS: { key: ProductSortKey; label: string; align?: "right" }[] = [
  { key: "description", label: "Produto" },
  { key: "barcode", label: "Código de barras" },
  { key: "salePrice", label: "Preço", align: "right" },
  { key: "stockQuantity", label: "Estoque", align: "right" },
  { key: "isActive", label: "Status" },
];

export function ProductTable({ items, query, onSort }: Props) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-base-border bg-base-raised px-4 py-10 text-center text-sm text-ink-muted">
        Nenhum produto encontrado com os filtros atuais.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-base-border">
      <table className="w-full text-sm">
        <thead className="bg-base-raised text-ink-muted">
          <tr>
            {COLUMNS.map(({ key, label, align }) => (
              <th
                key={key}
                onClick={() => onSort(key)}
                className={`cursor-pointer select-none px-4 py-3 font-medium transition hover:text-ink ${
                  align === "right" ? "text-right" : "text-left"
                }`}
              >
                {label}
                {query.sortKey === key && (query.sortDirection === "asc" ? " ↑" : " ↓")}
              </th>
            ))}
            <th className="px-4 py-3 text-left font-medium">Unidade</th>
          </tr>
        </thead>
        <tbody>
          {items.map((product) => (
            <tr key={product.id} className="border-t border-base-border">
              <td className="px-4 py-3">{product.description}</td>
              <td className="px-4 py-3 font-mono text-xs text-ink-muted">{product.barcode}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(product.salePrice)}</td>
              <td className="px-4 py-3 text-right">{product.stockQuantity}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    product.isActive ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger"
                  }`}
                >
                  {product.isActive ? "Ativo" : "Inativo"}
                </span>
              </td>
              <td className="px-4 py-3 text-ink-muted">{product.unitName ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
