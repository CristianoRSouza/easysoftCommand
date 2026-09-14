import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import {
  draftFrom,
  validateUnit,
  type FieldError,
  type Unit,
  type UnitDraft,
} from "../domain/unit";
import { saveUnit } from "../application/save-unit";
import { useContainer } from "@/shared/container/container-context";
import { FIELD } from "@/shared/ui/primitives";

function errorFor(errors: FieldError[], field: keyof UnitDraft): string | null {
  return errors.find((e) => e.field === field)?.message ?? null;
}

/**
 * Formulário de edição da unidade.
 *
 * Valida no envio, não a cada tecla: acusar erro enquanto a pessoa ainda está
 * digitando a sigla é ruído. O que o domínio recusa vira mensagem aqui.
 */
export function UnitDialog({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const { units } = useContainer();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState<UnitDraft>(() => draftFrom(unit));
  const [errors, setErrors] = useState<FieldError[]>([]);

  // Fechar com Esc: um diálogo que só fecha no botão prende quem usa teclado.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: () => saveUnit(units)(unit, draft),
    onSuccess: async () => {
      // A lista precisa refletir a mudança; os produtos mostram o nome da
      // unidade na coluna, então também envelheceram.
      await queryClient.invalidateQueries({ queryKey: ["units"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const encontrados = validateUnit(draft);
    setErrors(encontrados);
    if (encontrados.length === 0) mutation.mutate();
  }

  const set = <K extends keyof UnitDraft>(chave: K) =>
    (valor: UnitDraft[K]) => setDraft((d) => ({ ...d, [chave]: valor }));

  const siglaErro = errorFor(errors, "shortDescription");
  const descricaoErro = errorFor(errors, "description");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-md space-y-5 rounded-lg p-6 shadow-elegant"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold">Editar unidade</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Código {unit.legacyCode} · o código não muda
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
          <span className="text-sm text-muted-foreground">Sigla</span>
          <input
            value={draft.shortDescription}
            onChange={(e) => set("shortDescription")(e.target.value)}
            maxLength={12}
            autoFocus
            className={`${FIELD} w-full uppercase ${siglaErro ? "border-destructive" : ""}`}
          />
          {siglaErro ? (
            <span className="block text-xs text-destructive">{siglaErro}</span>
          ) : (
            <span className="block text-xs text-muted-foreground">
              É a sigla que sai no cupom fiscal, ao lado da quantidade.
            </span>
          )}
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm text-muted-foreground">Descrição</span>
          <input
            value={draft.description}
            onChange={(e) => set("description")(e.target.value)}
            className={`${FIELD} w-full ${descricaoErro ? "border-destructive" : ""}`}
          />
          {descricaoErro && <span className="block text-xs text-destructive">{descricaoErro}</span>}
        </label>

        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={draft.isFractional}
              onChange={(e) => set("isFractional")(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <span>
              <span className="text-sm">Aceita quantidade fracionada</span>
              <span className="block text-xs text-muted-foreground">
                2,5 kg faz sentido; 2,5 unidades, não.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => set("isActive")(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <span>
              <span className="text-sm">Ativa</span>
              <span className="block text-xs text-muted-foreground">
                Desativar só é permitido quando nenhum produto usa a unidade.
              </span>
            </span>
          </label>
        </div>

        {mutation.error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {mutation.error instanceof Error
              ? mutation.error.message
              : "Não foi possível salvar."}
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
