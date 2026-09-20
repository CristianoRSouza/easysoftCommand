import { describe, expect, it } from "vitest";
import {
  averageTicketOf,
  buildReport,
  isRevenueMethod,
  type RevenueOrderItem,
  type RevenueSources,
  type RevenueTransaction,
} from "./revenue";

function tx(
  id: string,
  createdAt: string,
  method: RevenueTransaction["method"],
  amount: number,
  orderIds: string[] = [],
): RevenueTransaction {
  return { id, createdAt, method, amount, orderIds };
}

function item(orderId: string, product: string, quantity: number, unitPrice: number, subtotal: number): RevenueOrderItem {
  return { orderId, product, quantity, unitPrice, subtotal };
}

function fontes(parcial: Partial<RevenueSources> = {}): RevenueSources {
  return {
    range: { from: "2026-07-01", to: "2026-07-03" },
    transactions: [],
    previousYear: [],
    totemByOrder: new Map(),
    itemsByOrder: new Map(),
    authorizedNotes: 0,
    ...parcial,
  };
}

describe("relatório de receitas", () => {
  const transacoes = [
    tx("t1", "2026-07-01T10:00:00Z", "credit", 100, ["o1"]),
    tx("t2", "2026-07-01T11:00:00Z", "debit", 50, ["o2"]),
    tx("t3", "2026-07-03T09:00:00Z", "pix", 25, []),
  ];

  it("soma o período e reparte por meio de pagamento, com a fatia de cada um", () => {
    const relatorio = buildReport(fontes({ transactions: transacoes }));

    expect(relatorio.total).toEqual({ amount: 175, count: 3 });
    const porMeio = Object.fromEntries(relatorio.byMethod.map((m) => [m.method, m]));
    expect(porMeio.credit).toMatchObject({ amount: 100, count: 1 });
    expect(porMeio.debit?.share).toBeCloseTo(50 / 175, 5);
    expect(relatorio.byMethod.reduce((soma, m) => soma + m.share, 0)).toBeCloseTo(1, 5);
  });

  it("mostra o dia sem venda com zero, em vez de sumir com ele", () => {
    // Um gráfico que pula o dia parado é lido como dia que não existiu.
    const dias = buildReport(fontes({ transactions: transacoes })).byDay;
    expect(dias.map((d) => d.day)).toEqual(["2026-07-01", "2026-07-02", "2026-07-03"]);
    expect(dias[1]).toMatchObject({ total: 0, credit: 0, debit: 0, pix: 0 });
  });

  it("acumula o período dia a dia, terminando no total", () => {
    const dias = buildReport(fontes({ transactions: transacoes })).byDay;
    expect(dias.map((d) => d.cumulative)).toEqual([150, 150, 175]);
  });

  it("reparte o valor da transação entre os produtos, na proporção do subtotal", () => {
    // R$ 100 pagos numa comanda de R$ 80 em pão e R$ 20 em café: o pão fica
    // com R$ 80 do dinheiro, e não com metade.
    const relatorio = buildReport(
      fontes({
        transactions: [tx("t1", "2026-07-01T10:00:00Z", "credit", 100, ["o1"])],
        itemsByOrder: new Map([
          ["o1", [item("o1", "PAO", 2, 40, 80), item("o1", "CAFE", 1, 20, 20)]],
        ]),
      }),
    );

    const porProduto = Object.fromEntries(relatorio.topProducts.map((p) => [p.product, p]));
    expect(porProduto.PAO?.amount).toBeCloseTo(80, 5);
    expect(porProduto.CAFE?.amount).toBeCloseTo(20, 5);
    expect(porProduto.PAO?.transactions).toBe(1);
  });

  it("conta os itens com a quantidade cortada pela nuvem", () => {
    const relatorio = buildReport(
      fontes({
        transactions: [tx("t1", "2026-07-01T10:00:00Z", "credit", 10.48, ["o1"])],
        itemsByOrder: new Map([
          [
            "o1",
            [
              item("o1", "PAO DE QUEIJO KG", 0, 51.9, 10.48), // 0,202 kg virou 0
              item("o1", "CAFE", 1, 5, 5),
            ],
          ],
        ]),
      }),
    );

    expect(relatorio.truncatedItems).toBe(1);
  });

  it("ticket médio de período sem venda é zero, não divisão por zero", () => {
    expect(averageTicketOf({ amount: 0, count: 0 })).toBe(0);
    expect(averageTicketOf({ amount: 175, count: 3 })).toBeCloseTo(58.333, 3);
  });

  it("reconhece só os três meios que entram na receita", () => {
    expect(isRevenueMethod("credit")).toBe(true);
    expect(isRevenueMethod("cash")).toBe(false);
  });
});
