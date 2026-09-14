import type { SupabaseClient } from "@supabase/supabase-js";
import type { UnitRepository } from "../application/unit-repository";
import type { Unit, UnitDraft, UnitQuery } from "../domain/unit";
import type { Tenant } from "@/shared/tenant/tenant";
import { asBoolean, asNumber, asText } from "@/shared/infrastructure/convert";

function toUnit(row: Record<string, unknown>): Unit {
  return {
    id: asText(row.id) ?? "",
    legacyCode: asNumber(row.legacy_code),
    shortDescription: asText(row.short_description) ?? "",
    description: asText(row.description) ?? "",
    isFractional: asBoolean(row.is_fractional),
    isActive: asBoolean(row.is_active),
  };
}

/**
 * Lê e grava as unidades de medida da empresa.
 *
 * Repare no filtro: `company_id`, não `store_id`. Unidades pertencem à empresa
 * e valem para todas as lojas dela — quilo é quilo em qualquer filial. É a
 * exceção à regra de que toda leitura na nuvem se restringe à loja.
 */
export class SupabaseUnitRepository implements UnitRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  async list(query: UnitQuery): Promise<Unit[]> {
    let request = this.client
      .from("pv_product_units")
      .select("id, legacy_code, short_description, description, is_fractional, is_active")
      .eq("company_id", this.tenant.companyId);

    const term = query.search.trim();
    if (term) {
      const safe = term.replace(/[%,()]/g, " ");
      request = request.or(`short_description.ilike.%${safe}%,description.ilike.%${safe}%`);
    }

    const { data, error } = await request.order("legacy_code");
    if (error) throw new Error(`Falha ao listar unidades: ${error.message}`);

    return ((data ?? []) as unknown as Record<string, unknown>[]).map(toUnit);
  }

  /** Produtos são por loja, mas a unidade é da empresa: conta em todas as lojas dela. */
  async countProductsUsing(unitId: string): Promise<number> {
    const { count, error } = await this.client
      .from("pv_products")
      .select("id", { count: "exact", head: true })
      .eq("unit_id", unitId);

    if (error) throw new Error(`Falha ao verificar o uso da unidade: ${error.message}`);
    return count ?? 0;
  }

  /**
   * O filtro por empresa entra também na gravação, não só na leitura.
   *
   * Sem ele, um identificador de outra empresa escrito à mão alteraria o dado
   * alheio — e o isolamento passaria a depender de o banco estar bem configurado,
   * que é justamente o que não se pode assumir.
   */
  async update(unitId: string, draft: UnitDraft): Promise<void> {
    const { data, error } = await this.client
      .from("pv_product_units")
      .update({
        short_description: draft.shortDescription,
        description: draft.description,
        is_fractional: draft.isFractional,
        is_active: draft.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", unitId)
      .eq("company_id", this.tenant.companyId)
      .select("id");

    if (error) throw new Error(`Falha ao salvar a unidade: ${error.message}`);
    if (!data || data.length === 0) {
      throw new Error("A unidade não foi encontrada nesta empresa.");
    }
  }
}
