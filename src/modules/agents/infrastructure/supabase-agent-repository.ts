import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentRepository } from "../application/agent-repository";
import type { Agent } from "../domain/agent";
import type { Tenant } from "@/shared/tenant/tenant";
import { AGENT_COLUMNS, toAgent } from "./agent-mapper";

export class SupabaseAgentRepository implements AgentRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  async list(): Promise<Agent[]> {
    // Agentes pertencem à empresa, como totens e unidades.
    const { data, error } = await this.client
      .from("vw_agent_config")
      .select(AGENT_COLUMNS)
      .eq("company_id", this.tenant.companyId)
      .order("agent_name");

    if (error) throw new Error(`Falha ao listar agentes: ${error.message}`);
    return ((data ?? []) as unknown as Record<string, unknown>[]).map(toAgent);
  }
}
