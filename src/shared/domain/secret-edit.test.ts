import { describe, expect, it } from "vitest";
import { isNewValue, KEEP_SECRET, secretToColumn } from "./secret-edit";

/**
 * Quem edita nunca vê o segredo atual, então campo vazio é ambíguo: "não
 * mexi" ou "quero apagar"? A intenção é declarada, e não deduzida da presença
 * da chave no objeto — diferença que some em qualquer cópia pelo caminho.
 */
describe("edição de segredo", () => {
  it("manter não entra no UPDATE, e é isso que preserva o valor atual", () => {
    expect(secretToColumn(KEEP_SECRET)).toBeUndefined();
  });

  it("apagar grava nulo de propósito", () => {
    expect(secretToColumn({ action: "clear" })).toBeNull();
  });

  it("gravar novo valor tira os espaços das pontas", () => {
    expect(secretToColumn({ action: "set", value: "  abc123  " })).toBe("abc123");
  });

  it("pedir para gravar só espaço não é gravar nada", () => {
    expect(isNewValue({ action: "set", value: "   " })).toBe(false);
    expect(secretToColumn({ action: "set", value: "   " })).toBeUndefined();
  });

  it("reconhece quando há valor novo de verdade", () => {
    expect(isNewValue({ action: "set", value: "abc" })).toBe(true);
    expect(isNewValue(KEEP_SECRET)).toBe(false);
    expect(isNewValue({ action: "clear" })).toBe(false);
  });
});
