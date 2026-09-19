import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/shared/auth/auth-context";
import { useAccess } from "@/shared/access/access-context";
import { supabase } from "@/shared/supabase/client";
import { SupabaseTenantDirectory } from "./supabase-tenant-directory";
import {
  resolveCompany,
  resolveStore,
  type CompanyOption,
  type StoreOption,
  type Tenant,
} from "./tenant";

interface TenantState {
  tenant: Tenant | null;
  loading: boolean;
  error: string | null;
  companies: CompanyOption[];
  stores: StoreOption[];
  selectedCompanyId: string | null;
  selectCompany(id: string): void;
  selectStore(id: string): void;
}

const TenantContext = createContext<TenantState | null>(null);

const directory = new SupabaseTenantDirectory(supabase);

const CHAVE_EMPRESA = "easycommand.empresa";
const CHAVE_LOJA = "easycommand.loja";

/**
 * O armazenamento do navegador pode estar indisponível (modo privado,
 * bloqueio de dados do site). Lembrar a loja escolhida é conveniência: se não
 * der, o painel pede de novo, e nada mais quebra.
 */
function lembrar(chave: string, valor: string | null) {
  try {
    if (valor) localStorage.setItem(chave, valor);
    else localStorage.removeItem(chave);
  } catch {
    /* conveniência perdida, nada mais */
  }
}

function lembrado(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

/** Consultas que não dependem da loja e sobrevivem à troca. */
const INDEPENDENTES_DA_LOJA = new Set(["access", "tenant-companies", "tenant-stores", "plan-window"]);

/** Resolve e guarda a empresa e a loja em que o painel está operando. */
export function TenantProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const { profile, loading: carregandoPerfil } = useAccess();
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? null;

  const [empresaId, setEmpresaId] = useState<string | null>(() => lembrado(CHAVE_EMPRESA));
  const [lojaId, setLojaId] = useState<string | null>(() => lembrado(CHAVE_LOJA));

  const empresas = useQuery<CompanyOption[]>({
    queryKey: ["tenant-companies", userId, profile.isSystemAdmin],
    queryFn: () => directory.companies(userId as string, profile),
    enabled: userId !== null && !carregandoPerfil,
    staleTime: 10 * 60 * 1000,
  });

  const empresaResolvida = empresas.data ? resolveCompany(empresas.data, empresaId) : null;

  const lojas = useQuery<StoreOption[]>({
    queryKey: ["tenant-stores", userId, empresaResolvida, profile.isCompanyAdmin, profile.isSystemAdmin],
    queryFn: () => directory.stores(userId as string, empresaResolvida as string, profile),
    enabled: userId !== null && empresaResolvida !== null && !carregandoPerfil,
    staleTime: 10 * 60 * 1000,
  });

  const lojaResolvida = lojas.data ? resolveStore(lojas.data, lojaId, lembrado(CHAVE_LOJA)) : null;

  // A escolha resolvida vira a lembrada — inclusive quando deixa de valer.
  useEffect(() => {
    if (empresas.data) lembrar(CHAVE_EMPRESA, empresaResolvida);
  }, [empresas.data, empresaResolvida]);

  useEffect(() => {
    if (lojas.data) lembrar(CHAVE_LOJA, lojaResolvida);
  }, [lojas.data, lojaResolvida]);

  /**
   * Trocar de loja apaga o que foi lido da anterior.
   *
   * As consultas guardadas em memória são identificadas pelo filtro, não pela
   * loja: sem limpar, a tela de Receitas da loja nova mostraria por um
   * instante — ou até recarregar — o faturamento da loja de antes.
   */
  function esquecerDadosDaLoja() {
    queryClient.removeQueries({
      predicate: (query) => !INDEPENDENTES_DA_LOJA.has(String(query.queryKey[0])),
    });
  }

  function selectCompany(id: string) {
    if (id === empresaResolvida) return;
    esquecerDadosDaLoja();
    setEmpresaId(id);
    setLojaId(null);
    lembrar(CHAVE_LOJA, null);
  }

  function selectStore(id: string) {
    if (id === lojaResolvida) return;
    esquecerDadosDaLoja();
    setLojaId(id);
    lembrar(CHAVE_LOJA, id);
  }

  const empresa = empresas.data?.find((c) => c.id === empresaResolvida) ?? null;
  const loja = lojas.data?.find((s) => s.id === lojaResolvida) ?? null;

  const tenant: Tenant | null =
    empresa && loja
      ? { companyId: empresa.id, companyName: empresa.name, storeId: loja.id, storeName: loja.name }
      : null;

  const falha = empresas.error ?? lojas.error;

  const state: TenantState = {
    tenant,
    loading:
      carregandoPerfil || empresas.isPending || (empresaResolvida !== null && lojas.isPending),
    error: falha instanceof Error ? falha.message : null,
    companies: empresas.data ?? [],
    stores: lojas.data ?? [],
    selectedCompanyId: empresaResolvida,
    selectCompany,
    selectStore,
  };

  return <TenantContext.Provider value={state}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantState {
  const context = useContext(TenantContext);
  if (!context) throw new Error("useTenant precisa estar dentro de TenantProvider.");
  return context;
}
