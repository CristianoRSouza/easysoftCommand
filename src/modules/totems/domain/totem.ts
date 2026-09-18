import type {
  ImageServer,
  PaymentEnvironment,
  PrinterSettings,
  TefRuntime,
} from "./totem-settings";

/**
 * Totem de autoatendimento — o terminal em que o cliente paga a comanda.
 *
 * O que importa operacionalmente não são os sessenta campos de configuração,
 * mas três perguntas: está ativo, está em produção de verdade, e os meios de
 * pagamento estão ligados.
 */
export interface Totem {
  id: string;
  name: string;
  isActive: boolean;
  mode: TotemMode;
  /** Ambiente de PIX e TEF, separado do modo do aplicativo e do fiscal. */
  paymentEnvironment: PaymentEnvironment;
  fiscal: TotemFiscalSettings;
  payments: TotemPaymentMethods;
  integrations: TotemIntegrations;
  tef: TefRuntime;
  images: ImageServer;
  printer: PrinterSettings;
  license: TotemLicense | null;
}

/**
 * Modo do aplicativo.
 *
 * `demo` e `homolog` não vendem de verdade: um totem esquecido nesses modos é
 * um caixa que parece funcionar e não fatura.
 */
export type TotemMode = "demo" | "homolog" | "production" | "unknown";

const MODES: Record<string, TotemMode> = {
  demo: "demo",
  homolog: "homolog",
  homologation: "homolog",
  homologacao: "homolog",
  production: "production",
  producao: "production",
  prod: "production",
};

export function toTotemMode(value: unknown): TotemMode {
  if (typeof value !== "string") return "unknown";
  return MODES[value.toLowerCase()] ?? "unknown";
}

export const TOTEM_MODE_LABEL: Record<TotemMode, string> = {
  demo: "Demonstração",
  homolog: "Homologação",
  production: "Produção",
  unknown: "Não definido",
};

/** `true` só quando o totem realmente vende. */
export function sellsForReal(totem: Totem): boolean {
  return totem.isActive && totem.mode === "production";
}

export interface TotemFiscalSettings {
  /** 1 = produção, 2 = homologação. Divergir do modo do app é sinal de engano. */
  nfceEnvironment: number | null;
  nfceSerie: number | null;
  serviceUrl: string | null;
  emitTimeoutMs: number | null;
}

export interface TotemPaymentMethods {
  credit: boolean;
  debit: boolean;
  pix: boolean;
}

/** Nenhum meio ligado significa um totem que não recebe pagamento algum. */
export function hasAnyPaymentMethod(payments: TotemPaymentMethods): boolean {
  return payments.credit || payments.debit || payments.pix;
}

/**
 * Presença das chaves de integração — nunca os valores.
 *
 * Mesma regra do emitente: os segredos ficam cifrados no banco e esta tela só
 * precisa saber se estão configurados.
 */
export interface TotemIntegrations {
  nfceServiceApiKey: boolean;
  tefApiKey: boolean;
  pixApiKey: boolean;
  aditumPartnerToken: boolean;
  aditumActivationCode: boolean;
  tefBaseUrl: string | null;
  pixBaseUrl: string | null;
  establishmentCnpj: string | null;
}

export interface TotemLicense {
  type: string | null;
  planSlug: string | null;
  status: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  maxTransactionsMonth: number | null;
}

export type LicenseHealth = "missing" | "expired" | "expiring" | "active";

export const LICENSE_WARNING_DAYS = 15;

/** Licença vencida derruba o totem: ele para de aceitar pagamento. */
export function licenseHealth(
  license: TotemLicense | null,
  now: Date = new Date(),
): LicenseHealth {
  if (!license) return "missing";
  if (license.status && license.status !== "active") return "expired";
  if (!license.expiresAt) return "active";

  const expiry = new Date(license.expiresAt);
  if (Number.isNaN(expiry.getTime())) return "active";
  if (expiry.getTime() <= now.getTime()) return "expired";

  const days = (expiry.getTime() - now.getTime()) / 86_400_000;
  return days <= LICENSE_WARNING_DAYS ? "expiring" : "active";
}
