import type { Page } from "@/shared/domain/paging";
import type { ReferenceTable } from "../domain/reference-table";

export interface ReferenceQuery {
  search: string;
  page: number;
  pageSize: number;
}

export const DEFAULT_REFERENCE_QUERY: ReferenceQuery = { search: "", page: 1, pageSize: 50 };

/** Uma linha de tabela de referência: colunas variam conforme a tabela. */
export type ReferenceRow = Record<string, unknown>;

export interface TaxReformRepository {
  /**
   * Lê uma página de uma tabela de referência.
   *
   * Recebe a descrição da tabela em vez do nome solto: os nomes de view e de
   * coluna vêm de uma lista fixa no domínio, nunca da entrada do usuário.
   */
  list(table: ReferenceTable, query: ReferenceQuery): Promise<Page<ReferenceRow>>;
}
