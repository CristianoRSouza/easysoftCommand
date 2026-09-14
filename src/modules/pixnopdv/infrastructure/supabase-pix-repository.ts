import type { SupabaseClient } from "@supabase/supabase-js";
import type { PixRepository } from "../application/pix-repository";
import type { PixCredentials } from "../domain/pix-credentials";
import type { Tenant } from "@/shared/tenant/tenant";
import { PIX_COLUMNS, toPixCredentials } from "./pix-mapper";

export class SupabasePixRepository implements PixRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  async get(): Promise<PixCredentials | null> {
    const { data, error } = await this.client
      .from("vw_pixnopdv_store_credentials")
      .select(PIX_COLUMNS)
      .eq("store_id", this.tenant.storeId)
      .maybeSingle();

    if (error) throw new Error(`Falha ao carregar o PIXnoPDV: ${error.message}`);
    return data ? toPixCredentials(data as unknown as Record<string, unknown>) : null;
  }
}
