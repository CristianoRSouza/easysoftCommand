import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccessProfile } from "@/shared/access/access";
import {
  seesAllStores,
  type CompanyOption,
  type StoreOption,
  type TenantDirectory,
} from "./tenant";

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

/** Tipo de loja que abre sozinha para o administrador da empresa. */
const MATRIZ = "headquarters";

export class SupabaseTenantDirectory implements TenantDirectory {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * Administrador do sistema vê todas as empresas; os demais, as aprovadas
   * para ele. É a mesma regra do sistema em produção.
   */
  async companies(userId: string, profile: AccessProfile): Promise<CompanyOption[]> {
    let ids: string[] | null = null;

    if (!profile.isSystemAdmin) {
      const { data, error } = await this.client
        .from("pb_user_company_access")
        .select("company_id")
        .eq("user_id", userId)
        .eq("status", "approved");

      if (error) throw new Error(`Falha ao ler as empresas do usuário: ${error.message}`);

      ids = (data ?? [])
        .map((row) => asText((row as { company_id?: unknown }).company_id))
        .filter((id): id is string => id !== null);
      if (ids.length === 0) return [];
    }

    let request = this.client.from("pv_companies").select("id, name, cnpj").order("name");
    if (ids) request = request.in("id", ids);

    const { data, error } = await request;
    if (error) throw new Error(`Falha ao ler as empresas: ${error.message}`);

    return ((data ?? []) as Record<string, unknown>[])
      .map((row) => ({
        id: asText(row.id) ?? "",
        name: asText(row.name) ?? "Empresa sem nome",
        cnpj: asText(row.cnpj),
      }))
      .filter((company) => company.id !== "");
  }

  async stores(userId: string, companyId: string, profile: AccessProfile): Promise<StoreOption[]> {
    const [acessos, lojas] = await Promise.all([
      this.client.from("pb_user_store_access").select("store_id, is_default").eq("user_id", userId),
      this.client
        .from("pv_stores")
        .select("id, company_id, trade_name, legacy_store_code, store_type")
        .eq("company_id", companyId)
        .eq("is_deleted", false)
        .order("legacy_store_code"),
    ]);

    if (acessos.error) throw new Error(`Falha ao ler as lojas do usuário: ${acessos.error.message}`);
    if (lojas.error) throw new Error(`Falha ao ler as lojas: ${lojas.error.message}`);

    const liberacoes = new Map<string, boolean>();
    for (const row of (acessos.data ?? []) as Record<string, unknown>[]) {
      const id = asText(row.store_id);
      if (id) liberacoes.set(id, row.is_default === true);
    }

    const todas = seesAllStores(profile);

    return ((lojas.data ?? []) as Record<string, unknown>[])
      .filter((row) => todas || liberacoes.has(asText(row.id) ?? ""))
      .map((row) => {
        const id = asText(row.id) ?? "";
        const matrizDoAdmin = profile.isCompanyAdmin && row.store_type === MATRIZ;
        return {
          id,
          companyId: asText(row.company_id) ?? companyId,
          name:
            asText(row.trade_name) ?? asText(String(row.legacy_store_code ?? "")) ?? "Loja sem nome",
          code: row.legacy_store_code == null ? null : String(row.legacy_store_code),
          isDefault: matrizDoAdmin || liberacoes.get(id) === true,
        };
      })
      .filter((store) => store.id !== "");
  }
}
