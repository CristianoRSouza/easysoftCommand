import type { PixRepository } from "../application/pix-repository";
import type { PixCredentials } from "../domain/pix-credentials";
import type { ElectronApi } from "@/shared/runtime/electron-api";
import { toPixCredentials } from "./pix-mapper";

/**
 * No banco da loja os segredos são colunas comuns, não vêm com o sufixo `_set`
 * da view da nuvem. O `IS NOT NULL` constrói o mesmo indicador aqui, para as
 * duas fontes entregarem o mesmo `PixCredentials`.
 */
const SQL = `
  SELECT c.environment, c.api_base_url, c.basic_user,
         (c.basic_token IS NOT NULL AND c.basic_token <> '') AS basic_token_set,
         (c.secret_key  IS NOT NULL AND c.secret_key  <> '') AS secret_key_set,
         c.insecure_tls, c.enabled, c.updated_at
  FROM pixnopdv_store_credentials c
  ORDER BY c.updated_at DESC NULLS LAST
  LIMIT 1
`;

export class PostgresPixRepository implements PixRepository {
  constructor(private readonly api: ElectronApi) {}

  async get(): Promise<PixCredentials | null> {
    const result = await this.api.query<Record<string, unknown>>(SQL);
    if (!result.ok) throw new Error(`Falha ao carregar o PIXnoPDV: ${result.error}`);
    const row = result.rows[0];
    return row ? toPixCredentials(row) : null;
  }
}
