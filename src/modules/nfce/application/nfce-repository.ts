import type { Page } from "@/shared/domain/paging";
import type { NfceNote, NfceQuery, NfceTotals } from "../domain/nfce-note";

/**
 * Porta de acesso às notas fiscais.
 *
 * `totals` é separado de `list` de propósito: os cartões do topo somam o
 * período inteiro, enquanto a tabela mostra uma página. No projeto anterior
 * isso já foi um bug corrigido — os cartões somavam as 50 linhas visíveis e
 * apresentavam o resultado como total do período.
 */
export interface NfceRepository {
  list(query: NfceQuery): Promise<Page<NfceNote>>;
  totals(query: NfceQuery): Promise<NfceTotals>;
}
