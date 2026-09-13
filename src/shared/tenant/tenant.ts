/** Empresa e loja selecionadas. Toda leitura no Supabase é filtrada por `storeId`. */
export interface Tenant {
  companyId: string;
  storeId: string;
}
