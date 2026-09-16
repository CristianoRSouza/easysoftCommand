import type { Totem } from "../domain/totem";
import { rejectionFor, type TotemDraft } from "../domain/totem-draft";
import type { TotemRepository } from "./totem-repository";

/**
 * Salvar um totem.
 *
 * A regra da licença é conferida aqui, e não só na tela: a tela decide o que
 * mostrar, esta camada decide o que acontece. Uma verificação que existe
 * apenas no formulário some no primeiro atalho — outra tela, um teste, uma
 * chamada direta ao repositório.
 */
export function saveTotem(repository: TotemRepository) {
  return async (
    totem: Totem,
    draft: TotemDraft,
    context: { performedBy: string },
  ): Promise<void> => {
    const recusa = rejectionFor(draft, totem.license);
    if (recusa) throw new Error(recusa);

    await repository.update(totem.id, draft, context.performedBy);
  };
}
