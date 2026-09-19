import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyLicense, type LicenseStatus } from "./license";
import { UNLIMITED_WINDOW, type PlanWindow, type PlanWindowResolver } from "./plan-window";

/**
 * Licença ativa da empresa e a janela do plano correspondente.
 *
 * As duas tabelas vivem no esquema `billing`, não no `public` — o mesmo
 * engano que fez as licenças de totem parecerem ausentes em todos os totens.
 */
const ESQUEMA = "billing";

export class SupabasePlanWindowResolver implements PlanWindowResolver {
  constructor(private readonly client: SupabaseClient) {}

  async resolve(companyId: string): Promise<PlanWindow> {
    const { data: licenca, error: erroLicenca } = await this.client
      .schema(ESQUEMA)
      .from("company_licenses")
      .select("plan_name")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (erroLicenca) throw new Error(`Falha ao ler a licença da empresa: ${erroLicenca.message}`);

    const planSlug = (licenca as { plan_name?: string | null } | null)?.plan_name ?? null;
    if (!planSlug) return UNLIMITED_WINDOW;

    const { data: plano, error: erroPlano } = await this.client
      .schema(ESQUEMA)
      .from("module_plans")
      .select("name, history_window_days")
      .eq("slug", planSlug)
      .maybeSingle();

    if (erroPlano) throw new Error(`Falha ao ler o plano: ${erroPlano.message}`);

    const row = plano as { name?: string | null; history_window_days?: number | null } | null;
    return {
      planSlug,
      planName: row?.name ?? null,
      historyWindowDays: row?.history_window_days ?? null,
    };
  }

  /**
   * A licença mais recente, ativa ou não. Diferente da janela, que só olha a
   * ativa: aqui a desativada é justamente o que precisa virar aviso.
   */
  async license(companyId: string): Promise<LicenseStatus> {
    const { data, error } = await this.client
      .schema(ESQUEMA)
      .from("company_licenses")
      .select("plan_name, expires_at, is_active")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Falha ao ler a licença da empresa: ${error.message}`);

    const row = data as { plan_name?: string | null; expires_at?: string | null; is_active?: boolean | null } | null;
    const planSlug = row?.plan_name ?? null;

    let planName: string | null = null;
    if (planSlug) {
      const { data: plano } = await this.client
        .schema(ESQUEMA)
        .from("module_plans")
        .select("name")
        .eq("slug", planSlug)
        .maybeSingle();
      planName = (plano as { name?: string | null } | null)?.name ?? null;
    }

    return classifyLicense({
      planSlug,
      planName,
      expiresAt: row?.expires_at ?? null,
      isActive: row?.is_active ?? null,
    });
  }
}
