import { useState, type FormEvent } from "react";
import { ArrowLeft, MailCheck } from "lucide-react";
import { supabase } from "@/shared/supabase/client";
import { FIELD } from "@/shared/ui/primitives";

/**
 * Recuperação de senha.
 *
 * Fala direto com o Supabase Auth, sem passar por repositório: não é dado de
 * negócio, é autenticação — e a conta existe na nuvem mesmo quando o painel
 * roda local.
 */
export function RecoverPasswordPage({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}${window.location.pathname}#/redefinir-senha`,
      });
      if (error) throw new Error(error.message);
      setEnviado(true);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível enviar o e-mail.");
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass-panel w-full max-w-sm space-y-4 rounded-lg p-8 text-center shadow-elegant">
          <MailCheck size={32} className="mx-auto text-success" />
          <div>
            <h1 className="font-heading text-lg font-bold">Verifique seu e-mail</h1>
            {/* Não confirma se o endereço existe: dizer "e-mail não cadastrado"
                entregaria a estranhos quais contas existem no sistema. */}
            <p className="mt-2 text-sm text-muted-foreground">
              Se houver uma conta para <span className="text-foreground">{email}</span>, o link de
              redefinição chegará em instantes.
            </p>
          </div>
          <button onClick={onBack} className="text-sm text-primary hover:underline">
            Voltar para o acesso
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="glass-panel w-full max-w-sm space-y-5 rounded-lg p-8 shadow-elegant"
      >
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight">Recuperar senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enviaremos um link para você definir uma nova senha.
          </p>
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

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg bg-gradient-primary py-2 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {enviando ? "Enviando..." : "Enviar link"}
        </button>

        <button
          type="button"
          onClick={onBack}
          className="flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={15} /> Voltar para o acesso
        </button>
      </form>
    </div>
  );
}
