import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TriangleAlert, X } from "lucide-react";
import { TOTEM_MODE_LABEL, type Totem, type TotemMode } from "../domain/totem";
import { draftFrom, rejectionFor, wantsProduction, type TotemDraft } from "../domain/totem-draft";
import { saveTotem } from "../application/save-totem";
import { SecretField } from "@/shared/ui/SecretField";
import { useContainer } from "@/shared/container/container-context";
import { useSession } from "@/shared/auth/auth-context";
import { FIELD } from "@/shared/ui/primitives";

/** Os modos que se pode escolher. `unknown` não é uma escolha, é um diagnóstico. */
const MODES: TotemMode[] = ["demo", "homolog", "production"];

function Texto({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <input
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${FIELD} w-full`}
      />
    </label>
  );
}

function Numero({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
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
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function TotemDialog({ totem, onClose }: { totem: Totem; onClose: () => void }) {
  const { totems } = useContainer();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<TotemDraft>(() => draftFrom(totem));

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: () =>
      saveTotem(totems)(totem, draft, { performedBy: session?.user.email ?? "painel" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["totems"] });
      await queryClient.invalidateQueries({ queryKey: ["audit"] });
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  const set =
    <K extends keyof TotemDraft>(chave: K) =>
    (valor: TotemDraft[K]) =>
      setDraft((d) => ({ ...d, [chave]: valor }));

  // A recusa aparece enquanto se edita, não depois de tentar salvar.
  const recusa = rejectionFor(draft, totem.license);

  // O modo do aplicativo e o ambiente fiscal deveriam concordar: vender de
  // verdade emitindo nota de teste é o engano que custa caro.
  const divergente =
    draft.mode === "production" && draft.nfceEnvironment != null && draft.nfceEnvironment !== 1;

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
            <h2 className="font-heading text-lg font-bold">{totem.name || "Sem nome"}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Impressora e tempos do TEF não são alterados por esta tela e ficam como estão
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

        <div className="grid gap-4 sm:grid-cols-2">
          <Texto label="Nome" value={draft.name} onChange={set("name")} />

          <label className="block space-y-1.5">
            <span className="text-sm text-muted-foreground">Modo do aplicativo</span>
            <select
              value={draft.mode}
              onChange={(e) => set("mode")(e.target.value as TotemMode)}
              className={`${FIELD} w-full`}
            >
              {draft.mode === "unknown" && (
                <option value="unknown">{TOTEM_MODE_LABEL.unknown}</option>
              )}
              {MODES.map((modo) => (
                <option key={modo} value={modo}>
                  {TOTEM_MODE_LABEL[modo]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(e) => set("isActive")(e.target.checked)}
            className="accent-primary"
          />
          <span className="text-sm">Totem ativo</span>
        </label>

        <div className="space-y-4 border-t border-border/60 pt-4">
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Fiscal
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm text-muted-foreground">Ambiente da NFC-e</span>
              <select
                value={draft.nfceEnvironment ?? ""}
                onChange={(e) =>
                  set("nfceEnvironment")(e.target.value === "" ? null : Number(e.target.value))
                }
                className={`${FIELD} w-full`}
              >
                <option value="">Não definido</option>
                <option value="1">Produção</option>
                <option value="2">Homologação</option>
              </select>
            </label>

            <Numero label="Série" value={draft.nfceSerie} onChange={set("nfceSerie")} />
            <Numero
              label="Tempo limite de emissão (ms)"
              hint="Entre 10.000 e 300.000; fora disso o banco guarda vazio"
              value={draft.nfceEmitTimeoutMs}
              onChange={set("nfceEmitTimeoutMs")}
            />
            <Texto
              label="URL do serviço fiscal"
              value={draft.nfceServiceUrl}
              placeholder="https://..."
              onChange={set("nfceServiceUrl")}
            />
          </div>

          {divergente && (
            <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <span>
                Totem em produção emitindo NFC-e em homologação: as notas não terão valor fiscal.
              </span>
            </p>
          )}
        </div>

        <div className="space-y-3 border-t border-border/60 pt-4">
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Meios de pagamento
          </h3>
          <div className="flex flex-wrap gap-5">
            {(
              [
                ["creditEnabled", "Crédito"],
                ["debitEnabled", "Débito"],
                ["pixEnabled", "PIX"],
              ] as const
            ).map(([chave, label]) => (
              <label key={chave} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft[chave]}
                  onChange={(e) => set(chave)(e.target.checked)}
                  className="accent-primary"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
          {!draft.creditEnabled && !draft.debitEnabled && !draft.pixEnabled && (
            <p className="text-xs text-warning">
              Sem nenhum meio habilitado o totem não recebe pagamento algum.
            </p>
          )}
        </div>

        <div className="space-y-4 border-t border-border/60 pt-4">
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Integrações
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <Texto
              label="URL do TEF"
              value={draft.tefBaseUrl}
              placeholder="https://..."
              onChange={set("tefBaseUrl")}
            />
            <Texto
              label="URL do PIX"
              value={draft.pixBaseUrl}
              placeholder="https://..."
              onChange={set("pixBaseUrl")}
            />
            <Texto
              label="CNPJ do estabelecimento"
              value={draft.establishmentCnpj}
              onChange={set("establishmentCnpj")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <SecretField
              label="Chave do serviço fiscal"
              present={totem.integrations.nfceServiceApiKey}
              edit={draft.nfceServiceApiKey}
              onChange={set("nfceServiceApiKey")}
            />
            <SecretField
              label="Chave do TEF"
              present={totem.integrations.tefApiKey}
              edit={draft.tefApiKey}
              onChange={set("tefApiKey")}
            />
            <SecretField
              label="Token de parceiro Aditum"
              present={totem.integrations.aditumPartnerToken}
              edit={draft.aditumPartnerToken}
              onChange={set("aditumPartnerToken")}
            />
            <SecretField
              label="Código de ativação Aditum"
              present={totem.integrations.aditumActivationCode}
              edit={draft.aditumActivationCode}
              onChange={set("aditumActivationCode")}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Os segredos da Aditum são cifrados no servidor antes de serem gravados. A auditoria
            registra que a chave mudou, nunca o valor dela.
          </p>
        </div>

        {recusa && (
          <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <span>{recusa}</span>
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
            disabled={mutation.isPending || recusa !== null}
            title={recusa ?? undefined}
            className="rounded-lg bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>

        {/* `wantsProduction` sem recusa significa que a licença permite: vale
            dizer, porque é a pergunta que o operador faz antes de virar a chave. */}
        {wantsProduction(draft) && !recusa && (
          <p className="text-xs text-muted-foreground">
            A licença deste totem permite operação em produção.
          </p>
        )}
      </form>
    </div>
  );
}
