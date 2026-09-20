import { describe, expect, it } from "vitest";
import {
  closingState,
  CLOSING_LABEL,
  isCancelled,
  sumApproved,
  sumItems,
  type OrderClosing,
  type OrderItem,
  type OrderPayment,
} from "./order-detail";

function item(parcial: Partial<OrderItem> = {}): OrderItem {
  return {
    id: "i1",
    productName: "PAO",
    barcode: null,
    unitName: "UND",
    quantity: 1,
    unitPrice: 10,
    subtotal: 10,
    origin: "totem",
    status: "active",
    syncedToFirebird: false,
    firebirdId: null,
    ...parcial,
  };
}

function pagamento(status: string, amount: number): OrderPayment {
  return { id: `p-${status}-${amount}`, method: "credit", amount, status, createdAt: "" };
}

function fechamento(parcial: Partial<OrderClosing> = {}): OrderClosing {
  return {
    pending: false,
    attempts: 0,
    lastError: null,
    requestedAt: null,
    closedAt: null,
    firebirdSaleId: null,
    firebirdCashRegisterId: null,
    ...parcial,
  };
}

describe("soma da comanda", () => {
  it("item cancelado continua na tela, mas não é venda", () => {
    const itens = [item(), item({ id: "i2", subtotal: 25, status: "cancelled" })];
    expect(isCancelled(itens[1]!)).toBe(true);
    expect(sumItems(itens)).toBe(10);
  });

  it("reconhece o cancelado seja qual for a caixa do texto", () => {
    expect(isCancelled(item({ status: "CANCELLED" }))).toBe(true);
    expect(isCancelled(item({ status: null }))).toBe(false);
  });

  it("só o pagamento aprovado entrou no caixa", () => {
    const pagamentos = [pagamento("approved", 30), pagamento("processing", 100), pagamento("declined", 50)];
    // Somar o que está "em processamento" faria a comanda parecer paga.
    expect(sumApproved(pagamentos)).toBe(30);
  });
});

describe("fechamento no PDV", () => {
  it("separa a espera normal da espera com erro", () => {
    expect(closingState(fechamento({ closedAt: "2026-08-12T10:00:00Z" }))).toBe("closed");
    expect(closingState(fechamento({ pending: true }))).toBe("pending");
    expect(closingState(fechamento({ pending: true, lastError: "timeout" }))).toBe("failing");
    expect(closingState(fechamento())).toBe("open");
  });

  it("todo estado tem rótulo em português", () => {
    for (const estado of ["closed", "pending", "failing", "open"] as const) {
      expect(CLOSING_LABEL[estado]).toBeTruthy();
    }
  });
});
