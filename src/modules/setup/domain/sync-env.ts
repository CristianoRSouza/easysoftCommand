/**
 * O arquivo `.env` do Sync-Service, montado a partir do que quem instala
 * preenche.
 *
 * As chaves e os valores fixos são os que o assistente do projeto anterior
 * gerava. O `.env.example` do painel tem outras (`FB_WIRE_CRYPT`,
 * `IMAGE_SERVER_*`), mas aquele arquivo é do painel, não do serviço — e
 * `FB_WIRE_CRYPT=DISABLED` contradiria o passo que manda ativar o WireCrypt.
 */
export interface SyncEnvFields {
  fbHost: string;
  fbPort: string;
  fbDatabase: string;
  fbMediaDatabase: string;
  fbUser: string;
  fbPassword: string;
  pgHost: string;
  pgPort: string;
  pgDatabase: string;
  pgUser: string;
  pgPassword: string;
  serverIp: string;
}

/** Os valores de fábrica de cada programa, como no projeto anterior. */
export const DEFAULT_SYNC_ENV: SyncEnvFields = {
  fbHost: "localhost",
  fbPort: "3050",
  fbDatabase: "",
  fbMediaDatabase: "",
  fbUser: "SYSDBA",
  fbPassword: "masterkey",
  pgHost: "localhost",
  pgPort: "5432",
  pgDatabase: "easycommandpay",
  pgUser: "postgres",
  pgPassword: "",
  serverIp: "192.168.0.100",
};

/**
 * Senha entre aspas: sem elas, um `#` na senha vira começo de comentário e o
 * serviço lê só o pedaço antes dele. Nada é escapado dentro — o `dotenv` não
 * desfaz escapes em aspas duplas, e uma barra dobrada mudaria a senha.
 */
function entreAspas(valor: string): string {
  return `"${valor}"`;
}

export function buildSyncEnv(campos: SyncEnvFields): string {
  return [
    "# Firebird",
    `FB_HOST=${campos.fbHost}`,
    `FB_PORT=${campos.fbPort}`,
    `FB_DATABASE=${campos.fbDatabase}`,
    `FB_MEDIA_DATABASE=${campos.fbMediaDatabase}`,
    `FB_USER=${campos.fbUser}`,
    `FB_PASSWORD=${entreAspas(campos.fbPassword)}`,
    "",
    "# PostgreSQL",
    `PG_HOST=${campos.pgHost}`,
    `PG_PORT=${campos.pgPort}`,
    `PG_DATABASE=${campos.pgDatabase}`,
    `PG_USER=${campos.pgUser}`,
    `PG_PASSWORD=${entreAspas(campos.pgPassword)}`,
    "",
    "# Servidor",
    `SERVER_IP=${campos.serverIp}`,
    "PORT=3001",
    "SYNC_INTERVAL=60000",
  ].join("\n");
}

/**
 * Os caminhos dos bancos, lidos do IBConfig.INI do ERP.
 *
 * A chave é casada no começo da linha. Procurar `Path=` em qualquer lugar,
 * como o projeto anterior fazia, pegaria também uma `DataPath=` que aparecesse
 * antes no arquivo.
 */
export function parseIbConfig(texto: string): { database: string | null; mediaDatabase: string | null } {
  const valor = (chave: string) =>
    texto.match(new RegExp(`^\\s*${chave}\\s*=(.*)$`, "im"))?.[1]?.trim() || null;
  return { database: valor("Path"), mediaDatabase: valor("Path_Midia") };
}
