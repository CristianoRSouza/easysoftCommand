import type { Page } from "@/shared/domain/paging";
import type { NfceNote, NfceQuery, NfceTotals } from "../domain/nfce-note";
import type { NfceDetail } from "../domain/nfce-detail";

/**
 * Porta de acesso às notas fiscais.
 *
 * `totals` é separado de `list` de propósito: os cartões do topo somam o
 * período inteiro, enquanto a tabela mostra uma página. No projeto anterior
 * isso já foi um bug corrigido — os cartões somavam as 50 linhas visíveis e
 * apresentavam o resultado como total do período.
 *
 * Só leitura. Corrigir uma NFC-e é reenviá-la à SEFAZ, e esse caminho não sai
 * da nuvem: veja `docs/specs/correcao-manual-nfce.md`.
 */
export interface NfceRepository {
  list(query: NfceQuery): Promise<Page<NfceNote>>;
  totals(query: NfceQuery): Promise<NfceTotals>;
  /** `null` quando a nota não existe ou não pertence à loja em uso. */
  detail(noteId: string): Promise<NfceDetail | null>;
}
