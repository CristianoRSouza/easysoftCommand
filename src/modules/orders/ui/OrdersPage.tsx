import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import {
  DEFAULT_ORDER_QUERY,
  ORDER_STATUS_LABEL,
  type Order,
  type OrderQuery,
  type OrderSortKey,
  type OrderStatusFilter,
} from "../domain/order";
import { useContainer } from "@/shared/container/container-context";
import { lastPageOf, type Page } from "@/shared/domain/paging";
import { formatDateTime } from "@/shared/ui/format";
import {
  Badge,
  Empty,
  ErrorNotice,
  FIELD,
  Loading,
  PageHeader,
  Pagination,
  Panel,
  SortableHeader,
} from "@/shared/ui/primitives";

const STATUS_TONE = {
  open: "info",
  closed: "success",
  cancelled: "destructive",
} as const;

export function OrdersPage() {
  const { orders } = useContainer();
  const [query, setQuery] = useState<OrderQuery>(DEFAULT_ORDER_QUERY);

  const { data, isPending, error } = useQuery<Page<Order>>({
    queryKey: ["orders", query],
    queryFn: () => orders.list(query),
    placeholderData: (previous) => previous,
  });

  const patch = (next: Partial<OrderQuery>) =>
    setQuery((current) => ({ ...current, ...next }));

  const sortBy = (key: OrderSortKey) =>
    patch({
      sortKey: key,
      sortDirection: query.sortKey === key && query.sortDirection === "asc" ? "desc" : "asc",
      page: 1,
    });

  const total = data?.total ?? 0;
  const header = { activeKey: query.sortKey, direction: query.sortDirection, onSort: sortBy };

  return (
    <div className="space-y-5">
      <PageHeader title="Comandas" count={total} unit={["comanda", "comandas"]} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query.search}
            onChange={(e) => patch({ search: e.target.value, page: 1 })}
            placeholder="Buscar por código, mesa ou cliente..."
            className={`${FIELD} w-full pl-9`}
          />
        </div>

        <select
          value={query.status}
          onChange={(e) => patch({ status: e.target.value as OrderStatusFilter, page: 1 })}
          className={FIELD}
        >
          <option value="all">Todas</option>
          <option value="open">Abertas</option>
          <option value="closed">Fechadas</option>
          <option value="cancelled">Canceladas</option>
        </select>

        <input
          type="date"
          value={query.range.from ?? ""}
          onChange={(e) =>
            patch({ range: { ...query.range, from: e.target.value || null }, page: 1 })
          }
          className={FIELD}
        />
        <input
          type="date"
          value={query.range.to ?? ""}
          onChange={(e) => patch({ range: { ...query.range, to: e.target.value || null }, page: 1 })}
          className={FIELD}
        />

        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={query.onlyPendingSync}
            onChange={(e) => patch({ onlyPendingSync: e.target.checked, page: 1 })}
            className="accent-primary"
          />
          Só pendentes de sincronização
        </label>
      </div>

      {error && <ErrorNotice error={error} fallback="Não foi possível carregar as comandas." />}

      {isPending ? (
        <Loading label="Carregando comandas..." />
      ) : (data?.items.length ?? 0) === 0 ? (
        <Empty label="Nenhuma comanda encontrada com os filtros atuais." />
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Código</th>
                <SortableHeader column="tableName" label="Mesa" {...header} />
                <th className="px-4 py-3 text-left font-medium">Cliente</th>
                <SortableHeader column="status" label="Status" {...header} />
                <th className="px-4 py-3 text-left font-medium">Totem</th>
                <SortableHeader column="createdAt" label="Aberta em" {...header} />
                <th className="px-4 py-3 text-left font-medium">Sincronização</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((order) => (
                <tr
                  key={order.id}
                  className="border-t border-border/40 transition-colors hover:bg-secondary/40"
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {order.barcode || "—"}
                  </td>
                  <td className="px-4 py-3">{order.tableName || "—"}</td>
                  <td className="px-4 py-3">{order.customerName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[order.status]}>
                      {ORDER_STATUS_LABEL[order.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{order.totemName ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {formatDateTime(order.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {order.syncClosePending ? (
                      <Badge tone="warning">
                        Pendente
                        {order.syncCloseAttempts > 0 && ` (${order.syncCloseAttempts}x)`}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <Pagination
        page={query.page}
        lastPage={lastPageOf(total, query.pageSize)}
        onChange={(page) => patch({ page })}
      />
    </div>
  );
}
