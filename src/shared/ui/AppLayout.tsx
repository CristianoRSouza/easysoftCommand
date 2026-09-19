import { useState } from "react";
import { Outlet } from "react-router-dom";
import { PanelLeft, Sparkles } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { UserMenu } from "./UserMenu";
import { ThemeToggle } from "./ThemeToggle";
import { useTenant } from "@/shared/tenant/tenant-context";
import { StorePicker } from "@/shared/tenant/StorePicker";
import { LicenseBanner } from "@/shared/plan/LicenseBanner";
import { useLicense } from "@/shared/plan/plan-context";
import { AssistantButton } from "@/modules/assistant/ui/AssistantButton";
import logoEasySoft from "@/assets/easysoft-logo.png";

const MENU_RECOLHIDO = "easycommand.menu-recolhido";

/** Preferência de quem usa este navegador; se o armazenamento falhar, o menu abre. */
function lerRecolhido(): boolean {
  try {
    return localStorage.getItem(MENU_RECOLHIDO) === "1";
  } catch {
    return false;
  }
}

export function AppLayout() {
  const { tenant, companies, stores } = useTenant();
  const licenca = useLicense();
  const demonstracao = licenca.planSlug?.includes("demo") ?? false;
  const [recolhido, setRecolhido] = useState(lerRecolhido);
  const [menuNoCelular, setMenuNoCelular] = useState(false);

  function alternarMenu() {
    // No celular o botão abre a gaveta; no computador, recolhe o menu.
    if (window.matchMedia("(max-width: 767px)").matches) {
      setMenuNoCelular((aberto) => !aberto);
      return;
    }
    setRecolhido((atual) => {
      try {
        localStorage.setItem(MENU_RECOLHIDO, atual ? "0" : "1");
      } catch {
        // Sem armazenamento, vale só até recarregar.
      }
      return !atual;
    });
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        collapsed={recolhido}
        mobileOpen={menuNoCelular}
        onCloseMobile={() => setMenuNoCelular(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border/60 bg-card/50 px-3 backdrop-blur-sm sm:px-5">
          <button
            onClick={alternarMenu}
            aria-label="Mostrar ou recolher o menu"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <PanelLeft size={16} />
          </button>
          <span className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
            Desenvolvido por
            {/* O logo tem letras brancas: no tema claro, vai sobre uma faixa escura. */}
            <img
              src={logoEasySoft}
              alt="EasySoft"
              className="h-5 rounded object-contain opacity-80 [.light_&]:bg-[hsl(222_47%_11%)] [.light_&]:px-1.5 [.light_&]:opacity-100"
            />
          </span>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
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
                className={`hidden shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium sm:flex ${
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

            <UserMenu />
            <ThemeToggle />
          </div>
        </header>

        <LicenseBanner />

        <main className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
        </main>
        <AssistantButton />
      </div>
    </div>
  );
}
