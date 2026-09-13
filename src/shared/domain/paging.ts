/**
 * Paginação — vocabulário comum a todos os módulos de listagem.
 *
 * Vive em `shared/domain` porque é regra, não infraestrutura: continua válida
 * independentemente de os dados virem do PostgreSQL ou do Supabase.
 */

export type SortDirection = "asc" | "desc";

/** Uma página de resultados. `total` é a contagem do filtro inteiro, não da página. */
export interface Page<T> {
  items: T[];
  total: number;
}

/** Converte página (base 1) no intervalo de índices que os repositórios usam. */
export function pageToRange(page: number, pageSize: number): { from: number; to: number } {
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.max(1, Math.floor(pageSize));
  const from = (safePage - 1) * safeSize;
  return { from, to: from + safeSize - 1 };
}

/** Quantas páginas o total ocupa. Nunca menos que uma, para a interface ter o que exibir. */
export function lastPageOf(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
}

/** Intervalo de datas no formato `AAAA-MM-DD`, como vem dos campos de data. */
export interface DateRange {
  from: string | null;
  to: string | null;
}

/** Início do dia local, em ISO — o que o banco espera comparar com `created_at`. */
export function startOfDayIso(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 0, 0, 0, 0).toISOString();
}

/** Início do dia seguinte. Usar `<` com este valor inclui o dia inteiro do `to`. */
export function startOfNextDayIso(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, (day ?? 1) + 1, 0, 0, 0, 0).toISOString();
}
