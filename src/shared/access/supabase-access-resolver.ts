import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccessProfile, AccessResolver } from "./access";

/**
 * Papéis que dão administração do sistema.
 *
 * `tech_admin` entra junto porque é assim no sistema em produção: a lista de
 * papéis é consultada para o menu, enquanto a auditoria pergunta à função
 * `is_system_admin` do banco. As duas respostas coincidem, e é a função que
 * vale para a auditoria — ela é a mesma que as políticas do banco usam.
 */
const SYSTEM_ROLES = ["system_admin", "tech_admin"];
const COMPANY_ROLE = "company_admin";

export class SupabaseAccessResolver implements AccessResolver {
  constructor(private readonly client: SupabaseClient) {}

  async resolve(userId: string): Promise<AccessProfile> {
    const [sistema, papeis] = await Promise.all([
      this.client.rpc("is_system_admin", { _user_id: userId }),
      this.client.from("pv_user_roles").select("role").eq("user_id", userId),
    ]);

    // Falha de consulta não concede nada. O projeto anterior faz o mesmo, e
    // pela mesma razão: erro ao ler permissão não é permissão.
    const roles = new Set(
      (papeis.data ?? []).map((row) => String((row as { role?: unknown }).role ?? "")),
    );

    return {
      isSystemAdmin: sistema.data === true || SYSTEM_ROLES.some((role) => roles.has(role)),
      isCompanyAdmin: roles.has(COMPANY_ROLE),
    };
  }
}
