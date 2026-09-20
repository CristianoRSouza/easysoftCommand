import { describe, expect, it } from "vitest";
import { toDocuments, toItem, toPayment, toTotals } from "./nfce-detail-mapper";

describe("documentos da nota", () => {
  it("separa o XML que não existe do que está no armazenamento de arquivos", () => {
    // Caso real: as notas autorizadas desta base têm a coluna vazia e o
    // arquivo no bucket fiscal-xml, que o painel não pode ler. Dizer "não
    // existe" seria falso.
    const documentos = toDocuments({
      authorized_xml: null,
      storage_authorized_xml_path: "empresa/loja/sem-chave.xml",
      signed_xml: null,
      cancellation_xml: null,
    });

    expect(documentos.authorized).toBeNull();
    expect(documentos.storedElsewhere).toEqual({
      authorized: true,
      signed: false,
      cancellation: false,
    });
  });

  it("XML na coluna é lido direto, sem apontar para o armazenamento", () => {
    const documentos = toDocuments({ authorized_xml: "<nfe/>", storage_authorized_xml_path: null });
    expect(documentos.authorized).toBe("<nfe/>");
    expect(documentos.storedElsewhere.authorized).toBe(false);
  });
});

describe("linhas da nota", () => {
  it("lê valor que vem como texto, que é como o banco devolve NUMERIC", () => {
    // Um mapeador que esquecesse isso mostraria R$ 0,00 para o mesmo produto.
    const item = toItem({ item_number: "1", quantity: "2.5", unit_price: "10.40", gross_total: "26.00" });
    expect(item).toMatchObject({ sequence: 1, quantity: 2.5, unitPrice: 10.4, grossValue: 26 });
  });

  it("soma da nota vem dos campos fiscais, mesmo quando zerados", () => {
    const totais = toTotals({ products_value: "26.00", total_value: "26.00", discount_value: null });
    expect(totais.products).toBe(26);
    expect(totais.discount).toBe(0);
  });

  it("pagamento sem troco não vira troco indefinido", () => {
    // A coluna é `payment_value`, não `amount`: ler o nome errado mostraria
    // R$ 0,00 em toda linha, que parece dado e não é.
    const pagamento = toPayment({ payment_number: 1, payment_method: "03", payment_value: "26.00" });
    expect(pagamento).toMatchObject({ sequence: 1, amount: 26, change: 0 });
  });
});
