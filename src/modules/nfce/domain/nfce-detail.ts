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
  issuer: NfceIssuer;
  recipient: NfceRecipient | null;
  totals: NfceFiscalTotals;
  items: NfceItem[];
  payments: NfcePayment[];
  history: NfceHistoryEntry[];
  /** XML autorizado, quando existe. É o documento que vale legalmente. */
  authorizedXml: string | null;
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
