import type { Agent, AgentDraft, NewAgentDraft } from "../domain/agent";

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

/**
 * O que aconteceu com o registro na trilha.
 *
 * A gravação e o registro dela são duas escritas, e o banco aceita a primeira
 * e recusa a segunda para quem não é administrador. Dizer "não salvou" seria
 * mentira; ficar calado esconderia que a trilha tem um buraco.
 */
export interface SaveOutcome {
  audited: boolean;
  auditError: string | null;
}

export interface CreateOutcome extends SaveOutcome {
  id: string;
}

export interface AgentRepository {
  list(): Promise<Agent[]>;

  /** Grava a alteração e registra na trilha; o resultado diz se a trilha aceitou. */
  update(agentId: string, update: AgentUpdate): Promise<SaveOutcome>;

  /** Liga ou desliga, sem tocar no resto da configuração. */
  setActive(agentId: string, isActive: boolean, performedBy: string): Promise<SaveOutcome>;

  /** Cria um agente e devolve o identificador gerado. */
  create(draft: NewAgentDraft, performedBy: string): Promise<CreateOutcome>;
}
