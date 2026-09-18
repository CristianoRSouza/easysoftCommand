import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import {
  DEFAULT_TRANSACTION_QUERY,
  paymentMethodLabel,
  transactionStatusLabel,
  transactionStatusTone,
  type Transaction,
  type TransactionQuery,
  type TransactionSortKey,
} from "../domain/transaction";
import { useContainer } from "@/shared/container/container-context";
import { lastPageOf, type Page } from "@/shared/domain/paging";
import { TransactionDialog } from "./TransactionDialog";
import { PlanWindowNotice, useOutsidePlanWindow } from "@/shared/plan/PlanWindowNotice";
import { formatCurrency, formatDateTime } from "@/shared/ui/format";
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

export function TransactionsPage() {
  const { transactions } = useContainer();
  const [query, setQuery] = useState<TransactionQuery>(DEFAULT_TRANSACTION_QUERY);
  const [aberta, setAberta] = useState<Transaction | null>(null);

  // Período além do plano não é consultado: o aviso substitui o resultado.
  const foraDoPlano = useOutsidePlanWindow(query.range);

  const { data, isPending, error } = useQuery<Page<Transaction>>({
    queryKey: ["transactions", query],
    queryFn: () => transactions.list(query),
    enabled: !foraDoPlano,
    placeholderData: (previous) => previous,
  });

  const patch = (next: Partial<TransactionQuery>) =>
    setQuery((current) => ({ ...current, ...next }));

  const sortBy = (key: TransactionSortKey) =>
    patch({
      sortKey: key,
      sortDirection: query.sortKey === key && query.sortDirection === "asc" ? "desc" : "asc",
      page: 1,
    });

  const total = data?.total ?? 0;
  const header = { activeKey: query.sortKey, direction: query.sortDirection, onSort: sortBy };

  // Soma apenas da página exibida. Dizer "total do período" exigiria uma
  // agregação no banco — e um número que parece total sem ser é pior que nenhum.
  const somaDaPagina = (data?.items ?? []).reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Transações" count={total} unit={["transação", "transações"]} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query.search}
            onChange={(e) => patch({ search: e.target.value, page: 1 })}
            placeholder="Buscar por NSU ou autorização..."
            className={`${FIELD} w-full pl-9`}
          />
        </div>

        <select
          value={query.status}
          onChange={(e) => patch({ status: e.target.value, page: 1 })}
          className={FIELD}
        >
          <option value="">Todos os status</option>
          <option value="approved">Aprovadas</option>
          <option value="pending">Pendentes</option>
          <option value="declined">Negadas</option>
          <option value="cancelled">Canceladas</option>
        </select>

        <select
          value={query.paymentMethod}
          onChange={(e) => patch({ paymentMethod: e.target.value, page: 1 })}
          className={FIELD}
        >
          <option value="">Todos os meios</option>
          <option value="credit">Crédito</option>
          <option value="debit">Débito</option>
          <option value="pix">PIX</option>
          <option value="voucher">Voucher</option>
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
      </div>

      {error && <ErrorNotice error={error} fallback="Não foi possível carregar as transações." />}

      {foraDoPlano ? (
        <PlanWindowNotice
          range={query.range}
          subject="transações"
          onAdjust={(range) => patch({ range, page: 1 })}
        />
      ) : isPending ? (
        <Loading label="Carregando transações..." />
      ) : (data?.items.length ?? 0) === 0 ? (
        <Empty label="Nenhuma transação encontrada com os filtros atuais." />
      ) : (
        <>
          <Panel className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-muted-foreground">
                <tr>
                  <SortableHeader column="createdAt" label="Data" {...header} />
                  <th className="px-4 py-3 text-left font-medium">Meio</th>
                  <SortableHeader column="amount" label="Valor" align="right" {...header} />
                  <th className="px-4 py-3 text-right font-medium">Parcelas</th>
                  <th className="px-4 py-3 text-left font-medium">NSU</th>
                  <th className="px-4 py-3 text-left font-medium">Autorização</th>
                  <SortableHeader column="status" label="Status" {...header} />
                </tr>
              </thead>
              <tbody>
                {data?.items.map((transaction) => (
                  <tr
                    key={transaction.id}
                    onClick={() => setAberta(transaction)}
                    title="Ver o retorno do TEF e os dados de PIX"
                    className="cursor-pointer border-t border-border/40 transition-colors hover:bg-secondary/40"
                  >
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {formatDateTime(transaction.createdAt)}
                    </td>
                    <td className="px-4 py-3">{paymentMethodLabel(transaction.paymentMethod)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(transaction.amount)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {transaction.installments > 1 ? `${transaction.installments}x` : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {transaction.nsu ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {transaction.authorizationCode ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={transactionStatusTone(transaction.status)}>
                        {transactionStatusLabel(transaction.status)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <p className="text-right text-sm text-muted-foreground">
            Soma desta página:{" "}
            <span className="font-medium text-foreground">{formatCurrency(somaDaPagina)}</span>
          </p>
        </>
      )}

      {aberta && <TransactionDialog transaction={aberta} onClose={() => setAberta(null)} />}

      {!foraDoPlano && (
        <Pagination
          page={query.page}
          lastPage={lastPageOf(total, query.pageSize)}
          onChange={(page) => patch({ page })}
        />
      )}
    </div>
  );
}
