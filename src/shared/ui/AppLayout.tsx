import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useSession } from "@/shared/auth/auth-context";
import { useTenant } from "@/shared/tenant/tenant-context";
import { detectDataSource } from "@/shared/runtime/environment";

export function AppLayout() {
  const { signOut, requiresLogin } = useSession();
  const { tenant } = useTenant();
  const source = detectDataSource();

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center justify-end gap-4 border-b border-base-border px-5">
          {tenant && (
            <span className="truncate text-xs text-ink-muted" title={tenant.companyName}>
              {tenant.companyName} · <span className="text-ink">{tenant.storeName}</span>
            </span>
          )}
          <span className="shrink-0 rounded-full border border-base-border px-2 py-0.5 text-xs text-ink-muted">
            {source === "postgres" ? "Local · PostgreSQL" : "Nuvem · Supabase"}
          </span>
          {requiresLogin && (
            <button
              onClick={() => void signOut()}
              className="shrink-0 text-sm text-ink-muted transition hover:text-ink"
            >
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
