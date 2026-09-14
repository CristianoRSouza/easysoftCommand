import type { SupabaseClient } from "@supabase/supabase-js";
import type { TotemRepository } from "../application/totem-repository";
import type { Totem } from "../domain/totem";
import type { Tenant } from "@/shared/tenant/tenant";
import { asText } from "@/shared/infrastructure/convert";
import { TOTEM_COLUMNS_CLOUD, toLicense, toTotem } from "./totem-mapper";

type Row = Record<string, unknown>;

export class SupabaseTotemRepository implements TotemRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  async list(): Promise<Totem[]> {
    // Totens pertencem à empresa, como as unidades — não à loja.
    const { data, error } = await this.client
      .from("vw_devices_totem_config")
      .select(TOTEM_COLUMNS_CLOUD)
      .eq("company_id", this.tenant.companyId)
      .order("totem_name");

    if (error) throw new Error(`Falha ao listar totens: ${error.message}`);

    const rows = (data ?? []) as unknown as Row[];
    if (rows.length === 0) return [];

    const ids = rows.map((row) => asText(row.id)).filter((id): id is string => id !== null);
    const { data: licencas } = await this.client
      .from("device_licenses")
      .select("totem_config_id, license_type, plan_slug, status, starts_at, expires_at, max_transactions_month")
      .in("totem_config_id", ids);

    const porTotem = new Map<string, Row>();
    for (const licenca of (licencas ?? []) as unknown as Row[]) {
      const id = asText(licenca.totem_config_id);
      if (id) porTotem.set(id, licenca);
    }

    return rows.map((row) => toTotem(row, toLicense(porTotem.get(asText(row.id) ?? ""))));
  }
}
