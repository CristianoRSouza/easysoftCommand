import type { ReactNode } from "react";
import { useSession } from "./auth-context";
import { LoginPage } from "./LoginPage";

/** No modo local não há login — o acesso ao banco já é a credencial. */
export function RequireSession({ children }: { children: ReactNode }) {
  const { session, loading, requiresLogin } = useSession();

  if (!requiresLogin) return <>{children}</>;
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-muted">
        Carregando…
      </div>
    );
  }
  if (!session) return <LoginPage />;
  return <>{children}</>;
}
