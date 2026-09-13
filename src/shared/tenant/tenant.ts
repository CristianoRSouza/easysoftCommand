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

/**
 * Porta de resolução do tenant.
 *
 * Descobrir a que empresa e loja um usuário tem acesso é uma consulta ao banco,
 * não um dado do token — por isso é uma porta, e não uma função pura.
 */
export interface TenantResolver {
  resolve(userId: string): Promise<Tenant | null>;
}
