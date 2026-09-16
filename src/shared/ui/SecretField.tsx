import { KEEP_SECRET, type SecretEdit } from "@/shared/domain/secret-edit";
import { FIELD } from "./primitives";

/**
 * Campo de segredo.
 *
 * O valor atual nunca chega até a tela — ela só sabe se existe. Por isso as
 * três ações são explícitas: deixar em branco mantém, digitar substitui, e
 * apagar exige marcar a caixa. Um campo vazio, sozinho, jamais apaga nada.
 */
export function SecretField({
  label,
  present,
  edit,
  onChange,
}: {
  label: string;
  present: boolean;
  edit: SecretEdit;
  onChange: (edit: SecretEdit) => void;
}) {
  const removendo = edit.action === "clear";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {present ? "Gravado" : "Não configurado"}
        </span>
      </div>

      <input
        type="password"
        autoComplete="new-password"
        disabled={removendo}
        value={edit.action === "set" ? edit.value : ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? KEEP_SECRET : { action: "set", value: e.target.value })
        }
        placeholder={present ? "Deixe em branco para manter" : "Informe a credencial"}
        className={`${FIELD} w-full disabled:opacity-50`}
      />

      {present && (
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={removendo}
            onChange={(e) => onChange(e.target.checked ? { action: "clear" } : KEEP_SECRET)}
            className="accent-destructive"
          />
          <span className="text-xs text-muted-foreground">Apagar esta credencial</span>
        </label>
      )}
    </div>
  );
}
