import type { NfceDetail } from "./nfce-detail";

/**
 * Correção manual de uma NFC-e rejeitada.
 *
 * Quando a SEFAZ recusa uma nota por erro de classificação fiscal, a venda já
 * aconteceu e o dinheiro já entrou — falta o documento. A correção permite
 * ajustar os campos que causaram a recusa e reenviar.
 *
 * O que NÃO se pode corrigir é o valor. Uma nota que sai com total diferente do
 * que o cliente pagou deixa de ser correção e vira outra venda. Por isso os
 * campos editáveis são apenas os de classificação: NCM, CFOP, CEST e CST/CSOSN.
 * Nenhum deles participa do cálculo do total.
 */

/** Só uma nota em revisão manual pode ser corrigida. */
export const EDITABLE_STATUS = "manual_review";

export function canCorrect(detail: NfceDetail): boolean {
  return detail.note.status === EDITABLE_STATUS;
}

/** Campos de classificação fiscal de um item. */
export interface ItemCorrection {
  sequence: number;
  ncm: string;
  cfop: string;
  cest: string;
  /** CST (2 dígitos) no Regime Normal, CSOSN (3 dígitos) no Simples Nacional. */
  icmsCode: string;
}

export interface PaymentCorrection {
  sequence: number;
  /** Código de dois dígitos da forma de pagamento. `01` é dinheiro. */
  method: string;
  value: number;
  change: number;
}

export interface RecipientCorrection {
  cpf: string;
  cnpj: string;
  name: string;
  email: string;
}

export interface CorrectionDraft {
  items: ItemCorrection[];
  payments: PaymentCorrection[];
  recipient: RecipientCorrection;
  additionalInfo: string;
}

// ---------------------------------------------------------------------------
// Regime tributário
// ---------------------------------------------------------------------------

/** Simples Nacional (1) e Simples Nacional com excesso (2) usam CSOSN. */
export function usesCsosn(taxRegimeCode: number | null): boolean {
  return taxRegimeCode === 1 || taxRegimeCode === 2;
}

/** Regime Normal (3) usa CST. */
export function usesCst(taxRegimeCode: number | null): boolean {
  return taxRegimeCode === 3;
}

const CSOSN_PERMITIDOS = new Set([
  "101", "102", "103", "201", "202", "203", "300", "400", "500", "900",
]);

const CST_PERMITIDOS = new Set([
  "00", "10", "20", "30", "40", "41", "50", "51", "60", "70", "90",
]);

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

export interface CorrectionError {
  /** Identifica onde o erro está, para a tela destacar o campo certo. */
  where: string;
  message: string;
}

