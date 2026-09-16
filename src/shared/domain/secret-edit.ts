/**
 * O que fazer com um segredo que a tela não mostra.
 *
 * Quem edita nunca vê o valor atual, então um campo vazio é ambíguo: pode
 * significar "não mexi" ou "quero apagar". O projeto anterior resolvia isso
 * pela presença da chave no objeto enviado — uma diferença invisível entre
 * `{}` e `{ token: null }`, que some em qualquer cópia de objeto pelo caminho.
 *
 * Aqui a intenção é declarada, e vale igual para o PIXnoPDV e para os totens.
 */
export type SecretEdit =
  | { readonly action: "keep" }
  | { readonly action: "clear" }
  | { readonly action: "set"; readonly value: string };

export const KEEP_SECRET: SecretEdit = { action: "keep" };

/** `true` quando o operador pediu para gravar um valor novo. */
export function isNewValue(edit: SecretEdit): edit is { action: "set"; value: string } {
  return edit.action === "set" && edit.value.trim() !== "";
}

/**
 * Traduz a intenção em valor de coluna. `undefined` significa "não incluir no
 * UPDATE" — é o que preserva o segredo atual sem precisar lê-lo.
 */
export function secretToColumn(edit: SecretEdit): string | null | undefined {
  if (edit.action === "keep") return undefined;
  if (edit.action === "clear") return null;
  const limpo = edit.value.trim();
  return limpo === "" ? null : limpo;
}
