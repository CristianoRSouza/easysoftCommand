import {
  changedFields,
  draftFrom,
  normalizeAgent,
  requiresAcknowledgement,
  validateAgent,
  AgentRuleViolation,
  type Agent,
  type AgentDraft,
} from "../domain/agent";
import type { AgentChange, AgentRepository } from "./agent-repository";

export interface SaveAgentOptions {
  /** Quem está salvando, para a auditoria. */
  performedBy: string;
  /** Confirmação explícita de que a contingência vai acumular notas. */
  acknowledgedAccumulation?: boolean;
}

/**
 * Salva a configuração de um agente.
 *
 * Calcula o que mudou antes de gravar: a auditoria registra campos alterados,
 * e mandar todos faria o histórico dizer que tudo mudou sempre — inútil para
 * quem investiga depois.
 */
export function saveAgent(repository: AgentRepository) {
  return async (
    agent: Agent,
    draft: AgentDraft,
    options: SaveAgentOptions,
  ): Promise<{ changed: boolean }> => {
    const errors = validateAgent(draft);
    if (errors.length > 0) {
      throw new AgentRuleViolation(errors.map((e) => e.message).join(" "));
    }

    const normalizado = normalizeAgent(draft);

    if (requiresAcknowledgement(agent, normalizado) && !options.acknowledgedAccumulation) {
      throw new AgentRuleViolation(
        "Contingência ligada com transmissão automática desligada: as notas vão se acumular " +
          "sem chegar à SEFAZ. Confirme que é isso mesmo.",
      );
    }

    const campos = changedFields(agent, normalizado);
    if (campos.length === 0) return { changed: false };

    const anterior = draftFrom(agent);
    const changes: AgentChange[] = campos.map((campo) => ({
      field: campo,
      previous: anterior[campo],
      next: normalizado[campo],
    }));

    await repository.update(agent.id, {
      draft: normalizado,
      changes,
      performedBy: options.performedBy,
    });
    return { changed: true };
  };
}
