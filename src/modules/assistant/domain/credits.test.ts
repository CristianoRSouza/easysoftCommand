import { describe, expect, it } from "vitest";
import { DAILY_FREE_LIMIT, startOfTodayInBrasilia, summarizeCredits } from "./credits";

const AGORA = new Date("2026-09-19T12:00:00-03:00");

function uso(createdAt: string, wasFree = true, action: string | null = "chat") {
  return { createdAt, wasFree, action };
}

describe("créditos do assistente", () => {
  it("conta o dia pelo fuso de Brasília, não pelo do navegador", () => {
    // 23h de Brasília já é o dia seguinte em UTC; contar por UTC daria cota
    // nova antes da hora para quem usa à noite.
    expect(startOfTodayInBrasilia(AGORA).toISOString()).toBe("2026-09-19T03:00:00.000Z");
  });

  it("desconta da cota grátis só o uso de hoje", () => {
    const resumo = summarizeCredits(
      [uso("2026-09-19T10:00:00-03:00"), uso("2026-09-18T10:00:00-03:00")],
      [],
      AGORA,
    );
    expect(resumo.freeRemaining).toBe(DAILY_FREE_LIMIT - 1);
  });

  it("pergunta ao suporte não consome a cota", () => {
    const resumo = summarizeCredits(
      [uso("2026-09-19T10:00:00-03:00", true, "support")],
      [],
      AGORA,
    );
    expect(resumo.freeRemaining).toBe(DAILY_FREE_LIMIT);
  });

  it("consulta paga não consome a cota grátis", () => {
    const resumo = summarizeCredits([uso("2026-09-19T10:00:00-03:00", false)], [], AGORA);
    expect(resumo.freeRemaining).toBe(DAILY_FREE_LIMIT);
  });

  it("a cota não fica negativa depois do limite", () => {
    const doze = Array.from({ length: 12 }, () => uso("2026-09-19T10:00:00-03:00"));
    expect(summarizeCredits(doze, [], AGORA).freeRemaining).toBe(0);
  });

  it("o saldo é a soma do extrato, com compras e consumos", () => {
    expect(summarizeCredits([], [100, -3, -7, 50], AGORA).balance).toBe(140);
    expect(summarizeCredits([], [], AGORA).balance).toBe(0);
  });
});
