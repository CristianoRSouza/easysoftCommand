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
  /** As notas que exigem ação de alguém. */
  nfceAttention: NfceAttention;
  /** Transações por dia nos últimos sete dias, do mais antigo ao mais recente. */
  transactionsByDay: DayCount[];
}

/**
 * NFC-e sem solução.
 *
 * Três situações diferentes que têm a mesma consequência: a venda aconteceu e
 * o documento não está resolvido. Separá-las importa porque cada uma se
 * resolve de um jeito.
 */
export interface NfceAttention {
  /** Rejeitada por erro de classificação; espera correção manual na loja. */
  manualReview: number;
  /** Emitida normalmente, mas a conferência com a venda falhou. */
  reconcileFailed: number;
  /** Emitida em contingência e ainda não transmitida. */
  unusable: number;
}

export function totalNeedingAttention(attention: NfceAttention): number {
  return attention.manualReview + attention.reconcileFailed + attention.unusable;
}

export interface DayCount {
  day: string;
  label: string;
  count: number;
}

/** Quantos dias o gráfico da tela inicial cobre, contando hoje. */
export const DASHBOARD_DAYS = 7;
