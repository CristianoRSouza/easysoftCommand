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

/**
 * Um alerta sobre o rascunho — informa, não impede.
 *
 * O projeto anterior não valida nada neste formulário, e essa permissividade
 * pode ser deliberada: quando a SEFAZ cai numa sexta à noite, exigir que o
 * operador preencha campos antes de ligar a contingência é atrito no pior
 * momento possível. Uma migração reproduz o comportamento; melhorá-lo é decisão
 * de produto, não do código.
 *
 * O meio-termo é dizer o que vai acontecer e deixar a pessoa decidir.
 */
export interface AgentWarning {
  field: keyof AgentDraft;
  severity: "info" | "danger";
  message: string;
}

/** Faixas em que cada valor costuma fazer sentido. Fora delas, avisa. */
const FAIXAS = {
  timeoutMs: { min: 1000, max: 120000, nome: "O tempo limite da SEFAZ" },
  retryMaxAttempts: { min: 0, max: 20, nome: "O número de tentativas" },
  retryBackoffMs: { min: 0, max: 300000, nome: "A espera entre tentativas" },
  apiRateLimit: { min: 1, max: 1000, nome: "O limite de chamadas" },
  contingencyWorkerIntervalMs: { min: 5000, max: 3600000, nome: "O intervalo do worker" },
} as const;

function segundos(ms: number): string {
  return ms >= 60000 ? `${Math.round(ms / 60000)} minutos` : `${Math.round(ms / 1000)} segundos`;
}

/**
 * Examina o rascunho e devolve o que vale a pessoa saber antes de salvar.
 *
 * Nada aqui bloqueia. A única coisa que impede a gravação é valor que o banco
 * não aceita — e isso o próprio banco recusa.
 */
export function inspectAgent(draft: AgentDraft): AgentWarning[] {
  const warnings: AgentWarning[] = [];

  for (const [campo, faixa] of Object.entries(FAIXAS)) {
    const valor = draft[campo as keyof AgentDraft];
    if (typeof valor !== "number" || !Number.isFinite(valor)) continue;
    if (valor < faixa.min || valor > faixa.max) {
      warnings.push({
        field: campo as keyof AgentDraft,
        severity: "info",
        message: `${faixa.nome} costuma ficar entre ${faixa.min} e ${faixa.max}. ${
          campo.endsWith("Ms") ? `${valor} equivale a ${segundos(valor)}.` : ""
        }`.trim(),
      });
    }
  }

  if (draft.contingencyEnabled && draft.contingencyReason.trim() === "") {
    warnings.push({
      field: "contingencyReason",
      severity: "info",
      message:
        "Sem motivo registrado, quem encontrar a loja em contingência semanas depois não vai saber se ainda faz sentido.",
    });
  }

  if (draft.contingencyEnabled && !draft.contingencyAutoTransmit) {
    warnings.push({
      field: "contingencyAutoTransmit",
      severity: "danger",
      message:
        "As notas vão se acumular sem chegar à SEFAZ enquanto esta combinação estiver ativa.",
    });
  }

  return warnings;
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

/** Um número que o banco não aceita — o único caso que impede gravar. */
export class AgentInvalidValue extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentInvalidValue";
  }
}

/**
 * Campos numéricos vazios ou não numéricos.
 *
 * Diferente dos avisos: aqui não há valor a gravar, então a gravação não tem
 * como acontecer. Não é regra de negócio, é ausência de dado.
 */
export function missingNumbers(draft: AgentDraft): (keyof AgentDraft)[] {
  return (Object.keys(FAIXAS) as (keyof AgentDraft)[]).filter((campo) => {
    const valor = draft[campo];
    return typeof valor !== "number" || !Number.isFinite(valor);
  });
}
