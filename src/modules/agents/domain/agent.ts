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

// ---------------------------------------------------------------------------
// Edição
// ---------------------------------------------------------------------------

/**
 * O que o formulário edita.
 *
 * `installPath` fica de fora: é o caminho da instalação no disco, gerido por
 * quem instala o serviço, não pelo painel. O nome também não muda — ele
 * identifica o agente nos registros já gravados.
 */
export interface AgentDraft {
  isActive: boolean;
  logLevel: string;
  timeoutMs: number;
  retryMaxAttempts: number;
  retryBackoffMs: number;
  apiRateLimit: number;
  contingencyEnabled: boolean;
  contingencyReason: string;
  contingencyAutoTransmit: boolean;
  contingencyWorkerEnabled: boolean;
  contingencyWorkerIntervalMs: number;
}

export const LOG_LEVELS = ["error", "warn", "info", "debug"] as const;

export function draftFrom(agent: Agent): AgentDraft {
  return {
    isActive: agent.isActive,
    logLevel: agent.logLevel ?? "info",
    timeoutMs: agent.sefaz.timeoutMs ?? 15000,
    retryMaxAttempts: agent.sefaz.retryMaxAttempts ?? 3,
    retryBackoffMs: agent.sefaz.retryBackoffMs ?? 2000,
    apiRateLimit: agent.sefaz.apiRateLimit ?? 60,
    contingencyEnabled: agent.contingency.enabled,
    contingencyReason: agent.contingency.reason ?? "",
    contingencyAutoTransmit: agent.contingency.autoTransmit,
    contingencyWorkerEnabled: agent.contingency.workerEnabled,
    contingencyWorkerIntervalMs: agent.contingency.workerIntervalMs ?? 60000,
  };
}

export interface FieldError {
  field: keyof AgentDraft;
  message: string;
}

/** Limites de sanidade. Fora deles, o agente não opera bem — ou não opera. */
const LIMITES = {
  timeoutMs: { min: 1000, max: 120000, nome: "O tempo limite da SEFAZ" },
  retryMaxAttempts: { min: 0, max: 20, nome: "O número de tentativas" },
  retryBackoffMs: { min: 0, max: 300000, nome: "A espera entre tentativas" },
  apiRateLimit: { min: 1, max: 1000, nome: "O limite de chamadas" },
  contingencyWorkerIntervalMs: { min: 5000, max: 3600000, nome: "O intervalo do worker" },
} as const;

/**
 * Valida o rascunho antes de qualquer ida ao banco.
 *
 * Vive no domínio, e não na tela, porque a regra é a mesma independentemente de
 * quem chama — e porque validação que só existe no formulário deixa de valer
 * assim que alguém grava por outro caminho.
 */
export function validateAgent(draft: AgentDraft): FieldError[] {
  const errors: FieldError[] = [];

  for (const [campo, limite] of Object.entries(LIMITES)) {
    const valor = draft[campo as keyof AgentDraft];
    if (typeof valor !== "number" || !Number.isFinite(valor)) {
      errors.push({ field: campo as keyof AgentDraft, message: `${limite.nome} precisa ser um número.` });
    } else if (valor < limite.min || valor > limite.max) {
      errors.push({
        field: campo as keyof AgentDraft,
        message: `${limite.nome} deve ficar entre ${limite.min} e ${limite.max}.`,
      });
    }
  }

  if (!LOG_LEVELS.includes(draft.logLevel as (typeof LOG_LEVELS)[number])) {
    errors.push({ field: "logLevel", message: "Nível de log inválido." });
  }

  // Contingência é uma decisão que alguém toma por um motivo. Sem o motivo
  // registrado, quem encontrar a loja nesse estado semanas depois não sabe se
  // ainda faz sentido — e a tendência é deixar como está.
  if (draft.contingencyEnabled && draft.contingencyReason.trim() === "") {
    errors.push({
      field: "contingencyReason",
      message: "Informe por que a contingência está sendo ligada.",
    });
  }

  return errors;
}

export function normalizeAgent(draft: AgentDraft): AgentDraft {
  return {
    ...draft,
    logLevel: draft.logLevel.trim().toLowerCase(),
    contingencyReason: draft.contingencyEnabled ? draft.contingencyReason.trim() : "",
  };
}

/** Campos que mudaram entre o agente atual e o rascunho. Vazio significa nada a gravar. */
export function changedFields(agent: Agent, draft: AgentDraft): (keyof AgentDraft)[] {
  const atual = draftFrom(agent);
  return (Object.keys(draft) as (keyof AgentDraft)[]).filter(
    (campo) => atual[campo] !== draft[campo],
  );
}

export class AgentRuleViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentRuleViolation";
  }
}

/**
 * Ligar contingência sem transmissão automática precisa ser deliberado.
 *
 * Nessa combinação as notas se acumulam sem nunca serem enviadas à SEFAZ — a
 * loja continua vendendo e o passivo fiscal cresce em silêncio. A regra não
 * proíbe: há casos em que se quer segurar o envio. Ela exige que a escolha seja
 * consciente, e não um efeito colateral de mexer noutro campo.
 */
export function requiresAcknowledgement(agent: Agent, draft: AgentDraft): boolean {
  const passaAAcumular = draft.contingencyEnabled && !draft.contingencyAutoTransmit;
  const jaAcumulava = agent.contingency.enabled && !agent.contingency.autoTransmit;
  return passaAAcumular && !jaAcumulava;
}
