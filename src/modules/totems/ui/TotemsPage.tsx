import { useQuery } from "@tanstack/react-query";
import { CreditCard, QrCode, TriangleAlert } from "lucide-react";
import {
  hasAnyPaymentMethod,
  licenseHealth,
  sellsForReal,
  TOTEM_MODE_LABEL,
  type LicenseHealth,
  type Totem,
} from "../domain/totem";
import { useContainer } from "@/shared/container/container-context";
import { formatDateTime } from "@/shared/ui/format";
import { Badge, Empty, ErrorNotice, Loading, PageHeader, Panel } from "@/shared/ui/primitives";

const MODE_TONE = {
  production: "success",
  homolog: "warning",
  demo: "warning",
  unknown: "muted",
} as const;

const LICENSE: Record<LicenseHealth, { tone: "success" | "warning" | "destructive" | "muted"; label: string }> = {
  active: { tone: "success", label: "Ativa" },
  expiring: { tone: "warning", label: "Vence em breve" },
  expired: { tone: "destructive", label: "Vencida" },
  missing: { tone: "muted", label: "Sem licença" },
};

function Method({ enabled, label, icon: Icon }: { enabled: boolean; label: string; icon: typeof CreditCard }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${enabled ? "text-foreground" : "text-muted-foreground/50 line-through"}`}
      title={enabled ? `${label} habilitado` : `${label} desabilitado`}
    >
      <Icon size={13} />
      {label}
    </span>
  );
}

function TotemCard({ totem }: { totem: Totem }) {
  const license = licenseHealth(totem.license);
  const semPagamento = !hasAnyPaymentMethod(totem.payments);
  // O modo do aplicativo e o ambiente fiscal deveriam concordar. Divergir é
  // sinal de configuração pela metade: vende de verdade e emite nota de teste,
  // ou o contrário.
  const ambienteDivergente =
    totem.mode === "production" &&
    totem.fiscal.nfceEnvironment != null &&
    totem.fiscal.nfceEnvironment !== 1;

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold">{totem.name || "Sem nome"}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {totem.integrations.establishmentCnpj ?? "CNPJ não informado"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={totem.isActive ? "success" : "muted"}>
            {totem.isActive ? "Ativo" : "Inativo"}
          </Badge>
          <Badge tone={MODE_TONE[totem.mode]}>{TOTEM_MODE_LABEL[totem.mode]}</Badge>
          {totem.license && <Badge tone={LICENSE[license].tone}>{LICENSE[license].label}</Badge>}
        </div>
      </div>

      {!sellsForReal(totem) && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" />
          <span>
            {!totem.isActive
              ? "Totem inativo — não atende clientes."
              : `Em ${TOTEM_MODE_LABEL[totem.mode].toLowerCase()}: as vendas deste totem não são reais.`}
          </span>
        </p>
      )}

      {ambienteDivergente && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" />
          <span>
            Totem em produção, mas emitindo NFC-e em homologação (ambiente{" "}
            {totem.fiscal.nfceEnvironment}). As notas não terão valor fiscal.
          </span>
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Série NFC-e</p>
          <p className="mt-0.5">{totem.fiscal.nfceSerie ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Ambiente fiscal</p>
          <p className="mt-0.5">
            {totem.fiscal.nfceEnvironment == null
              ? "—"
              : totem.fiscal.nfceEnvironment === 1
                ? "Produção"
                : "Homologação"}
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">Meios de pagamento</p>
          <div className="mt-1 flex flex-wrap gap-3">
            <Method enabled={totem.payments.credit} label="Crédito" icon={CreditCard} />
            <Method enabled={totem.payments.debit} label="Débito" icon={CreditCard} />
            <Method enabled={totem.payments.pix} label="PIX" icon={QrCode} />
            {semPagamento && (
              <span className="text-xs text-destructive">nenhum meio habilitado</span>
            )}
          </div>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">Chaves configuradas</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {[
              ["NFC-e", totem.integrations.nfceServiceApiKey],
              ["TEF", totem.integrations.tefApiKey],
              ["Token Aditum", totem.integrations.aditumPartnerToken],
              ["Ativação Aditum", totem.integrations.aditumActivationCode],
            ].map(([label, present]) => (
              <Badge key={String(label)} tone={present ? "success" : "muted"}>
                {String(label)}
              </Badge>
            ))}
          </div>
        </div>
        {totem.license?.expiresAt && (
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Licença válida até</p>
            <p className="mt-0.5">{formatDateTime(totem.license.expiresAt)}</p>
          </div>
        )}
      </div>
    </Panel>
  );
}

export function TotemsPage() {
  const { totems } = useContainer();
  const { data, isPending, error } = useQuery<Totem[]>({
    queryKey: ["totems"],
    queryFn: () => totems.list(),
  });

  const lista = data ?? [];
  const vendendo = lista.filter(sellsForReal).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Totens" count={lista.length} unit={["totem", "totens"]} />

      {error && <ErrorNotice error={error} fallback="Não foi possível carregar os totens." />}

      {isPending ? (
        <Loading label="Carregando totens..." />
      ) : lista.length === 0 ? (
        <Empty label="Nenhum totem cadastrado." />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{vendendo}</span> de {lista.length}{" "}
            {lista.length === 1 ? "totem vende" : "totens vendem"} de verdade — ativos e em
            produção.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {lista.map((totem) => (
              <TotemCard key={totem.id} totem={totem} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
