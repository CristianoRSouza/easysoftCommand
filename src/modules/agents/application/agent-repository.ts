import type { Agent, AgentDraft } from "../domain/agent";

/** Uma alteração registrada na auditoria: o campo, o valor antigo e o novo. */
export interface AgentChange {
  field: string;
  previous: unknown;
  next: unknown;
}

/** O que a gravação precisa saber além dos dados: o que mudou e quem mudou. */
export interface AgentUpdate {
  draft: AgentDraft;
  changes: AgentChange[];
  performedBy: string;
}

export interface AgentRepository {
  list(): Promise<Agent[]>;

  /**
   * Grava a alteração e o registro de auditoria **juntos**.
   *
   * O projeto anterior fazia as duas coisas em chamadas separadas: se a
   * segunda falhasse, a configuração mudava sem deixar rastro de quem mudou.
   * Aqui é uma operação só — ou as duas valem, ou nenhuma.
   */
  update(agentId: string, update: AgentUpdate): Promise<void>;
}
