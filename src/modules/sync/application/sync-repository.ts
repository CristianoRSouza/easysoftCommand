import type { Page } from "@/shared/domain/paging";
import type {
  InboxItem,
  InboxSummary,
  SyncLogEntry,
  SyncOverview,
  SyncQuery,
} from "../domain/sync-activity";

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

  /**
   * Fila de entrada da nuvem.
   *
   * Ao contrário de `logs` e `overview`, esta existe nos dois modos: a fila
   * mora na nuvem, e o programa da loja também consegue consultá-la.
   */
  inboxSummary(): Promise<InboxSummary>;
  inbox(query: SyncQuery): Promise<Page<InboxItem>>;
}
