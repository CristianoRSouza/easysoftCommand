import { describe, expect, it } from "vitest";
import { truncatedQuantity } from "./quantity";

/**
 * Casos reais da loja CORAÇÃO MELADO: a nuvem grava a quantidade como número
 * inteiro e o peso perde as casas decimais. A regra precisa apontar isso sem
 * confundir com desconto, que produz outra conta.
 */
describe("truncatedQuantity", () => {
  it("aponta o peso que o subtotal indica quando a quantidade foi cortada", () => {
    // 0,202 kg de pão de queijo a R$ 51,90 chegaram como 0.
    expect(truncatedQuantity({ quantity: 0, unitPrice: 51.9, subtotal: 10.48 })).toBe(0.202);
    // 7,82 kg de pão francês a R$ 16,49 chegaram como 7.
    expect(truncatedQuantity({ quantity: 7, unitPrice: 16.49, subtotal: 128.95 })).toBe(7.82);
  });

  it("não aponta nada quando a quantidade gravada fecha com o subtotal", () => {
    expect(truncatedQuantity({ quantity: 2, unitPrice: 5, subtotal: 10 })).toBeNull();
    expect(truncatedQuantity({ quantity: 1, unitPrice: 65, subtotal: 65 })).toBeNull();
  });

  it("não confunde desconto com corte: a parte inteira tem de bater", () => {
    // R$ 100 de desconto em 10 itens de R$ 20: a conta dá 5, inteiro, e a
    // quantidade gravada (10) não é a parte inteira dela.
    expect(truncatedQuantity({ quantity: 10, unitPrice: 20, subtotal: 100 })).toBeNull();
    // Acréscimo: o subtotal indica 3,5 mas foram lançadas 2 unidades.
    expect(truncatedQuantity({ quantity: 2, unitPrice: 10, subtotal: 35 })).toBeNull();
  });

  it("ignora linha sem preço ou sem valor, que não permite conta nenhuma", () => {
    expect(truncatedQuantity({ quantity: 0, unitPrice: 0, subtotal: 10 })).toBeNull();
    expect(truncatedQuantity({ quantity: 0, unitPrice: 51.9, subtotal: 0 })).toBeNull();
    expect(truncatedQuantity({ quantity: 1, unitPrice: -5, subtotal: 10 })).toBeNull();
  });
});
