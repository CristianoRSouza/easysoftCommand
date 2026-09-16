import type { Totem } from "../domain/totem";
import type { TotemDraft } from "../domain/totem-draft";

/** Totens são poucos por loja: a lista inteira vem de uma vez. */
export interface TotemRepository {
  list(): Promise<Totem[]>;

  /** Grava as alterações e registra na auditoria quem mudou o quê. */
  update(id: string, draft: TotemDraft, performedBy: string): Promise<void>;
}
