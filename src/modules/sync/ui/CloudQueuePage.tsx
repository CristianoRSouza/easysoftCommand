import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { DIRECTION_LABEL, type QueueDirection, type QueueOverview } from "../domain/sync-activity";
import { QueueEvents } from "./QueueEvents";
import { QueueOverviewPanels } from "./QueueOverviewPanels";
import { useContainer } from "@/shared/container/container-context";
import { ErrorNotice, Loading, PageHeader } from "@/shared/ui/primitives";

const DIRECOES: QueueDirection[] = ["inbox", "outbox"];

const EXPLICACAO: Record<QueueDirection, string> = {
  inbox:
    "A loja publica as mudanças e a nuvem as aplica. Evento preso aqui é dado que já existe na loja e ainda não existe no painel.",
  outbox:
    "O que é alterado no painel — configuração de totem, usuários — espera a loja buscar. Evento preso aqui é mudança que a loja ainda não recebeu.",
};

export function CloudQueuePage() {
  const { sync } = useContainer();
  const queryClient = useQueryClient();
  const [direcao, setDirecao] = useState<QueueDirection>("inbox");

  const visao = useQuery<QueueOverview>({
    queryKey: ["fila", direcao, "visao"],
    queryFn: () => sync.overview(direcao),
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Fila da nuvem" />

      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/60">
        <div className="flex flex-wrap gap-1">
          {DIRECOES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setDirecao(item)}
              className={`rounded-t-lg px-3 py-2 text-sm transition-colors ${
                direcao === item
                  ? "border-b-2 border-primary font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {DIRECTION_LABEL[item]}
            </button>
          ))}
        </div>
        <button
          onClick={() => void queryClient.invalidateQueries({ queryKey: ["fila", direcao] })}
          disabled={visao.isFetching}
          className="mb-1.5 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-secondary disabled:opacity-50"
        >
          <RefreshCw size={14} className={visao.isFetching ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      <p className="text-sm text-muted-foreground">{EXPLICACAO[direcao]}</p>

      {visao.error && <ErrorNotice error={visao.error} fallback="Não foi possível ler a fila." />}
      {visao.isPending ? (
        <Loading label="Carregando a fila..." />
      ) : (
        visao.data && <QueueOverviewPanels direction={direcao} overview={visao.data} />
      )}

      <QueueEvents key={direcao} direction={direcao} />
    </div>
  );
}
