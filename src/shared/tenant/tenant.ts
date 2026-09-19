import type { AccessProfile } from "@/shared/access/access";

/**
 * Empresa e loja em que a aplicação está operando.
 *
 * Toda leitura no Supabase é filtrada por `storeId`. Os nomes existem para que
 * a interface possa dizer ao usuário qual loja ele está vendo — mostrar dados
 * sem dizer de onde vêm é como o painel acaba enganando quem olha.
 */
export interface Tenant {
  companyId: string;
  companyName: string;
  storeId: string;
  storeName: string;
}

export interface CompanyOption {
  id: string;
  name: string;
  cnpj: string | null;
}

export interface StoreOption {
  id: string;
  companyId: string;
  name: string;
  code: string | null;
  /** Loja que abre sozinha quando nenhuma foi escolhida antes. */
  isDefault: boolean;
}

/**
 * Quem vê todas as lojas da empresa.
 *
 * Administrador do sistema e administrador da empresa. Usuário comum vê
 * apenas as lojas liberadas para ele — e **não** todas quando não tem nenhuma
 * liberada: a ausência de liberação é ausência de acesso, não acesso total.
 * Uma versão anterior deste projeto invertia isso e dava mais do que o
 * sistema em produção dá.
 */
export function seesAllStores(profile: AccessProfile): boolean {
  return profile.isSystemAdmin || profile.isCompanyAdmin;
}

/**
 * Qual empresa abrir.
 *
 * A escolhida antes, se ainda for válida; senão, a única que existe. Com mais
 * de uma e nenhuma escolha, ninguém escolhe pelo usuário: abrir a primeira da
 * lista em ordem alfabética mostraria os dados de uma empresa aleatória para
 * um administrador que cuida de centenas.
 */
export function resolveCompany(companies: CompanyOption[], stored: string | null): string | null {
  if (stored && companies.some((c) => c.id === stored)) return stored;
  if (companies.length === 1) return companies[0]?.id ?? null;
  return null;
}

/** Qual loja abrir — na mesma ordem de preferência do sistema em produção. */
export function resolveStore(
  stores: StoreOption[],
  current: string | null,
  stored: string | null,
): string | null {
  const valida = (id: string | null) => id !== null && stores.some((s) => s.id === id);
  if (valida(current)) return current;
  if (valida(stored)) return stored;
  if (stores.length === 1) return stores[0]?.id ?? null;
  return stores.find((s) => s.isDefault)?.id ?? null;
}

/**
 * Porta das listas de empresas e lojas.
 *
 * Quem pode ver o quê é consulta ao banco, não dado do token — o acesso pode
 * mudar sem o token mudar.
 */
export interface TenantDirectory {
  companies(userId: string, profile: AccessProfile): Promise<CompanyOption[]>;
  stores(userId: string, companyId: string, profile: AccessProfile): Promise<StoreOption[]>;
}
