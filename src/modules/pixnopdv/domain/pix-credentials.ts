/**
 * Credenciais do PIXnoPDV — o provedor que gera os QR Codes de pagamento.
 *
 * Os segredos ficam no banco e esta camada só carrega a informação de que
 * existem. O projeto anterior descobria isso trazendo o token e a chave em
 * claro até o navegador e testando se vinham vazios; aqui a pergunta é feita
 * ao banco como filtro, e o valor nunca sai de lá.
 */
export interface PixCredentials {
  environment: string;
  apiBaseUrl: string | null;
  basicUser: string | null;
  basicTokenSet: boolean;
  secretKeySet: boolean;
  insecureTls: boolean;
  enabled: boolean;
  updatedAt: string | null;
}

/** Está pronta para operar quando ligada e com as duas credenciais gravadas. */
export function isOperational(credentials: PixCredentials): boolean {
  return credentials.enabled && credentials.basicTokenSet && credentials.secretKeySet;
}

/**
 * TLS inseguro aceita certificado inválido do provedor.
 *
 * Serve para teste em rede local; em produção abre espaço para alguém no meio
 * do caminho ler ou alterar a cobrança.
 */
export function hasInsecureTransport(credentials: PixCredentials): boolean {
  return credentials.insecureTls;
}

import { textOrNull, urlOrNull } from "@/shared/domain/text";
import type { SecretEdit } from "@/shared/domain/secret-edit";

export { KEEP_SECRET, secretToColumn, type SecretEdit } from "@/shared/domain/secret-edit";

/** O que a tela envia para gravar. */
export interface PixCredentialsDraft {
  environment: string;
  apiBaseUrl: string | null;
  basicUser: string | null;
  basicToken: SecretEdit;
  secretKey: SecretEdit;
  insecureTls: boolean;
  enabled: boolean;
}

/**
 * Os campos não-secretos, prontos para gravar.
 *
 * Normaliza o que o operador digitou sem recusar nada: o projeto anterior
 * também não recusava, e inventar uma regra de validação aqui mudaria o
 * comportamento de quem já usa a tela.
 */
export function normalizeDraft(draft: PixCredentialsDraft): {
  environment: string;
  api_base_url: string | null;
  basic_user: string | null;
  insecure_tls: boolean;
  enabled: boolean;
} {
  return {
    environment: draft.environment,
    api_base_url: urlOrNull(draft.apiBaseUrl),
    basic_user: textOrNull(draft.basicUser),
    insecure_tls: draft.insecureTls,
    enabled: draft.enabled,
  };
}
