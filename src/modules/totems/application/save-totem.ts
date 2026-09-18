import type { Totem } from "../domain/totem";
import { rejectionFor, type TotemDraft } from "../domain/totem-draft";
import type { CreateOutcome, SaveOutcome, TotemRepository } from "./totem-repository";

interface SaveContext {
  performedBy: string;
  /** A licença escolhida no formulário; `null` solta a que estiver presa. */
  licenseId: string | null;
  /** A licença do totem, para a regra de demonstração. */
  license: Totem["license"];
}

/**
 * Salvar um totem.
 *
 * As regras são conferidas aqui, e não só na tela: a tela decide o que
 * mostrar, esta camada decide o que acontece. Uma verificação que existe
 * apenas no formulário some no primeiro atalho — outra tela, um teste, uma
 * chamada direta ao repositório.
 */
export function saveTotem(repository: TotemRepository) {
  return async (totem: Totem, draft: TotemDraft, context: SaveContext): Promise<SaveOutcome> => {
    const recusa = rejectionFor(draft, context.license, context.licenseId !== null);
    if (recusa) throw new Error(recusa);

    // A licença primeiro: o banco recusa totem ativo sem licença, e gravar
    // `is_active` antes do vínculo faria o comando ser rejeitado.
    await repository.bindLicense(totem.id, context.licenseId);
    return repository.update(totem.id, draft, context.performedBy);
  };
}

/** Cadastrar um totem. Mesmas regras, e o vínculo acontece dentro do repositório. */
export function createTotem(repository: TotemRepository) {
  return async (draft: TotemDraft, context: SaveContext): Promise<CreateOutcome> => {
    const recusa = rejectionFor(draft, context.license, context.licenseId !== null);
    if (recusa) throw new Error(recusa);

    return repository.create(draft, context.licenseId, context.performedBy);
  };
}
