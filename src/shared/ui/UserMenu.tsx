import { useEffect, useRef, useState } from "react";
import { KeyRound, LogOut, User } from "lucide-react";
import { useSession } from "@/shared/auth/auth-context";

type Envio = "parado" | "enviando" | "enviado" | "falhou";

/**
 * Quem está logado, e as duas coisas que se faz com a própria conta: pedir
 * uma senha nova por e-mail e sair.
 */
export function UserMenu() {
  const { session, signOut, requestPasswordReset } = useSession();
  const [aberto, setAberto] = useState(false);
  const [envio, setEnvio] = useState<Envio>("parado");
  const raiz = useRef<HTMLDivElement>(null);
  const email = session?.user.email ?? null;

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  async function redefinir() {
    if (!email) return;
    setEnvio("enviando");
    try {
      await requestPasswordReset(email);
      setEnvio("enviado");
    } catch {
      setEnvio("falhou");
    }
  }

  const rotuloDoEnvio: Record<Envio, string> = {
    parado: "Redefinir senha",
    enviando: "Enviando…",
    enviado: "E-mail enviado — veja sua caixa de entrada",
    falhou: "Não foi possível enviar. Tente de novo",
  };

  return (
    <div ref={raiz} className="relative">
      <button
        onClick={() => {
          setAberto((a) => !a);
          setEnvio("parado");
        }}
        aria-label="Perfil"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <User size={15} />
      </button>

      {aberto && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-popover p-1 shadow-elegant">
          <div className="px-3 py-2">
            <p className="text-sm font-medium">Perfil</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
          <div className="my-1 h-px bg-border" />
          <button
            onClick={() => void redefinir()}
            disabled={envio === "enviando" || envio === "enviado"}
            className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-secondary disabled:hover:bg-transparent ${
              envio === "falhou" ? "text-destructive" : envio === "enviado" ? "text-success" : ""
            }`}
          >
            <KeyRound size={15} className="shrink-0" />
            {rotuloDoEnvio[envio]}
          </button>
          <button
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
          >
            <LogOut size={15} className="shrink-0" />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
