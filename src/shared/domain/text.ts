/**
 * Normalização do que o operador digitou, antes de gravar.
 *
 * Campo em branco e campo ausente significam a mesma coisa no banco: nulo.
 * Guardar `""` em vez de `NULL` cria duas formas de "vazio" que depois
 * discordam em qualquer comparação.
 */
export function textOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const limpo = value.trim();
  return limpo === "" ? null : limpo;
}

/** URL sem barras no fim, para não gerar `.../api//recurso` ao concatenar. */
export function urlOrNull(value: string | null | undefined): string | null {
  const limpo = textOrNull(value);
  return limpo ? limpo.replace(/\/+$/, "") : null;
}
