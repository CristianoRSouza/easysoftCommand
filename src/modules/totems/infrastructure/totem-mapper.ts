import { asBoolean, asIsoDate, asNumber, asText } from "@/shared/infrastructure/convert";
import { toTotemMode, type Totem, type TotemLicense } from "../domain/totem";
import {
  IMAGE_SERVER_DEFAULTS,
  PRINTER_DEFAULTS,
  TEF_RUNTIME_DEFAULTS,
  toInstallmentType,
  toPaymentEnvironment,
  type ImageServer,
  type PrinterSettings,
  type TefRuntime,
} from "../domain/totem-settings";

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
  "id, totem_name, is_active, app_mode, payment_environment",
  "nfce_environment, nfce_serie, nfce_service_url, nfce_emit_timeout_ms",
  "payment_credit_enabled, payment_debit_enabled, payment_pix_enabled, payment_voucher_enabled, payment_voucher_kind",
  "tef_http_base_url, pix_http_base_url, establishment_cnpj",
  "nfce_service_api_key, tef_http_api_key, pix_http_api_key",
  "aditum_partner_token_encrypted, aditum_activation_code_encrypted",
  "tef_base_url, tef_insecure_tls, tef_application_name, tef_application_version",
  "tef_contactless, tef_poll_interval_ms, tef_poll_max_ms, tef_credit_installment_type",
  "tef_confirm_after_charge, tef_claim_source_statuses, tef_enable_worker_pending_job",
  "image_server_host, image_server_port",
  "printer_enabled, printer_model, printer_port, printer_code_page, printer_cols_normal",
  "printer_cut_paper, printer_cut_type, printer_translate_tags, printer_ignore_tags",
  "printer_verify, printer_line_feed_after, printer_copies, printer_timeout_ms",
].join(", ");

/**
 * Para comparar antes e depois de uma gravação.
 *
 * Inclui os identificadores de chave, que a tela não usa: sem eles, toda
 * gravação apareceria na auditoria como se o `_kid` tivesse mudado, porque o
 * valor anterior nunca teria sido lido.
 */
export const TOTEM_COLUMNS_FOR_DIFF = [
  TOTEM_COLUMNS_CLOUD,
  "aditum_partner_token_kid, aditum_activation_code_kid",
].join(", ");

/** `true` quando a coluna tem conteúdo — é o que a tela precisa saber. */
function preenchido(value: unknown): boolean {
  return value != null && String(value).trim() !== "";
}

/** Número da coluna, ou o padrão quando a coluna veio vazia. */
function numeroOu(value: unknown, padrao: number): number {
  return value == null ? padrao : asNumber(value);
}

function textoOu(value: unknown, padrao: string): string {
  return asText(value) ?? padrao;
}

function toTefRuntime(row: Row): TefRuntime {
  return {
    baseUrl: asText(row.tef_base_url),
    insecureTls: asBoolean(row.tef_insecure_tls),
    applicationName: textoOu(row.tef_application_name, TEF_RUNTIME_DEFAULTS.applicationName),
    applicationVersion: textoOu(
      row.tef_application_version,
      TEF_RUNTIME_DEFAULTS.applicationVersion,
    ),
    contactless: asBoolean(row.tef_contactless),
    pollIntervalMs: numeroOu(row.tef_poll_interval_ms, TEF_RUNTIME_DEFAULTS.pollIntervalMs),
    pollMaxMs: numeroOu(row.tef_poll_max_ms, TEF_RUNTIME_DEFAULTS.pollMaxMs),
    installmentType: toInstallmentType(row.tef_credit_installment_type),
    confirmAfterCharge: asBoolean(row.tef_confirm_after_charge),
    claimSourceStatuses: textoOu(
      row.tef_claim_source_statuses,
      TEF_RUNTIME_DEFAULTS.claimSourceStatuses,
    ),
    workerPendingJob: asBoolean(row.tef_enable_worker_pending_job),
  };
}

function toImageServer(row: Row): ImageServer {
  return {
    host: textoOu(row.image_server_host, IMAGE_SERVER_DEFAULTS.host),
    port: numeroOu(row.image_server_port, IMAGE_SERVER_DEFAULTS.port),
  };
}

function toPrinter(row: Row): PrinterSettings {
  return {
    enabled: asBoolean(row.printer_enabled),
    model: textoOu(row.printer_model, PRINTER_DEFAULTS.model),
    port: textoOu(row.printer_port, PRINTER_DEFAULTS.port),
    codePage: numeroOu(row.printer_code_page, PRINTER_DEFAULTS.codePage),
    columns: numeroOu(row.printer_cols_normal, PRINTER_DEFAULTS.columns),
    cutPaper: asBoolean(row.printer_cut_paper),
    cutType: numeroOu(row.printer_cut_type, PRINTER_DEFAULTS.cutType),
    translateTags: asBoolean(row.printer_translate_tags),
    ignoreTags: asBoolean(row.printer_ignore_tags),
    verify: asBoolean(row.printer_verify),
    lineFeedAfter: numeroOu(row.printer_line_feed_after, PRINTER_DEFAULTS.lineFeedAfter),
    copies: numeroOu(row.printer_copies, PRINTER_DEFAULTS.copies),
    timeoutMs: numeroOu(row.printer_timeout_ms, PRINTER_DEFAULTS.timeoutMs),
  };
}

export function toTotem(row: Row, license: TotemLicense | null): Totem {
  return {
    id: asText(row.id) ?? "",
    name: asText(row.totem_name) ?? "",
    isActive: asBoolean(row.is_active),
    mode: toTotemMode(row.app_mode),
    paymentEnvironment: toPaymentEnvironment(row.payment_environment),
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
      voucher: row.payment_voucher_enabled === true,
      voucherKind: row.payment_voucher_kind === "food" ? "food" : "meal",
    },
    integrations: {
      nfceServiceApiKey: preenchido(row.nfce_service_api_key),
      tefApiKey: preenchido(row.tef_http_api_key),
      pixApiKey: preenchido(row.pix_http_api_key),
      aditumPartnerToken: preenchido(row.aditum_partner_token_encrypted),
      aditumActivationCode: preenchido(row.aditum_activation_code_encrypted),
      tefBaseUrl: asText(row.tef_http_base_url),
      pixBaseUrl: asText(row.pix_http_base_url),
      establishmentCnpj: asText(row.establishment_cnpj),
    },
    tef: toTefRuntime(row),
    images: toImageServer(row),
    printer: toPrinter(row),
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
