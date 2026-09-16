import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, X } from "lucide-react";
import { KEEP_SECRET, type PixCredentials, type PixCredentialsDraft } from "../domain/pix-credentials";
import { SecretField } from "@/shared/ui/SecretField";
import { useContainer } from "@/shared/container/container-context";
import { FIELD } from "@/shared/ui/primitives";

function draftFrom(credentials: PixCredentials): PixCredentialsDraft {
  return {
    environment: credentials.environment,
    apiBaseUrl: credentials.apiBaseUrl,
    basicUser: credentials.basicUser,
    basicToken: KEEP_SECRET,
    secretKey: KEEP_SECRET,
    insecureTls: credentials.insecureTls,
    enabled: credentials.enabled,
  };
}

export function PixDialog({
  credentials,
  onClose,
}: {
  credentials: PixCredentials;
  onClose: () => void;
}) {
  const { pix } = useContainer();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<PixCredentialsDraft>(() => draftFrom(credentials));

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: () => pix.save(draft),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pixnopdv"] });
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  const set =
    <K extends keyof PixCredentialsDraft>(chave: K) =>
    (valor: PixCredentialsDraft[K]) =>
      setDraft((d) => ({ ...d, [chave]: valor }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel my-8 w-full max-w-lg space-y-5 rounded-lg p-6 shadow-elegant"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold">PIXnoPDV</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Ambiente {draft.environment} · a loja não muda aqui
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

        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => set("enabled")(e.target.checked)}
            className="accent-primary"
          />
          <span className="text-sm">PIXnoPDV habilitado</span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm text-muted-foreground">URL da API</span>
          <input
            value={draft.apiBaseUrl ?? ""}
            onChange={(e) => set("apiBaseUrl")(e.target.value)}
            placeholder="https://..."
            className={`${FIELD} w-full`}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm text-muted-foreground">Usuário</span>
          <input
            value={draft.basicUser ?? ""}
            onChange={(e) => set("basicUser")(e.target.value)}
            className={`${FIELD} w-full`}
          />
        </label>

        <div className="space-y-4 border-t border-border/60 pt-4">
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Credenciais
          </h3>
          <SecretField
            label="Token básico"
            present={credentials.basicTokenSet}
            edit={draft.basicToken}
            onChange={set("basicToken")}
          />
          <SecretField
            label="Chave secreta"
            present={credentials.secretKeySet}
            edit={draft.secretKey}
            onChange={set("secretKey")}
          />
        </div>

        <div className="space-y-2 border-t border-border/60 pt-4">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={draft.insecureTls}
              onChange={(e) => set("insecureTls")(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <span>
              <span className="text-sm">Aceitar certificado inválido (TLS inseguro)</span>
              <span className="block text-xs text-muted-foreground">
                Só para teste em rede local.
              </span>
            </span>
          </label>

          {draft.insecureTls && (
            <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <ShieldAlert size={16} className="mt-0.5 shrink-0" />
              <span>
                Com isto ligado, quem estiver no meio do caminho pode ler ou alterar a cobrança.
              </span>
            </p>
          )}
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
