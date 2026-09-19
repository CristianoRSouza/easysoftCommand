import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createContainer, type Container } from "@/composition/container";
import { useTenant } from "@/shared/tenant/tenant-context";
import { StorePicker } from "@/shared/tenant/StorePicker";

const ContainerContext = createContext<Container | null>(null);

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center px-4">{children}</div>;
}

/**
 * Monta o container e o disponibiliza à árvore.
 *
 * `createContainer` lança quando falta loja no modo nuvem — e isso aconteceria
 * durante a renderização, derrubando a aplicação inteira numa tela branca. Aqui
 * a falha é capturada e vira uma mensagem que diz o que aconteceu.
 */
export function ContainerProvider({ children }: { children: ReactNode }) {
  const { tenant, loading, error, companies } = useTenant();

  const result = useMemo<{ container: Container } | { error: string } | null>(() => {
    if (loading) return null;
    if (error) return { error };
    if (!tenant) return null;
    try {
      return { container: createContainer(tenant) };
    } catch (cause) {
      return {
        error: cause instanceof Error ? cause.message : "Não foi possível iniciar a aplicação.",
      };
    }
  }, [tenant, loading, error]);

  // Sem loja escolhida, mas com opções: quem decide é a pessoa. Um
  // administrador do sistema enxerga centenas de empresas, e abrir uma delas
  // por conta própria mostraria dados de uma loja qualquer.
  if (!loading && !error && !tenant) {
    return (
      <Centered>
        <div className="glass-panel w-full max-w-md space-y-5 rounded-lg p-8 shadow-elegant">
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight">Escolha a loja</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {companies.length === 0
                ? "Nenhuma empresa está liberada para este usuário. Peça acesso ao administrador."
                : "O painel mostra os dados de uma loja por vez."}
            </p>
          </div>
          {companies.length > 0 && <StorePicker />}
        </div>
      </Centered>
    );
  }

  if (result === null) {
    return (
      <Centered>
        <p className="text-muted-foreground">Carregando...</p>
      </Centered>
    );
  }

  if ("error" in result) {
    return (
      <Centered>
        <div className="glass-panel max-w-md rounded-lg border-destructive/40 bg-destructive/10 px-5 py-4 text-center shadow-elegant">
          <p className="font-medium text-destructive">Não foi possível carregar os dados</p>
          <p className="mt-1 text-sm text-muted-foreground">{result.error}</p>
        </div>
      </Centered>
    );
  }

  return <ContainerContext.Provider value={result.container}>{children}</ContainerContext.Provider>;
}

export function useContainer(): Container {
  const context = useContext(ContainerContext);
  if (!context) throw new Error("useContainer precisa estar dentro de ContainerProvider.");
  return context;
}
