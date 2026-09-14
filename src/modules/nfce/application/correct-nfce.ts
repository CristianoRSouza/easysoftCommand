import {
  normalizeCorrection,
  validateCorrection,
  type CorrectionDraft,
  type FiscalContext,
} from "../domain/nfce-correction";
import type { NfceDetail } from "../domain/nfce-detail";
import type { NfceRepository } from "./nfce-repository";

/** Correção recusada por regra fiscal. Traz todas as mensagens de uma vez. */
export class CorrectionRejected extends Error {
  constructor(public readonly reasons: string[]) {
    super(reasons.join(" "));
    this.name = "CorrectionRejected";
  }
}

/**
 * Corrige uma NFC-e em revisão manual.
 *
 * Valida tudo **antes** de gravar. No projeto anterior a ordem era inversa: as
 * alterações eram aplicadas e só então se conferia se o valor total havia
 * mudado — devolvendo erro com os dados já modificados e sem transação para
 * desfazer.
 */
export function correctNfce(repository: NfceRepository) {
  return async (
    detail: NfceDetail,
    draft: CorrectionDraft,
    context: FiscalContext,
  ): Promise<void> => {
    const normalizado = normalizeCorrection(draft);
    const erros = validateCorrection(normalizado, detail, context);

    if (erros.length > 0) {
      throw new CorrectionRejected(erros.map((e) => e.message));
    }

    await repository.saveCorrection(detail.note.id, normalizado);
  };
}
