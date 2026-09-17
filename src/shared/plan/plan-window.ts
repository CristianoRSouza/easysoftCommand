import type { DateRange } from "@/shared/domain/paging";

/**
 * Quanto histórico o plano da empresa permite consultar.
 *
 * Vem de `billing.module_plans.history_window_days`. Hoje só o plano de
 * demonstração tem limite (30 dias) e os pagos são ilimitados — mas o valor é
 * cadastrado no banco, então a regra vale para o que o comercial definir
 * depois, sem mudar código.
 */
export interface PlanWindow {
  planSlug: string | null;
  planName: string | null;
  /** `null` significa sem limite. */
  historyWindowDays: number | null;
}

export const UNLIMITED_WINDOW: PlanWindow = {
  planSlug: null,
  planName: null,
  historyWindowDays: null,
};

function ymd(date: Date): string {
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mes}-${dia}`;
}

/**
 * A data mais antiga que o plano alcança, ou `null` sem limite.
 *
 * O dia de hoje conta como o primeiro da janela: 30 dias são hoje mais 29
 * anteriores, e não hoje mais 30.
 */
export function earliestAllowedDate(window: PlanWindow, now: Date = new Date()): string | null {
  const dias = window.historyWindowDays;
  if (!dias || dias <= 0) return null;
  const limite = new Date(now);
  limite.setDate(limite.getDate() - (dias - 1));
  return ymd(limite);
}

/**
 * `true` quando o período pedido começa antes do que o plano permite.
 *
 * Sem plano cadastrado, ou sem janela, nada é bloqueado. O permissivo é
 * deliberado, e é o que o sistema em produção faz: recusar relatório por falta
 * de cadastro puniria o usuário por um problema que não é dele.
 */
export function isOutsideWindow(
  range: DateRange,
  window: PlanWindow,
  now: Date = new Date(),
): boolean {
  const minimo = earliestAllowedDate(window, now);
  if (!minimo) return false;
  return (range.from != null && range.from < minimo) || (range.to != null && range.to < minimo);
}

/** O período encurtado até onde o plano alcança. */
export function clampToWindow(
  range: DateRange,
  window: PlanWindow,
  now: Date = new Date(),
): DateRange {
  const minimo = earliestAllowedDate(window, now);
  if (!minimo) return range;
  return {
    from: range.from == null || range.from < minimo ? minimo : range.from,
    to: range.to != null && range.to < minimo ? ymd(now) : range.to,
  };
}

/** Porta de leitura do plano ativo da empresa. */
export interface PlanWindowResolver {
  resolve(companyId: string): Promise<PlanWindow>;
}
