import { describe, expect, it } from "vitest";
import { matchingPreset, presetRange } from "./date-presets";
import { lastPageOf, pageToRange, startOfDayIso, startOfNextDayIso } from "./paging";

const AGORA = new Date("2026-09-19T15:30:00");

describe("períodos prontos", () => {
  it("hoje é só o dia de hoje", () => {
    expect(presetRange("today", AGORA)).toEqual({ from: "2026-09-19", to: "2026-09-19" });
  });

  it("sete dias incluem hoje, e não são hoje mais sete", () => {
    expect(presetRange("7d", AGORA)).toEqual({ from: "2026-09-13", to: "2026-09-19" });
    expect(presetRange("30d", AGORA)).toEqual({ from: "2026-08-21", to: "2026-09-19" });
  });

  it("mês atual é o mês inteiro, como no projeto anterior", () => {
    expect(presetRange("month", AGORA)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("reconhece o período escolhido para destacar o botão certo", () => {
    expect(matchingPreset({ from: "2026-09-13", to: "2026-09-19" }, AGORA)).toBe("7d");
    expect(matchingPreset({ from: "2026-07-01", to: "2026-08-04" }, AGORA)).toBeNull();
  });
});

describe("paginação e limites do dia", () => {
  it("converte página em intervalo de linhas", () => {
    expect(pageToRange(1, 50)).toEqual({ from: 0, to: 49 });
    expect(pageToRange(3, 50)).toEqual({ from: 100, to: 149 });
  });

  it("lista vazia ainda tem uma página, para a tela não somer", () => {
    expect(lastPageOf(0, 50)).toBe(1);
    expect(lastPageOf(50, 50)).toBe(1);
    expect(lastPageOf(51, 50)).toBe(2);
  });

  it("o filtro de data cobre o dia inteiro, até o instante antes do dia seguinte", () => {
    // Comparar com o fim do dia por "23:59:59" perderia as vendas do último
    // segundo; o filtro usa o começo do dia seguinte com "menor que".
    const inicio = new Date(startOfDayIso("2026-09-19"));
    const fim = new Date(startOfNextDayIso("2026-09-19"));
    expect(fim.getTime() - inicio.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(inicio.getHours()).toBe(0);
  });
});
