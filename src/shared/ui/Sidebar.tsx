import { useState } from "react";
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
  Receipt,
  Sparkles,
  Headset,
  ExternalLink,
  LoaderCircle,
  type LucideIcon,
} from "lucide-react";
import {
  canIssueBootstrapCodes,
  canViewAuditLogs,
  type AccessProfile,
} from "@/shared/access/access";
import { useAccess } from "@/shared/access/access-context";
import { openExternal, type ExternalDestination } from "@/shared/external/external-access";

interface Item {
  /** Rota do painel, ou o sistema externo que o item abre em outra aba. */
  to: string | { external: ExternalDestination };
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
      { to: { external: "billing" }, label: "Planos", icon: Receipt },
      { to: { external: "ai-credits" }, label: "Créditos IA", icon: Sparkles },
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
      { to: { external: "support" }, label: "Falar com o suporte", icon: Headset },
    ],
  },
];

const ITEM = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors";
const ITEM_INATIVO = "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground";

/**
 * O menu lateral.
 *
 * No computador ele recolhe para só os ícones, liberando espaço para as
 * tabelas largas. No celular fica escondido e abre por cima da tela, como no
 * projeto anterior — fixo com 240 px, ele ocuparia quase toda a largura.
 */
export function Sidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const { profile } = useAccess();
  const [abrindo, setAbrindo] = useState<ExternalDestination | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  async function abrir(destino: ExternalDestination) {
    if (abrindo) return;
    setAbrindo(destino);
    setFalha(null);
    try {
      await openExternal(destino);
    } catch (erro) {
      setFalha(erro instanceof Error ? erro.message : "Não foi possível abrir.");
    } finally {
      setAbrindo(null);
    }
  }

  // Grupo sem item visível não aparece — um título sozinho faria a pessoa
  // procurar o que foi escondido dela.
  const grupos = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.requires || item.requires(profile)),
  })).filter((group) => group.items.length > 0);

  function conteudo(soIcones: boolean) {
    return (
      <>
        <div className={soIcones ? "flex justify-center py-5" : "px-5 py-5"}>
          {soIcones ? (
            <span className="font-heading text-lg font-bold text-primary">E</span>
          ) : (
            <>
              <h1 className="font-heading text-lg font-bold tracking-tight text-sidebar-foreground">
                Easy<span className="text-primary">Command</span>
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">Admin</p>
            </>
          )}
        </div>

        <nav className={`flex-1 space-y-6 overflow-y-auto pb-6 ${soIcones ? "px-2" : "px-3"}`}>
          {grupos.map((group) => (
            <div key={group.title}>
              {!soIcones && (
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </p>
              )}
              <ul className="space-y-1">
                {group.items.map(({ to, label, icon: Icon }) =>
                  typeof to === "string" ? (
                    <li key={to}>
                      <NavLink
                        to={to}
                        end={to === "/"}
                        onClick={onCloseMobile}
                        title={soIcones ? label : undefined}
                        className={({ isActive }) =>
                          `${ITEM} ${soIcones ? "justify-center" : ""} ${isActive ? "bg-sidebar-accent font-medium text-primary" : ITEM_INATIVO}`
                        }
                      >
                        <Icon size={18} className="shrink-0" />
                        {!soIcones && label}
                      </NavLink>
                    </li>
                  ) : (
                    <li key={to.external}>
                      <button
                        type="button"
                        onClick={() => void abrir(to.external)}
                        disabled={abrindo !== null}
                        title={soIcones ? label : undefined}
                        className={`${ITEM} ${soIcones ? "justify-center" : ""} ${ITEM_INATIVO} disabled:opacity-60`}
                      >
                        {abrindo === to.external ? (
                          <LoaderCircle size={18} className="shrink-0 animate-spin" />
                        ) : (
                          <Icon size={18} className="shrink-0" />
                        )}
                        {!soIcones && (
                          <>
                            <span className="flex-1 text-left">{label}</span>
                            <ExternalLink size={13} className="shrink-0 opacity-60" />
                          </>
                        )}
                      </button>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
          {falha && (
            <p role="alert" className="px-3 text-xs text-destructive">
              {falha}
            </p>
          )}
        </nav>
      </>
    );
  }

  return (
    <>
      <aside
        className={`hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {conteudo(collapsed)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label="Fechar o menu"
            onClick={onCloseMobile}
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
          />
          <aside className="relative flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar shadow-2xl">
            {conteudo(false)}
          </aside>
        </div>
      )}
    </>
  );
}
