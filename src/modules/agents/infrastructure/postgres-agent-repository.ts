import type { AgentRepository } from "../application/agent-repository";
import type { Agent } from "../domain/agent";
import type { ElectronApi } from "@/shared/runtime/electron-api";
import { AGENT_COLUMNS, toAgent } from "./agent-mapper";

export class PostgresAgentRepository implements AgentRepository {
  constructor(private readonly api: ElectronApi) {}

  async list(): Promise<Agent[]> {
    const result = await this.api.query<Record<string, unknown>>(
      `SELECT ${AGENT_COLUMNS} FROM agent_config ORDER BY agent_name`,
    );
    if (!result.ok) throw new Error(`Falha ao listar agentes: ${result.error}`);
    return result.rows.map(toAgent);
  }
}
