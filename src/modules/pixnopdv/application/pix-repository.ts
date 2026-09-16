import type { PixCredentials, PixCredentialsDraft } from "../domain/pix-credentials";

export interface PixRepository {
  /** `null` quando a loja nunca configurou o PIXnoPDV. */
  get(): Promise<PixCredentials | null>;

  /** Grava e devolve o estado resultante, relido do banco. */
  save(draft: PixCredentialsDraft): Promise<PixCredentials>;
}
