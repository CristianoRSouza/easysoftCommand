import { KEEP_SECRET, type SecretEdit } from "@/shared/domain/secret-edit";
import { textOrNull, urlOrNull } from "@/shared/domain/text";
import type { Totem, TotemLicense, TotemMode, VoucherKind } from "./totem";
import {
  IMAGE_SERVER_DEFAULTS,
  PRINTER_DEFAULTS,
  TEF_RUNTIME_DEFAULTS,
  toInstallmentType,
  toPaymentEnvironment,
  type ImageServer,
  type PaymentEnvironment,
  type PrinterSettings,
  type TefRuntime,
} from "./totem-settings";

/**
 * O que a tela de totens pode alterar.
 *
 * A gravação é parcial: coluna que não está no rascunho não entra no comando e
 * não muda de valor. O projeto anterior monta, a cada gravação, um objeto com
 * os sessenta campos da configuração, preenchendo com um valor padrão todo
 * campo que o formulário não carregou — salvar uma mudança de nome reescrevia
 * impressora, TEF e tempos de espera com os padrões do código.
 */
export interface TotemDraft {
  name: string;
  isActive: boolean;
  mode: TotemMode;
  paymentEnvironment: PaymentEnvironment;

  nfceEnvironment: number | null;
  nfceSerie: number | null;
  nfceServiceUrl: string | null;
  nfceEmitTimeoutMs: number | null;
  nfceServiceApiKey: SecretEdit;

  creditEnabled: boolean;
  debitEnabled: boolean;
  pixEnabled: boolean;
  voucherEnabled: boolean;
  voucherKind: VoucherKind;

  tefHttpBaseUrl: string | null;
  tefHttpApiKey: SecretEdit;
  pixHttpBaseUrl: string | null;
  pixHttpApiKey: SecretEdit;

  establishmentCnpj: string | null;
  aditumPartnerToken: SecretEdit;
  aditumActivationCode: SecretEdit;
  tef: TefRuntime;

  images: ImageServer;
  printer: PrinterSettings;
}

export function draftFrom(totem: Totem): TotemDraft {
  return {
    name: totem.name,
    isActive: totem.isActive,
    mode: totem.mode,
    paymentEnvironment: totem.paymentEnvironment,

    nfceEnvironment: totem.fiscal.nfceEnvironment,
    nfceSerie: totem.fiscal.nfceSerie,
    nfceServiceUrl: totem.fiscal.serviceUrl,
    nfceEmitTimeoutMs: totem.fiscal.emitTimeoutMs,
    nfceServiceApiKey: KEEP_SECRET,

    creditEnabled: totem.payments.credit,
    debitEnabled: totem.payments.debit,
    pixEnabled: totem.payments.pix,
    voucherEnabled: totem.payments.voucher,
    voucherKind: totem.payments.voucherKind,

    tefHttpBaseUrl: totem.integrations.tefBaseUrl,
    tefHttpApiKey: KEEP_SECRET,
    pixHttpBaseUrl: totem.integrations.pixBaseUrl,
    pixHttpApiKey: KEEP_SECRET,

    establishmentCnpj: totem.integrations.establishmentCnpj,
    aditumPartnerToken: KEEP_SECRET,
    aditumActivationCode: KEEP_SECRET,
    tef: totem.tef,

    images: totem.images,
    printer: totem.printer,
  };
}

