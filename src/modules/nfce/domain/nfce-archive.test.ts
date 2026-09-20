import { describe, expect, it } from "vitest";
import {
  archiveFileName,
  emptyStats,
  fileNameFor,
  summaryText,
  uniqueName,
  type ArchivedNote,
} from "./nfce-archive";
import { DEFAULT_NFCE_QUERY } from "./nfce-note";

function nota(parcial: Partial<ArchivedNote> = {}): ArchivedNote {
  return {
    id: "n1",
    number: 12,
    serie: 2,
    accessKey: "35260612345678000199650020000000121000000127",
    status: "authorized",
    authorizedXml: "<nfe/>",
    cancellationXml: null,
    storedElsewhere: false,
    ...parcial,
  };
}

describe("pacote de XML", () => {
  it("nomeia o arquivo pela chave de acesso, que é como a contabilidade procura", () => {
    expect(fileNameFor(nota())).toBe("35260612345678000199650020000000121000000127.xml");
    expect(fileNameFor(nota(), "-cancelamento")).toContain("-cancelamento.xml");
  });

  it("cai para número e série quando a nota não tem chave", () => {
    // Nesta base, nenhuma nota autorizada tem a chave gravada.
    expect(fileNameFor(nota({ accessKey: null }))).toBe("nota-2-12.xml");
  });

  it("não repete nome dentro do pacote", () => {
    const usados = new Set<string>();
    expect(uniqueName("a.xml", usados)).toBe("a.xml");
    expect(uniqueName("a.xml", usados)).toBe("a-2.xml");
    expect(uniqueName("a.xml", usados)).toBe("a-3.xml");
  });

  it("o nome do pacote descreve o filtro que o gerou", () => {
    expect(
      archiveFileName({
        ...DEFAULT_NFCE_QUERY,
        range: { from: "2026-07-01", to: "2026-08-04" },
        status: "authorized",
      }),
    ).toBe("nfce-xml-2026-07-01_a_2026-08-04-authorized.zip");

    expect(archiveFileName({ ...DEFAULT_NFCE_QUERY, reconcileFailed: true })).toBe(
      "nfce-xml-todo-o-periodo-reconciliacao-falhou.zip",
    );
  });

  it("separa, no resumo, a nota sem XML da que tem XML guardado no armazenamento", () => {
    // Misturar as duas faria o resumo dizer que o documento não existe.
    const stats = emptyStats();
    stats.notes = 2;
    stats.withoutXml.push("nº 7/2 (draft)");
    stats.inStorage.push("chave-abc (authorized)");

    const resumo = summaryText(DEFAULT_NFCE_QUERY, stats, new Date("2026-09-19T12:00:00Z"));

    expect(resumo).toContain("Notas sem XML: 1");
    expect(resumo).toContain("Notas com XML no armazenamento (fora deste pacote): 1");
    expect(resumo).toContain("chave-abc (authorized)");
    expect(resumo).toContain("Não é falta de documento");
  });
});
