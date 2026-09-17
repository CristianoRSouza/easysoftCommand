/**
 * O que este usuário pode ver no painel.
 *
 * É trava de interface, não de dados: quem guarda o dado é o RLS do banco, e
 * as views de auditoria já devolvem zero linhas para quem não é administrador.
 * Esconder o que a pessoa não pode usar evita a tela que abre, consulta e
 * mostra "nenhum registro" — o que parece defeito e não é.
 */
export interface AccessProfile {
  isSystemAdmin: boolean;
  isCompanyAdmin: boolean;
}

/**
 * O que vale enquanto o perfil não chegou, e também quando a consulta falha.
 *
 * Na dúvida não se concede: esconder um item de menu é bem menos grave que
 * mostrar ação de administrador para quem não é.
 */
export const NO_ACCESS: AccessProfile = { isSystemAdmin: false, isCompanyAdmin: false };

/** A trilha de auditoria é de administrador do sistema. */
export function canViewAuditLogs(profile: AccessProfile): boolean {
  return profile.isSystemAdmin;
}

/**
 * Códigos de primeiro acesso: administrador do sistema ou da empresa.
 *
 * Quem decide de verdade é a função na nuvem, que recusa quem não tem
 * permissão. Aqui só se evita oferecer o que vai ser negado.
 */
export function canIssueBootstrapCodes(profile: AccessProfile): boolean {
  return profile.isSystemAdmin || profile.isCompanyAdmin;
}

/**
 * Porta de resolução do perfil.
 *
 * Como o tenant, é consulta ao banco e não dado do token — o papel pode ser
 * revogado sem que o token mude.
 */
export interface AccessResolver {
  resolve(userId: string): Promise<AccessProfile>;
}
