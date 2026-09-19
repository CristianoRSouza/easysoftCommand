import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { TriangleAlert, X } from "lucide-react";
import { ORDER_STATUS_LABEL, type Order } from "../domain/order";
import {
  CLOSING_LABEL,
  closingState,
  isCancelled,
  sumApproved,
  sumItems,
  truncatedQuantity,
  type OrderDetail,
  type OrderItem,
} from "../domain/order-detail";
import { paymentMethodLabel, transactionStatusLabel } from "@/modules/transactions/domain/transaction";
import { useContainer } from "@/shared/container/container-context";
import { formatCurrency, formatDateTime, formatQuantity } from "@/shared/ui/format";
import { Badge, Empty, ErrorNotice, Loading } from "@/shared/ui/primitives";

const CLOSING_TONE = {
  closed: "success",
  pending: "warning",
  failing: "destructive",
  open: "muted",
} as const;

/**
 * A quantidade gravada, e a que o subtotal indica quando a gravada foi cortada.
 *
 * Mostrar só o "0" faria o item parecer lançado por engano; trocar pelo valor
 * calculado esconderia que o banco guardou outra coisa. As duas aparecem, e a
 * calculada vem marcada como tal.
 */
function Quantidade({ item }: { item: OrderItem }) {
  const indicada = truncatedQuantity(item);
  if (indicada === null) return <>{formatQuantity(item.quantity)}</>;
  return (
    <span
      className="inline-flex items-center gap-1 text-warning"
      title={`Gravada como ${formatQuantity(item.quantity)}: a nuvem guarda a quantidade sem casas decimais. O subtotal indica ${formatQuantity(indicada)}.`}
    >
      <TriangleAlert size={12} />≈ {formatQuantity(indicada)}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm">{value || "—"}</p>
    </div>
  );
}

export function OrderDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const { orders } = useContainer();

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  const { data, isPending, error } = useQuery<OrderDetail | null>({
    queryKey: ["orders", "detalhe", order.id],
    queryFn: () => orders.detail(order.id),
  });

  const estado = data ? closingState(data.closing) : null;
  const totalItens = data ? sumItems(data.items) : 0;
  const totalPago = data ? sumApproved(data.payments) : 0;
  const falta = Number((totalItens - totalPago).toFixed(2));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel my-8 w-full max-w-3xl space-y-5 rounded-lg p-6 shadow-elegant"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-bold">
              Mesa {order.tableName || "—"}
              <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">
                {order.barcode}
              </span>
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Aberta em {formatDateTime(order.createdAt)}
              {order.customerName ? ` · ${order.customerName}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={order.status === "closed" ? "success" : "info"}>
              {ORDER_STATUS_LABEL[order.status]}
            </Badge>
            {estado && <Badge tone={CLOSING_TONE[estado]}>{CLOSING_LABEL[estado]}</Badge>}
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {error && <ErrorNotice error={error} fallback="Não foi possível carregar a comanda." />}

        {isPending ? (
          <Loading label="Carregando a comanda..." />
        ) : !data ? (
          <p className="text-sm text-muted-foreground">
            Comanda não encontrada, ou fora da loja em uso.
          </p>
        ) : (
          <>
            {/* O caso que leva alguém a abrir esta tela: pago aqui, não fechado
                no caixa. O erro do PDV vem junto, porque é o que diz o que fazer. */}
            {data.closing.lastError && (
              <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                <span>
                  O fechamento no PDV falhou {data.closing.attempts}{" "}
                  {data.closing.attempts === 1 ? "vez" : "vezes"}: {data.closing.lastError}
                </span>
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Totem" value={order.totemName} />
              <Field
                label="Fechamento pedido"
                value={
                  data.closing.requestedAt ? formatDateTime(data.closing.requestedAt) : null
                }
              />
              <Field
                label="Fechada no PDV"
                value={data.closing.closedAt ? formatDateTime(data.closing.closedAt) : null}
              />
              <Field
                label="Venda no PDV"
                value={
                  data.closing.firebirdSaleId
                    ? `${data.closing.firebirdSaleId}${
                        data.closing.firebirdCashRegisterId
                          ? ` · caixa ${data.closing.firebirdCashRegisterId}`
                          : ""
                      }`
                    : null
                }
              />
            </div>

            <div className="space-y-2 border-t border-border/60 pt-4">
              <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Itens ({data.items.length})
              </h3>
              {data.items.length === 0 ? (
                <Empty label="Nenhum item nesta comanda." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border/60 text-muted-foreground">
                      <tr>
                        <th className="py-2 text-left font-medium">Produto</th>
                        <th className="py-2 text-right font-medium">Qtd.</th>
                        <th className="py-2 text-right font-medium">Unitário</th>
                        <th className="py-2 text-right font-medium">Subtotal</th>
                        <th className="py-2 pl-4 text-left font-medium">No PDV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((item) => (
                        <tr
                          key={item.id}
                          className={`border-t border-border/40 ${
                            isCancelled(item) ? "text-muted-foreground line-through" : ""
                          }`}
                        >
                          <td className="py-2">
                            {item.productName}
                            {item.unitName && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({item.unitName})
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            <Quantidade item={item} />
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {formatCurrency(item.unitPrice)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {formatCurrency(item.subtotal)}
                          </td>
                          <td className="py-2 pl-4 text-xs text-muted-foreground">
                            {item.syncedToFirebird
                              ? (item.firebirdId ?? "sincronizado")
                              : "não enviado"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-right text-sm">
                <span className="text-muted-foreground">Soma dos itens válidos: </span>
                <span className="font-medium tabular-nums">{formatCurrency(totalItens)}</span>
              </p>
            </div>

            <div className="space-y-2 border-t border-border/60 pt-4">
              <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Pagamentos ({data.payments.length})
              </h3>
              {data.payments.length === 0 ? (
                <Empty label="Nenhuma transação vinculada a esta comanda." />
              ) : (
                <ul className="space-y-1.5">
                  {data.payments.map((payment) => (
                    <li key={payment.id} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {formatDateTime(payment.createdAt)}
                      </span>
                      <span>{paymentMethodLabel(payment.method)}</span>
                      <Badge tone={payment.status === "approved" ? "success" : "muted"}>
                        {transactionStatusLabel(payment.status)}
                      </Badge>
                      <span className="ml-auto tabular-nums">
                        {formatCurrency(payment.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-right text-sm">
                <span className="text-muted-foreground">Pago (aprovado): </span>
                <span className="font-medium tabular-nums">{formatCurrency(totalPago)}</span>
              </p>
              {/* Só avisa quando falta dinheiro. Sobra acontece por troco e
                  divisão de conta, e apontar isso como erro geraria alarme falso. */}
              {falta > 0.01 && (
                <p className="text-right text-sm text-warning">
                  Faltam {formatCurrency(falta)} para cobrir os itens.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
