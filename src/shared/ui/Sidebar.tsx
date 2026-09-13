import { NavLink } from "react-router-dom";
import { LayoutDashboard, Package } from "lucide-react";

const ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/produtos", label: "Produtos", icon: Package },
] as const;

export function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-base-border bg-base-raised">
      <div className="px-5 py-5">
        <h1 className="text-lg font-semibold">EasyCommand</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                isActive ? "bg-accent/15 text-accent" : "text-ink-muted hover:bg-base hover:text-ink"
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
