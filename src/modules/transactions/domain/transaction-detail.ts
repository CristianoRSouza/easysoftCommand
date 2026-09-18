import type { Transaction } from "./transaction";

/**
 * O detalhe técnico de um pagamento.
 *
 * É o que se olha quando o cliente diz que pagou e a venda não fechou. Nada
 * aqui é para o dia a dia: são os dados que a operadora e o provedor de PIX
 * devolveram, guardados exatamente como vieram.
 */
export interface TransactionDetail {
  transaction: Transaction;
  tefTransactionId: string | null;
  /** Comandas que este pagamento fechou. */
  orderIds: string[];
  tef: TefSnapshot | null;
  pix: PixTracking | null;
}

/**
 * O retorno do TEF, como veio.
 *
 * As vias são guardadas linha por linha porque é assim que a impressora as
 * recebe — juntar num texto só perderia a quebra que o cliente vê no papel.
 */
export interface TefSnapshot {
  merchantReceipt: string[];
  cardholderReceipt: string[];
  /** A resposta crua da operadora, para quando nada mais explica. */
  authorizationResponse: unknown;
}

/** `true` quando há algo de fato para mostrar do TEF. */
export function hasTefData(tef: TefSnapshot | null): tef is TefSnapshot {
  if (!tef) return false;
  return (
    tef.merchantReceipt.length > 0 ||
    tef.cardholderReceipt.length > 0 ||
    tef.authorizationResponse != null
  );
}

/**
 * O acompanhamento de uma cobrança PIX.
 *
 * `lastPollAt` é a última vez que o sistema perguntou ao provedor se o
 * pagamento entrou. Uma cobrança sem `paidAt` e com consulta antiga é o caso
 * em que o dinheiro pode ter caído e ninguém percebeu.
 */
export interface PixTracking {
  status: string | null;
  qrcodeId: string | null;
  txid: string | null;
  endToEndId: string | null;
  paidAt: string | null;
  lastPollAt: string | null;
  providerUrl: string | null;
}

export function hasPixData(pix: PixTracking | null): pix is PixTracking {
  if (!pix) return false;
  return Boolean(pix.status || pix.txid || pix.qrcodeId || pix.paidAt);
}

/** As vias do TEF em texto, para copiar ou conferir com o papel. */
export function receiptToText(lines: string[]): string {
  return lines.join("\n");
}
