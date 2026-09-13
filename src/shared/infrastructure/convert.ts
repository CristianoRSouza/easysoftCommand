/**
 * Conversores de linha de banco para tipos do domínio.
 *
 * Existem porque as duas fontes divergem no formato: o driver `pg` devolve
 * `NUMERIC` como **texto** ("119.88"), enquanto o Supabase devolve número. Um
 * mapeador que esquecesse essa conversão mostraria R$ 0,00 no programa e o
 * valor certo no navegador, para o mesmo produto — e nada acusaria.
 *
 * São a alternativa a `as string` e `as number`: a conversão silenciosa deixa
 * um campo ausente virar a string "undefined" dentro de um filtro, e a consulta
 * falha sem dizer por quê.
 */

/** Texto não vazio, ou `null`. */
export function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Número a partir de número ou texto. Vale `0` quando não dá para converter. */
export function asNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Booleano. O PostgreSQL pode devolver `"t"`/`"f"` conforme o driver. */
export function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true" || value === "t";
  return false;
}

/**
 * Data como texto ISO, ou string vazia.
 *
 * As duas fontes divergem aqui, e de um jeito que passa despercebido: o
 * Supabase devolve `timestamptz` como texto ISO, o driver `pg` devolve um
 * objeto `Date` (que atravessa o IPC do Electron intacto, porque a clonagem
 * estruturada preserva datas). Tratar tudo como texto fazia a coluna de data
 * aparecer vazia só no programa instalado — a tela não quebrava, só mentia.
 */
export function asIsoDate(value: unknown): string {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  if (typeof value === "string") return value;
  return "";
}
