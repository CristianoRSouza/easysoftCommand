import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AgentRepository,
  AgentUpdate,
  CreateOutcome,
  SaveOutcome,
} from "../application/agent-repository";
import type { Agent, NewAgentDraft } from "../domain/agent";
import type { Tenant } from "@/shared/tenant/tenant";
import { asText } from "@/shared/infrastructure/convert";
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
  contingencySubstitutionWorkerEnabled: "contingency_substitution_worker_enabled",
  contingencySubstitutionWorkerIntervalMs: "contingency_substitution_worker_interval_ms",
  contingencySubstitutionJustification: "contingency_substitution_xjust",
  contingencySlaWarnHours: "contingency_sla_warn_hours",
  contingencySlaBlockHours: "contingency_sla_block_hours",
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
   * Grava a alteração e registra na trilha.
   *
   * A alteração vem **primeiro**, e isto mudou depois de medir: o banco recusa
   * a escrita na trilha para quem não é administrador (`permission denied for
   * table service_agent_audit`). Com a auditoria antes, a recusa impedia
   * qualquer edição de agente — e a mensagem falava de auditoria, não de
   * permissão, deixando o operador sem entender por que não conseguia salvar.
   *
   * A troca tem um custo: se a trilha recusar, a alteração fica sem registro.
   * Por isso o resultado diz o que aconteceu, e a tela avisa — em vez de
   * engolir a recusa, como faz o projeto anterior.
   *
   * O filtro por empresa entra também na gravação. Sem ele o isolamento
   * dependeria de o banco estar bem configurado — e a medição feita neste
   * projeto mostrou que não se pode contar com isso.
   */
  async update(agentId: string, update: AgentUpdate): Promise<SaveOutcome> {
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

    if (Object.keys(patch).length === 0) return { audited: true, auditError: null };

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

    return this.writeAudit(agentId, "updated", changes.map((c) => c.field), anterior, novo, performedBy);
  }

  /** Liga ou desliga o agente, sem tocar no resto da configuração. */
  async setActive(agentId: string, isActive: boolean, performedBy: string): Promise<SaveOutcome> {
    const { error } = await this.client
      .from("vw_nfce_service_agent")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", agentId)
      .eq("company_id", this.tenant.companyId);

    if (error) throw new Error(`Falha ao alterar o agente: ${error.message}`);

    return this.writeAudit(
      agentId,
      "toggled",
      ["isActive"],
      { isActive: !isActive },
      { isActive },
      performedBy,
    );
  }

  /**
   * Registra na trilha e devolve o que aconteceu, em vez de lançar.
   *
   * A alteração já está gravada: transformar a recusa em erro faria a tela
   * dizer que não salvou algo que salvou.
   */
  private async writeAudit(
    agentId: string,
    action: string,
    changedFields: string[],
    previousValues: Record<string, unknown>,
    newValues: Record<string, unknown>,
    performedBy: string,
  ): Promise<SaveOutcome> {
    const { error } = await this.client.from("vw_nfce_service_agent_audit").insert({
      agent_config_id: agentId,
      company_id: this.tenant.companyId,
      action,
      changed_fields: changedFields,
      previous_values: previousValues,
      new_values: newValues,
      performed_by: performedBy,
    });

    return { audited: !error, auditError: error?.message ?? null };
  }

  async create(draft: NewAgentDraft, performedBy: string): Promise<CreateOutcome> {
    const { data, error } = await this.client
      .from("vw_nfce_service_agent")
      .insert({
        company_id: this.tenant.companyId,
        agent_name: draft.name,
        is_active: draft.isActive,
        log_level: draft.logLevel,
        api_rate_limit: draft.apiRateLimit,
        sefaz_timeout_ms: draft.timeoutMs,
        retry_max_attempts: draft.retryMaxAttempts,
        retry_backoff_ms: draft.retryBackoffMs,
        contingency_enabled: draft.contingencyEnabled,
        contingency_reason: draft.contingencyReason || null,
        contingency_auto_transmit: draft.contingencyAutoTransmit,
        contingency_worker_enabled: draft.contingencyWorkerEnabled,
        contingency_worker_interval_ms: draft.contingencyWorkerIntervalMs,
        contingency_substitution_worker_enabled: draft.contingencySubstitutionWorkerEnabled,
        contingency_substitution_worker_interval_ms: draft.contingencySubstitutionWorkerIntervalMs,
        contingency_substitution_xjust: draft.contingencySubstitutionJustification || null,
        contingency_sla_warn_hours: draft.contingencySlaWarnHours,
        contingency_sla_block_hours: draft.contingencySlaBlockHours,
      })
      .select("id")
      .single();

    if (error) throw new Error(`Falha ao criar o agente: ${error.message}`);

    const id = asText((data as Record<string, unknown>).id);
    if (!id) throw new Error("O agente foi criado mas o identificador não voltou.");

    // A trilha vem depois porque depende do identificador, e a recusa dela não
    // desfaz o agente que já existe.
    const auditoria = await this.writeAudit(
      id,
      "created",
      Object.keys(draft),
      {},
      draft as unknown as Record<string, unknown>,
      performedBy,
    );

    return { id, ...auditoria };
  }
}
