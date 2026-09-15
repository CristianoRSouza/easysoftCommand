import type { ServiceRepository } from "../application/service-repository";
import type { ServiceKind, ServiceRuntime, ServiceRuntimeDraft } from "../domain/service-runtime";
import type { ElectronApi } from "@/shared/runtime/electron-api";
import { asIsoDate, asText } from "@/shared/infrastructure/convert";

/** Cada serviço tem sua tabela, e cada tabela guarda uma linha só. */
const TABELA: Record<ServiceKind, string> = {
  tef: "tef_service_runtime",
  sync: "sync_service_runtime",
};

export class PostgresServiceRepository implements ServiceRepository {
  constructor(private readonly api: ElectronApi) {}

  isAvailable(): boolean {
    return true;
  }

  async list(): Promise<ServiceRuntime[]> {
    const kinds: ServiceKind[] = ["tef", "sync"];

    const leituras = await Promise.all(
      kinds.map(async (service) => {
        const result = await this.api.query<Record<string, unknown>>(
          `SELECT install_path, windows_service_name, updated_at
           FROM ${TABELA[service]} WHERE singleton_key = 1`,
        );
        // Tabela ausente não é falha do painel: a instalação pode ser antiga e
        // ainda não ter esse registro. Vale mostrar o serviço em branco.
        if (!result.ok) {
          return { service, installPath: null, windowsServiceName: null, updatedAt: null };
        }
        const row = result.rows[0];
        return {
          service,
          installPath: asText(row?.install_path),
          windowsServiceName: asText(row?.windows_service_name),
          updatedAt: row?.updated_at == null ? null : asIsoDate(row.updated_at),
        };
      }),
    );

    return leituras;
  }

  /**
   * Grava o registro único.
   *
   * `ON CONFLICT` cobre o caso de a linha ainda não existir — a alternativa
   * seria consultar antes para decidir entre inserir e atualizar, o que abre
   * espaço para outro processo criar a linha no meio do caminho.
   */
  async save(service: ServiceKind, draft: ServiceRuntimeDraft): Promise<void> {
    const result = await this.api.execute([
      {
        sql: `INSERT INTO ${TABELA[service]}
                (singleton_key, install_path, windows_service_name, updated_at)
              VALUES (1, NULLIF($1, ''), NULLIF($2, ''), NOW())
              ON CONFLICT (singleton_key) DO UPDATE
              SET install_path         = EXCLUDED.install_path,
                  windows_service_name = EXCLUDED.windows_service_name,
                  updated_at           = NOW()`,
        params: [draft.installPath, draft.windowsServiceName],
      },
    ]);

    if (!result.ok) throw new Error(`Falha ao salvar o serviço: ${result.error}`);
  }
}
