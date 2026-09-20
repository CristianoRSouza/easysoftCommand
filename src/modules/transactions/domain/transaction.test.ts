import { describe, expect, it } from "vitest";
import {
  paymentMethodLabel,
  TRANSACTION_STATUSES,
  transactionStatusLabel,
  transactionStatusTone,
} from "./transaction";

describe("status de transação", () => {
  it("traduz os status que travam o pagamento no meio do caminho", () => {
    // Apareciam em inglês e não podiam ser filtrados: são 573 nesta loja.
    expect(transactionStatusLabel("processing")).toBe("Em processamento");
    expect(transactionStatusLabel("aborted")).toBe("Abortada");
    expect(transactionStatusLabel("tef_requested")).toBe("TEF solicitado");
  });

  it("mostra como veio do banco o status que ninguém previu", () => {
    // Esconder um status desconhecido é pior que mostrá-lo em inglês.
    expect(transactionStatusLabel("quantum_flux")).toBe("quantum_flux");
    expect(transactionStatusTone("quantum_flux")).toBe("muted");
  });

  it("colore o aprovado de sucesso e a falha de vermelho", () => {
    expect(transactionStatusTone("approved")).toBe("success");
    expect(transactionStatusTone("failed")).toBe("destructive");
    expect(transactionStatusTone("processing")).toBe("info");
  });

  it("a lista do filtro é a mesma fonte do rótulo e da cor", () => {
    // Eram três listas, e `processing` ficou de fora das três.
    for (const status of TRANSACTION_STATUSES) {
      expect(transactionStatusLabel(status.value)).toBe(status.label);
      expect(transactionStatusTone(status.value)).toBe(status.tone);
    }
  });

  it("traduz os meios de pagamento e preserva o desconhecido", () => {
    expect(paymentMethodLabel("pix")).toBe("PIX");
    expect(paymentMethodLabel("crypto")).toBe("crypto");
  });
});
