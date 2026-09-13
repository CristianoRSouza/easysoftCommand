/**
 * Indicadores da tela inicial.
 *
 * Apenas o que pode ser medido nas duas fontes. Erros recentes, última
 * sincronização e batimentos dos serviços ficam de fora: as tabelas
 * `sync_log` e `sync_heartbeat` existem só no PostgreSQL local, e no projeto
 * anterior esses valores eram constantes escritas no código quando se rodava
 * pelo navegador — apareciam como medição sem nunca terem sido medidos.
 * Entram junto com o módulo de Sincronização.
 */
export interface DashboardSummary {
  activeProducts: number;
  openOrders: number;
  todayTransactions: number;
}
