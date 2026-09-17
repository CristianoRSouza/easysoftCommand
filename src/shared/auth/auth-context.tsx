import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/shared/supabase/client";
import { translateAuthError } from "./auth-errors";
import { clearRecoveryLink, readRecoveryLink } from "./recovery-link";

/**
 * Onde está a recuperação de senha.
 *
 * `none` é o uso normal. `ready` significa que o link foi aceito e há uma
 * sessão aberta — mas quem chegou por ele ainda não escolheu a senha nova, e
 * por isso não pode entrar no painel. `invalid` é link vencido ou já usado.
 */
export type RecoveryState = "none" | "ready" | "invalid";

interface SessionState {
  session: Session | null;
  loading: boolean;
  recovery: RecoveryState;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  finishRecovery(): void;
}

const SessionContext = createContext<SessionState | null>(null);

/** Nome do painel no cadastro da função de e-mail — define domínio e marca do link. */
const RECOVERY_APP = "manager";

type Verificacao = ReturnType<typeof supabase.auth.verifyOtp>;
let verificacaoDoLink: Verificacao | null | undefined;

/**
 * Valida o link de recuperação uma única vez por carregamento da página.
 *
 * O token é de uso único. Se o efeito que o valida rodar duas vezes — e o
 * React faz exatamente isso em desenvolvimento —, a primeira chamada consome o
 * token e a segunda falha, e a tela diria "link expirado" para um link bom.
 */
function verificarLinkUmaVez(): Verificacao | null {
  if (verificacaoDoLink !== undefined) return verificacaoDoLink;
  const link = readRecoveryLink(window.location);
  if (!link) {
    verificacaoDoLink = null;
    return null;
  }
  clearRecoveryLink();
  verificacaoDoLink = supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: "recovery" });
  return verificacaoDoLink;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState<RecoveryState>("none");

  useEffect(() => {
    let ativo = true;

    // A assinatura vem antes de qualquer chamada: o evento de recuperação pode
    // disparar durante a validação do link, e perdê-lo deixaria a pessoa
    // dentro do painel sem ter definido a senha.
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!ativo) return;
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecovery("ready");
    });

    async function iniciar() {
      const verificacao = verificarLinkUmaVez();
      if (verificacao) {
        const { data: verificado, error } = await verificacao;
        if (!ativo) return;
        setSession(verificado.session);
        setRecovery(error ? "invalid" : "ready");
      } else {
        const { data: atual } = await supabase.auth.getSession();
        if (!ativo) return;
        setSession(atual.session);
      }
      setLoading(false);
    }

    void iniciar();
    return () => {
      ativo = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<SessionState>(
    () => ({
      session,
      loading,
      recovery,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error("E-mail ou senha inválidos.");
      },
      async signOut() {
        await supabase.auth.signOut();
      },
      /**
       * Pede o e-mail de recuperação pela mesma função que o sistema em
       * produção usa. Ela responde igual exista a conta ou não — qualquer
       * diferença viraria um jeito de descobrir quais e-mails têm cadastro.
       */
      async requestPasswordReset(email) {
        const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
          "send-recovery-email",
          { body: { email: email.trim(), app: RECOVERY_APP } },
        );
        const falha = error?.message ?? (data?.ok === false ? data.error : undefined);
        if (error || data?.ok === false) {
          throw new Error(translateAuthError(falha, "Não foi possível enviar o e-mail."));
        }
      },
      async updatePassword(password) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw new Error(translateAuthError(error.message, "Não foi possível salvar a senha."));
      },
      finishRecovery() {
        setRecovery("none");
      },
    }),
    [session, loading, recovery],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession precisa estar dentro de SessionProvider.");
  return context;
}
