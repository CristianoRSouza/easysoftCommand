import {
  changedFields,
  draftFrom,
  missingNumbers,
  normalizeAgent,
  AgentInvalidValue,
  type Agent,
  type AgentDraft,
} from "../domain/agent";
import type { AgentChange, AgentRepository, SaveOutcome } from "./agent-repository";

export interface SaveAgentOptions {
  /** Quem está salvando, para a auditoria. */
  performedBy: string;
}

/**
 * Salva a configuração de um agente.
 *
 * A única coisa que impede a gravação é campo numérico vazio — sem valor não há
 * o que gravar. Todo o resto é aviso na tela: o projeto anterior não valida
 * nada aqui, e reproduzir esse comportamento é o trabalho da migração.
 *
 * Calcula o que mudou antes de gravar: a auditoria registra campos alterados, e
 * mandar todos faria o histórico dizer que tudo mudou sempre — inútil para quem
 * investiga depois.
 */
export function saveAgent(repository: AgentRepository) {
  return async (
    agent: Agent,
    draft: AgentDraft,
    options: SaveAgentOptions,
  ): Promise<SaveOutcome & { changed: boolean }> => {
    const faltando = missingNumbers(draft);
    if (faltando.length > 0) {
      throw new AgentInvalidValue(
        `Preencha ${faltando.length === 1 ? "o campo numérico vazio" : "os campos numéricos vazios"}.`,
      );
    }

    const normalizado = normalizeAgent(draft);
    const campos = changedFields(agent, normalizado);
    if (campos.length === 0) return { changed: false, audited: true, auditError: null };

    const anterior = draftFrom(agent);
    const changes: AgentChange[] = campos.map((campo) => ({
      field: campo,
      previous: anterior[campo],
      next: normalizado[campo],
    }));

    const resultado = await repository.update(agent.id, {
      draft: normalizado,
      changes,
      performedBy: options.performedBy,
    });
    return { changed: true, ...resultado };
  };
}
