import type { Unit, UnitQuery } from "../domain/unit";

/** Unidades são poucas e não mudam: a lista inteira vem de uma vez, sem paginação. */
export interface UnitRepository {
  list(query: UnitQuery): Promise<Unit[]>;
}
