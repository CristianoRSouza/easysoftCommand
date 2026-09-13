import { useState, type FormEvent } from "react";
import { useSession } from "./auth-context";
import { FIELD } from "@/shared/ui/primitives";

export function LoginPage() {
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível entrar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="glass-panel w-full max-w-sm space-y-5 rounded-lg p-8 shadow-elegant"
      >
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight">
            Easy<span className="text-primary">Command</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Acesse para gerenciar a loja.</p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm text-muted-foreground">E-mail</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${FIELD} w-full`}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm text-muted-foreground">Senha</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${FIELD} w-full`}
          />
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-gradient-primary py-2 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
