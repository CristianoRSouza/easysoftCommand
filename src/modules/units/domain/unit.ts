/**
 * Unidade de medida — UND, KG, LT.
 *
 * `isFractional` decide se a quantidade aceita casas decimais: 2,5 kg faz
 * sentido; 2,5 unidades, não.
 *
 * Somente leitura, e isso é decisão de arquitetura do produto, não omissão: as
 * unidades são espelhadas do Firebird do PDV pelo Sync-Service. O PDV é a fonte
 * da verdade. Editar aqui seria desfeito na próxima sincronização — o usuário
 * salvaria, veria funcionar, e o valor voltaria sozinho depois.
 */
export interface Unit {
  id: string;
  legacyCode: number;
  shortDescription: string;
  description: string;
  isFractional: boolean;
  isActive: boolean;
  /** Quando a unidade entrou no cadastro — veio do PDV pela sincronização. */
  createdAt: string | null;
}

export interface UnitQuery {
  search: string;
}

export const DEFAULT_UNIT_QUERY: UnitQuery = { search: "" };
