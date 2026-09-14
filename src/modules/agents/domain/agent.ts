/**
 * Agente de serviço — o processo que fica em segundo plano na loja emitindo
 * NFC-e e conversando com a SEFAZ.
 *
 * O que a tela precisa responder: está ligado, está em contingência, e os
 * limites de tentativa fazem sentido.
 */
export interface Agent {
  id: string;
  name: string;
  isActive: boolean;
  installPath: string | null;
  logLevel: string | null;
  sefaz: AgentSefazSettings;
  contingency: AgentContingency;
}

export interface AgentSefazSettings {
  timeoutMs: number | null;
  retryMaxAttempts: number | null;
  retryBackoffMs: number | null;
  apiRateLimit: number | null;
}

/**
 * Contingência — o modo em que o agente emite sem falar com a SEFAZ na hora,
 * transmitindo depois.
 *
 * Ligada por muito tempo é sinal de problema: significa que a loja está
 * acumulando notas que ainda não foram autorizadas.
 */
export interface AgentContingency {
  enabled: boolean;
  reason: string | null;
  autoTransmit: boolean;
  workerEnabled: boolean;
  workerIntervalMs: number | null;
}

export type AgentHealth = "stopped" | "contingency" | "running";

export function agentHealth(agent: Agent): AgentHealth {
  if (!agent.isActive) return "stopped";
  return agent.contingency.enabled ? "contingency" : "running";
}

export const AGENT_HEALTH_LABEL: Record<AgentHealth, string> = {
  running: "Em operação",
  contingency: "Em contingência",
  stopped: "Parado",
};

/**
 * Contingência ligada sem transmissão automática é a combinação que trava a
 * loja em silêncio: as notas se acumulam e ninguém as envia.
 */
export function accumulatesWithoutSending(agent: Agent): boolean {
  return agent.contingency.enabled && !agent.contingency.autoTransmit;
}
