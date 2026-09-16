import type { ReactNode } from "react";
import { useSession } from "./auth-context";
import { LoginPage } from "./LoginPage";

export function RequireSession({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }
  if (!session) return <LoginPage />;
  return <>{children}</>;
}
