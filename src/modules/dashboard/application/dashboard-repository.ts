import type { DashboardSummary } from "../domain/dashboard-summary";

/**
 * Porta dos indicadores.
 *
 * O dashboard conta linhas diretamente e não depende dos módulos de Comandas e
 * Transações — é o padrão correto para uma tela de leitura: ela não precisa do
 * domínio que produz os dados, só dos números.
 */
export interface DashboardRepository {
  summary(): Promise<DashboardSummary>;
}
