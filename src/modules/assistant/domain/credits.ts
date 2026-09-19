/**
 * Quanto a loja ainda pode perguntar.
 *
 * Cada loja tem dez consultas grátis por dia, contadas no fuso de Brasília; o
 * que passa disso consome créditos comprados. As perguntas de suporte não
 * contam na cota. As regras são as do projeto anterior.
 */
export const DAILY_FREE_LIMIT = 10;

export interface UsageEntry {
  createdAt: string;
  wasFree: boolean;
  action: string | null;
}

export interface CreditSummary {
  freeRemaining: number;
  balance: number;
}

/** Meia-noite de hoje em Brasília, qualquer que seja o fuso do navegador. */
export function startOfTodayInBrasilia(now: Date = new Date()): Date {
  const dia = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return new Date(`${dia}T00:00:00-03:00`);
}

export function summarizeCredits(
  uso: UsageEntry[],
  movimentos: number[],
  now: Date = new Date(),
): CreditSummary {
  const inicio = startOfTodayInBrasilia(now).getTime();
  const gratisHoje = uso.filter(
    (u) => new Date(u.createdAt).getTime() >= inicio && u.action !== "support" && u.wasFree,
  ).length;
  return {
    freeRemaining: Math.max(0, DAILY_FREE_LIMIT - gratisHoje),
    balance: movimentos.reduce((soma, valor) => soma + valor, 0),
  };
}
