import { Outlet } from "react-router-dom";
import { Cloud, LogOut, Server } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { useSession } from "@/shared/auth/auth-context";
import { useTenant } from "@/shared/tenant/tenant-context";
import { detectDataSource } from "@/shared/runtime/environment";

export function AppLayout() {
  const { signOut, requiresLogin } = useSession();
  const { tenant } = useTenant();
  const isLocal = detectDataSource() === "postgres";
  const ModeIcon = isLocal ? Server : Cloud;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-end gap-3 border-b border-border/60 bg-card/50 px-5 backdrop-blur-sm">
          {tenant && (
            <span className="truncate text-xs text-muted-foreground" title={tenant.companyName}>
              {tenant.companyName}
              <span className="mx-1.5 text-border">/</span>
              <span className="font-medium text-foreground">{tenant.storeName}</span>
            </span>
          )}

          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-card px-2.5 py-1 text-xs text-muted-foreground">
            <ModeIcon size={13} className="text-primary" />
            {isLocal ? "Local · PostgreSQL" : "Nuvem · Supabase"}
          </span>

          {requiresLogin && (
            <button
              onClick={() => void signOut()}
              title="Sair"
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LogOut size={15} />
              Sair
            </button>
          )}
        </header>

        <main className="min-h-0 flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
