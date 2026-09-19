import { Outlet } from "react-router-dom";
import { LogOut, Sparkles } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { useSession } from "@/shared/auth/auth-context";
import { useTenant } from "@/shared/tenant/tenant-context";
import { StorePicker } from "@/shared/tenant/StorePicker";
import { LicenseBanner } from "@/shared/plan/LicenseBanner";
import { useLicense } from "@/shared/plan/plan-context";
import { AssistantButton } from "@/modules/assistant/ui/AssistantButton";

export function AppLayout() {
  const { signOut } = useSession();
  const { tenant, companies, stores } = useTenant();
  const licenca = useLicense();
  const demonstracao = licenca.planSlug?.includes("demo") ?? false;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-end gap-3 border-b border-border/60 bg-card/50 px-5 backdrop-blur-sm">
          {/* Quem tem mais de uma loja troca aqui; quem tem uma só vê o nome dela.
              Mostrar sempre de qual loja são os dados é o que impede alguém de
              conferir o número certo na loja errada. */}
          {companies.length > 1 || stores.length > 1 ? (
            <StorePicker compact />
          ) : (
            tenant && (
              <span className="truncate text-xs text-muted-foreground" title={tenant.companyName}>
                {tenant.companyName}
                <span className="mx-1.5 text-border">/</span>
                <span className="font-medium text-foreground">{tenant.storeName}</span>
              </span>
            )
          )}

          {licenca.planName && (
            <span
              className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                demonstracao
                  ? "border-warning/40 bg-warning/10 text-warning"
                  : "border-border text-muted-foreground"
              }`}
              title={demonstracao ? "Licença de demonstração — sem plano contratado" : "Plano contratado"}
            >
              {demonstracao && <Sparkles size={11} />}
              {licenca.planName}
            </span>
          )}

          <button
            onClick={() => void signOut()}
            title="Sair"
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut size={15} />
            Sair
          </button>
        </header>

        <LicenseBanner />

        <main className="min-h-0 flex-1 overflow-auto p-6">
          <Outlet />
        </main>
        <AssistantButton />
      </div>
    </div>
  );
}
