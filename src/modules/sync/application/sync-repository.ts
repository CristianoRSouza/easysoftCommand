import type { Page } from "@/shared/domain/paging";
import type { SyncLogEntry, SyncOverview, SyncQuery } from "../domain/sync-activity";

/**
 * Porta da sincronização.
 *
 * `isAvailable` existe porque este módulo genuinamente não tem como funcionar
 * na nuvem: `sync_log` e `sync_heartbeat` vivem só no PostgreSQL da loja e não
 * são replicados. No projeto anterior essa ausência virava constantes escritas
 * no código — erros sempre 0, serviços sempre nulos — e o painel apresentava
 * isso como medição. Declarar a indisponibilidade é mais honesto que exibir um
 * número que ninguém mediu.
 */
export interface SyncRepository {
  isAvailable(): boolean;
  overview(): Promise<SyncOverview>;
  logs(query: SyncQuery): Promise<Page<SyncLogEntry>>;
}
