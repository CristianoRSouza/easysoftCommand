import { KEEP_SECRET, type SecretEdit } from "@/shared/domain/secret-edit";
import { textOrNull, urlOrNull } from "@/shared/domain/text";
import type { Totem, TotemLicense, TotemMode } from "./totem";

/**
 * O que a tela de totens pode alterar.
 *
 * É exatamente o que ela mostra — nem um campo a mais. O projeto anterior
 * montava, a cada gravação, um objeto com os sessenta campos da configuração,
 * preenchendo com um valor padrão todo campo que o formulário não carregava
 * (`printer_model: data.printer_model ?? "0"`). Salvar uma mudança de nome
 * reescrevia impressora, TEF e tempos de espera com os padrões do código.
 *
 * Aqui a gravação é parcial: coluna que não está no rascunho não entra no
 * UPDATE e não muda de valor.
 */
export interface TotemDraft {
  name: string;
  isActive: boolean;
  mode: TotemMode;
  nfceEnvironment: number | null;
  nfceSerie: number | null;
  nfceServiceUrl: string | null;
  nfceEmitTimeoutMs: number | null;
  creditEnabled: boolean;
  debitEnabled: boolean;
  pixEnabled: boolean;
  tefBaseUrl: string | null;
  pixBaseUrl: string | null;
  establishmentCnpj: string | null;
  nfceServiceApiKey: SecretEdit;
  tefApiKey: SecretEdit;
  aditumPartnerToken: SecretEdit;
  aditumActivationCode: SecretEdit;
}

export function draftFrom(totem: Totem): TotemDraft {
  return {
    name: totem.name,
    isActive: totem.isActive,
    mode: totem.mode,
    nfceEnvironment: totem.fiscal.nfceEnvironment,
    nfceSerie: totem.fiscal.nfceSerie,
    nfceServiceUrl: totem.fiscal.serviceUrl,
    nfceEmitTimeoutMs: totem.fiscal.emitTimeoutMs,
    creditEnabled: totem.payments.credit,
    debitEnabled: totem.payments.debit,
    pixEnabled: totem.payments.pix,
    tefBaseUrl: totem.integrations.tefBaseUrl,
    pixBaseUrl: totem.integrations.pixBaseUrl,
    establishmentCnpj: totem.integrations.establishmentCnpj,
    nfceServiceApiKey: KEEP_SECRET,
    tefApiKey: KEEP_SECRET,
    aditumPartnerToken: KEEP_SECRET,
    aditumActivationCode: KEEP_SECRET,
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

/** `true` quando o rascunho pede produção, por qualquer um dos dois caminhos. */
export function wantsProduction(draft: TotemDraft): boolean {
  return draft.mode === "production" || draft.nfceEnvironment === 1;
}

/**
 * A recusa, quando houver. É a única regra que impede gravar — as demais
 * diferenças entre rascunho e realidade viram aviso na tela.
 */
export function rejectionFor(draft: TotemDraft, license: TotemLicense | null): string | null {
  if (wantsProduction(draft) && isDemoLicense(license)) return DEMO_BLOCK_MESSAGE;
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

/** As colunas não-secretas do UPDATE, já normalizadas. */
export function toColumns(draft: TotemDraft): Record<string, unknown> {
  const columns: Record<string, unknown> = {
    totem_name: draft.name.trim(),
    is_active: draft.isActive,
    nfce_environment: nfceEnvironment(draft.nfceEnvironment),
    nfce_serie: draft.nfceSerie,
    nfce_service_url: urlOrNull(draft.nfceServiceUrl),
    nfce_emit_timeout_ms: emitTimeout(draft.nfceEmitTimeoutMs),
    payment_credit_enabled: draft.creditEnabled,
    payment_debit_enabled: draft.debitEnabled,
    payment_pix_enabled: draft.pixEnabled,
    tef_http_base_url: urlOrNull(draft.tefBaseUrl),
    pix_http_base_url: urlOrNull(draft.pixBaseUrl),
    establishment_cnpj: textOrNull(draft.establishmentCnpj),
  };

  const mode = MODE_TO_COLUMN[draft.mode];
  if (mode !== null) columns.app_mode = mode;

  return columns;
}
