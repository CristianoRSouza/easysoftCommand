import type { NfceIssuer } from "../domain/nfce-issuer";
import type { IssuerDraft } from "../domain/issuer-draft";

/**
 * Porta de acesso ao emitente.
 *
 * Os segredos de integração não passam por aqui: eles vivem no banco da loja,
 * cifrados, e a nuvem não os guarda. Esta porta alcança o cadastro — que é o
 * que a NFC-e assina.
 */
export interface IssuerRepository {
  /** `null` quando a loja ainda não tem emitente configurado. */
  get(): Promise<NfceIssuer | null>;

  /** Grava o cadastro e devolve o emitente relido do banco. */
  update(draft: IssuerDraft): Promise<NfceIssuer>;
}
