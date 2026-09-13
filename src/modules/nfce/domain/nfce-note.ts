import type { DateRange } from "@/shared/domain/paging";

/**
 * NFC-e — Nota Fiscal de Consumidor eletrônica.
 *
 * Documento fiscal emitido a cada venda. Diferente dos outros módulos, aqui o
 * estado tem peso legal: uma nota autorizada não pode ser alterada, e o valor
 * total é imutável depois de emitida.
 */
export interface NfceNote {
  id: string;
  number: number;
  serie: number;
  accessKey: string | null;
  status: NfceStatus;
  totalValue: number;
  issuedAt: string;
  authorizedAt: string | null;
  protocol: string | null;
  sefazStatusCode: string | null;
  sefazStatusReason: string | null;
  emissionType: number | null;
  reconcileStatus: string | null;
  retryCount: number;
}

/** Os estados possíveis de uma nota, como o banco os grava. */
export type NfceStatus =
  | "authorized"
  | "rejected"
  | "cancelled"
  | "draft"
  | "unusable"
  | "inutilized"
  | "denied"
  | "sending"
  | "manual_review";

const STATUS: readonly NfceStatus[] = [
  "authorized",
  "rejected",
  "cancelled",
  "draft",
  "unusable",
  "inutilized",
  "denied",
  "sending",
  "manual_review",
];

/** Interpreta o texto do banco. Valor desconhecido vira rascunho, não quebra a tela. */
export function toNfceStatus(value: unknown): NfceStatus {
  return STATUS.includes(value as NfceStatus) ? (value as NfceStatus) : "draft";
}

export const NFCE_STATUS_LABEL: Record<NfceStatus, string> = {
  authorized: "Autorizada",
  rejected: "Rejeitada",
  cancelled: "Cancelada",
  draft: "Rascunho",
  unusable: "Inutilizável",
  inutilized: "Inutilizada",
  denied: "Denegada",
  sending: "Enviando",
  manual_review: "Revisão manual",
};

type Tone = "success" | "warning" | "destructive" | "info" | "muted";

export const NFCE_STATUS_TONE: Record<NfceStatus, Tone> = {
  authorized: "success",
  rejected: "destructive",
  denied: "destructive",
  cancelled: "muted",
  inutilized: "muted",
  unusable: "muted",
  draft: "muted",
  sending: "info",
  manual_review: "warning",
};

/**
 * Estados que exigem alguém olhar.
 *
 * Uma nota rejeitada é uma venda sem documento fiscal; em revisão manual, é uma
 * venda travada. Ambas custam dinheiro enquanto ninguém age.
 */
export const NFCE_NEEDS_ATTENTION: readonly NfceStatus[] = ["rejected", "denied", "manual_review"];

export function needsAttention(status: NfceStatus): boolean {
  return NFCE_NEEDS_ATTENTION.includes(status);
}

export type NfceStatusFilter = "all" | NfceStatus;

export interface NfceQuery {
  /** Chave de acesso, protocolo ou número da nota. */
  search: string;
  status: NfceStatusFilter;
  range: DateRange;
  page: number;
  pageSize: number;
}

export const DEFAULT_NFCE_QUERY: NfceQuery = {
  search: "",
  status: "all",
  range: { from: null, to: null },
  page: 1,
  pageSize: 50,
};

/**
 * Totais do período inteiro, não da página exibida.
 *
 * A distinção é o motivo de este tipo existir: somar as 50 linhas da tela e
 * chamar de "total do período" é um número que parece certo e está errado.
 */
export interface NfceTotals {
  /** Quantas notas casam com o filtro, ao todo. */
  count: number;
  /** Contagem por status. */
  byStatus: Record<string, number>;
  /** Soma do valor das notas autorizadas — o faturamento com documento fiscal válido. */
  authorizedAmount: number;
}
