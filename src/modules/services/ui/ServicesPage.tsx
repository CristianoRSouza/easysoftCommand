import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Info, Pencil } from "lucide-react";
import {
  DEFAULT_WINDOWS_SERVICE,
  draftFrom,
  inspectRuntime,
  isUnchanged,
  normalizeRuntime,
  SERVICE_LABEL,
  type ServiceRuntime,
  type ServiceRuntimeDraft,
} from "../domain/service-runtime";
import { useContainer } from "@/shared/container/container-context";
import { formatDateTime } from "@/shared/ui/format";
import { ErrorNotice, FIELD, Loading, PageHeader, Panel } from "@/shared/ui/primitives";

function RuntimeCard({ runtime }: { runtime: ServiceRuntime }) {
  const { services } = useContainer();
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState<ServiceRuntimeDraft>(() => draftFrom(runtime));

  const mutation = useMutation({
    mutationFn: () => services.save(runtime.service, normalizeRuntime(draft)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["services"] });
      setEditando(false);
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isUnchanged(runtime, draft)) {
      setEditando(false);
      return;
    }
    mutation.mutate();
  }

  const warnings = inspectRuntime(draft);
  const aviso = (campo: keyof ServiceRuntimeDraft) =>
    warnings.find((w) => w.field === campo)?.message ?? null;

  if (!editando) {
    return (
      <Panel className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-heading text-base font-semibold">
            {SERVICE_LABEL[runtime.service]}
          </h3>
          <button
            onClick={() => {
              setDraft(draftFrom(runtime));
              setEditando(true);
            }}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title={`Editar ${SERVICE_LABEL[runtime.service]}`}
          >
            <Pencil size={15} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Pasta da instalação</p>
            <p className="mt-0.5 break-all font-mono text-sm">{runtime.installPath ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Nome do serviço no Windows</p>
            <p className="mt-0.5 font-mono text-sm">{runtime.windowsServiceName ?? "—"}</p>
          </div>
          {runtime.updatedAt && (
            <p className="text-xs text-muted-foreground">
              Registrado em {formatDateTime(runtime.updatedAt)}
            </p>
          )}
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="font-heading text-base font-semibold">{SERVICE_LABEL[runtime.service]}</h3>

        <label className="block space-y-1.5">
          <span className="text-sm text-muted-foreground">Pasta da instalação</span>
          <input
            value={draft.installPath}
            onChange={(e) => setDraft((d) => ({ ...d, installPath: e.target.value }))}
            placeholder="C:\EasyFood\Servico"
            className={`${FIELD} w-full font-mono text-sm ${aviso("installPath") ? "border-warning" : ""}`}
          />
          {aviso("installPath") && (
            <span className="flex items-start gap-1.5 text-xs text-warning">
              <Info size={13} className="mt-0.5 shrink-0" />
              {aviso("installPath")}
            </span>
          )}
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm text-muted-foreground">Nome do serviço no Windows</span>
          <input
            value={draft.windowsServiceName}
            onChange={(e) => setDraft((d) => ({ ...d, windowsServiceName: e.target.value }))}
            placeholder={DEFAULT_WINDOWS_SERVICE[runtime.service]}
            className={`${FIELD} w-full font-mono text-sm ${aviso("windowsServiceName") ? "border-warning" : ""}`}
          />
          {aviso("windowsServiceName") && (
            <span className="flex items-start gap-1.5 text-xs text-warning">
              <Info size={13} className="mt-0.5 shrink-0" />
              {aviso("windowsServiceName")}
            </span>
          )}
        </label>

        {mutation.error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {mutation.error instanceof Error ? mutation.error.message : "Não foi possível salvar."}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditando(false)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Check size={15} />
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

export function ServicesPage() {
  const { services } = useContainer();
  const disponivel = services.isAvailable();

  const { data, isPending, error } = useQuery<ServiceRuntime[]>({
    queryKey: ["services"],
    queryFn: () => services.list(),
    enabled: disponivel,
  });

  if (!disponivel) {
    return (
      <div className="space-y-5">
        <PageHeader title="Instalação dos serviços" />
        <Panel className="flex items-start gap-3 p-5 text-sm text-muted-foreground">
          <Info size={18} className="mt-0.5 shrink-0 text-primary" />
          <span>
            Este registro guarda caminhos de arquivo do computador da loja. Abra o programa
            instalado lá para vê-lo ou alterá-lo.
          </span>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Instalação dos serviços" />

      <p className="text-sm text-muted-foreground">
        Onde cada serviço de segundo plano está instalado nesta máquina. O painel não os instala
        nem os controla — guarda o endereço para quem precisar dar suporte.
      </p>

      {error && <ErrorNotice error={error} fallback="Não foi possível ler os serviços." />}

      {isPending ? (
        <Loading label="Carregando..." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data?.map((runtime) => <RuntimeCard key={runtime.service} runtime={runtime} />)}
        </div>
      )}
    </div>
  );
}
