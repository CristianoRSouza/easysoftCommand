import type { PixCredentials } from "../domain/pix-credentials";

export interface PixRepository {
  /** `null` quando a loja nunca configurou o PIXnoPDV. */
  get(): Promise<PixCredentials | null>;
}
