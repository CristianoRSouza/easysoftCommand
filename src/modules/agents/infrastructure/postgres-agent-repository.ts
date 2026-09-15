import type { AgentRepository, AgentUpdate } from "../application/agent-repository";
import type { Agent, NewAgentDraft } from "../domain/agent";
import type { ElectronApi } from "@/shared/runtime/electron-api";
import { AGENT_COLUMNS, toAgent } from "./agent-mapper";

/**
 * Colunas do banco correspondentes a cada campo do formulário.
 *
 * O mapa é explícito para que o nome da coluna nunca venha da entrada do
 * usuário: a chave é um campo conhecido do rascunho, e o valor é uma coluna
 * fixa. Montar SQL com nome vindo de fora seria injeção pela porta da frente.
 */
const COLUNA: Record<string, string> = {
  isActive: "is_active",
  logLevel: "log_level",
  timeoutMs: "sefaz_timeout_ms",
  retryMaxAttempts: "retry_max_attempts",
  retryBackoffMs: "retry_backoff_ms",
  apiRateLimit: "api_rate_limit",
  contingencyEnabled: "contingency_enabled",
  contingencyReason: "contingency_reason",
  contingencyAutoTransmit: "contingency_auto_transmit",
  contingencyWorkerEnabled: "contingency_worker_enabled",
  contingencyWorkerIntervalMs: "contingency_worker_interval_ms",
};

export class PostgresAgentRepository implements AgentRepository {
  constructor(private readonly api: ElectronApi) {}

  async list(): Promise<Agent[]> {
    const result = await this.api.query<Record<string, unknown>>(
      `SELECT ${AGENT_COLUMNS} FROM nfce_service_agent ORDER BY agent_name`,
    );
    if (!result.ok) throw new Error(`Falha ao listar agentes: ${result.error}`);
    return result.rows.map(toAgent);
  }

  async update(agentId: string, update: AgentUpdate): Promise<void> {
    const { draft, changes, performedBy } = update;

    // Grava apenas o que mudou. Reescrever tudo funcionaria, mas sobrescreveria
    // em silêncio qualquer campo que outro processo tenha alterado enquanto o
    // formulário estava aberto.
    const atribuicoes: string[] = [];
    const valores: unknown[] = [agentId];

    for (const { field } of changes) {
      const coluna = COLUNA[field];
      if (!coluna) continue;
      valores.push(draft[field as keyof typeof draft]);
      atribuicoes.push(`"${coluna}" = $${valores.length}`);
    }

    if (atribuicoes.length === 0) return;

    const anterior: Record<string, unknown> = {};
    const novo: Record<string, unknown> = {};
    for (const change of changes) {
      anterior[change.field] = change.previous;
      novo[change.field] = change.next;
    }

    const result = await this.api.execute([
      {
        sql: `UPDATE nfce_service_agent SET ${atribuicoes.join(", ")}, updated_at = NOW() WHERE id = $1`,
        params: valores,
      },
      {
        sql: `INSERT INTO nfce_service_agent_audit
                (agent_config_id, action, changed_fields, previous_values, new_values, performed_by)
              VALUES ($1, 'updated', $2, $3, $4, $5)`,
        params: [
          agentId,
          JSON.stringify(changes.map((c) => c.field)),
          JSON.stringify(anterior),
          JSON.stringify(novo),
          performedBy,
        ],
      },
    ]);

    if (!result.ok) throw new Error(`Falha ao salvar o agente: ${result.error}`);
    // Zero linhas significa que o agente sumiu entre abrir o formulário e
    // salvar. Silenciar isso faria a tela dizer "salvo" sem ter salvado nada.
    if (result.rowCounts[0] === 0) {
      throw new Error("O agente não foi encontrado. Ele pode ter sido removido.");
    }
  }

  /**
   * Cria o agente e registra a criação, na mesma transação.
   *
   * `RETURNING id` não serve aqui: a auditoria precisa do identificador e o
   * canal de escrita devolve apenas quantas linhas cada comando afetou. Gerar
   * o identificador antes resolve — e deixa os dois comandos independentes,
   * que é o que permite aplicá-los juntos.
   */
  async create(draft: NewAgentDraft, performedBy: string): Promise<string> {
    const id = crypto.randomUUID();

    const result = await this.api.execute([
      {
        sql: `INSERT INTO nfce_service_agent
                (id, agent_name, is_active, log_level, api_rate_limit,
                 sefaz_timeout_ms, retry_max_attempts, retry_backoff_ms,
                 contingency_enabled, contingency_reason, contingency_auto_transmit,
                 contingency_worker_enabled, contingency_worker_interval_ms, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULLIF($10, ''), $11, $12, $13, NOW())`,
        params: [
          id,
          draft.name,
          draft.isActive,
          draft.logLevel,
          draft.apiRateLimit,
          draft.timeoutMs,
          draft.retryMaxAttempts,
          draft.retryBackoffMs,
          draft.contingencyEnabled,
          draft.contingencyReason,
          draft.contingencyAutoTransmit,
          draft.contingencyWorkerEnabled,
          draft.contingencyWorkerIntervalMs,
        ],
      },
      {
        sql: `INSERT INTO nfce_service_agent_audit
                (agent_config_id, action, changed_fields, previous_values, new_values, performed_by)
              VALUES ($1, 'created', $2, '{}'::jsonb, $3, $4)`,
        params: [
          id,
          JSON.stringify(Object.keys(draft)),
          JSON.stringify(draft),
          performedBy,
        ],
      },
    ]);

    if (!result.ok) throw new Error(`Falha ao criar o agente: ${result.error}`);
    return id;
  }
}
