import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, X } from "lucide-react";
import {
  paymentMethodLabel,
  transactionStatusLabel,
  transactionStatusTone,
  type Transaction,
} from "../domain/transaction";
import {
  hasPixData,
  hasTefData,
  receiptToText,
  type TransactionDetail,
} from "../domain/transaction-detail";
import { useContainer } from "@/shared/container/container-context";
import { formatCurrency, formatDateTime } from "@/shared/ui/format";
import { Badge, ErrorNotice, Loading } from "@/shared/ui/primitives";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-all text-sm">{value || "—"}</p>
    </div>
  );
}

/**
 * Bloco fechado por padrão.
 *
 * As vias e o retorno cru da operadora são longos e raramente necessários —
 * abertos de início, empurrariam para fora da tela justamente os campos que
 * se olha primeiro.
 */
function Dobra({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-lg border border-border">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm">
        <ChevronDown size={15} className="shrink-0 text-muted-foreground" />
        {title}
      </summary>
      <div className="border-t border-border/60 p-3">{children}</div>
    </details>
  );
}

function Via({ title, lines }: { title: string; lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{title}</p>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-background px-3 py-2 font-mono text-xs">
        {receiptToText(lines)}
      </pre>
    </div>
  );
}

export function TransactionDialog({
  transaction,
  onClose,
}: {
  transaction: Transaction;
  onClose: () => void;
}) {
  const { transactions } = useContainer();

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  const { data, isPending, error } = useQuery<TransactionDetail | null>({
    queryKey: ["transactions", "detalhe", transaction.id],
    queryFn: () => transactions.detail(transaction.id),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel my-8 w-full max-w-2xl space-y-5 rounded-lg p-6 shadow-elegant"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-bold">
              {paymentMethodLabel(transaction.paymentMethod)} ·{" "}
              {formatCurrency(transaction.amount)}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {formatDateTime(transaction.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={transactionStatusTone(transaction.status)}>
              {transactionStatusLabel(transaction.status)}
            </Badge>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {error && <ErrorNotice error={error} fallback="Não foi possível carregar a transação." />}

        {isPending ? (
          <Loading label="Carregando a transação..." />
        ) : !data ? (
          <p className="text-sm text-muted-foreground">
            Transação não encontrada, ou fora da loja em uso.
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="NSU" value={transaction.nsu} />
              <Field label="Autorização" value={transaction.authorizationCode} />
              <Field label="Parcelas" value={String(transaction.installments || 1)} />
              <Field label="ID no TEF" value={data.tefTransactionId} />
              <Field
                label="Comandas"
                value={data.orderIds.length ? String(data.orderIds.length) : null}
              />
              <Field label="Identificador" value={transaction.id} />
            </div>

            {hasPixData(data.pix) && (
              <div className="space-y-3 border-t border-border/60 pt-4">
                <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  PIX
                </h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Situação" value={data.pix.status} />
                  <Field
                    label="Pago em"
                    value={data.pix.paidAt ? formatDateTime(data.pix.paidAt) : null}
                  />
                  <Field
                    label="Última consulta"
                    value={data.pix.lastPollAt ? formatDateTime(data.pix.lastPollAt) : null}
                  />
                  <Field label="txid" value={data.pix.txid} />
                  <Field label="Ponta a ponta" value={data.pix.endToEndId} />
                  <Field label="QR Code" value={data.pix.qrcodeId} />
                </div>
                {/* Cobrança sem pagamento e com consulta antiga é o caso em que
                    o dinheiro pode ter caído sem ninguém perceber. */}
                {!data.pix.paidAt && data.pix.lastPollAt && (
                  <p className="text-xs text-warning">
                    Esta cobrança não tem pagamento registrado. A última consulta ao provedor foi em{" "}
                    {formatDateTime(data.pix.lastPollAt)}.
                  </p>
                )}
              </div>
            )}

            {hasTefData(data.tef) && (
              <div className="space-y-3 border-t border-border/60 pt-4">
                <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Retorno do TEF
                </h3>
                <Dobra title="Vias do comprovante">
                  <div className="space-y-3">
                    <Via title="Via do estabelecimento" lines={data.tef.merchantReceipt} />
                    <Via title="Via do cliente" lines={data.tef.cardholderReceipt} />
                  </div>
                </Dobra>
                {data.tef.authorizationResponse != null && (
                  <Dobra title="Resposta da operadora (bruta)">
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-background px-3 py-2 font-mono text-xs">
                      {JSON.stringify(data.tef.authorizationResponse, null, 2)}
                    </pre>
                  </Dobra>
                )}
              </div>
            )}

            {!hasTefData(data.tef) && !hasPixData(data.pix) && (
              <p className="border-t border-border/60 pt-4 text-sm text-muted-foreground">
                Esta transação não guardou retorno do TEF nem dados de PIX.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
