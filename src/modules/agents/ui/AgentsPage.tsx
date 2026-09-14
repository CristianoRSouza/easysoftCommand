import { useQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import {
  accumulatesWithoutSending,
  agentHealth,
  AGENT_HEALTH_LABEL,
  type Agent,
} from "../domain/agent";
import { useContainer } from "@/shared/container/container-context";
import { Badge, Empty, ErrorNotice, Loading, PageHeader, Panel } from "@/shared/ui/primitives";

const HEALTH_TONE = {
  running: "success",
  contingency: "warning",
  stopped: "muted",
} as const;

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm tabular-nums">{value}</p>
    </div>
  );
}

function ms(value: number | null): string {
  if (value == null) return "—";
  return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${value} ms`;
}

function AgentCard({ agent }: { agent: Agent }) {
  const health = agentHealth(agent);

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold">{agent.name || "Sem nome"}</h3>
          {agent.installPath && (
            <p className="mt-0.5 break-all font-mono text-xs text-muted-foreground">
              {agent.installPath}
            </p>
          )}
        </div>
        <Badge tone={HEALTH_TONE[health]}>{AGENT_HEALTH_LABEL[health]}</Badge>
      </div>

      {/* Contingência ligada sem transmissão automática trava a loja em
          silêncio: as notas se acumulam e ninguém as envia. */}
      {accumulatesWithoutSending(agent) && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" />
          <span>
            Em contingência com transmissão automática desligada: as notas se acumulam sem serem
            enviadas à SEFAZ.
          </span>
        </p>
      )}

      {agent.contingency.enabled && agent.contingency.reason && (
        <p className="mt-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          Motivo da contingência: {agent.contingency.reason}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Field label="Tempo limite SEFAZ" value={ms(agent.sefaz.timeoutMs)} />
        <Field
          label="Tentativas"
          value={agent.sefaz.retryMaxAttempts?.toString() ?? "—"}
        />
        <Field label="Espera entre tentativas" value={ms(agent.sefaz.retryBackoffMs)} />
        <Field label="Limite de chamadas" value={agent.sefaz.apiRateLimit?.toString() ?? "—"} />
        <Field label="Nível de log" value={agent.logLevel ?? "—"} />
        <Field
          label="Worker de contingência"
          value={
            agent.contingency.workerEnabled
              ? `a cada ${ms(agent.contingency.workerIntervalMs)}`
              : "desligado"
          }
        />
      </div>
    </Panel>
  );
}

export function AgentsPage() {
  const { agents } = useContainer();
  const { data, isPending, error } = useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: () => agents.list(),
  });

  const lista = data ?? [];
  const emContingencia = lista.filter((a) => a.contingency.enabled).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Agentes de Serviço" count={lista.length} unit={["agente", "agentes"]} />

      {error && <ErrorNotice error={error} fallback="Não foi possível carregar os agentes." />}

      {isPending ? (
        <Loading label="Carregando agentes..." />
      ) : lista.length === 0 ? (
        <Empty label="Nenhum agente configurado." />
      ) : (
        <>
          {emContingencia > 0 && (
            <p className="text-sm text-warning">
              {emContingencia} {emContingencia === 1 ? "agente está" : "agentes estão"} em
              contingência.
            </p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {lista.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
