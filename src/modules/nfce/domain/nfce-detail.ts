import type { NfceNote } from "./nfce-note";

/**
 * Detalhe completo de uma nota.
 *
 * Modelado como partes compostas, e não como um tipo único de noventa campos
 * espelhando as colunas do banco. Quem lê "emitente" ou "totais" entende o que
 * é sem precisar do dicionário de dados.
 */
export interface NfceDetail {
  note: NfceNote;
  identification: NfceIdentification | null;
  issuer: NfceIssuer;
  recipient: NfceRecipient | null;
  totals: NfceFiscalTotals;
  taxReform: TaxReformTotals;
  items: NfceItem[];
  payments: NfcePayment[];
  history: NfceHistoryEntry[];
  recovery: NfceRecovery;
  documents: NfceDocuments;
  /** Informação complementar impressa na nota (`infCpl`). */
  additionalInfo: string | null;
  /** Dados de tributos no campo próprio (`infAdFisco`). */
  taxInfo: string | null;
}

/**
 * Como a nota foi emitida.
 *
 * São os campos que explicam por que uma nota saiu diferente da outra: o
 * ambiente diz se ela vale fiscalmente, o tipo de emissão diz se saiu em
 * contingência, e a finalidade distingue uma nota normal de uma substituta.
 */
export interface NfceIdentification {
  model: string | null;
  operationNature: string | null;
  /** 1 = produção, 2 = homologação. Em homologação a nota não vale. */
  environment: number | null;
  emissionType: number | null;
  emissionPurpose: number | null;
  finalConsumer: number | null;
  presence: number | null;
  intermediary: number | null;
  danfePrintType: number | null;
  emissionProcess: number | null;
  processVersion: string | null;
}

/** 1 = normal; qualquer outro valor significa emissão em contingência. */
export function isContingency(identification: NfceIdentification | null): boolean {
  return identification?.emissionType != null && identification.emissionType !== 1;
}

/**
 * Totais de IBS, CBS e Imposto Seletivo — os tributos da reforma.
 *
 * Ficam separados dos totais antigos de propósito: são regimes diferentes
 * convivendo na mesma nota, e somá-los num número só esconderia qual imposto
 * é qual.
 */
export interface TaxReformTotals {
  base: number;
  ibs: number;
  ibsState: number;
  ibsCity: number;
  cbs: number;
  /** Total da nota no novo regime (`vNFTot`). */
  noteTotal: number;
}

/** `true` quando a reforma já incide sobre esta nota. */
export function hasTaxReform(totals: TaxReformTotals): boolean {
  return totals.base > 0 || totals.ibs > 0 || totals.cbs > 0 || totals.noteTotal > 0;
}

/**
 * O que aconteceu depois da recusa.
 *
 * É o bloco que responde à pergunta de quem está esperando a nota sair: ela
 * vai tentar de novo, quando, e o que deu errado da última vez.
 */
export interface NfceRecovery {
  reconcileStatus: string | null;
  retryCount: number;
  lastRetryAt: string | null;
  nextRetryAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  manualFixRequiredAt: string | null;
  manualFixNote: string | null;
  cancellationProtocol: string | null;
  cancelledAt: string | null;
  /** Quando esta nota substitui outra, ou foi substituída. */
  originNoteId: string | null;
  replacementNoteId: string | null;
}

/**
 * Os XMLs da nota.
 *
 * O autorizado é o documento que vale legalmente; o de cancelamento vale junto
 * com ele quando a nota foi cancelada. Assinado e gerado servem para
 * investigar uma recusa — mostram o que foi enviado, não o que foi aceito.
 */
export interface NfceDocuments {
  authorized: string | null;
  cancellation: string | null;
  signed: string | null;
  generated: string | null;
  qrcode: string | null;
  queryUrl: string | null;
}

export interface NfceIssuer {
  cnpj: string;
  companyName: string;
  tradeName: string | null;
  stateRegistration: string | null;
  address: string | null;
  city: string | null;
  uf: string;
}

export interface NfceRecipient {
  document: string | null;
  name: string | null;
  email: string | null;
}

/**
 * Totais fiscais.
 *
 * `products` é a soma dos itens antes de descontos e acréscimos; `note` é o
 * que o consumidor pagou. Os dois divergirem é normal — confundi-los, não.
 */
export interface NfceFiscalTotals {
  products: number;
  discount: number;
  freight: number;
  insurance: number;
  otherExpenses: number;
  note: number;
  icms: number;
  pis: number;
  cofins: number;
  /** Tributos aproximados, o valor exigido pela Lei da Transparência. */
  approximateTaxes: number;
}

export interface NfceItem {
  sequence: number;
  productCode: string;
  description: string;
  ncm: string;
  cfop: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  grossValue: number;
  discount: number;
  icmsValue: number;
}

export interface NfcePayment {
  sequence: number;
  method: string;
  methodDescription: string | null;
  amount: number;
  change: number;
  cardBrand: string | null;
  authorizationNsu: string | null;
}

/**
 * Uma entrada do histórico da nota.
 *
 * Reúne registros e eventos numa linha do tempo só: para quem investiga por que
 * uma nota foi rejeitada, a separação entre as duas tabelas não ajuda.
 */
export interface NfceHistoryEntry {
  id: string;
  at: string;
  kind: "log" | "event";
  level: string;
  message: string;
  returnCode: string | null;
  protocol: string | null;
}

/** Soma dos itens, para conferir com o total declarado na nota. */
export function sumItems(items: NfceItem[]): number {
  return items.reduce((total, item) => total + item.grossValue - item.discount, 0);
}

/** Soma dos pagamentos menos o troco — o que de fato entrou no caixa. */
export function sumPayments(payments: NfcePayment[]): number {
  return payments.reduce((total, payment) => total + payment.amount - payment.change, 0);
}

/**
 * Diferença entre o total da nota e a soma dos itens.
 *
 * Existe porque essa é a conferência que denuncia nota inconsistente. No
 * projeto anterior, a regra correspondente impedia que uma correção manual
 * alterasse o valor total — a checagem aqui é a versão só de leitura dela.
 */
export function itemsMismatch(detail: NfceDetail): number {
  return Number((detail.totals.note - sumItems(detail.items)).toFixed(2));
}
