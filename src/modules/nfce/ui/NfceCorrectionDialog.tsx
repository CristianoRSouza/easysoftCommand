import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, TriangleAlert, X } from "lucide-react";
import {
  draftFrom,
  received,
  usesCsosn,
  type CorrectionDraft,
  type FiscalContext,
} from "../domain/nfce-correction";
import { correctNfce } from "../application/correct-nfce";
import type { NfceDetail } from "../domain/nfce-detail";
import { useContainer } from "@/shared/container/container-context";
import { formatCurrency } from "@/shared/ui/format";
import { FIELD, Loading } from "@/shared/ui/primitives";

const CAMPO_CURTO = `${FIELD} w-full px-2 py-1.5 text-sm`;

export function NfceCorrectionDialog({
  detail,
  onClose,
}: {
  detail: NfceDetail;
  onClose: () => void;
}) {
  const { nfce } = useContainer();
  const queryClient = useQueryClient();

  const contexto = useQuery<FiscalContext | null>({
    queryKey: ["nfce", "contexto-fiscal", detail.note.id],
    queryFn: () => nfce.fiscalContext(detail.note.id),
  });

  const codigos = useQuery<Map<number, string>>({
    queryKey: ["nfce", "icms", detail.note.id],
    queryFn: () => nfce.itemIcmsCodes(detail.note.id),
  });

  const [draft, setDraft] = useState<CorrectionDraft | null>(null);

  // O rascunho só nasce quando os códigos de ICMS chegam: montá-lo antes faria
  // os campos aparecerem vazios e o usuário pensar que a nota não os tem.
  useEffect(() => {
    if (codigos.data && !draft) setDraft(draftFrom(detail, codigos.data));
  }, [codigos.data, detail, draft]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: () => correctNfce(nfce)(detail, draft as CorrectionDraft, contexto.data!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["nfce"] });
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (draft && contexto.data) mutation.mutate();
  }

  const carregando = contexto.isPending || codigos.isPending || !draft;

  const setItem = (sequence: number, campo: "ncm" | "cfop" | "cest" | "icmsCode") =>
    (valor: string) =>
      setDraft((d) =>
        d
          ? {
              ...d,
              items: d.items.map((i) => (i.sequence === sequence ? { ...i, [campo]: valor } : i)),
            }
          : d,
      );

  const setPagamento = (sequence: number, campo: "method" | "value" | "change") =>
    (valor: string) =>
      setDraft((d) =>
        d
          ? {
              ...d,
              payments: d.payments.map((p) =>
                p.sequence === sequence
                  ? { ...p, [campo]: campo === "method" ? valor : Number(valor) }
                  : p,
              ),
            }
          : d,
      );

  const rotuloIcms = usesCsosn(contexto.data?.taxRegimeCode ?? null) ? "CSOSN" : "CST";
  const recebido = draft ? received(draft.payments) : 0;
  const faltaCobrir = recebido + 0.0001 < detail.totals.note;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel my-8 w-full max-w-4xl space-y-5 rounded-lg p-6 shadow-elegant"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold">
              Corrigir NFC-e nº {detail.note.number}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {detail.note.sefazStatusCode
                ? `Rejeitada: ${detail.note.sefazStatusCode} · ${detail.note.sefazStatusReason ?? ""}`
                : "Em revisão manual"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* O que NÃO se pode mexer, dito antes de qualquer campo. Uma nota que
            sai com total diferente do que o cliente pagou deixa de ser correção
            e vira outra venda. */}
        <p className="flex items-start gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-sm text-muted-foreground">
          <Lock size={15} className="mt-0.5 shrink-0" />
          <span>
            O valor total da nota ({formatCurrency(detail.totals.note)}) não muda. Só a
            classificação fiscal, os pagamentos e os dados do destinatário são editáveis.
          </span>
        </p>

        {carregando ? (
          <Loading label="Carregando os dados fiscais..." />
        ) : (
          <>
            <section>
              <h3 className="mb-2 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Itens
              </h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium">Produto</th>
                      <th className="w-28 px-2 py-2 text-left font-medium">NCM</th>
                      <th className="w-20 px-2 py-2 text-left font-medium">CFOP</th>
                      <th className="w-24 px-2 py-2 text-left font-medium">CEST</th>
                      <th className="w-20 px-2 py-2 text-left font-medium">{rotuloIcms}</th>
                      <th className="w-24 px-2 py-2 text-right font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.items.map((item, indice) => (
                      <tr key={item.sequence} className="border-t border-border/40">
                        <td className="px-2 py-2">{detail.items[indice]?.description ?? "—"}</td>
                        <td className="px-2 py-1.5">
                          <input
                            value={item.ncm}
                            onChange={(e) => setItem(item.sequence, "ncm")(e.target.value)}
                            className={CAMPO_CURTO}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={item.cfop}
                            onChange={(e) => setItem(item.sequence, "cfop")(e.target.value)}
                            className={CAMPO_CURTO}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={item.cest}
                            onChange={(e) => setItem(item.sequence, "cest")(e.target.value)}
                            className={CAMPO_CURTO}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={item.icmsCode}
                            onChange={(e) => setItem(item.sequence, "icmsCode")(e.target.value)}
                            className={CAMPO_CURTO}
                          />
                        </td>
                        {/* O valor aparece para conferência e não é editável —
                            é o que garante que a correção não vire outra venda. */}
                        <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                          {formatCurrency(detail.items[indice]?.grossValue ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 className="mb-2 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Pagamentos
              </h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 text-xs text-muted-foreground">
                    <tr>
                      <th className="w-24 px-2 py-2 text-left font-medium">Forma</th>
                      <th className="px-2 py-2 text-left font-medium">Descrição</th>
                      <th className="w-32 px-2 py-2 text-left font-medium">Valor</th>
                      <th className="w-32 px-2 py-2 text-left font-medium">Troco</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.payments.map((payment, indice) => (
                      <tr key={payment.sequence} className="border-t border-border/40">
                        <td className="px-2 py-1.5">
                          <input
                            value={payment.method}
                            onChange={(e) => setPagamento(payment.sequence, "method")(e.target.value)}
                            className={CAMPO_CURTO}
                          />
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">
                          {detail.payments[indice]?.methodDescription ?? "—"}
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            step="0.01"
                            value={payment.value}
                            onChange={(e) => setPagamento(payment.sequence, "value")(e.target.value)}
                            className={CAMPO_CURTO}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            step="0.01"
                            value={payment.change}
                            onChange={(e) => setPagamento(payment.sequence, "change")(e.target.value)}
                            className={CAMPO_CURTO}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p
                className={`mt-2 text-right text-sm ${faltaCobrir ? "text-destructive" : "text-muted-foreground"}`}
              >
                Recebido menos troco:{" "}
                <span className="font-medium">{formatCurrency(recebido)}</span> · total da nota:{" "}
                <span className="font-medium">{formatCurrency(detail.totals.note)}</span>
              </p>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm text-muted-foreground">CPF do destinatário</span>
                <input
                  value={draft.recipient.cpf}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, recipient: { ...d.recipient, cpf: e.target.value } } : d,
                    )
                  }
                  className={`${FIELD} w-full`}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm text-muted-foreground">Nome do destinatário</span>
                <input
                  value={draft.recipient.name}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, recipient: { ...d.recipient, name: e.target.value } } : d,
                    )
                  }
                  className={`${FIELD} w-full`}
                />
              </label>
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-sm text-muted-foreground">Informação complementar</span>
                <input
                  value={draft.additionalInfo}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, additionalInfo: e.target.value } : d))
                  }
                  className={`${FIELD} w-full`}
                />
              </label>
            </section>
          </>
        )}

        {mutation.error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <p className="flex items-center gap-1.5 font-medium">
              <TriangleAlert size={15} /> A correção não foi salva
            </p>
            <p className="mt-1">
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Não foi possível salvar."}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={carregando || mutation.isPending}
            className="rounded-lg bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {mutation.isPending ? "Salvando..." : "Salvar correção"}
          </button>
        </div>
      </form>
    </div>
  );
}
