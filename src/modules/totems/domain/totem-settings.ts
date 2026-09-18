/**
 * As configurações do totem que o painel edita, agrupadas como a tela as
 * mostra.
 *
 * São muitas — o equipamento faz venda, emite nota, fala com a maquininha,
 * imprime e busca imagem de produto. Agrupá-las por assunto é o que evita o
 * formulário de sessenta campos em fila única, onde ninguém acha nada.
 */

/** Ambiente de PIX e TEF. Em homologação o dinheiro não é real. */
export type PaymentEnvironment = "homologacao" | "producao";

export const PAYMENT_ENVIRONMENT_LABEL: Record<PaymentEnvironment, string> = {
  homologacao: "Homologação",
  producao: "Produção",
};

export function toPaymentEnvironment(value: unknown): PaymentEnvironment {
  return value === "producao" ? "producao" : "homologacao";
}

/**
 * Quem paga os juros do parcelado.
 *
 * `Merchant` é o lojista absorvendo; `Issuer` é o cliente pagando ao emissor
 * do cartão. Escolher errado muda quanto entra no caixa.
 */
export type InstallmentType = "Merchant" | "Issuer";

export const INSTALLMENT_TYPE_LABEL: Record<InstallmentType, string> = {
  Merchant: "Lojista absorve os juros",
  Issuer: "Emissor cobra do cliente",
};

export function toInstallmentType(value: unknown): InstallmentType {
  return value === "Issuer" ? "Issuer" : "Merchant";
}

/** Runtime do TEF da Aditum — os tempos e o comportamento da maquininha. */
export interface TefRuntime {
  baseUrl: string | null;
  insecureTls: boolean;
  applicationName: string;
  applicationVersion: string;
  contactless: boolean;
  pollIntervalMs: number;
  pollMaxMs: number;
  installmentType: InstallmentType;
  confirmAfterCharge: boolean;
  /** Status que o totem pode reivindicar, separados por vírgula. */
  claimSourceStatuses: string;
  workerPendingJob: boolean;
}

export const TEF_RUNTIME_DEFAULTS: TefRuntime = {
  baseUrl: null,
  insecureTls: false,
  applicationName: "EasySoft PDV",
  applicationVersion: "1.0.0",
  contactless: false,
  pollIntervalMs: 600,
  pollMaxMs: 180_000,
  installmentType: "Merchant",
  confirmAfterCharge: true,
  claimSourceStatuses: "pending,tef_requested",
  workerPendingJob: false,
};

/** De onde o totem busca as fotos dos produtos. */
export interface ImageServer {
  host: string;
  port: number;
}

export const IMAGE_SERVER_DEFAULTS: ImageServer = { host: "127.0.0.1", port: 3001 };

/** A impressora de comprovante acoplada ao totem. */
export interface PrinterSettings {
  enabled: boolean;
  model: string;
  port: string;
  codePage: number;
  columns: number;
  cutPaper: boolean;
  cutType: number;
  translateTags: boolean;
  ignoreTags: boolean;
  verify: boolean;
  lineFeedAfter: number;
  copies: number;
  timeoutMs: number;
}

export const PRINTER_DEFAULTS: PrinterSettings = {
  enabled: false,
  model: "0",
  port: "",
  codePage: 2,
  columns: 64,
  cutPaper: true,
  cutType: 0,
  translateTags: true,
  ignoreTags: false,
  verify: false,
  lineFeedAfter: 3,
  copies: 1,
  timeoutMs: 3500,
};
