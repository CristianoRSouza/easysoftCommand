import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  CreditCard,
  Ruler,
  FileText,
  Building2,
  TrendingUp,
  Monitor,
  ScrollText,
  QrCode,
  Cpu,
  CloudUpload,
  Wand2,
  KeyRound,
  Landmark,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import {
  canIssueBootstrapCodes,
  canViewAuditLogs,
  type AccessProfile,
} from "@/shared/access/access";
import { useAccess } from "@/shared/access/access-context";

interface Item {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Quando existe, o item só aparece para quem o perfil permite. */
  requires?: (profile: AccessProfile) => boolean;
}

/**
 * Navegação agrupada, como no projeto anterior. Cada grupo só aparece quando
 * tem item — nada de seção vazia esperando módulo que ainda não existe.
 */
const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Visão Geral",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/receitas", label: "Receitas", icon: TrendingUp },
    ],
  },
  {
    title: "Operação",
    items: [
      { to: "/comandas", label: "Comandas", icon: ClipboardList },
      { to: "/transacoes", label: "Transações", icon: CreditCard },
      { to: "/nfce", label: "NFC-e", icon: FileText },
    ],
  },
  {
    title: "Cadastros",
    items: [
      { to: "/produtos", label: "Produtos", icon: Package },
      { to: "/unidades", label: "Unidades", icon: Ruler },
      { to: "/emitente", label: "Emitente NFC-e", icon: Building2 },
      { to: "/reforma-tributaria", label: "Reforma tributária", icon: Landmark },
    ],
  },
  {
    title: "Infra / Serviços",
    items: [
      { to: "/totens", label: "Totens", icon: Monitor },
      { to: "/fila-nuvem", label: "Fila da nuvem", icon: CloudUpload },
      { to: "/agentes", label: "Agentes de Serviço", icon: Cpu },
      { to: "/pixnopdv", label: "PIXnoPDV", icon: QrCode },
      { to: "/auditoria", label: "Auditoria", icon: ScrollText, requires: canViewAuditLogs },
    ],
  },
  {
    title: "Ajuda",
    items: [
      { to: "/assistente", label: "Assistente", icon: Wand2 },
      {
        to: "/primeiro-acesso",
        label: "Primeiro acesso",
        icon: KeyRound,
        requires: canIssueBootstrapCodes,
      },
      { to: "/manual", label: "Manual", icon: BookOpen },
    ],
  },
];

export function Sidebar() {
  const { profile } = useAccess();

  // Grupo sem item visível não aparece — um título sozinho faria a pessoa
  // procurar o que foi escondido dela.
  const grupos = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.requires || item.requires(profile)),
  })).filter((group) => group.items.length > 0);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="px-5 py-5">
        <h1 className="font-heading text-lg font-bold tracking-tight text-sidebar-foreground">
          Easy<span className="text-primary">Command</span>
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">Admin</p>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {grupos.map((group) => (
          <div key={group.title}>
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </p>
            <ul className="space-y-1">
              {group.items.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === "/"}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? "bg-sidebar-accent font-medium text-primary"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      }`
                    }
                  >
                    <Icon size={18} className="shrink-0" />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
