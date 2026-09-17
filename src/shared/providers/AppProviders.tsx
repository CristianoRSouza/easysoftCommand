import type { ComponentType, ReactNode } from "react";
import { SessionProvider } from "@/shared/auth/auth-context";
import { RequireSession } from "@/shared/auth/RequireSession";
import { AccessProvider } from "@/shared/access/access-context";
import { TenantProvider } from "@/shared/tenant/tenant-context";
import { PlanProvider } from "@/shared/plan/plan-context";
import { ContainerProvider } from "@/shared/container/container-context";

/**
 * Os provedores da aplicação, de fora para dentro. **A ordem é a regra.**
 *
 * - `SessionProvider` primeiro: tudo depende de saber quem é o usuário.
 * - `RequireSession` em seguida, e antes de qualquer consulta: é ele que
 *   segura a tela de login e a troca de senha. Nada abaixo dele roda sem
 *   sessão, o que evita consultas disparando sem usuário.
 * - `AccessProvider` decide o que aparece no menu; depende da sessão.
 * - `TenantProvider` resolve empresa e loja.
 * - `PlanProvider` depende do tenant: a janela de histórico é do plano da
 *   empresa.
 * - `ContainerProvider` por último: os repositórios recebem o tenant pronto.
 *
 * Aninhar isto à mão custava sete níveis de indentação, onde a ordem — a única
 * coisa que importa aqui — ficava escondida no meio do JSX.
 */
const PROVIDERS: ComponentType<{ children: ReactNode }>[] = [
  SessionProvider,
  RequireSession,
  AccessProvider,
  TenantProvider,
  PlanProvider,
  ContainerProvider,
];

export function AppProviders({ children }: { children: ReactNode }) {
  return PROVIDERS.reduceRight(
    (dentro, Provider) => <Provider>{dentro}</Provider>,
    children as ReactNode,
  );
}
