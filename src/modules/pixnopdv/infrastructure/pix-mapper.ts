import { asBoolean, asIsoDate, asText } from "@/shared/infrastructure/convert";
import type { PixCredentials } from "../domain/pix-credentials";

type Row = Record<string, unknown>;

/**
 * Se cada segredo está preenchido — apurado por contagem no banco, não lido da
 * linha. `basic_token_set` e `secret_key_set` não são colunas: o projeto
 * anterior os montava no código, e pedi-los ao PostgREST derruba a consulta
 * inteira com `column ... does not exist`.
 */
export interface SecretsPresence {
  basicTokenSet: boolean;
  secretKeySet: boolean;
}

export function toPixCredentials(row: Row, secrets: SecretsPresence): PixCredentials {
  return {
    environment: asText(row.environment) ?? "producao",
    apiBaseUrl: asText(row.api_base_url),
    basicUser: asText(row.basic_user),
    basicTokenSet: secrets.basicTokenSet,
    secretKeySet: secrets.secretKeySet,
    insecureTls: asBoolean(row.insecure_tls),
    enabled: asBoolean(row.enabled),
    updatedAt: row.updated_at == null ? null : asIsoDate(row.updated_at),
  };
}
