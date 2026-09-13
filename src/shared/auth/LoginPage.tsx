import { useState, type FormEvent } from "react";
import { useSession } from "./auth-context";

const FIELD =
  "w-full rounded-lg border border-base-border bg-base px-3 py-2 outline-none focus:border-accent";

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
        className="w-full max-w-sm space-y-5 rounded-xl border border-base-border bg-base-raised p-8"
      >
        <div>
          <h1 className="text-xl font-semibold">EasyCommand</h1>
          <p className="mt-1 text-sm text-ink-muted">Acesse para gerenciar a loja.</p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm text-ink-muted">E-mail</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm text-ink-muted">Senha</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={FIELD}
          />
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-accent py-2 font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
        >
          {submitting ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
