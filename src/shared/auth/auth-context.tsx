import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/shared/supabase/client";
import { detectDataSource } from "@/shared/runtime/environment";

interface SessionState {
  session: Session | null;
  loading: boolean;
  /** No modo local não há login: o acesso ao banco já é a credencial. */
  requiresLogin: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const requiresLogin = detectDataSource() === "supabase";
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(requiresLogin);

  useEffect(() => {
    if (!requiresLogin) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [requiresLogin]);

  const value = useMemo<SessionState>(
    () => ({
      session,
      loading,
      requiresLogin,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error("E-mail ou senha inválidos.");
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [session, loading, requiresLogin],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession precisa estar dentro de SessionProvider.");
  return context;
}
