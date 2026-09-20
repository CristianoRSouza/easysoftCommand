import { describe, expect, it } from "vitest";
import { clampToWindow, earliestAllowedDate, isOutsideWindow, UNLIMITED_WINDOW } from "./plan-window";

const AGORA = new Date("2026-09-19T12:00:00");
const demo = { planSlug: "ecp-demo", planName: "Demo", historyWindowDays: 30 };
const standard = { planSlug: "ecp-standard", planName: "Standard", historyWindowDays: 90 };

describe("janela de histórico do plano", () => {
  it("conta hoje como o primeiro dia da janela", () => {
    // 30 dias são hoje mais 29 anteriores, não hoje mais 30.
    expect(earliestAllowedDate(demo, AGORA)).toBe("2026-08-21");
    expect(earliestAllowedDate(standard, AGORA)).toBe("2026-06-22");
  });

  it("plano sem limite alcança qualquer data", () => {
    expect(earliestAllowedDate(UNLIMITED_WINDOW, AGORA)).toBeNull();
    expect(isOutsideWindow({ from: "2020-01-01", to: null }, UNLIMITED_WINDOW, AGORA)).toBe(false);
  });

  it("recusa o período que começa antes do que o plano alcança", () => {
    expect(isOutsideWindow({ from: "2026-07-01", to: "2026-08-04" }, demo, AGORA)).toBe(true);
    expect(isOutsideWindow({ from: "2026-07-01", to: "2026-08-04" }, standard, AGORA)).toBe(false);
  });

  it("encurta o período até onde o plano alcança", () => {
    expect(clampToWindow({ from: "2026-01-01", to: "2026-09-19" }, demo, AGORA)).toEqual({
      from: "2026-08-21",
      to: "2026-09-19",
    });
  });

  it("período inteiro no passado vira a janela toda, e não um intervalo vazio", () => {
    expect(clampToWindow({ from: "2025-01-01", to: "2025-02-01" }, demo, AGORA)).toEqual({
      from: "2026-08-21",
      to: "2026-09-19",
    });
  });
});
