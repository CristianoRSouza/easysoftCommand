import type { SupabaseClient } from "@supabase/supabase-js";
import type { PixRepository } from "../application/pix-repository";
import type { PixCredentials } from "../domain/pix-credentials";
import type { Tenant } from "@/shared/tenant/tenant";
import { PIX_COLUMNS, toPixCredentials } from "./pix-mapper";

/** É uma tabela, não uma view: o mesmo nome nos dois bancos. */
const TABELA = "pixnopdv_store_credentials";

/** O PostgREST usa este código quando a tabela não existe no projeto. */
const TABELA_INEXISTENTE = "PGRST205";

export class SupabasePixRepository implements PixRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  async get(): Promise<PixCredentials | null> {
    const { data, error } = await this.client
      .from(TABELA)
      .select(PIX_COLUMNS)
      .eq("store_id", this.tenant.storeId)
      .maybeSingle();

    if (error) {
      // O PIXnoPDV é opcional: nem todo projeto tem a tabela provisionada.
      // Tratar isso como falha faria a tela acusar erro onde o correto é dizer
      // que o recurso não está disponível nesta instalação.
      if (error.code === TABELA_INEXISTENTE) return null;
      throw new Error(`Falha ao carregar o PIXnoPDV: ${error.message}`);
    }

    return data ? toPixCredentials(data as unknown as Record<string, unknown>) : null;
  }
}
