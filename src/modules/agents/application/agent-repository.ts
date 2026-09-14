import type { Agent } from "../domain/agent";

/** Agentes são poucos: a lista inteira vem de uma vez. */
export interface AgentRepository {
  list(): Promise<Agent[]>;
}
