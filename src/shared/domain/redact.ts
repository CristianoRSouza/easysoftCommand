/**
 * Apaga segredos de um objeto antes que ele vá para algum lugar que se guarda.
 *
 * O projeto anterior decidia isso por lista de tabelas: filtrava os campos do
 * emitente e mais nada. O resultado é que a trilha de auditoria dos totens
 * gravava `nfce_service_api_key` e `tef_http_api_key` em claro, dentro de um
 * JSON que a própria tela de auditoria exibe. A chave do serviço fiscal e a do
 * TEF ficavam legíveis para qualquer um com acesso ao painel, e permanentes:
 * trocar a chave não apaga o registro de quando ela foi gravada.
 *
 * Aqui a decisão é pelo nome do campo. Um campo novo chamado `algum_token`
 * nasce protegido, sem ninguém precisar lembrar de incluí-lo numa lista — e
 * essa é a diferença que importa, porque a lista é justamente o que se esquece
 * de atualizar.
 */
const SECRET_NAME = [
  /token/i,
  /secret/i,
  /password/i,
  /senha/i,
  /api_?key/i,
  /activation_code/i,
  /certificate/i,
];

/**
 * Sufixos que descrevem um segredo sem o revelar, e por isso podem passar:
 * o texto cifrado, o indicador de presença, o identificador da chave e o
 * prefixo que serve para reconhecer qual credencial é.
 */
const SAFE_SUFFIX = [/_encrypted$/i, /_set$/i, /_kid$/i, /_prefix$/i];

export const REDACTED = "[removido]";

/** `true` quando o valor deste campo não pode ser guardado como está. */
export function isSecretField(name: string): boolean {
  if (SAFE_SUFFIX.some((suffix) => suffix.test(name))) return false;
  return SECRET_NAME.some((pattern) => pattern.test(name));
}

/**
 * O mesmo objeto, com os valores secretos trocados por um marcador.
 *
 * O marcador fica no lugar do valor em vez de o campo sumir: quem lê a
 * auditoria precisa saber que a chave mudou, mesmo sem poder ver para quê.
 */
export function redactSecrets(values: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(values)) {
    safe[name] = isSecretField(name) && value != null ? REDACTED : value;
  }
  return safe;
}
