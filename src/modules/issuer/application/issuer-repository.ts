import type { NfceIssuer } from "../domain/nfce-issuer";

/**
 * Porta de acesso ao emitente.
 *
 * Só leitura nesta etapa. Quando a escrita entrar, os segredos de integração
 * precisarão passar pela cifra `enc:v1:` antes de chegar ao banco — nunca por
 * este caminho.
 */
export interface IssuerRepository {
  /** `null` quando a loja ainda não tem emitente configurado. */
  get(): Promise<NfceIssuer | null>;
}
