import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createContainer, type Container } from "@/composition/container";
import { useTenant } from "@/shared/tenant/tenant-context";

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
  const { tenant, loading, error } = useTenant();

  const result = useMemo<{ container: Container } | { error: string } | null>(() => {
    if (loading) return null;
    if (error) return { error };
    try {
      return { container: createContainer(tenant) };
    } catch (cause) {
      return {
        error: cause instanceof Error ? cause.message : "Não foi possível iniciar a aplicação.",
      };
    }
  }, [tenant, loading, error]);

  if (result === null) {
    return <Centered><p className="text-ink-muted">Carregando…</p></Centered>;
  }

  if ("error" in result) {
    return (
      <Centered>
        <div className="max-w-md rounded-xl border border-danger/40 bg-danger/10 px-5 py-4 text-center">
          <p className="font-medium text-danger">Não foi possível carregar os dados</p>
          <p className="mt-1 text-sm text-ink-muted">{result.error}</p>
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
