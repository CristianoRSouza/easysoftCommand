import type { Page } from "@/shared/domain/paging";
import type { InboxItem, InboxSummary, SyncQuery } from "../domain/sync-activity";

/**
 * Porta da fila de sincronização.
 *
 * Só a fila de entrada sobreviveu. O painel de serviços — batimentos e
 * registros do Sync-Service — lia `sync_heartbeat` e `sync_log`, tabelas que
 * existem apenas no PostgreSQL da loja e não são replicadas. Com o programa
 * instalado descontinuado, essa medição deixou de estar ao alcance do painel.
 *
 * Preferi remover a tela a mantê-la mostrando zeros: um painel que exibe
 * "0 erros" sem ter medido nada é pior que um painel que não exibe.
 */
export interface SyncRepository {
  inboxSummary(): Promise<InboxSummary>;
  inbox(query: SyncQuery): Promise<Page<InboxItem>>;
}
