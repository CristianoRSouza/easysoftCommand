const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const quantity = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function formatCurrency(value: number): string {
  return currency.format(value);
}

export function formatQuantity(value: number): string {
  return quantity.format(value);
}

/** Data e hora no fuso do usuário. Devolve travessão quando a data é inválida. */
export function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date);
}
