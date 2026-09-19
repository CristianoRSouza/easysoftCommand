import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info, X } from "lucide-react";
import {
  emptyAgentDraft,
  inspectAgent,
  LOG_LEVELS,
  missingName,
  missingNumbers,
  normalizeAgent,
  type NewAgentDraft,
} from "../domain/agent";
import { useContainer } from "@/shared/container/container-context";
import { useSession } from "@/shared/auth/auth-context";
import { FIELD } from "@/shared/ui/primitives";

/**
 * Criação de um agente.
 *
 * Os valores iniciais não são vazios: um agente recém-criado com tempo limite
 * zero e nenhuma tentativa não funciona, e quem cria raramente sabe quais
 * números usar. Os padrões são os que a operação já usa.
 */
export function NewAgentDialog({
  onClose,
  onAuditMissing,
}: {
  onClose: () => void;
  /** Chamado quando o agente foi criado mas a trilha recusou o registro. */
  onAuditMissing: (motivo: string) => void;
}) {
  const { agents } = useContainer();
  const { session } = useSession();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState<NewAgentDraft>(emptyAgentDraft);
  const [tentouSalvar, setTentouSalvar] = useState(false);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: () =>
      agents.create(
        { ...normalizeAgent(draft), name: draft.name.trim() } as NewAgentDraft,
        session?.user.email ?? "painel local",
      ),
    onSuccess: async (resultado) => {
      await queryClient.invalidateQueries({ queryKey: ["agents"] });
      await queryClient.invalidateQueries({ queryKey: ["audit"] });
      if (resultado && !resultado.audited && resultado.auditError) {
        onAuditMissing(resultado.auditError);
      }
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTentouSalvar(true);
    if (missingName(draft) || missingNumbers(draft).length > 0) return;
    mutation.mutate();
  }

  const set =
    <K extends keyof NewAgentDraft>(chave: K) =>
    (valor: NewAgentDraft[K]) =>
      setDraft((d) => ({ ...d, [chave]: valor }));

  const warnings = inspectAgent(draft);
  const semNome = tentouSalvar && missingName(draft);

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
            <h2 className="font-heading text-lg font-bold">Novo agente</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              O caminho da instalação é definido por quem instala o serviço.
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

        <label className="block space-y-1.5">
          <span className="text-sm text-muted-foreground">Nome</span>
          <input
            value={draft.name}
            onChange={(e) => set("name")(e.target.value)}
            autoFocus
            placeholder="Agente NFC-e"
            className={`${FIELD} w-full ${semNome ? "border-destructive" : ""}`}
          />
          {semNome ? (
            <span className="block text-xs text-destructive">
              O nome identifica o agente nos registros. Sem ele não há como distingui-lo depois.
            </span>
          ) : (
            <span className="block text-xs text-muted-foreground">
              Depois de criado o nome não muda, para o histórico continuar legível.
            </span>
          )}
        </label>

        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(e) => set("isActive")(e.target.checked)}
            className="accent-primary"
          />
          <span className="text-sm">Já começa ativo</span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm text-muted-foreground">Nível de log</span>
            <select
              value={draft.logLevel}
              onChange={(e) => set("logLevel")(e.target.value)}
              className={`${FIELD} w-full`}
            >
              {LOG_LEVELS.map((nivel) => (
                <option key={nivel} value={nivel}>
                  {nivel}
                </option>
              ))}
            </select>
          </label>

          {(
            [
              ["apiRateLimit", "Limite de chamadas"],
              ["timeoutMs", "Tempo limite SEFAZ (ms)"],
              ["retryMaxAttempts", "Tentativas"],
              ["retryBackoffMs", "Espera entre tentativas (ms)"],
            ] as const
          ).map(([campo, rotulo]) => {
            const aviso = warnings.find((w) => w.field === campo);
            return (
              <label key={campo} className="block space-y-1.5">
                <span className="text-sm text-muted-foreground">{rotulo}</span>
                <input
                  type="number"
                  value={Number.isFinite(draft[campo]) ? draft[campo] : ""}
                  onChange={(e) =>
                    set(campo)(e.target.value === "" ? Number.NaN : Number(e.target.value))
                  }
                  className={`${FIELD} w-full ${aviso ? "border-warning" : ""}`}
                />
                {aviso && (
                  <span className="flex items-start gap-1.5 text-xs text-warning">
                    <Info size={13} className="mt-0.5 shrink-0" />
                    {aviso.message}
                  </span>
                )}
              </label>
            );
          })}
        </div>

        {mutation.error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {mutation.error instanceof Error ? mutation.error.message : "Não foi possível criar."}
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
            {mutation.isPending ? "Criando..." : "Criar agente"}
          </button>
        </div>
      </form>
    </div>
  );
}
