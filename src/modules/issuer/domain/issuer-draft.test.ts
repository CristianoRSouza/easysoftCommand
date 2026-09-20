import { describe, expect, it } from "vitest";
import { inspectIssuer, toColumns, type IssuerDraft } from "./issuer-draft";

function rascunho(parcial: Partial<IssuerDraft> = {}): IssuerDraft {
  return {
    companyName: "KELLY DE OLIVEIRA MENDONCA",
    tradeName: "CORAÇÃO MELADO",
    cnpj: "60.326.256/0001-15",
    stateRegistration: "574164429119",
    municipalRegistration: null,
    cnae: "4721104",
    street: "PRACA EXPEDICIONARIOS BRASILEIRO",
    number: "8",
    complement: null,
    neighborhood: "CENTRO",
    zipCode: "11900000",
    phone: "13 38222375",
    nfceSerie: null,
    nfeSerie: null,
    ...parcial,
  };
}

describe("conferência do emitente", () => {
  it("cadastro completo não gera aviso", () => {
    expect(inspectIssuer(rascunho())).toEqual([]);
  });

  it("avisa sobre CNPJ incompleto, contando só os dígitos", () => {
    // Um dígito faltando só aparece quando a SEFAZ rejeita a nota — e aí a
    // venda já aconteceu.
    const avisos = inspectIssuer(rascunho({ cnpj: "60.326.256/0001-1" }));
    expect(avisos[0]?.field).toBe("cnpj");
    expect(avisos[0]?.message).toContain("13 dígitos");
  });

  it("avisa sobre a falta de inscrição estadual", () => {
    const avisos = inspectIssuer(rascunho({ stateRegistration: "  " }));
    expect(avisos.some((a) => a.field === "stateRegistration")).toBe(true);
  });

  it("avisa sobre CEP e CNAE com tamanho errado, e ignora os vazios", () => {
    expect(inspectIssuer(rascunho({ zipCode: "119000" })).some((a) => a.field === "zipCode")).toBe(
      true,
    );
    expect(inspectIssuer(rascunho({ cnae: "47211" })).some((a) => a.field === "cnae")).toBe(true);
    expect(inspectIssuer(rascunho({ zipCode: null, cnae: null }))).toEqual([]);
  });

  it("razão social vazia é aviso: ela sai impressa na nota", () => {
    expect(inspectIssuer(rascunho({ companyName: "  " }))[0]?.field).toBe("companyName");
  });
});

describe("colunas do emitente", () => {
  it("campo em branco vira nulo, e não texto vazio", () => {
    const colunas = toColumns(rascunho({ municipalRegistration: "   ", complement: "" }));
    expect(colunas.municipal_registration).toBeNull();
    expect(colunas.address_complement).toBeNull();
  });

  it("mantém o que foi preenchido", () => {
    expect(toColumns(rascunho()).legal_name).toBe("KELLY DE OLIVEIRA MENDONCA");
  });
});
