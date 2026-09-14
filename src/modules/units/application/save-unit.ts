import {
  ensureCanDeactivate,
  isUnchanged,
  normalizeUnit,
  validateUnit,
  UnitRuleViolation,
  type Unit,
  type UnitDraft,
} from "../domain/unit";
import type { UnitRepository } from "./unit-repository";

/**
 * Salva uma unidade.
 *
 * A ordem dos passos não é acidental: valida o formato antes de consultar o
 * banco (não faz sentido perguntar quantos produtos usam uma sigla inválida), e
 * confere a regra de desativação antes de gravar. A consulta de uso só acontece
 * quando ela pode mudar o resultado — desativar.
 */
export function saveUnit(repository: UnitRepository) {
  return async (unit: Unit, draft: UnitDraft): Promise<{ changed: boolean }> => {
    const errors = validateUnit(draft);
    if (errors.length > 0) {
      throw new UnitRuleViolation(errors.map((e) => e.message).join(" "));
    }

    const normalizado = normalizeUnit(draft);
    if (isUnchanged(unit, normalizado)) return { changed: false };

    if (unit.isActive && !normalizado.isActive) {
      const emUso = await repository.countProductsUsing(unit.id);
      ensureCanDeactivate(unit, normalizado, emUso);
    }

    await repository.update(unit.id, normalizado);
    return { changed: true };
  };
}
