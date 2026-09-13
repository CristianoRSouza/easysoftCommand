/**
 * Unidade de medida — UND, KG, LT.
 *
 * `isFractional` decide se a quantidade aceita casas decimais: 2,5 kg faz
 * sentido; 2,5 unidades, não.
 */
export interface Unit {
  id: string;
  legacyCode: number;
  shortDescription: string;
  description: string;
  isFractional: boolean;
  isActive: boolean;
}

export interface UnitQuery {
  search: string;
}

export const DEFAULT_UNIT_QUERY: UnitQuery = { search: "" };
