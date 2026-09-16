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

/**
 * O que fazer com um segredo que a tela não mostra.
 *
 * Quem edita a tela não vê o token atual, então um campo vazio é ambíguo:
 * pode significar "não mexi" ou "quero apagar". O projeto anterior resolvia
 * isso pela presença da chave no objeto enviado — uma diferença invisível
 * entre `{}` e `{ basic_token: null }`, fácil de errar sem perceber.
 *
 * Aqui a intenção é declarada.
 */
export type SecretEdit =
  | { readonly action: "keep" }
  | { readonly action: "clear" }
  | { readonly action: "set"; readonly value: string };

export const KEEP_SECRET: SecretEdit = { action: "keep" };

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

function textoOuNulo(value: string | null | undefined): string | null {
  if (value == null) return null;
  const limpo = value.trim();
  return limpo === "" ? null : limpo;
}

/** URL sem barras no fim, para não gerar `.../api//cobranca` ao concatenar. */
function urlOuNulo(value: string | null | undefined): string | null {
  const limpo = textoOuNulo(value);
  return limpo ? limpo.replace(/\/+$/, "") : null;
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
    api_base_url: urlOuNulo(draft.apiBaseUrl),
    basic_user: textoOuNulo(draft.basicUser),
    insecure_tls: draft.insecureTls,
    enabled: draft.enabled,
  };
}

/**
 * Traduz a intenção em valor de coluna. `undefined` significa "não incluir no
 * UPDATE" — é o que preserva o segredo atual sem precisar lê-lo.
 */
export function secretToColumn(edit: SecretEdit): string | null | undefined {
  if (edit.action === "keep") return undefined;
  if (edit.action === "clear") return null;
  return textoOuNulo(edit.value);
}
