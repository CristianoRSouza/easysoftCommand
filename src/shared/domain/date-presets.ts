import type { DateRange } from "./paging";

/**
 * Atalhos de período.
 *
 * O projeto anterior oferece estes quatro em todas as telas com filtro de
 * data. Digitar duas datas para ver o dia de hoje é trabalho que a tela pode
 * poupar.
 */
export type DatePreset = "today" | "7d" | "30d" | "month";

export const DATE_PRESET_LABEL: Record<DatePreset, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  month: "Mês atual",
};

export const DATE_PRESETS: DatePreset[] = ["today", "7d", "30d", "month"];

function ymd(date: Date): string {
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mes}-${dia}`;
}

function shiftDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * O período de um atalho.
 *
 * "7 dias" é hoje mais os seis anteriores, não hoje mais sete: quem pede uma
 * semana espera sete dias no total, contando o de hoje.
 */
export function presetRange(preset: DatePreset, now: Date = new Date()): DateRange {
  switch (preset) {
    case "today":
      return { from: ymd(now), to: ymd(now) };
    case "7d":
      return { from: ymd(shiftDays(now, -6)), to: ymd(now) };
    case "30d":
      return { from: ymd(shiftDays(now, -29)), to: ymd(now) };
    case "month": {
      const primeiro = new Date(now.getFullYear(), now.getMonth(), 1);
      const ultimo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: ymd(primeiro), to: ymd(ultimo) };
    }
  }
}

/** Qual atalho corresponde ao período atual, ou `null` se for um período à mão. */
export function matchingPreset(range: DateRange, now: Date = new Date()): DatePreset | null {
  return (
    DATE_PRESETS.find((preset) => {
      const alvo = presetRange(preset, now);
      return alvo.from === range.from && alvo.to === range.to;
    }) ?? null
  );
}