/** O rascunho de um totem novo, com os mesmos padrões do projeto anterior. */
export function emptyDraft(): TotemDraft {
  return {
    name: "",
    isActive: false,
    mode: "demo",
    paymentEnvironment: "homologacao",

    nfceEnvironment: 2,
    nfceSerie: 1,
    nfceServiceUrl: null,
    nfceEmitTimeoutMs: 30_000,
    nfceServiceApiKey: KEEP_SECRET,

    creditEnabled: true,
    debitEnabled: true,
    pixEnabled: true,
    // Forma nova: nasce desligada, ao contrário das outras três.
    voucherEnabled: false,
    voucherKind: "meal",

    tefHttpBaseUrl: null,
    tefHttpApiKey: KEEP_SECRET,
    pixHttpBaseUrl: null,
    pixHttpApiKey: KEEP_SECRET,

    establishmentCnpj: null,
    aditumPartnerToken: KEEP_SECRET,
    aditumActivationCode: KEEP_SECRET,
    tef: { ...TEF_RUNTIME_DEFAULTS },

    images: { ...IMAGE_SERVER_DEFAULTS },
    printer: { ...PRINTER_DEFAULTS },
  };
}

/** Como o banco grava o modo. O domínio usa nomes em inglês; a coluna, não. */
const MODE_TO_COLUMN: Record<TotemMode, string | null> = {
  demo: "demo",
  homolog: "homologacao",
  production: "producao",
  // Um totem cujo modo o banco não soube classificar não é reescrito como
  // "demo" ao salvar outra coisa: o valor atual fica onde está.
  unknown: null,
};

/** O único plano de demonstração. Qualquer outro plano nomeado é real. */
const DEMO_PLAN = "ecp-demo";

/**
 * Tipos que valem como demonstração quando a licença não tem plano nomeado.
 *
 * `monthly` estar nesta lista surpreende, mas é a regra do sistema em
 * produção: sem plano, a mensalidade não é prova de licença paga. Copiado tal
 * e qual — mudá-lo aqui liberaria produção para quem hoje não tem.
 */
const DEMO_TYPES_WITHOUT_PLAN = ["", "monthly", "trial", "demo"];

/**
 * Licença de demonstração impede qualquer coisa em produção.
 *
 * O projeto anterior repetia esta verificação em três funções quase idênticas
 * — uma para o modo do aplicativo, uma para o ambiente de pagamento e uma
 * para o ambiente da NFC-e. É uma regra só.
 *
 * Totem sem licença nenhuma não é bloqueado: é o que o sistema em produção
 * faz hoje ao editar um totem já existente.
 */
export function isDemoLicense(license: TotemLicense | null): boolean {
  if (!license) return false;

  const plan = license.planSlug?.trim();
  if (plan) return plan === DEMO_PLAN;

  return DEMO_TYPES_WITHOUT_PLAN.includes((license.type ?? "").trim().toLowerCase());
}

export const DEMO_BLOCK_MESSAGE =
  "A licença deste totem é de demonstração e não permite operação em produção.";

export const NO_LICENSE_MESSAGE =
  "Vincule uma licença antes de ativar o totem — o banco recusa totem ativo sem licença.";

/** `true` quando o rascunho pede produção, por qualquer um dos três caminhos. */
export function wantsProduction(draft: TotemDraft): boolean {
  return (
    draft.mode === "production" ||
    draft.nfceEnvironment === 1 ||
    draft.paymentEnvironment === "producao"
  );
}

/**
 * A recusa, quando houver. São as duas únicas regras que impedem gravar — as
 * demais diferenças entre rascunho e realidade viram aviso na tela.
 */
export function rejectionFor(
  draft: TotemDraft,
  license: TotemLicense | null,
  hasLicenseBound: boolean,
): string | null {
  if (wantsProduction(draft) && isDemoLicense(license)) return DEMO_BLOCK_MESSAGE;
  if (draft.isActive && !hasLicenseBound) return NO_LICENSE_MESSAGE;
  return null;
}

/** Tempo de emissão que o banco aceita, na mesma faixa do projeto anterior. */
const EMIT_TIMEOUT_MIN = 10_000;
const EMIT_TIMEOUT_MAX = 300_000;

function emitTimeout(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value < EMIT_TIMEOUT_MIN || value > EMIT_TIMEOUT_MAX) return null;
  return Math.floor(value);
}

