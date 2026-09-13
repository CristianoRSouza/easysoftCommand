import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import {
  itemsMismatch,
  sumItems,
  sumPayments,
  type NfceDetail,
} from "../domain/nfce-detail";
import { NFCE_STATUS_LABEL, NFCE_STATUS_TONE } from "../domain/nfce-note";
import { useContainer } from "@/shared/container/container-context";
import { formatCurrency, formatDateTime, formatQuantity } from "@/shared/ui/format";
import { Badge, ErrorNotice, Loading, Panel } from "@/shared/ui/primitives";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm">{value || "—"}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel className="p-5">
      <h2 className="mb-4 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </Panel>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${strong ? "border-t border-border/60 pt-2" : ""}`}>
      <span className={strong ? "font-medium" : "text-muted-foreground"}>{label}</span>
      <span className={`tabular-nums ${strong ? "font-semibold" : ""}`}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

export function NfceDetailPage() {
  const { noteId } = useParams<{ noteId: string }>();
  const { nfce } = useContainer();

  const { data, isPending, error } = useQuery<NfceDetail | null>({
    queryKey: ["nfce", "detalhe", noteId],
    queryFn: () => nfce.detail(noteId as string),
    enabled: Boolean(noteId),
  });

  if (isPending) return <Loading label="Carregando a nota..." />;
  if (error) return <ErrorNotice error={error} fallback="Não foi possível carregar a nota." />;
  if (!data) {
    return (
      <div className="space-y-4">
        <Link to="/nfce" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> Voltar
        </Link>
        <Panel className="px-4 py-12 text-center text-sm text-muted-foreground">
          Nota não encontrada, ou fora da loja em uso.
        </Panel>
      </div>
    );
  }

  const { note, issuer, recipient, totals, items, payments, history } = data;
  const diferenca = itemsMismatch(data);
  const recebido = sumPayments(payments);

  return (
    <div className="space-y-5">
      <Link
        to="/nfce"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={16} /> Voltar para as notas
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            NFC-e nº {note.number || "—"}
            <span className="ml-2 text-base font-normal text-muted-foreground">
              série {note.serie || "—"}
            </span>
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{note.accessKey ?? "Sem chave de acesso"}</p>
        </div>
        <Badge tone={NFCE_STATUS_TONE[note.status]}>{NFCE_STATUS_LABEL[note.status]}</Badge>
      </div>

      {/* A conferência que denuncia nota inconsistente. Só avisa quando há
          diferença — alerta que aparece sempre deixa de ser lido. */}
      {diferenca !== 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          <span>
            O total da nota ({formatCurrency(totals.note)}) não bate com a soma dos itens (
            {formatCurrency(sumItems(items))}). Diferença de {formatCurrency(Math.abs(diferenca))}.
          </span>
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Situação">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Emissão" value={formatDateTime(note.issuedAt)} />
            <Field label="Autorização" value={note.authorizedAt ? formatDateTime(note.authorizedAt) : null} />
            <Field label="Protocolo" value={note.protocol} />
            <Field
              label="Retorno SEFAZ"
              value={
                note.sefazStatusCode
                  ? `${note.sefazStatusCode}${note.sefazStatusReason ? ` · ${note.sefazStatusReason}` : ""}`
                  : null
              }
            />
            <Field label="Tentativas" value={String(note.retryCount)} />
            <Field label="Tipo de emissão" value={note.emissionType == null ? null : String(note.emissionType)} />
          </div>
        </Section>

        <Section title="Totais">
          <div className="text-sm">
            <TotalRow label="Produtos" value={totals.products} />
            <TotalRow label="Desconto" value={totals.discount} />
            {totals.freight > 0 && <TotalRow label="Frete" value={totals.freight} />}
            {totals.insurance > 0 && <TotalRow label="Seguro" value={totals.insurance} />}
            {totals.otherExpenses > 0 && <TotalRow label="Outras despesas" value={totals.otherExpenses} />}
            <TotalRow label="Total da nota" value={totals.note} strong />
            <div className="mt-3 space-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>ICMS</span>
                <span className="tabular-nums">{formatCurrency(totals.icms)}</span>
              </div>
              <div className="flex justify-between">
                <span>PIS / COFINS</span>
                <span className="tabular-nums">{formatCurrency(totals.pis + totals.cofins)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tributos aproximados</span>
                <span className="tabular-nums">{formatCurrency(totals.approximateTaxes)}</span>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Emitente">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Razão social" value={issuer.companyName} />
            <Field label="Nome fantasia" value={issuer.tradeName} />
            <Field label="CNPJ" value={issuer.cnpj} />
            <Field label="Inscrição estadual" value={issuer.stateRegistration} />
            <Field label="Endereço" value={issuer.address} />
            <Field label="Município / UF" value={[issuer.city, issuer.uf].filter(Boolean).join(" / ")} />
          </div>
        </Section>

        <Section title="Destinatário">
          {recipient ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nome" value={recipient.name} />
              <Field label="Documento" value={recipient.document} />
              <Field label="E-mail" value={recipient.email} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Consumidor não identificado — o caso normal na NFC-e.
            </p>
          )}
        </Section>
      </div>

      <Section title={`Itens (${items.length})`}>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Esta nota não tem itens registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-right font-medium">#</th>
                  <th className="px-2 py-2 text-left font-medium">Produto</th>
                  <th className="px-2 py-2 text-left font-medium">NCM</th>
                  <th className="px-2 py-2 text-left font-medium">CFOP</th>
                  <th className="px-2 py-2 text-right font-medium">Qtd.</th>
                  <th className="px-2 py-2 text-left font-medium">Un.</th>
                  <th className="px-2 py-2 text-right font-medium">Unitário</th>
                  <th className="px-2 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.sequence}-${item.productCode}`} className="border-t border-border/40">
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{item.sequence}</td>
                    <td className="px-2 py-2">
                      {item.description}
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{item.productCode}</span>
                    </td>
                    <td className="px-2 py-2 font-mono text-xs text-muted-foreground">{item.ncm || "—"}</td>
                    <td className="px-2 py-2 font-mono text-xs text-muted-foreground">{item.cfop || "—"}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatQuantity(item.quantity)}</td>
                    <td className="px-2 py-2 text-muted-foreground">{item.unit || "—"}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatCurrency(item.grossValue - item.discount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={`Pagamentos (${payments.length})`}>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Esta nota não tem pagamentos registrados.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium">Forma</th>
                    <th className="px-2 py-2 text-left font-medium">Bandeira</th>
                    <th className="px-2 py-2 text-left font-medium">NSU</th>
                    <th className="px-2 py-2 text-right font-medium">Valor</th>
                    <th className="px-2 py-2 text-right font-medium">Troco</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.sequence} className="border-t border-border/40">
                      <td className="px-2 py-2">{payment.methodDescription ?? payment.method}</td>
                      <td className="px-2 py-2 text-muted-foreground">{payment.cardBrand ?? "—"}</td>
                      <td className="px-2 py-2 font-mono text-xs text-muted-foreground">
                        {payment.authorizationNsu ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(payment.amount)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                        {payment.change > 0 ? formatCurrency(payment.change) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 border-t border-border/60 pt-3 text-right text-sm">
              <span className="text-muted-foreground">Recebido (menos troco): </span>
              <span className="font-medium tabular-nums">{formatCurrency(recebido)}</span>
            </p>
          </>
        )}
      </Section>

      <Section title={`Histórico (${history.length})`}>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro para esta nota.</p>
        ) : (
          <ol className="space-y-3">
            {history.map((entry) => (
              <li key={`${entry.kind}-${entry.id}`} className="flex gap-3 text-sm">
                <span className="w-36 shrink-0 tabular-nums text-xs text-muted-foreground">
                  {formatDateTime(entry.at)}
                </span>
                <span className="min-w-0 flex-1">
                  <Badge tone={entry.kind === "event" ? "info" : entry.level === "error" ? "destructive" : "muted"}>
                    {entry.kind === "event" ? "Evento" : entry.level}
                  </Badge>
                  <span className="ml-2">{entry.message}</span>
                  {entry.returnCode && (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      código {entry.returnCode}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
