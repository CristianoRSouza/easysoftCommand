import type { Product, ProductQuery, ProductSortKey } from "../domain/product";
import { formatCurrency, formatQuantity } from "@/shared/ui/format";
import { Badge, Empty, Panel, SortableHeader } from "@/shared/ui/primitives";

interface Props {
  items: Product[];
  query: ProductQuery;
  onSort: (key: ProductSortKey) => void;
  onOpen: (product: Product) => void;
}

export function ProductTable({ items, query, onSort, onOpen }: Props) {
  if (items.length === 0) {
    return <Empty label="Nenhum produto encontrado com os filtros atuais." />;
  }

  const header = { activeKey: query.sortKey, direction: query.sortDirection, onSort };

  return (
    <Panel className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border/60 text-muted-foreground">
          <tr>
            <SortableHeader column="description" label="Produto" {...header} />
            <SortableHeader column="barcode" label="Código de barras" {...header} />
            <SortableHeader column="salePrice" label="Preço" align="right" {...header} />
            <SortableHeader column="stockQuantity" label="Estoque" align="right" {...header} />
            <SortableHeader column="isActive" label="Status" {...header} />
            <th className="px-4 py-3 text-left font-medium">Unidade</th>
          </tr>
        </thead>
        <tbody>
          {items.map((product) => (
            <tr
              key={product.id}
              onClick={() => onOpen(product)}
              title="Ver a classificação fiscal"
              className="cursor-pointer border-t border-border/40 transition-colors hover:bg-secondary/40"
            >
              <td className="px-4 py-3">{product.description || "—"}</td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                {product.barcode || "—"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatCurrency(product.salePrice)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatQuantity(product.stockQuantity)}
              </td>
              <td className="px-4 py-3">
                <Badge tone={product.isActive ? "success" : "destructive"}>
                  {product.isActive ? "Ativo" : "Inativo"}
                </Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{product.unitName ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
