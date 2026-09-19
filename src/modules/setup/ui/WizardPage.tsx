import { useState, type ChangeEvent, type ReactNode } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  ExternalLink,
  TriangleAlert,
} from "lucide-react";
import {
  buildSyncEnv,
  DEFAULT_SYNC_ENV,
  parseIbConfig,
  type SyncEnvFields,
} from "../domain/sync-env";
import { FIELD, PageHeader, Panel } from "@/shared/ui/primitives";

/**
 * Assistente de instalação do Sync-Service.
 *
 * Não grava nada: o serviço roda em outra máquina, sob outro programa. O
 * assistente guia a instalação e gera o `.env` para quem instala copiar — o
 * limite honesto do que o painel alcança.
 */
const PASSOS = [
  "Pré-requisitos",
  "Bancos de dados",
  "Conexões",
  "Configurar o Firebird",
  "Instalar e testar",
  "Serviço do Windows",
  "Conferência",
];

const PRE_REQUISITOS = [
  { nome: "Node.js 20+ LTS", link: "https://nodejs.org/", uso: "Executa o Sync-Service" },
  { nome: "Firebird 3.0+", link: "https://firebirdsql.org/", uso: "Banco de dados do ERP" },
  {
    nome: "PostgreSQL 14+",
    link: "https://www.postgresql.org/download/",
    uso: "Banco de dados principal",
  },
];

const REPOSITORIO = "https://github.com/NeanderEasySoft/easy-command-pay.git";
const REINICIAR_FIREBIRD =
  "net stop FirebirdServerDefaultInstance && net start FirebirdServerDefaultInstance";

const CONFERENCIA = [
  "Node.js instalado",
  "PostgreSQL rodando",
  "Firebird configurado (Srp e WireCrypt)",
  "Arquivo .env salvo na pasta do serviço",
  "npm install executado",
  "Teste de conexão com sucesso",
  "Serviço do Windows instalado",
  "Portas 3001 e 5432 liberadas",
];

function BotaoCopiar({ texto, rotulo }: { texto: string; rotulo?: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }
  return (
    <button
      type="button"
      onClick={() => void copiar()}
      title="Copiar"
      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
    >
      {copiado ? <Check size={15} className="text-success" /> : <Copy size={15} />}
      {rotulo && (copiado ? "Copiado" : rotulo)}
    </button>
  );
}

