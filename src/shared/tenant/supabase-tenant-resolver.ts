import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tenant, TenantResolver } from "./tenant";

/**
 * Devolve o valor apenas quando ele é mesmo um texto não vazio.
 *
 * Existe para substituir `as string`. A conversão silenciosa deixava um
 * identificador ausente virar a string "undefined" dentro do filtro, e a
 * consulta falhava sem dizer por quê — o erro se disfarçava de resposta.
 */
function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * Resolve a empresa e a loja do usuário a partir das tabelas de acesso.
 *
 * Esta fatia não tem seletor de loja — isso é trabalho do módulo multi-tenant.
 * Aqui a loja é escolhida de forma determinística: a marcada como padrão em
 * `pb_user_store_access`, ou a primeira por código. O nome escolhido aparece no
 * cabeçalho, para que o usuário sempre saiba qual loja está vendo.
 */
export class SupabaseTenantResolver implements TenantResolver {
  constructor(private readonly client: SupabaseClient) {}

  async resolve(userId: string): Promise<Tenant | null> {
    const company = await this.firstApprovedCompany(userId);
    if (!company) return null;

    const store = await this.defaultStore(userId, company.id);
    if (!store) return null;

    return {
      companyId: company.id,
      companyName: company.name,
      storeId: store.id,
      storeName: store.name,
    };
  }

  private async firstApprovedCompany(userId: string): Promise<{ id: string; name: string } | null> {
    const { data: access, error: accessError } = await this.client
      .from("pb_user_company_access")
      .select("company_id")
      .eq("user_id", userId)
      .eq("status", "approved");

    if (accessError) throw new Error(`Falha ao ler empresas do usuário: ${accessError.message}`);

    const ids = (access ?? [])
      .map((row) => asText(row.company_id))
      .filter((id): id is string => id !== null);
    if (ids.length === 0) return null;

    const { data, error } = await this.client
      .from("pv_companies")
      .select("id, name")
      .in("id", ids)
      .order("name")
      .limit(1);

    if (error) throw new Error(`Falha ao ler a empresa: ${error.message}`);

    const row = data?.[0];
    const id = asText(row?.id);
    if (!id) return null;
    return { id, name: asText(row?.name) ?? "Empresa sem nome" };
  }

  private async defaultStore(
    userId: string,
    companyId: string,
  ): Promise<{ id: string; name: string } | null> {
    const { data: access, error: accessError } = await this.client
      .from("pb_user_store_access")
      .select("store_id, is_default")
      .eq("user_id", userId);

    if (accessError) throw new Error(`Falha ao ler lojas do usuário: ${accessError.message}`);

    const { data: stores, error } = await this.client
      .from("pv_stores")
      .select("id, trade_name, legacy_store_code")
      .eq("company_id", companyId)
      .eq("is_deleted", false)
      .order("legacy_store_code");

    if (error) throw new Error(`Falha ao ler as lojas: ${error.message}`);

    const accessRows = access ?? [];
    const allowedIds = new Set(
      accessRows.map((row) => asText(row.store_id)).filter((id): id is string => id !== null),
    );

    const candidates = (stores ?? [])
      .map((row) => ({
        id: asText(row.id),
        name: asText(row.trade_name) ?? asText(row.legacy_store_code) ?? "Loja sem nome",
      }))
      .filter((row): row is { id: string; name: string } => row.id !== null);

    // Sem linhas de acesso, o usuário enxerga toda a empresa (é o caso dos
    // administradores). Com linhas, vale apenas o que foi concedido.
    const visible =
      allowedIds.size === 0 ? candidates : candidates.filter((row) => allowedIds.has(row.id));
    if (visible.length === 0) return null;

    const defaultId = asText(accessRows.find((row) => row.is_default === true)?.store_id);
    return visible.find((row) => row.id === defaultId) ?? visible[0] ?? null;
  }
}
