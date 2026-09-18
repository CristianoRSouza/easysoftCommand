import type { RevenueMethod } from "../domain/revenue";

/**
 * As cores das séries, lidas dos tokens do tema.
 *
 * A cor segue o meio de pagamento, nunca a posição na lista: filtrar ou
 * reordenar não pode repintar as séries que sobraram.
 */
export const METHOD_COLOR: Record<RevenueMethod, string> = {
  credit: "hsl(var(--chart-credit))",
  debit: "hsl(var(--chart-debit))",
  pix: "hsl(var(--chart-pix))",
};

/** Série única — sem identidade a distinguir, usa a cor de destaque do painel. */
export const SINGLE_SERIES = "hsl(var(--primary))";
export const COMPARISON_SERIES = "hsl(var(--muted-foreground))";

/** Eixos e grade ficam discretos: o dado é que precisa ser visto. */
export const AXIS = { fontSize: 11, fill: "hsl(var(--muted-foreground))" } as const;
export const GRID = "hsl(var(--border))";

/** O fundo do painel, usado como separador de 2px entre fatias empilhadas. */
export const SURFACE = "hsl(var(--card))";

export const TOOLTIP_STYLE = {
  contentStyle: {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "0.5rem",
    fontSize: "0.8rem",
  },
  labelStyle: { color: "hsl(var(--foreground))" },
  itemStyle: { color: "hsl(var(--foreground))" },
} as const;

/** Valores no eixo: milhares abreviados, para o rótulo não virar uma parede. */
export function shortCurrency(value: number): string {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 1000)} mil`;
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}
