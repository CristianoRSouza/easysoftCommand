import type { Page } from "@/shared/domain/paging";
import type { NfceNote, NfceQuery, NfceTotals } from "../domain/nfce-note";
import type { NfceDetail } from "../domain/nfce-detail";
import type { CorrectionDraft, FiscalContext } from "../domain/nfce-correction";

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
  /** `null` quando a nota não existe ou não pertence à loja em uso. */
  detail(noteId: string): Promise<NfceDetail | null>;

  /**
   * O contexto fiscal necessário para validar uma correção: regime do
   * emitente e as UFs envolvidas. Não vem no detalhe porque só a correção
   * precisa dele.
   */
  fiscalContext(noteId: string): Promise<FiscalContext | null>;

  /** Código de ICMS (CST ou CSOSN) por item — o campo que a correção ajusta. */
  itemIcmsCodes(noteId: string): Promise<Map<number, string>>;

  /**
   * Grava a correção.
   *
   * O rascunho já chega validado e normalizado. A gravação acontece numa
   * transação só: o projeto anterior fazia um comando por vez e conferia o
   * valor total **depois**, quando os dados já estavam alterados e não havia
   * como desfazer.
   */
  saveCorrection(noteId: string, draft: CorrectionDraft): Promise<void>;
}
