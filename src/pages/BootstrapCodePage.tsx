import { useState, type FormEvent } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { supabase } from "@/shared/supabase/client";
import { formatDateTime } from "@/shared/ui/format";
import { FIELD, PageHeader, Panel } from "@/shared/ui/primitives";

interface Codigo {
  code: string;
  email: string;
  expiresAt: string;
}

/**
 * Código de primeiro acesso.
 *
 * Gera um código assinado pela nuvem para um operador definir a senha no PDV.
 * A autorização é decidida no servidor — quem não for administrador da loja
 * recebe recusa da função, e é assim que deve ser: permissão conferida no
 * cliente é sugestão, não controle.
 */
export function BootstrapCodePage() {
  const [email, setEmail] = useState("");
  const [gerando, setGerando] = useState(false);
  const [codigo, setCodigo] = useState<Codigo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function gerar(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setCodigo(null);
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("issue-bootstrap-code", {
        body: { email: email.trim() },
      });
      if (error) throw new Error(error.message);
      const resposta = data as Partial<Codigo> | null;
      if (!resposta?.code) throw new Error("A função não devolveu um código.");
      setCodigo({
        code: resposta.code,
        email: resposta.email ?? email.trim(),
        expiresAt: resposta.expiresAt ?? "",
      });
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível gerar o código.");
    } finally {
      setGerando(false);
    }
  }

  async function copiar() {
    if (!codigo) return;
    await navigator.clipboard.writeText(codigo.code);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }


  return (
    <div className="space-y-5">
      <PageHeader title="Código de primeiro acesso" />

      <Panel className="max-w-lg p-5">
        <form onSubmit={gerar} className="space-y-4">
          <div>
            <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
              <KeyRound size={17} className="text-primary" /> Gerar código
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              O operador usa este código uma única vez, no PDV, para definir a própria senha.
            </p>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm text-muted-foreground">E-mail do operador</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${FIELD} w-full`}
            />
          </label>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <button
            type="submit"
            disabled={gerando}
            className="rounded-lg bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {gerando ? "Gerando..." : "Gerar código"}
          </button>
        </form>

        {codigo && (
          <div className="mt-5 border-t border-border/60 pt-5">
            <p className="text-xs text-muted-foreground">Código para {codigo.email}</p>
            <div className="mt-2 flex items-center gap-3">
              <code className="flex-1 rounded-lg border border-border bg-background px-4 py-3 font-mono text-lg tracking-widest">
                {codigo.code}
              </code>
              <button
                onClick={() => void copiar()}
                className="rounded-lg border border-border p-3 transition-colors hover:bg-secondary"
                title="Copiar"
              >
                {copiado ? <Check size={17} className="text-success" /> : <Copy size={17} />}
              </button>
            </div>
            {codigo.expiresAt && (
              <p className="mt-2 text-xs text-muted-foreground">
                Válido até {formatDateTime(codigo.expiresAt)}.
              </p>
            )}
            <p className="mt-3 text-xs text-warning">
              Entregue o código pessoalmente ou por canal seguro. Ele permite definir a senha de
              acesso ao PDV.
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}
