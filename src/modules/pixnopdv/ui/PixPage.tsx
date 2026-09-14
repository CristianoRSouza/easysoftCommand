import { useQuery } from "@tanstack/react-query";
import { Check, Minus, ShieldAlert } from "lucide-react";
import {
  hasInsecureTransport,
  isOperational,
  type PixCredentials,
} from "../domain/pix-credentials";
import { useContainer } from "@/shared/container/container-context";
import { formatDateTime } from "@/shared/ui/format";
import { Badge, ErrorNotice, Loading, PageHeader, Panel } from "@/shared/ui/primitives";

function SecretRow({ label, present }: { label: string; present: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-2 last:border-0">
      <span className="text-sm">{label}</span>
      {present ? (
        <span className="flex items-center gap-1.5 text-sm text-success">
          <Check size={15} /> Configurado
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Minus size={15} /> Não configurado
        </span>
      )}
    </div>
  );
}

export function PixPage() {
  const { pix } = useContainer();
  const { data, isPending, error } = useQuery<PixCredentials | null>({
    queryKey: ["pixnopdv"],
    queryFn: () => pix.get(),
  });

  if (isPending) return <Loading label="Carregando o PIXnoPDV..." />;
  if (error) return <ErrorNotice error={error} fallback="Não foi possível carregar o PIXnoPDV." />;

  if (!data) {
    return (
      <div className="space-y-5">
        <PageHeader title="PIXnoPDV" />
        <Panel className="px-4 py-12 text-center text-sm text-muted-foreground">
          Esta loja ainda não configurou o PIXnoPDV.
        </Panel>
      </div>
    );
  }

  const operacional = isOperational(data);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="PIXnoPDV" />
        <div className="flex gap-2">
          <Badge tone={data.enabled ? "success" : "muted"}>
            {data.enabled ? "Habilitado" : "Desabilitado"}
          </Badge>
          <Badge tone={operacional ? "success" : "warning"}>
            {operacional ? "Pronto para operar" : "Configuração incompleta"}
          </Badge>
        </div>
      </div>

      {/* TLS inseguro aceita certificado inválido do provedor: serve para teste
          em rede local, mas em produção abre espaço para alguém no meio do
          caminho ler ou alterar a cobrança. */}
      {hasInsecureTransport(data) && (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <span>
            Verificação de certificado desligada (TLS inseguro). A comunicação com o provedor pode
            ser lida ou alterada por quem estiver no meio do caminho.
          </span>
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-5">
          <h2 className="mb-4 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Conexão
          </h2>
          <div className="grid gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Ambiente</p>
              <p className="mt-0.5 text-sm">{data.environment}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">URL da API</p>
              <p className="mt-0.5 break-all text-sm">{data.apiBaseUrl ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Usuário</p>
              <p className="mt-0.5 text-sm">{data.basicUser ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Última alteração</p>
              <p className="mt-0.5 text-sm">
                {data.updatedAt ? formatDateTime(data.updatedAt) : "—"}
              </p>
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="mb-4 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Credenciais
          </h2>
          <SecretRow label="Token básico" present={data.basicTokenSet} />
          <SecretRow label="Chave secreta" present={data.secretKeySet} />
          <p className="mt-3 text-xs text-muted-foreground">
            Os valores ficam guardados no banco e não são lidos por esta tela.
          </p>
        </Panel>
      </div>
    </div>
  );
}
