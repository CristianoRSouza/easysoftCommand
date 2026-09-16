import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info, X } from "lucide-react";
import type { NfceIssuer } from "../domain/nfce-issuer";
import { draftFrom, inspectIssuer, type IssuerDraft, type IssuerWarning } from "../domain/issuer-draft";
import { useContainer } from "@/shared/container/container-context";
import { FIELD } from "@/shared/ui/primitives";

function warningFor(warnings: IssuerWarning[], field: keyof IssuerDraft): IssuerWarning | null {
  return warnings.find((w) => w.field === field) ?? null;
}

function Campo({
  label,
  value,
  warning,
  onChange,
}: {
  label: string;
  value: string | null;
  warning?: IssuerWarning | null;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={`${FIELD} w-full ${warning ? "border-warning" : ""}`}
      />
      {warning && (
        <span className="flex items-start gap-1.5 text-xs text-warning">
          <Info size={13} className="mt-0.5 shrink-0" />
          {warning.message}
        </span>
      )}
    </label>
  );
}

function Serie({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className={`${FIELD} w-full`}
      />
    </label>
  );
}

export function IssuerDialog({ issuer, onClose }: { issuer: NfceIssuer; onClose: () => void }) {
  const { issuer: repository } = useContainer();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<IssuerDraft>(() => draftFrom(issuer));

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: () => repository.update(draft),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["issuer"] });
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  const set =
    <K extends keyof IssuerDraft>(chave: K) =>
    (valor: IssuerDraft[K]) =>
      setDraft((d) => ({ ...d, [chave]: valor }));

  const warnings = inspectIssuer(draft);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel my-8 w-full max-w-2xl space-y-5 rounded-lg p-6 shadow-elegant"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold">Emitente NFC-e</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Estes dados saem impressos na nota
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

        <div className="space-y-4">
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Identificação
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              label="Razão social"
              value={draft.companyName}
              warning={warningFor(warnings, "companyName")}
              onChange={set("companyName")}
            />
            <Campo label="Nome fantasia" value={draft.tradeName} onChange={set("tradeName")} />
            <Campo
              label="CNPJ"
              value={draft.cnpj}
              warning={warningFor(warnings, "cnpj")}
              onChange={set("cnpj")}
            />
            <Campo
              label="Inscrição estadual"
              value={draft.stateRegistration}
              warning={warningFor(warnings, "stateRegistration")}
              onChange={set("stateRegistration")}
            />
            <Campo
              label="Inscrição municipal"
              value={draft.municipalRegistration}
              onChange={set("municipalRegistration")}
            />
            <Campo
              label="CNAE"
              value={draft.cnae}
              warning={warningFor(warnings, "cnae")}
              onChange={set("cnae")}
            />
          </div>
        </div>

        <div className="space-y-4 border-t border-border/60 pt-4">
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Endereço
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Logradouro" value={draft.street} onChange={set("street")} />
            <Campo label="Número" value={draft.number} onChange={set("number")} />
            <Campo label="Complemento" value={draft.complement} onChange={set("complement")} />
            <Campo label="Bairro" value={draft.neighborhood} onChange={set("neighborhood")} />
            <Campo
              label="CEP"
              value={draft.zipCode}
              warning={warningFor(warnings, "zipCode")}
              onChange={set("zipCode")}
            />
            <Campo label="Telefone" value={draft.phone} onChange={set("phone")} />
          </div>
          <p className="text-xs text-muted-foreground">
            Município, UF e regimes tributários são referências a tabelas próprias e não mudam por
            aqui.
          </p>
        </div>

        <div className="space-y-4 border-t border-border/60 pt-4">
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Séries
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Serie label="Série NFC-e" value={draft.nfceSerie} onChange={set("nfceSerie")} />
            <Serie label="Série NF-e" value={draft.nfeSerie} onChange={set("nfeSerie")} />
          </div>
        </div>

        {mutation.error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {mutation.error instanceof Error ? mutation.error.message : "Não foi possível salvar."}
          </p>
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
            disabled={mutation.isPending}
            className="rounded-lg bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
