import { asBoolean, asIsoDate, asText } from "@/shared/infrastructure/convert";
import type { PixCredentials } from "../domain/pix-credentials";

type Row = Record<string, unknown>;

export const PIX_COLUMNS =
  "environment, api_base_url, basic_user, basic_token_set, secret_key_set, insecure_tls, enabled, updated_at";

export function toPixCredentials(row: Row): PixCredentials {
  return {
    environment: asText(row.environment) ?? "producao",
    apiBaseUrl: asText(row.api_base_url),
    basicUser: asText(row.basic_user),
    basicTokenSet: asBoolean(row.basic_token_set),
    secretKeySet: asBoolean(row.secret_key_set),
    insecureTls: asBoolean(row.insecure_tls),
    enabled: asBoolean(row.enabled),
    updatedAt: row.updated_at == null ? null : asIsoDate(row.updated_at),
  };
}
