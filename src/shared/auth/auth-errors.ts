/**
 * Mensagens do Supabase Auth em português.
 *
 * Só as que as telas de acesso e de senha podem receber. O restante cai na
 * mensagem genérica de cada operação: repassar texto técnico em inglês não
 * ajuda quem está tentando entrar.
 */
const TRADUCOES: Array<[RegExp, string]> = [
  [/rate limit|too many requests/i, "Muitas tentativas. Aguarde alguns minutos e tente de novo."],
  [/should be different/i, "A nova senha precisa ser diferente da anterior."],
  [/password should be at least|weak password|too weak/i, "Senha fraca. Use pelo menos 8 caracteres."],
  [/expired|invalid.*token|token.*(invalid|not found)|otp/i, "Link inválido ou expirado. Peça um novo e-mail de recuperação."],
];

export function translateAuthError(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  return TRADUCOES.find(([padrao]) => padrao.test(raw))?.[1] ?? fallback;
}
