const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const quantity = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function formatCurrency(value: number): string {
  return currency.format(value);
}

export function formatQuantity(value: number): string {
  return quantity.format(value);
}

/**
 * Um dia civil (`AAAA-MM-DD`) em `DD/MM/AAAA`.
 *
 * Montado a partir das partes, de propósito. `new Date("2026-09-17")` é
 * meia-noite em UTC, e no fuso do Brasil isso volta como dia 16 — um dia a
 * menos numa data que o usuário acabou de escolher.
 */
export function formatDate(ymd: string): string {
  const [ano, mes, dia] = ymd.split("-");
  if (!ano || !mes || !dia) return "—";
  return `${dia}/${mes}/${ano}`;
}

/** Data e hora no fuso do usuário. Devolve travessão quando a data é inválida. */
export function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date);
}
