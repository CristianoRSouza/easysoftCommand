import { useState, type FormEvent } from "react";
import { CircleCheck, LinkIcon, ShieldCheck } from "lucide-react";
import { useSession } from "./auth-context";
import { FIELD } from "@/shared/ui/primitives";

/** O mesmo mínimo que o sistema em produção exige. */
const MIN_LENGTH = 8;

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-panel w-full max-w-sm space-y-5 rounded-lg p-8 shadow-elegant">
        {children}
      </div>
    </div>
  );
}

/**
 * Definir a senha nova, depois de chegar pelo link do e-mail.
 *
 * O link já abriu uma sessão. Esta tela existe para que ela não seja usada
 * antes da senha ser trocada: quem recebeu o e-mail precisa terminar o que
 * começou, e o painel só aparece depois.
 */
export function ResetPasswordPage() {
  const { recovery, updatePassword, finishRecovery } = useSession();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  if (recovery === "invalid") {
    return (
      <Moldura>
        <div className="space-y-2 text-center">
          <LinkIcon size={30} className="mx-auto text-destructive" />
          <h1 className="font-heading text-lg font-bold">Link inválido ou expirado</h1>
          <p className="text-sm text-muted-foreground">
            O link de recuperação vale uma única vez e por tempo limitado. Peça um novo na tela de
            acesso, em "Esqueci a senha".
          </p>
        </div>
        <button
          onClick={finishRecovery}
          className="w-full rounded-lg bg-gradient-primary py-2 font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Voltar para o acesso
        </button>
      </Moldura>
    );
  }

  if (concluido) {
    return (
      <Moldura>
        <div className="space-y-2 text-center">
          <CircleCheck size={30} className="mx-auto text-success" />
          <h1 className="font-heading text-lg font-bold">Senha alterada</h1>
          <p className="text-sm text-muted-foreground">
            A partir de agora, use a senha nova para entrar.
          </p>
        </div>
        <button
          onClick={finishRecovery}
          className="w-full rounded-lg bg-gradient-primary py-2 font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Entrar no painel
        </button>
      </Moldura>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    if (senha.length < MIN_LENGTH) {
      setErro(`A senha precisa ter pelo menos ${MIN_LENGTH} caracteres.`);
      return;
    }
    if (senha !== confirmacao) {
      setErro("As duas senhas não são iguais.");
      return;
    }
    setSalvando(true);
    try {
      await updatePassword(senha);
      setConcluido(true);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível salvar a senha.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="glass-panel w-full max-w-sm space-y-5 rounded-lg p-8 shadow-elegant"
      >
        <div>
          <h1 className="flex items-center gap-2 font-heading text-xl font-bold tracking-tight">
            <ShieldCheck size={20} className="text-primary" /> Nova senha
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Defina a sua nova senha de acesso.</p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm text-muted-foreground">Nova senha</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className={`${FIELD} w-full`}
          />
          <span className="block text-xs text-muted-foreground">
            Pelo menos {MIN_LENGTH} caracteres.
          </span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm text-muted-foreground">Repita a senha</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            className={`${FIELD} w-full`}
          />
        </label>

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <button
          type="submit"
          disabled={salvando}
          className="w-full rounded-lg bg-gradient-primary py-2 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {salvando ? "Salvando..." : "Salvar senha"}
        </button>
      </form>
    </div>
  );
}