/** Ambiente da NFC-e: 1 = produção, 2 = homologação. Não há terceiro valor. */
function nfceEnvironment(value: number | null): number | null {
  if (value == null) return null;
  return Number(value) === 1 ? 1 : 2;
}

/** Porta de rede válida; fora da faixa, o padrão. */
function port(value: number): number {
  return Number.isFinite(value) && value >= 1 && value <= 65535
    ? Math.floor(value)
    : IMAGE_SERVER_DEFAULTS.port;
}

function inteiro(value: number, padrao: number): number {
  return Number.isFinite(value) ? Math.floor(value) : padrao;
}

/** As colunas não-secretas do comando, já normalizadas. */
export function toColumns(draft: TotemDraft): Record<string, unknown> {
  const columns: Record<string, unknown> = {
    totem_name: draft.name.trim(),
    is_active: draft.isActive,
    payment_environment: draft.paymentEnvironment,

    nfce_environment: nfceEnvironment(draft.nfceEnvironment),
    nfce_serie: draft.nfceSerie,
    nfce_service_url: urlOrNull(draft.nfceServiceUrl),
    nfce_emit_timeout_ms: emitTimeout(draft.nfceEmitTimeoutMs),

    payment_credit_enabled: draft.creditEnabled,
    payment_debit_enabled: draft.debitEnabled,
    payment_pix_enabled: draft.pixEnabled,
    payment_voucher_enabled: draft.voucherEnabled,
    payment_voucher_kind: draft.voucherKind,

    tef_http_base_url: urlOrNull(draft.tefHttpBaseUrl),
    pix_http_base_url: urlOrNull(draft.pixHttpBaseUrl),
    establishment_cnpj: textOrNull(draft.establishmentCnpj),

    tef_base_url: urlOrNull(draft.tef.baseUrl),
    tef_insecure_tls: draft.tef.insecureTls,
    tef_application_name: draft.tef.applicationName.trim(),
    tef_application_version: draft.tef.applicationVersion.trim(),
    tef_contactless: draft.tef.contactless,
    tef_poll_interval_ms: inteiro(draft.tef.pollIntervalMs, TEF_RUNTIME_DEFAULTS.pollIntervalMs),
    tef_poll_max_ms: inteiro(draft.tef.pollMaxMs, TEF_RUNTIME_DEFAULTS.pollMaxMs),
    tef_credit_installment_type: toInstallmentType(draft.tef.installmentType),
    tef_confirm_after_charge: draft.tef.confirmAfterCharge,
    tef_claim_source_statuses: draft.tef.claimSourceStatuses.trim(),
    tef_enable_worker_pending_job: draft.tef.workerPendingJob,

    image_server_host: textOrNull(draft.images.host) ?? IMAGE_SERVER_DEFAULTS.host,
    image_server_port: port(draft.images.port),

    printer_enabled: draft.printer.enabled,
    printer_model: draft.printer.model,
    printer_port: draft.printer.port,
    printer_code_page: inteiro(draft.printer.codePage, PRINTER_DEFAULTS.codePage),
    printer_cols_normal: inteiro(draft.printer.columns, PRINTER_DEFAULTS.columns),
    printer_cut_paper: draft.printer.cutPaper,
    printer_cut_type: inteiro(draft.printer.cutType, PRINTER_DEFAULTS.cutType),
    printer_translate_tags: draft.printer.translateTags,
    printer_ignore_tags: draft.printer.ignoreTags,
    printer_verify: draft.printer.verify,
    printer_line_feed_after: inteiro(draft.printer.lineFeedAfter, PRINTER_DEFAULTS.lineFeedAfter),
    printer_copies: inteiro(draft.printer.copies, PRINTER_DEFAULTS.copies),
    printer_timeout_ms: inteiro(draft.printer.timeoutMs, PRINTER_DEFAULTS.timeoutMs),
  };

  const mode = MODE_TO_COLUMN[draft.mode];
  if (mode !== null) columns.app_mode = mode;

  return columns;
}

export { toPaymentEnvironment };
