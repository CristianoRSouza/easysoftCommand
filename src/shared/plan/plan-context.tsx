import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/supabase/client";
import { useTenant } from "@/shared/tenant/tenant-context";
import { SupabasePlanWindowResolver } from "./supabase-plan-window-resolver";
import { UNLIMITED_WINDOW, type PlanWindow } from "./plan-window";
import { UNKNOWN_LICENSE, type LicenseStatus } from "./license";

interface PlanState {
  window: PlanWindow;
  license: LicenseStatus;
}

const PlanContext = createContext<PlanState | null>(null);

const resolver = new SupabasePlanWindowResolver(supabase);

export function PlanProvider({ children }: { children: ReactNode }) {
  const { tenant } = useTenant();
  const companyId = tenant?.companyId ?? null;

  const janela = useQuery<PlanWindow>({
    queryKey: ["plan-window", companyId],
    queryFn: async () => (companyId ? resolver.resolve(companyId) : UNLIMITED_WINDOW),
    enabled: companyId !== null,
    staleTime: 5 * 60 * 1000,
  });

  // A licença é relida ao voltar para a aba: quem renovou em outra janela não
  // deve continuar vendo a faixa de vencida.
  const licenca = useQuery<LicenseStatus>({
    queryKey: ["plan-window", "license", companyId],
    queryFn: async () => (companyId ? resolver.license(companyId) : UNKNOWN_LICENSE),
    enabled: companyId !== null,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Enquanto não se sabe o plano, nada é bloqueado. O contrário faria a tela
  // recusar o período por um instante a cada abertura.
  return (
    <PlanContext.Provider
      value={{ window: janela.data ?? UNLIMITED_WINDOW, license: licenca.data ?? UNKNOWN_LICENSE }}
    >
      {children}
    </PlanContext.Provider>
  );
}

function usePlan(): PlanState {
  const context = useContext(PlanContext);
  if (!context) throw new Error("usePlanWindow precisa estar dentro de PlanProvider.");
  return context;
}

export function usePlanWindow(): PlanWindow {
  return usePlan().window;
}

export function useLicense(): LicenseStatus {
  return usePlan().license;
}