/** Deixa só os dígitos e corta no tamanho — é como o campo chega ao XML. */
export function digitsOnly(value: string, maxLength: number): string {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

/**
 * Contexto fiscal necessário para validar.
 *
 * O CFOP correto depende de a operação ser interna ou interestadual, e o
 * código de ICMS depende do regime do emitente. Nenhuma dessas coisas está no
 * item — vêm da nota.
 */
export interface FiscalContext {
  taxRegimeCode: number | null;
  issuerUf: string;
  recipientUf: string;
}

function validateItem(item: ItemCorrection, context: FiscalContext): CorrectionError[] {
  const errors: CorrectionError[] = [];
  const where = `item-${item.sequence}`;
  const ncm = digitsOnly(item.ncm, 8);
  const cfop = digitsOnly(item.cfop, 4);
  const icms = digitsOnly(item.icmsCode, 4);

  if (ncm.length !== 8) {
    errors.push({ where, message: `Item ${item.sequence}: o NCM precisa ter 8 dígitos.` });
  }

  if (cfop.length !== 4) {
    errors.push({ where, message: `Item ${item.sequence}: o CFOP precisa ter 4 dígitos.` });
  } else if (cfop[0] !== "5" && cfop[0] !== "6") {
    // NFC-e é sempre saída: 5xxx dentro do estado, 6xxx para fora.
    errors.push({
      where,
      message: `Item ${item.sequence}: CFOP de NFC-e começa com 5 ou 6 (operação de saída).`,
    });
  } else if (context.issuerUf && context.recipientUf) {
    const interna = context.issuerUf === context.recipientUf;
    if (interna && cfop[0] !== "5") {
      errors.push({
        where,
        message: `Item ${item.sequence}: operação dentro de ${context.issuerUf} usa CFOP 5xxx.`,
      });
    }
    if (!interna && cfop[0] !== "6") {
      errors.push({
        where,
        message: `Item ${item.sequence}: operação de ${context.issuerUf} para ${context.recipientUf} usa CFOP 6xxx.`,
      });
    }
  }

  if (usesCsosn(context.taxRegimeCode)) {
    if (icms.length !== 3) {
      errors.push({
        where,
        message: `Item ${item.sequence}: no Simples Nacional o código é CSOSN, com 3 dígitos.`,
      });
    } else if (!CSOSN_PERMITIDOS.has(icms)) {
      errors.push({ where, message: `Item ${item.sequence}: CSOSN ${icms} não é aceito.` });
    }
  } else if (usesCst(context.taxRegimeCode)) {
    if (icms.length !== 2) {
      errors.push({
        where,
        message: `Item ${item.sequence}: no Regime Normal o código é CST, com 2 dígitos.`,
      });
    } else if (!CST_PERMITIDOS.has(icms)) {
      errors.push({ where, message: `Item ${item.sequence}: CST ${icms} não é aceito.` });
    }
  } else if (icms.length < 2 || icms.length > 4) {
    errors.push({ where, message: `Item ${item.sequence}: código de ICMS inválido.` });
  }

  return errors;
}

const DINHEIRO = "01";

function validatePayment(payment: PaymentCorrection): CorrectionError[] {
  const errors: CorrectionError[] = [];
  const where = `pagamento-${payment.sequence}`;
  const method = digitsOnly(payment.method, 2);

  if (method.length !== 2) {
    errors.push({ where, message: `Pagamento ${payment.sequence}: forma inválida.` });
  }
  if (!Number.isFinite(payment.value) || payment.value < 0) {
    errors.push({ where, message: `Pagamento ${payment.sequence}: valor inválido.` });
  }
  if (!Number.isFinite(payment.change) || payment.change < 0) {
    errors.push({ where, message: `Pagamento ${payment.sequence}: troco inválido.` });
  }
  if (payment.change > payment.value + TOLERANCIA) {
    errors.push({
      where,
      message: `Pagamento ${payment.sequence}: o troco não pode ser maior que o valor.`,
    });
  }
  // Troco só existe em dinheiro. Cartão não devolve diferença.
  if (method !== DINHEIRO && payment.change > TOLERANCIA) {
    errors.push({
      where,
      message: `Pagamento ${payment.sequence}: troco só se aplica a dinheiro.`,
    });
  }

  return errors;
}

/** Centavos são exatos; a folga existe só para erro de ponto flutuante. */
export const TOLERANCIA = 0.0001;

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** O que efetivamente entrou no caixa: soma dos pagamentos menos o troco. */
export function received(payments: PaymentCorrection[]): number {
  return round2(payments.reduce((total, p) => total + p.value - p.change, 0));
}

/**
 * Valida a correção inteira.
 *
 * Todas as regras vêm do projeto anterior — nenhuma foi inventada aqui. A
 * diferença é que elas rodam **antes** de qualquer gravação, e não depois.
 */
export function validateCorrection(
  draft: CorrectionDraft,
  detail: NfceDetail,
  context: FiscalContext,
): CorrectionError[] {
  const errors: CorrectionError[] = [];

  if (!canCorrect(detail)) {
    errors.push({
      where: "nota",
      message: "A correção só é permitida para nota em revisão manual.",
    });
    // Sem isso as demais mensagens seriam ruído: a nota nem pode ser tocada.
    return errors;
  }

  for (const item of draft.items) errors.push(...validateItem(item, context));
  for (const payment of draft.payments) errors.push(...validatePayment(payment));

  // Os pagamentos precisam cobrir a nota. Menos que isso é venda sem lastro.
  const recebido = received(draft.payments);
  if (recebido + TOLERANCIA < detail.totals.note) {
    errors.push({
      where: "pagamentos",
      message:
        `Os pagamentos somam ${recebido.toFixed(2)} menos o troco, e o total da nota é ` +
        `${detail.totals.note.toFixed(2)}. A soma não pode ser menor que o total.`,
    });
  }

  return errors;
}

/**
 * Normaliza o rascunho para o formato que vai ao banco.
 *
 * Os campos fiscais só aceitam dígitos; deixar a máscara passar faria o XML
 * sair inválido e a nota ser rejeitada de novo — pelo mesmo motivo.
 */
export function normalizeCorrection(draft: CorrectionDraft): CorrectionDraft {
  return {
    items: draft.items.map((item) => ({
      sequence: item.sequence,
      ncm: digitsOnly(item.ncm, 8),
      cfop: digitsOnly(item.cfop, 4),
      cest: digitsOnly(item.cest, 7),
      icmsCode: digitsOnly(item.icmsCode, 4),
    })),
    payments: draft.payments.map((payment) => ({
      sequence: payment.sequence,
      method: digitsOnly(payment.method, 2),
      value: round2(payment.value),
      change: round2(payment.change),
    })),
    recipient: {
      cpf: digitsOnly(draft.recipient.cpf, 11),
      cnpj: digitsOnly(draft.recipient.cnpj, 14),
      name: draft.recipient.name.trim().slice(0, 60),
      email: draft.recipient.email.trim().slice(0, 60),
    },
    additionalInfo: draft.additionalInfo.trim(),
  };
}

/** Monta o rascunho inicial a partir da nota carregada. */
export function draftFrom(detail: NfceDetail, icmsCodes: Map<number, string>): CorrectionDraft {
  return {
    items: detail.items.map((item) => ({
      sequence: item.sequence,
      ncm: item.ncm,
      cfop: item.cfop,
      cest: "",
      icmsCode: icmsCodes.get(item.sequence) ?? "",
    })),
    payments: detail.payments.map((payment) => ({
      sequence: payment.sequence,
      method: payment.method,
      value: payment.amount,
      change: payment.change,
    })),
    recipient: {
      cpf: detail.recipient?.document?.length === 11 ? detail.recipient.document : "",
      cnpj: detail.recipient?.document?.length === 14 ? detail.recipient.document : "",
      name: detail.recipient?.name ?? "",
      email: detail.recipient?.email ?? "",
    },
    additionalInfo: "",
  };
}
