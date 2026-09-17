/**
 * O link de recuperação de senha, como ele chega do e-mail.
 *
 * Quem envia o e-mail é a função `send-recovery-email` (EasyMail), e o link
 * aponta para `/reset-password?token_hash=...&type=recovery`. O token vem na
 * query, não no hash — e por isso não depende da rota: o painel usa rotas no
 * hash, e o link precisa funcionar antes de qualquer rota existir.
 */
export interface RecoveryLink {
  tokenHash: string;
}

export function readRecoveryLink(location: Pick<Location, "search">): RecoveryLink | null {
  const params = new URLSearchParams(location.search);
  const tokenHash = params.get("token_hash");
  if (params.get("type") !== "recovery" || !tokenHash) return null;
  return { tokenHash };
}

/**
 * Tira o token da barra de endereço.
 *
 * O token vale uma vez, mas continua na URL até alguém removê-lo — e URL vai
 * para histórico, favoritos, captura de tela e cabeçalho `Referer`.
 */
export function clearRecoveryLink(): void {
  window.history.replaceState({}, document.title, "/");
}
