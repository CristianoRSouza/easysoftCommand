import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/shared/auth/auth-context";
import { supabase } from "@/shared/supabase/client";
import { SupabaseTenantResolver } from "./supabase-tenant-resolver";
import type { Tenant } from "./tenant";

interface TenantState {
  tenant: Tenant | null;
  loading: boolean;
  error: string | null;
}

const TenantContext = createContext<TenantState | null>(null);

const resolver = new SupabaseTenantResolver(supabase);

/** Resolve a empresa e a loja do usuário autenticado. */
export function TenantProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const userId = session?.user.id ?? null;

  const query = useQuery<Tenant | null>({
    queryKey: ["tenant", userId],
    // A guarda vive aqui, e não numa conversão de tipo: `enabled` impede a
    // execução, mas só o `if` prova isso ao compilador.
    queryFn: async () => (userId ? resolver.resolve(userId) : null),
    enabled: userId !== null,
    staleTime: Infinity,
  });

  const state: TenantState = {
    tenant: query.data ?? null,
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
  };

  return <TenantContext.Provider value={state}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantState {
  const context = useContext(TenantContext);
  if (!context) throw new Error("useTenant precisa estar dentro de TenantProvider.");
  return context;
}
