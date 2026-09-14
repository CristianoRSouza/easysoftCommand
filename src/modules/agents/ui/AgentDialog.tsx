import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TriangleAlert, X } from "lucide-react";
import {
  draftFrom,
  LOG_LEVELS,
  requiresAcknowledgement,
  validateAgent,
  type Agent,
  type AgentDraft,
  type FieldError,
} from "../domain/agent";
import { saveAgent } from "../application/save-agent";
import { useContainer } from "@/shared/container/container-context";
import { useSession } from "@/shared/auth/auth-context";
import { FIELD } from "@/shared/ui/primitives";

function errorFor(errors: FieldError[], field: keyof AgentDraft): string | null {
  return errors.find((e) => e.field === field)?.message ?? null;
}

function Numero({
  label,
  hint,
  value,
  erro,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  erro: string | null;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
        className={`${FIELD} w-full ${erro ? "border-destructive" : ""}`}
      />
      {erro ? (
        <span className="block text-xs text-destructive">{erro}</span>
      ) : (
        hint && <span className="block text-xs text-muted-foreground">{hint}</span>
      )}
    </label>
  );
}

/**
 * Edição da configuração do agente.
 *
 * Valida no envio, não a cada tecla: acusar erro enquanto alguém ainda digita
 * um número é ruído.
 */
export function AgentDialog({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const { agents } = useContainer();
  const { session } = useSession();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState<AgentDraft>(() => draftFrom(agent));
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [confirmouAcumulo, setConfirmouAcumulo] = useState(false);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: () =>
      saveAgent(agents)(agent, draft, {
        // No modo local não há sessão: o registro fica como operador do painel,
        // que é o que se sabe com honestidade.
        performedBy: session?.user.email ?? "painel local",
        acknowledgedAccumulation: confirmouAcumulo,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agents"] });
      await queryClient.invalidateQueries({ queryKey: ["audit"] });
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const encontrados = validateAgent(draft);
    setErrors(encontrados);
    if (encontrados.length === 0) mutation.mutate();
  }

  const set =
    <K extends keyof AgentDraft>(chave: K) =>
    (valor: AgentDraft[K]) =>
      setDraft((d) => ({ ...d, [chave]: valor }));

  const vaiAcumular = requiresAcknowledgement(agent, draft);

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
            <h2 className="font-heading text-lg font-bold">{agent.name}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Configuração do agente · o nome e o caminho não mudam aqui
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
            checked={draft.isActive}
            onChange={(e) => set("isActive")(e.target.checked)}
            className="accent-primary"
          />
          <span className="text-sm">Agente ativo</span>
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

          <Numero
            label="Limite de chamadas"
            hint="Por minuto"
            value={draft.apiRateLimit}
            erro={errorFor(errors, "apiRateLimit")}
            onChange={set("apiRateLimit")}
          />
          <Numero
            label="Tempo limite SEFAZ (ms)"
            value={draft.timeoutMs}
            erro={errorFor(errors, "timeoutMs")}
            onChange={set("timeoutMs")}
          />
          <Numero
            label="Tentativas"
            value={draft.retryMaxAttempts}
            erro={errorFor(errors, "retryMaxAttempts")}
            onChange={set("retryMaxAttempts")}
          />
          <Numero
            label="Espera entre tentativas (ms)"
            value={draft.retryBackoffMs}
            erro={errorFor(errors, "retryBackoffMs")}
            onChange={set("retryBackoffMs")}
          />
        </div>

        <div className="space-y-3 border-t border-border/60 pt-4">
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Contingência
          </h3>

          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={draft.contingencyEnabled}
              onChange={(e) => set("contingencyEnabled")(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <span>
              <span className="text-sm">Emitir em contingência</span>
              <span className="block text-xs text-muted-foreground">
                Emite sem falar com a SEFAZ na hora, transmitindo depois.
              </span>
            </span>
          </label>

          {draft.contingencyEnabled && (
            <>
              <label className="block space-y-1.5">
                <span className="text-sm text-muted-foreground">Motivo</span>
                <input
                  value={draft.contingencyReason}
                  onChange={(e) => set("contingencyReason")(e.target.value)}
                  placeholder="SEFAZ indisponível, queda de internet…"
                  className={`${FIELD} w-full ${errorFor(errors, "contingencyReason") ? "border-destructive" : ""}`}
                />
                {errorFor(errors, "contingencyReason") ? (
                  <span className="block text-xs text-destructive">
                    {errorFor(errors, "contingencyReason")}
                  </span>
                ) : (
                  <span className="block text-xs text-muted-foreground">
                    Quem encontrar a loja neste estado semanas depois precisa saber por quê.
                  </span>
                )}
              </label>

              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={draft.contingencyAutoTransmit}
                  onChange={(e) => set("contingencyAutoTransmit")(e.target.checked)}
                  className="mt-0.5 accent-primary"
                />
                <span className="text-sm">Transmitir automaticamente quando a SEFAZ voltar</span>
              </label>

              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={draft.contingencyWorkerEnabled}
                  onChange={(e) => set("contingencyWorkerEnabled")(e.target.checked)}
                  className="mt-0.5 accent-primary"
                />
                <span className="text-sm">Worker de transmissão ligado</span>
              </label>

              <Numero
                label="Intervalo do worker (ms)"
                value={draft.contingencyWorkerIntervalMs}
                erro={errorFor(errors, "contingencyWorkerIntervalMs")}
                onChange={set("contingencyWorkerIntervalMs")}
              />
            </>
          )}
        </div>

        {/* A combinação que trava a loja em silêncio. A regra não proíbe — há
            casos em que se quer segurar o envio — mas exige que a escolha seja
            deliberada, e não efeito colateral de mexer noutro campo. */}
        {vaiAcumular && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-3">
            <input
              type="checkbox"
              checked={confirmouAcumulo}
              onChange={(e) => setConfirmouAcumulo(e.target.checked)}
              className="mt-0.5 accent-destructive"
            />
            <span className="text-sm text-destructive">
              <TriangleAlert size={14} className="mr-1 inline" />
              Entendo que as notas vão se acumular sem chegar à SEFAZ enquanto esta combinação
              estiver ativa.
            </span>
          </label>
        )}

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
