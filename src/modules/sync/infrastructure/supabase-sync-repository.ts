import type { SyncRepository } from "../application/sync-repository";
import type { SyncLogEntry, SyncOverview } from "../domain/sync-activity";
import type { Page } from "@/shared/domain/paging";

const MOTIVO =
  "A sincronização é medida no PostgreSQL da loja e não é replicada para a nuvem. Abra o programa instalado na loja para acompanhá-la.";

/**
 * Implementação que não mede nada — e diz isso.
 *
 * Preferir o erro explícito ao zero inventado: quem abrir esta tela pelo
 * navegador vê a explicação, não um painel de serviços todos parados.
 */
export class SupabaseSyncRepository implements SyncRepository {
  isAvailable(): boolean {
    return false;
  }

  async overview(): Promise<SyncOverview> {
    throw new Error(MOTIVO);
  }

  async logs(): Promise<Page<SyncLogEntry>> {
    throw new Error(MOTIVO);
  }
}
