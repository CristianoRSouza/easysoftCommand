import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info, TriangleAlert, X } from "lucide-react";
import {
  draftFrom,
  inspectAgent,
  LOG_LEVELS,
  type Agent,
  type AgentDraft,
  type AgentWarning,
} from "../domain/agent";
import { saveAgent } from "../application/save-agent";
import { useContainer } from "@/shared/container/container-context";
import { useSession } from "@/shared/auth/auth-context";
import { FIELD } from "@/shared/ui/primitives";

function warningFor(warnings: AgentWarning[], field: keyof AgentDraft): AgentWarning | null {
  return warnings.find((w) => w.field === field) ?? null;
}

/**
 * Aviso de campo — informa e não impede.
 *
 * A borda muda de cor, mas o botão Salvar continua funcionando: o projeto
 * anterior aceita qualquer valor aqui, e mudar isso seria transformar uma
 * migração em decisão de produto.
 */
function Aviso({ warning }: { warning: AgentWarning }) {
  const perigo = warning.severity === "danger";
  return (
    <span
      className={`flex items-start gap-1.5 text-xs ${perigo ? "text-destructive" : "text-warning"}`}
    >
      {perigo ? (
        <TriangleAlert size={13} className="mt-0.5 shrink-0" />
      ) : (
        <Info size={13} className="mt-0.5 shrink-0" />
      )}
      {warning.message}
    </span>
  );
}

function Numero({
  label,
  hint,
  value,
  warning,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  warning: AgentWarning | null;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
        className={`${FIELD} w-full ${warning ? "border-warning" : ""}`}
      />
      {warning ? <Aviso warning={warning} /> : hint && (
        <span className="block text-xs text-muted-foreground">{hint}</span>
      )}
    </label>
  );
}

export function AgentDialog({
  agent,
  onClose,
  onAuditMissing,
}: {
  agent: Agent;
  onClose: () => void;
  /** Chamado quando a alteração entrou mas a trilha recusou o registro. */
  onAuditMissing: (motivo: string) => void;
}) {
  const { agents } = useContainer();
  const { session } = useSession();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState<AgentDraft>(() => draftFrom(agent));

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
      }),
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
    mutation.mutate();
  }

  const set =
    <K extends keyof AgentDraft>(chave: K) =>
    (valor: AgentDraft[K]) =>
      setDraft((d) => ({ ...d, [chave]: valor }));

  // Avisos recalculados a cada mudança: quem está editando vê a consequência
  // enquanto decide, não depois de tentar salvar.
  const warnings = inspectAgent(draft);
  const acumula = warningFor(warnings, "contingencyAutoTransmit");

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
            warning={warningFor(warnings, "apiRateLimit")}
            onChange={set("apiRateLimit")}
          />
          <Numero
            label="Tempo limite SEFAZ (ms)"
            value={draft.timeoutMs}
            warning={warningFor(warnings, "timeoutMs")}
            onChange={set("timeoutMs")}
          />
          <Numero
            label="Tentativas"
            value={draft.retryMaxAttempts}
            warning={warningFor(warnings, "retryMaxAttempts")}
            onChange={set("retryMaxAttempts")}
          />
          <Numero
            label="Espera entre tentativas (ms)"
            value={draft.retryBackoffMs}
            warning={warningFor(warnings, "retryBackoffMs")}
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
                  className={`${FIELD} w-full`}
                />
                {warningFor(warnings, "contingencyReason") && (
                  <Aviso warning={warningFor(warnings, "contingencyReason")!} />
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
                warning={warningFor(warnings, "contingencyWorkerIntervalMs")}
                onChange={set("contingencyWorkerIntervalMs")}
              />

              <div className="space-y-3 border-t border-border/60 pt-3">
                <h4 className="text-sm font-medium">Substituição</h4>
                <p className="text-xs text-muted-foreground">
                  Troca a nota emitida em contingência por uma normal, depois que a SEFAZ volta.
                </p>

                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={draft.contingencySubstitutionWorkerEnabled}
                    onChange={(e) => set("contingencySubstitutionWorkerEnabled")(e.target.checked)}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="text-sm">Worker de substituição ligado</span>
                </label>

                {draft.contingencySubstitutionWorkerEnabled && (
                  <>
                    <Numero
                      label="Intervalo da substituição (ms)"
                      value={draft.contingencySubstitutionWorkerIntervalMs}
                      warning={null}
                      onChange={set("contingencySubstitutionWorkerIntervalMs")}
                    />
                    <label className="block space-y-1.5">
                      <span className="text-sm text-muted-foreground">
                        Justificativa da substituição
                      </span>
                      <input
                        value={draft.contingencySubstitutionJustification}
                        onChange={(e) =>
                          set("contingencySubstitutionJustification")(e.target.value)
                        }
                        placeholder="Texto que acompanha a nota substituta…"
                        className={`${FIELD} w-full`}
                      />
                    </label>
                  </>
                )}
              </div>

              {/* Contingência é para atravessar a queda da SEFAZ, não para virar
                  rotina: o acordo existe para alguém agir antes de a loja
                  acumular um dia inteiro de notas não autorizadas. */}
              <div className="space-y-3 border-t border-border/60 pt-3">
                <h4 className="text-sm font-medium">Limites de tempo em contingência</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Numero
                    label="Avisar após (horas)"
                    hint="Zero desliga o aviso"
                    value={draft.contingencySlaWarnHours}
                    warning={null}
                    onChange={set("contingencySlaWarnHours")}
                  />
                  <Numero
                    label="Bloquear após (horas)"
                    hint="Zero desliga o bloqueio"
                    value={draft.contingencySlaBlockHours}
                    warning={null}
                    onChange={set("contingencySlaBlockHours")}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* O aviso mais grave ganha destaque próprio, mas não bloqueia: há casos
            em que se quer mesmo segurar o envio. */}
        {acumula && (
          <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm text-destructive">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <span>{acumula.message}</span>
          </p>
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
