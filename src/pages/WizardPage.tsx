import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { PageHeader, Panel, FIELD } from "@/shared/ui/primitives";

/**
 * Assistente de configuração do Sync-Service.
 *
 * Gera o conteúdo do arquivo `.env` que o serviço de sincronização espera. Não
 * grava nada: o arquivo fica em outra máquina, sob outro programa. Gerar o
 * texto para quem instala copiar é o limite honesto do que este painel pode
 * fazer sem escrever fora do seu próprio domínio.
 */
interface Campos {
  fbHost: string;
  fbPort: string;
  fbDatabase: string;
  fbUser: string;
  fbPassword: string;
  pgHost: string;
  pgPort: string;
  pgDatabase: string;
  pgUser: string;
  pgPassword: string;
  serverIp: string;
}

const INICIAL: Campos = {
  fbHost: "localhost",
  fbPort: "3050",
  fbDatabase: "",
  fbUser: "SYSDBA",
  fbPassword: "",
  pgHost: "127.0.0.1",
  pgPort: "5432",
  pgDatabase: "easyfood",
  pgUser: "",
  pgPassword: "",
  serverIp: "192.168.0.10",
};

const PASSOS = [
  { titulo: "Firebird do PDV", descricao: "De onde os dados vêm." },
  { titulo: "PostgreSQL do painel", descricao: "Para onde os dados vão." },
  { titulo: "Rede", descricao: "Como os totens enxergam a loja." },
  { titulo: "Arquivo gerado", descricao: "Copie para o Sync-Service." },
];

function Campo({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${FIELD} w-full`}
      />
    </label>
  );
}

export function WizardPage() {
  const [passo, setPasso] = useState(0);
  const [campos, setCampos] = useState<Campos>(INICIAL);
  const [copiado, setCopiado] = useState(false);

  const set = (chave: keyof Campos) => (valor: string) =>
    setCampos((c) => ({ ...c, [chave]: valor }));

  const arquivo = useMemo(
    () =>
      [
        "# Firebird — origem dos dados (PDV)",
        `FB_HOST=${campos.fbHost}`,
        `FB_PORT=${campos.fbPort}`,
        `FB_DATABASE=${campos.fbDatabase}`,
        `FB_USER=${campos.fbUser}`,
        `FB_PASSWORD=${campos.fbPassword}`,
        "FB_CHARSET=WIN1252",
        "FB_WIRE_CRYPT=DISABLED",
        "",
        "# PostgreSQL — destino dos dados (painel)",
        `PG_HOST=${campos.pgHost}`,
        `PG_PORT=${campos.pgPort}`,
        `PG_DATABASE=${campos.pgDatabase}`,
        `PG_USER=${campos.pgUser}`,
        `PG_PASSWORD=${campos.pgPassword}`,
        "",
        "# Rede — endereço que os totens usam para alcançar a loja",
        `SERVER_IP=${campos.serverIp}`,
        "IMAGE_SERVER_PORT=3001",
        "IMAGE_SERVER_HOST=0.0.0.0",
      ].join("\n"),
    [campos],
  );

  async function copiar() {
    await navigator.clipboard.writeText(arquivo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Assistente de configuração" />

      <ol className="flex flex-wrap gap-2">
        {PASSOS.map((p, i) => (
          <li key={p.titulo}>
            <button
              onClick={() => setPasso(i)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                i === passo
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {i + 1}. {p.titulo}
            </button>
          </li>
        ))}
      </ol>

      <Panel className="p-5">
        <h2 className="font-heading text-base font-semibold">{PASSOS[passo]?.titulo}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{PASSOS[passo]?.descricao}</p>

        <div className="mt-5">
          {passo === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Servidor" value={campos.fbHost} onChange={set("fbHost")} />
              <Campo label="Porta" value={campos.fbPort} onChange={set("fbPort")} />
              <Campo
                label="Caminho do banco"
                value={campos.fbDatabase}
                onChange={set("fbDatabase")}
                placeholder="C:\\EasyFood\\DADOS.FDB"
              />
              <Campo label="Usuário" value={campos.fbUser} onChange={set("fbUser")} />
              <Campo
                label="Senha"
                type="password"
                value={campos.fbPassword}
                onChange={set("fbPassword")}
              />
            </div>
          )}

          {passo === 1 && (
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
            </div>
          )}

          {passo === 2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                label="IP da loja na rede"
                value={campos.serverIp}
                onChange={set("serverIp")}
                placeholder="192.168.0.10"
              />
              <p className="self-end text-xs text-muted-foreground">
                É o endereço que os totens usam para buscar as imagens dos produtos. Precisa ser
                fixo — se mudar, os totens param de carregar as fotos.
              </p>
            </div>
          )}

          {passo === 3 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Salve como <span className="font-mono">.env</span> na pasta do Sync-Service.
                </p>
                <button
                  onClick={() => void copiar()}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
                >
                  {copiado ? <Check size={15} className="text-success" /> : <Copy size={15} />}
                  {copiado ? "Copiado" : "Copiar"}
                </button>
              </div>
              <pre className="overflow-x-auto rounded-lg border border-border bg-background p-4 font-mono text-xs">
                {arquivo}
              </pre>
              <p className="text-xs text-warning">
                Este arquivo contém senhas. Não o envie por e-mail nem por aplicativo de mensagem.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-between border-t border-border/60 pt-4">
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
