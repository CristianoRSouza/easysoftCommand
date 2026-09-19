import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ReferenceQuery,
  ReferenceRow,
  TaxReformRepository,
} from "../application/tax-reform-repository";
import { columnsOf, type ReferenceTable } from "../domain/reference-table";
import { pageToRange, type Page } from "@/shared/domain/paging";

/**
 * As tabelas da reforma são iguais para todo mundo.
 *
 * Não levam filtro de empresa nem de loja — são a lista oficial, não dado da
 * loja. Por isso este repositório não recebe o tenant: não haveria o que
 * filtrar com ele.
 */
export class SupabaseTaxReformRepository implements TaxReformRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(table: ReferenceTable, query: ReferenceQuery): Promise<Page<ReferenceRow>> {
    const { from, to } = pageToRange(query.page, query.pageSize);

    let request = this.client
      .from(table.view)
      .select(columnsOf(table), { count: "exact" })
      // Versões antigas continuam na tabela, marcadas como inativas: mostrá-las
      // faria alguém usar um código que saiu de vigência.
      .eq("is_active", true);

    const termo = query.search.trim();
    if (termo && table.searchable.length > 0) {
      const seguro = termo.replace(/[%,()]/g, " ");
      request = request.or(table.searchable.map((c) => `${c}.ilike.%${seguro}%`).join(","));
    }

    const { data, error, count } = await request
      .order(table.orderBy, { ascending: true })
      .range(from, to);

    if (error) throw new Error(`Falha ao carregar a tabela: ${error.message}`);

    return { items: (data ?? []) as unknown as ReferenceRow[], total: count ?? 0 };
  }
}
