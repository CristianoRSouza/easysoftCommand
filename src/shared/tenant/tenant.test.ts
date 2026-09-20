import { describe, expect, it } from "vitest";
import { resolveCompany, resolveStore, seesAllStores, type StoreOption } from "./tenant";

const empresas = [
  { id: "c1", name: "CORAÇÃO MELADO", cnpj: "60326256000115" },
  { id: "c2", name: "OUTRA", cnpj: "00000000000191" },
];

function loja(id: string, isDefault = false): StoreOption {
  return { id, name: `Loja ${id}`, companyId: "c1", isDefault };
}

const perfil = (system: boolean, company: boolean) => ({
  isSystemAdmin: system,
  isCompanyAdmin: company,
});

describe("quem enxerga todas as lojas", () => {
  it("administrador do sistema e da empresa enxergam; o operador, não", () => {
    expect(seesAllStores(perfil(true, false))).toBe(true);
    expect(seesAllStores(perfil(false, true))).toBe(true);
    expect(seesAllStores(perfil(false, false))).toBe(false);
  });
});

describe("empresa escolhida", () => {
  it("mantém a guardada, quando ela continua liberada", () => {
    expect(resolveCompany(empresas, "c2")).toBe("c2");
  });

  it("descarta a guardada que não está mais liberada", () => {
    // Sem isso, quem perdeu o acesso continuaria vendo dados da empresa antiga.
    expect(resolveCompany(empresas, "c9")).toBeNull();
  });

  it("escolhe sozinho quando só há uma", () => {
    expect(resolveCompany([empresas[0]!], null)).toBe("c1");
  });

  it("não escolhe por conta própria entre várias", () => {
    expect(resolveCompany(empresas, null)).toBeNull();
  });
});

describe("loja escolhida", () => {
  const lojas = [loja("s1"), loja("s2", true)];

  it("mantém a loja atual, se ainda vale", () => {
    expect(resolveStore(lojas, "s1", "s2")).toBe("s1");
  });

  it("cai para a guardada quando a atual não vale mais", () => {
    expect(resolveStore(lojas, "s9", "s2")).toBe("s2");
  });

  it("escolhe sozinho quando só há uma", () => {
    expect(resolveStore([loja("s1")], null, null)).toBe("s1");
  });

  it("entre várias, fica com a matriz", () => {
    expect(resolveStore(lojas, null, null)).toBe("s2");
  });

  it("sem loja liberada, não inventa nenhuma", () => {
    expect(resolveStore([], "s1", "s2")).toBeNull();
  });
});