/** Um comando para colar no terminal, com o botão de copiar ao lado. */
function Comando({ rotulo, comando }: { rotulo?: string; comando: string }) {
  return (
    <div>
      {rotulo && <p className="mb-1 text-sm">{rotulo}</p>}
      <div className="flex items-start gap-2">
        <pre className="flex-1 overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-xs">
          {comando}
        </pre>
        <BotaoCopiar texto={comando} />
      </div>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${FIELD} w-full ${mono ? "font-mono" : ""}`}
      />
    </label>
  );
}

function Quadro({ children, tom }: { children: ReactNode; tom?: "warning" | "primary" }) {
  const cor =
    tom === "warning"
      ? "border-warning/40 bg-warning/10"
      : tom === "primary"
        ? "border-primary/30 bg-primary/5"
        : "border-border bg-secondary/30";
  return <div className={`rounded-lg border p-4 ${cor}`}>{children}</div>;
}

const Caminho = ({ children }: { children: ReactNode }) => (
  <code className="rounded bg-secondary px-1 font-mono text-xs">{children}</code>
);

export function WizardPage() {
  const [passo, setPasso] = useState(0);
  const [campos, setCampos] = useState<SyncEnvFields>(DEFAULT_SYNC_ENV);
  const [leituraIni, setLeituraIni] = useState<string | null>(null);

  const set = (chave: keyof SyncEnvFields) => (valor: string) =>
    setCampos((c) => ({ ...c, [chave]: valor }));

  async function carregarIni(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    const { database, mediaDatabase } = parseIbConfig(await arquivo.text());
    setCampos((c) => ({
      ...c,
      fbDatabase: database ?? c.fbDatabase,
      fbMediaDatabase: mediaDatabase ?? c.fbMediaDatabase,
    }));
    // Dizer o que não foi achado evita que a pessoa siga com um campo vazio
    // achando que o arquivo resolveu tudo.
    setLeituraIni(
      database && mediaDatabase
        ? "Os dois caminhos foram preenchidos a partir do arquivo."
        : database
          ? "Banco principal preenchido. O arquivo não tem o caminho do banco de mídias (Path_Midia)."
          : "O arquivo não tem a linha Path=. Confira se é o IBConfig.INI do ERP.",
    );
  }

  const env = buildSyncEnv(campos);

  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader title="Assistente de instalação" />

      <ol className="flex flex-wrap gap-2">
        {PASSOS.map((titulo, i) => (
          <li key={titulo}>
            <button
              onClick={() => setPasso(i)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                i === passo
                  ? "border-primary bg-primary/10 text-primary"
                  : i < passo
                    ? "border-success/30 text-success"
                    : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {i + 1}. {titulo}
            </button>
          </li>
        ))}
      </ol>

      <Panel className="space-y-4 p-5">
        <h2 className="font-heading text-base font-semibold">{PASSOS[passo]}</h2>

        {passo === 0 && (
          <>
            <p className="text-sm text-muted-foreground">
              Confira se estes programas estão instalados no servidor da loja:
            </p>
            <ul className="space-y-2">
              {PRE_REQUISITOS.map((item) => (
                <li
                  key={item.nome}
                  className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-3"
                >
                  <Circle size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{item.nome}</span>
                    <span className="block text-xs text-muted-foreground">{item.uso}</span>
                  </span>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    Baixar <ExternalLink size={12} />
                  </a>
                </li>
              ))}
            </ul>
            <Quadro tom="primary">
              <p className="mb-2 text-sm font-semibold">Sync-Service</p>
              <Comando rotulo="Baixe o repositório:" comando={`git clone ${REPOSITORIO}`} />
              <p className="mt-2 text-xs text-muted-foreground">
                Extraia para <Caminho>C:\EasyCommandPay\sync-service</Caminho>
              </p>
            </Quadro>
          </>
        )}

        {passo === 1 && (
          <>
            <p className="text-sm text-muted-foreground">
              Informe onde estão os bancos Firebird do ERP. O IBConfig.INI já tem esses caminhos.
            </p>
            <Quadro>
              <p className="mb-1 text-sm font-medium">Carregar o IBConfig.INI</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Costuma ficar em <Caminho>C:\Users\Public\EasySoft\Executaveis\IBConfig.INI</Caminho>
              </p>
              <input
                type="file"
                accept=".ini,.INI"
                onChange={(e) => void carregarIni(e)}
                className="text-sm file:mr-3 file:rounded-lg file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:text-foreground"
              />
              {leituraIni && <p className="mt-2 text-xs text-muted-foreground">{leituraIni}</p>}
            </Quadro>
            <Campo
              label="Banco principal (FB_DATABASE)"
              value={campos.fbDatabase}
              onChange={set("fbDatabase")}
              placeholder="C:\caminho\NOVOBANCO.FDB"
              mono
            />
            <Campo
              label="Banco de mídias (FB_MEDIA_DATABASE)"
              value={campos.fbMediaDatabase}
              onChange={set("fbMediaDatabase")}
              placeholder="C:\caminho\MIDIAS.FDB"
              mono
            />
          </>
        )}

        {passo === 2 && (
          <>
            <h3 className="text-sm font-semibold">Firebird</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Servidor" value={campos.fbHost} onChange={set("fbHost")} />
              <Campo label="Porta" value={campos.fbPort} onChange={set("fbPort")} />
              <Campo label="Usuário" value={campos.fbUser} onChange={set("fbUser")} />
              <Campo
                label="Senha"
                type="password"
                value={campos.fbPassword}
                onChange={set("fbPassword")}
              />
            </div>
            <h3 className="pt-2 text-sm font-semibold">PostgreSQL</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Servidor" value={campos.pgHost} onChange={set("pgHost")} />
              <Campo label="Porta" value={campos.pgPort} onChange={set("pgPort")} />
              <Campo label="Banco" value={campos.pgDatabase} onChange={set("pgDatabase")} />
              <Campo label="Usuário" value={campos.pgUser} onChange={set("pgUser")} />
              <Campo
                label="Senha"
                type="password"
                value={campos.pgPassword}
                onChange={set("pgPassword")}
              />
              <Campo
                label="IP do servidor na rede"
                value={campos.serverIp}
                onChange={set("serverIp")}
                placeholder="192.168.0.100"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              O IP é o endereço que os totens usam para buscar as imagens dos produtos. Precisa ser
              fixo — se mudar, os totens param de carregar as fotos.
            </p>
            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-sm">
                Salve como <span className="font-mono">.env</span> na pasta do Sync-Service:
              </p>
              <BotaoCopiar texto={env} rotulo="Copiar .env" />
            </div>
            <pre className="overflow-x-auto rounded-lg border border-border bg-background p-4 font-mono text-xs">
              {env}
            </pre>
            <p className="text-xs text-warning">
              Este arquivo contém senhas. Não o envie por e-mail nem por aplicativo de mensagem.
            </p>
          </>
        )}

        {passo === 3 && (
          <>
            <Quadro tom="warning">
              <p className="flex items-center gap-2 text-sm font-semibold text-warning">
                <TriangleAlert size={16} /> Configuração obrigatória
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Sem estas alterações, o serviço não consegue conectar no Firebird.
              </p>
            </Quadro>
            <p className="text-sm">
              Abra o arquivo <Caminho>firebird.conf</Caminho>, normalmente em:
            </p>
            <Comando comando="C:\Program Files\Firebird\Firebird_3_0\firebird.conf" />
            <p className="text-sm font-medium">Altere estas linhas:</p>
            <Quadro>
              <p className="mb-1 text-xs text-muted-foreground">Procure AuthServer e deixe assim:</p>
              <pre className="font-mono text-sm text-primary">AuthServer = Srp, Srp256</pre>
            </Quadro>
            <Quadro>
              <p className="mb-1 text-xs text-muted-foreground">Procure WireCrypt e deixe assim:</p>
              <pre className="font-mono text-sm text-primary">WireCrypt = Enabled</pre>
            </Quadro>
            <Comando rotulo="Depois, reinicie o serviço do Firebird:" comando={REINICIAR_FIREBIRD} />
          </>
        )}

        {passo === 4 && (
          <>
            <p className="text-sm text-muted-foreground">
              Rode no CMD ou no PowerShell do servidor:
            </p>
            <Comando rotulo="1. Entre na pasta do serviço:" comando="cd C:\EasyCommandPay\sync-service" />
            <Comando rotulo="2. Instale as dependências:" comando="npm install" />
            <Comando rotulo="3. Teste as conexões:" comando="npm run test-connection" />
            <Quadro>
              <p className="mb-2 text-sm font-semibold">Como ler o resultado</p>
              <ul className="space-y-1 text-sm">
                <li>
                  <span className="font-mono text-success">Firebird connected</span> — Firebird OK
                </li>
                <li>
                  <span className="font-mono text-success">PostgreSQL connected</span> — PostgreSQL
                  OK
                </li>
                <li>
                  <span className="font-mono text-destructive">Connection failed</span> — confira
                  servidor, porta, usuário e senha
                </li>
              </ul>
            </Quadro>
          </>
        )}

        {passo === 5 && (
          <>
            <p className="text-sm text-muted-foreground">
              Registre o Sync-Service como serviço do Windows, para iniciar junto com o servidor:
            </p>
            <Comando comando="npm run install-service" />
            <Quadro>
              <p className="mb-1 text-sm font-semibold">Confira no services.msc</p>
              <p className="text-sm text-muted-foreground">
                Abra <Caminho>services.msc</Caminho> e procure "EasyCommandPay Sync". O status
                deve ser "Em execução".
              </p>
            </Quadro>
            <h3 className="pt-2 text-sm font-semibold">Libere as portas no firewall</h3>
            <Comando
              rotulo="Porta 3001 (imagens):"
              comando='New-NetFirewallRule -DisplayName "EasyCommandPay Images" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow'
            />
            <Comando
              rotulo="Porta 5432 (PostgreSQL):"
              comando='New-NetFirewallRule -DisplayName "EasyCommandPay PostgreSQL" -Direction Inbound -Protocol TCP -LocalPort 5432 -Action Allow'
            />
          </>
        )}

        {passo === 6 && (
          <>
            {/* Lista a conferir, não lista de feitos: o painel não verificou
                nenhum destes itens, e marcá-los como concluídos seria afirmar
                algo que ninguém mediu. */}
            <p className="text-sm text-muted-foreground">Antes de encerrar, confira:</p>
            <ul className="space-y-2">
              {CONFERENCIA.map((item) => (
                <li key={item}>
                  <label className="flex items-center gap-3 text-sm">
                    <input type="checkbox" className="accent-primary" />
                    {item}
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="flex justify-between border-t border-border/60 pt-4">
          <button
            onClick={() => setPasso((p) => Math.max(0, p - 1))}
            disabled={passo === 0}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-secondary disabled:opacity-40"
          >
            <ChevronLeft size={15} /> Anterior
          </button>
          <button
            onClick={() => setPasso((p) => Math.min(PASSOS.length - 1, p + 1))}
            disabled={passo === PASSOS.length - 1}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-secondary disabled:opacity-40"
          >
            Próximo <ChevronRight size={15} />
          </button>
        </div>
      </Panel>
    </div>
  );
}
