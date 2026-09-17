import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/supabase/client";
import { useTenant } from "@/shared/tenant/tenant-context";
import { SupabasePlanWindowResolver } from "./supabase-plan-window-resolver";
import { UNLIMITED_WINDOW, type PlanWindow } from "./plan-window";

const PlanContext = createContext<PlanWindow | null>(null);

const resolver = new SupabasePlanWindowResolver(supabase);

export function PlanProvider({ children }: { children: ReactNode }) {
  const { tenant } = useTenant();
  const companyId = tenant?.companyId ?? null;

  const query = useQuery<PlanWindow>({
    queryKey: ["plan-window", companyId],
    queryFn: async () => (companyId ? resolver.resolve(companyId) : UNLIMITED_WINDOW),
    enabled: companyId !== null,
    staleTime: 5 * 60 * 1000,
  });

  // Enquanto não se sabe o plano, nada é bloqueado. O contrário faria a tela
  // recusar o período por um instante a cada abertura.
  return (
    <PlanContext.Provider value={query.data ?? UNLIMITED_WINDOW}>{children}</PlanContext.Provider>
  );
}

export function usePlanWindow(): PlanWindow {
  const context = useContext(PlanContext);
  if (!context) throw new Error("usePlanWindow precisa estar dentro de PlanProvider.");
  return context;
}
