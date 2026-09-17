import type { ReactNode } from "react";
import { useSession } from "./auth-context";
import { LoginPage } from "./LoginPage";
import { ResetPasswordPage } from "./ResetPasswordPage";

export function RequireSession({ children }: { children: ReactNode }) {
  const { session, loading, recovery } = useSession();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }
  // Antes da sessão: o link de recuperação abre uma sessão válida, e sem esta
  // ordem quem chegasse por ele entraria no painel sem trocar a senha.
  if (recovery !== "none") return <ResetPasswordPage />;
  if (!session) return <LoginPage />;
  return <>{children}</>;
}
