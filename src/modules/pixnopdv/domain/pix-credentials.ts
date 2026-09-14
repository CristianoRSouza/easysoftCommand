/**
 * Credenciais do PIXnoPDV — o provedor que gera os QR Codes de pagamento.
 *
 * Como no emitente e nos totens, os segredos ficam no banco e esta camada só
 * carrega a informação de que existem. A view da nuvem já entrega assim
 * (`*_set`), o que confirma que a regra é do sistema, não desta tela.
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
