import { Search } from "lucide-react";
import type { ActiveFilter, ProductQuery, StockFilter } from "../domain/product";
import { FIELD } from "@/shared/ui/primitives";

interface Props {
  query: ProductQuery;
  onChange: (patch: Partial<ProductQuery>) => void;
}

export function ProductFilters({ query, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-64 flex-1">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={query.search}
          onChange={(e) => onChange({ search: e.target.value, page: 1 })}
          placeholder="Buscar por nome ou código de barras..."
          className={`${FIELD} w-full pl-9`}
        />
      </div>

      <select
        value={query.activeFilter}
        onChange={(e) => onChange({ activeFilter: e.target.value as ActiveFilter, page: 1 })}
        className={FIELD}
      >
        <option value="all">Todos</option>
        <option value="active">Ativos</option>
        <option value="inactive">Inativos</option>
      </select>

      <select
        value={query.stockFilter}
        onChange={(e) => onChange({ stockFilter: e.target.value as StockFilter, page: 1 })}
        className={FIELD}
      >
        <option value="all">Estoque: todos</option>
        <option value="in_stock">Com estoque</option>
        <option value="out_of_stock">Sem estoque</option>
      </select>

      <input
        type="number"
        value={query.priceMin ?? ""}
        onChange={(e) =>
          onChange({ priceMin: e.target.value === "" ? null : Number(e.target.value), page: 1 })
        }
        placeholder="Preço mín."
        className={`${FIELD} w-28`}
      />
      <input
        type="number"
        value={query.priceMax ?? ""}
        onChange={(e) =>
          onChange({ priceMax: e.target.value === "" ? null : Number(e.target.value), page: 1 })
        }
        placeholder="Preço máx."
        className={`${FIELD} w-28`}
      />
    </div>
  );
}
