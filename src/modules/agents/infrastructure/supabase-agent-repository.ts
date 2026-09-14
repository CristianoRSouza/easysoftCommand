import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentRepository, AgentUpdate } from "../application/agent-repository";
import type { Agent } from "../domain/agent";
import type { Tenant } from "@/shared/tenant/tenant";
import { AGENT_COLUMNS, toAgent } from "./agent-mapper";

/** Campo do formulário para coluna do banco. Nome fixo, nunca vindo da entrada. */
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

export class SupabaseAgentRepository implements AgentRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  async list(): Promise<Agent[]> {
    // Agentes pertencem à empresa, como totens e unidades.
    const { data, error } = await this.client
      .from("vw_nfce_service_agent")
      .select(AGENT_COLUMNS)
      .eq("company_id", this.tenant.companyId)
      .order("agent_name");

    if (error) throw new Error(`Falha ao listar agentes: ${error.message}`);
    return ((data ?? []) as unknown as Record<string, unknown>[]).map(toAgent);
  }

  /**
   * Grava a alteração e a auditoria.
   *
   * Aqui não há transação: o PostgREST aplica um comando por requisição. Por
   * isso a auditoria vai **primeiro** — se ela falhar, nada muda; se a
   * alteração falhar depois, sobra um registro de auditoria sem efeito, que é
   * ruído, não perda. A ordem inversa perderia o rastro da mudança.
   *
   * O filtro por empresa entra também na gravação. Sem ele o isolamento
   * dependeria de o banco estar bem configurado — e a medição feita neste
   * projeto mostrou que não se pode contar com isso.
   */
  async update(agentId: string, update: AgentUpdate): Promise<void> {
    const { draft, changes, performedBy } = update;

    const anterior: Record<string, unknown> = {};
    const novo: Record<string, unknown> = {};
    const patch: Record<string, unknown> = {};

    for (const change of changes) {
      anterior[change.field] = change.previous;
      novo[change.field] = change.next;
      const coluna = COLUNA[change.field];
      if (coluna) patch[coluna] = draft[change.field as keyof typeof draft];
    }

    if (Object.keys(patch).length === 0) return;

    const auditoria = await this.client.from("vw_nfce_service_agent_audit").insert({
      agent_config_id: agentId,
      company_id: this.tenant.companyId,
      action: "updated",
      changed_fields: changes.map((c) => c.field),
      previous_values: anterior,
      new_values: novo,
      performed_by: performedBy,
    });
    if (auditoria.error) {
      throw new Error(`Falha ao registrar a auditoria: ${auditoria.error.message}`);
    }

    patch.updated_at = new Date().toISOString();
    const { data, error } = await this.client
      .from("vw_nfce_service_agent")
      .update(patch)
      .eq("id", agentId)
      .eq("company_id", this.tenant.companyId)
      .select("id");

    if (error) throw new Error(`Falha ao salvar o agente: ${error.message}`);
    if (!data || data.length === 0) {
      throw new Error("O agente não foi encontrado nesta empresa.");
    }
  }
}
