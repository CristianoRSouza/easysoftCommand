import type { SupabaseClient } from "@supabase/supabase-js";
import type { RevenueRepository } from "../application/revenue-repository";
import { buildReport, type MethodAmount, type RevenueReport } from "../domain/revenue";
import { startOfDayIso, startOfNextDayIso, type DateRange } from "@/shared/domain/paging";
import type { Tenant } from "@/shared/tenant/tenant";
import { asNumber, asText } from "@/shared/infrastructure/convert";

const BATCH = 1000;

type Row = Record<string, unknown>;

/**
 * Soma a receita aprovada varrendo em lotes.
 *
 * O PostgREST não agrega, então a soma acontece aqui — mesma limitação que a
 * tela de NFC-e enfrenta. A paginação usa `id` como cursor: com deslocamento,
 * uma transação nova durante a varredura empurraria linhas e a soma pularia
 * registros, produzindo um faturamento silenciosamente menor.
 */
export class SupabaseRevenueRepository implements RevenueRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  async report(range: DateRange): Promise<RevenueReport> {
    const porMetodo = new Map<string, MethodAmount>();
    let afterId: string | null = null;

    for (;;) {
      let request = this.client
        .from("vw_command_transactions")
        .select("id, payment_method, amount")
        .eq("store_id", this.tenant.storeId)
        // Só aprovadas: somar pendentes e negadas infla o faturamento com
        // dinheiro que não entrou.
        .eq("status", "approved");

      if (range.from) request = request.gte("created_at", startOfDayIso(range.from));
      if (range.to) request = request.lt("created_at", startOfNextDayIso(range.to));
      if (afterId) request = request.gt("id", afterId);

      const { data, error } = await request.order("id", { ascending: true }).limit(BATCH);
      if (error) throw new Error(`Falha ao somar a receita: ${error.message}`);

      const rows = (data ?? []) as unknown as Row[];
      if (rows.length === 0) break;

      for (const row of rows) {
        const method = asText(row.payment_method) ?? "outros";
        const atual = porMetodo.get(method) ?? { method, amount: 0, count: 0 };
        atual.amount += asNumber(row.amount);
        atual.count += 1;
        porMetodo.set(method, atual);
      }

      if (rows.length < BATCH) break;
      afterId = asText(rows[rows.length - 1]?.id);
      if (!afterId) break;
    }

    return buildReport(range, [...porMetodo.values()], await this.countAuthorizedNotes(range));
  }

  /** Notas autorizadas no mesmo período, para confrontar com a receita. */
  private async countAuthorizedNotes(range: DateRange): Promise<number> {
    let request = this.client
      .from("vw_nfce_notes")
      .select("id", { count: "exact", head: true })
      .eq("store_id", this.tenant.storeId)
      .eq("status", "authorized");

    if (range.from) request = request.gte("issued_at", startOfDayIso(range.from));
    if (range.to) request = request.lt("issued_at", startOfNextDayIso(range.to));

    const { count, error } = await request;
    if (error) throw new Error(`Falha ao contar as notas: ${error.message}`);
    return count ?? 0;
  }
}
