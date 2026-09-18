import { FIELD } from "@/shared/ui/primitives";

/** Campo de texto. */
export function Texto({
  label,
  value,
  placeholder,
  hint,
  onChange,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  hint?: string;
  onChange: (value: string) => void;
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
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

/**
 * Campo numérico.
 *
 * Campo vazio vira `null`, e não zero: zero é uma resposta, vazio é a ausência
 * dela. Confundir os dois faria um tempo de espera não informado virar "espere
 * zero milissegundos".
 */
export function Numero({
  label,
  value,
  hint,
  onChange,
}: {
  label: string;
  value: number | null;
  hint?: string;
  onChange: (value: number | null) => void;
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

/** Campo numérico que sempre tem valor — um padrão do equipamento. */
export function NumeroFixo({
  label,
  value,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  hint?: string;
  onChange: (value: number) => void;
}) {
  return (
    <Numero
      label={label}
      value={value}
      hint={hint}
      onChange={(novo) => onChange(novo ?? 0)}
    />
  );
}

export function Marcador({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-primary"
      />
      <span>
        <span className="text-sm">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

export function Escolha<T extends string>({
  label,
  value,
  options,
  hint,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  hint?: string;
  onChange: (value: T) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={`${FIELD} w-full`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
