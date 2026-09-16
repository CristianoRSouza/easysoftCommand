import type { NfceDetail } from "./nfce-detail";

/**
 * Correção manual de uma NFC-e rejeitada.
 *
 * O painel não corrige nota, e isso é um limite real, não uma tela faltando:
 * corrigir significa reenviar o documento à SEFAZ, e quem fala com a SEFAZ é o
 * serviço fiscal que roda na loja. A nuvem recebe as notas prontas.
 *
 * O que sobra aqui é reconhecer o estado, para a tela poder dizer que a nota
 * está parada esperando correção — que é a informação que faz alguém agir.
 *
 * As regras fiscais da correção (NCM, CFOP por UF, CST/CSOSN por regime,
 * troco só em dinheiro) estão em `docs/specs/correcao-manual-nfce.md`, junto
 * com o que falta no servidor para habilitar a operação.
 */

/** Só uma nota em revisão manual pode ser corrigida. */
export const EDITABLE_STATUS = "manual_review";

export function canCorrect(detail: NfceDetail): boolean {
  return detail.note.status === EDITABLE_STATUS;
}
