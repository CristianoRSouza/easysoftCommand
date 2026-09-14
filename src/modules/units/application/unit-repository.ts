import type { Unit, UnitDraft, UnitQuery } from "../domain/unit";

/** Unidades são poucas e não mudam: a lista inteira vem de uma vez, sem paginação. */
export interface UnitRepository {
  list(query: UnitQuery): Promise<Unit[]>;

  /** Quantos produtos apontam para esta unidade. Zero permite desativá-la. */
  countProductsUsing(unitId: string): Promise<number>;

  /** Grava a alteração. O rascunho já chega validado e normalizado. */
  update(unitId: string, draft: UnitDraft): Promise<void>;
}
