import type { SupabaseClient } from "@supabase/supabase-js";
import type { UnitRepository } from "../application/unit-repository";
import type { Unit, UnitQuery } from "../domain/unit";
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
 * Lê as unidades de medida da empresa.
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
}
