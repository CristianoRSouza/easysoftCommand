import { asBoolean, asIsoDate, asNumber, asText } from "@/shared/infrastructure/convert";
import { toTotemMode, type Totem, type TotemLicense } from "../domain/totem";

type Row = Record<string, unknown>;

/**
 * Colunas da view da nuvem.
 *
 * Os indicadores `_set` que o projeto anterior expõe não são colunas: ele os
 * calcula no código a partir do valor cifrado. Pedi-los ao banco fazia a
 * consulta inteira falhar — e o erro só aparecia contra o Supabase de verdade,
 * porque o teste local usava outra tabela.
 *
 * Aqui só a coluna cifrada é lida, e o indicador é derivado no mapeador. O
 * valor cifrado não vai à tela.
 */
export const TOTEM_COLUMNS_CLOUD = [
  "id, totem_name, is_active, app_mode",
  "nfce_environment, nfce_serie, nfce_service_url, nfce_emit_timeout_ms",
  "payment_credit_enabled, payment_debit_enabled, payment_pix_enabled",
  "tef_http_base_url, pix_http_base_url, establishment_cnpj",
  "nfce_service_api_key, tef_http_api_key",
  "aditum_partner_token_encrypted, aditum_activation_code_encrypted",
].join(", ");

/** `true` quando a coluna tem conteúdo — é o que a tela precisa saber. */
function preenchido(value: unknown): boolean {
  return value != null && String(value).trim() !== "";
}

export function toTotem(row: Row, license: TotemLicense | null): Totem {
  return {
    id: asText(row.id) ?? "",
    name: asText(row.totem_name) ?? "",
    isActive: asBoolean(row.is_active),
    mode: toTotemMode(row.app_mode),
    fiscal: {
      nfceEnvironment: row.nfce_environment == null ? null : asNumber(row.nfce_environment),
      nfceSerie: row.nfce_serie == null ? null : asNumber(row.nfce_serie),
      serviceUrl: asText(row.nfce_service_url),
      emitTimeoutMs: row.nfce_emit_timeout_ms == null ? null : asNumber(row.nfce_emit_timeout_ms),
    },
    payments: {
      credit: asBoolean(row.payment_credit_enabled),
      debit: asBoolean(row.payment_debit_enabled),
      pix: asBoolean(row.payment_pix_enabled),
    },
    integrations: {
      nfceServiceApiKey: preenchido(row.nfce_service_api_key),
      tefApiKey: preenchido(row.tef_http_api_key),
      aditumPartnerToken: preenchido(row.aditum_partner_token_encrypted),
      aditumActivationCode: preenchido(row.aditum_activation_code_encrypted),
      tefBaseUrl: asText(row.tef_http_base_url),
      pixBaseUrl: asText(row.pix_http_base_url),
      establishmentCnpj: asText(row.establishment_cnpj),
    },
    license,
  };
}

export function toLicense(row: Row | null | undefined): TotemLicense | null {
  if (!row) return null;
  return {
    type: asText(row.license_type),
    planSlug: asText(row.plan_slug),
    status: asText(row.status),
    startsAt: row.starts_at == null ? null : asIsoDate(row.starts_at),
    expiresAt: row.expires_at == null ? null : asIsoDate(row.expires_at),
    maxTransactionsMonth:
      row.max_transactions_month == null ? null : asNumber(row.max_transactions_month),
  };
}
