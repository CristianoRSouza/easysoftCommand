/**
 * A situação da licença da empresa, para avisar antes que o sistema pare.
 *
 * A regra é a do projeto anterior: vencida quando a data passou ou a licença
 * foi desativada; perto de vencer nos últimos sete dias; sem plano cadastrado
 * não se avisa nada — não é erro de quem usa.
 */
export type LicenseState = "active" | "expiring_soon" | "expired" | "unknown";

export interface LicenseStatus {
  state: LicenseState;
  planSlug: string | null;
  planName: string | null;
  expiresAt: string | null;
  /** Negativo quando já venceu; `null` sem data. */
  daysUntilExpiry: number | null;
}

export const UNKNOWN_LICENSE: LicenseStatus = {
  state: "unknown",
  planSlug: null,
  planName: null,
  expiresAt: null,
  daysUntilExpiry: null,
};

const AVISO_EM_DIAS = 7;

export function classifyLicense(
  licenca: {
    planSlug: string | null;
    planName: string | null;
    expiresAt: string | null;
    isActive: boolean | null;
  },
  now: Date = new Date(),
): LicenseStatus {
  const vence = licenca.expiresAt ? new Date(licenca.expiresAt).getTime() : NaN;
  const dias = Number.isFinite(vence)
    ? Math.ceil((vence - now.getTime()) / 86_400_000)
    : null;

  const state: LicenseState = !licenca.planSlug
    ? "unknown"
    : (Number.isFinite(vence) && vence < now.getTime()) || licenca.isActive === false
      ? "expired"
      : dias !== null && dias <= AVISO_EM_DIAS
        ? "expiring_soon"
        : "active";

  return {
    state,
    planSlug: licenca.planSlug,
    planName: licenca.planName,
    expiresAt: licenca.expiresAt,
    daysUntilExpiry: dias,
  };
}
