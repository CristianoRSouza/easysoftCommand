import type { QueueDirection, QueueEvent, QueueOverview } from "../domain/sync-activity";

/**
 * Porta das filas de sincronização.
 *
 * O painel de serviços — batimentos e registros do Sync-Service — lia
 * `sync_heartbeat` e `sync_log`, tabelas que existem apenas no PostgreSQL da
 * loja e não são replicadas. Com o programa instalado descontinuado, essa
 * medição deixou de estar ao alcance do painel, e a tela foi removida em vez
 * de mostrar zeros que ninguém mediu.
 *
 * Também não há "reenfileirar": no projeto anterior o botão só existia no
 * programa instalado, que gravava direto no banco da loja. A nuvem não oferece
 * essa operação.
 */
export interface SyncRepository {
  overview(direction: QueueDirection): Promise<QueueOverview>;
  events(direction: QueueDirection, offset: number, limit: number): Promise<QueueEvent[]>;
}
