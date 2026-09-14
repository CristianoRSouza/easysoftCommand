import { asBoolean, asIsoDate, asNumber, asText } from "@/shared/infrastructure/convert";
import { toTotemMode, type Totem, type TotemLicense } from "../domain/totem";

type Row = Record<string, unknown>;

/**
 * Colunas do totem — listadas uma a uma.
 *
 * Nenhuma coluna de segredo em claro aparece aqui. Das cifradas lê-se apenas
 * `IS NOT NULL`, porque a tela precisa saber se está configurado, não qual é.
 * A mesma regra vale para o emitente; aqui ela se repete porque o totem guarda
 * os próprios tokens da Aditum.
 */
export const TOTEM_COLUMNS_SQL = `
  t.id, t.totem_name, t.is_active, t.app_mode,
  t.nfce_environment, t.nfce_serie, t.nfce_service_url, t.nfce_emit_timeout_ms,
  t.payment_credit_enabled, t.payment_debit_enabled, t.payment_pix_enabled,
  t.tef_http_base_url, t.pix_http_base_url, t.establishment_cnpj,
  (t.nfce_service_api_key IS NOT NULL AND t.nfce_service_api_key <> '') AS has_nfce_key,
  (t.tef_http_api_key     IS NOT NULL AND t.tef_http_api_key     <> '') AS has_tef_key,
  (t.aditum_partner_token_encrypted    IS NOT NULL) AS has_partner_token,
  (t.aditum_activation_code_encrypted  IS NOT NULL) AS has_activation_code
`;

/** Colunas equivalentes na view da nuvem, onde os segredos já vêm redigidos. */
export const TOTEM_COLUMNS_CLOUD = [
  "id, totem_name, is_active, app_mode",
  "nfce_environment, nfce_serie, nfce_service_url, nfce_emit_timeout_ms",
  "payment_credit_enabled, payment_debit_enabled, payment_pix_enabled",
  "tef_http_base_url, pix_http_base_url, establishment_cnpj",
  "nfce_service_api_key_set, tef_http_api_key_set",
  "aditum_partner_token_encrypted_set, aditum_activation_code_encrypted_set",
].join(", ");

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
      // As duas fontes nomeiam o mesmo indicador de formas diferentes: o
      // PostgreSQL devolve `has_*` do SQL, a view da nuvem devolve `*_set`.
      nfceServiceApiKey: asBoolean(row.has_nfce_key ?? row.nfce_service_api_key_set),
      tefApiKey: asBoolean(row.has_tef_key ?? row.tef_http_api_key_set),
      aditumPartnerToken: asBoolean(
        row.has_partner_token ?? row.aditum_partner_token_encrypted_set,
      ),
      aditumActivationCode: asBoolean(
        row.has_activation_code ?? row.aditum_activation_code_encrypted_set,
      ),
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
