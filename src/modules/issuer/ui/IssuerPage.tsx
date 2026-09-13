import { useQuery } from "@tanstack/react-query";
import { Check, Minus, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import {
  certificateHealth,
  daysUntilExpiry,
  isProduction,
  type CertificateHealth,
  type NfceIssuer,
} from "../domain/nfce-issuer";
import { useContainer } from "@/shared/container/container-context";
import { formatDateTime } from "@/shared/ui/format";
import { Badge, ErrorNotice, Loading, PageHeader, Panel } from "@/shared/ui/primitives";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm">{value || "—"}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel className="p-5">
      <h2 className="mb-4 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </Panel>
  );
}

/**
 * Um segredo configurado aparece como presente, nunca como valor.
 *
 * Mostrar o token na tela o exporia a quem passa atrás do monitor, à captura de
 * tela e ao log do navegador, sem nenhum ganho: quem administra precisa saber
 * se está configurado, não qual é.
 */
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

const HEALTH: Record<
  CertificateHealth,
  { tone: "success" | "warning" | "destructive" | "muted"; label: string }
> = {
  valid: { tone: "success", label: "Válido" },
  expiring: { tone: "warning", label: "Vence em breve" },
  expired: { tone: "destructive", label: "Vencido" },
  missing: { tone: "muted", label: "Sem certificado" },
};

function CertificateAlert({ issuer }: { issuer: NfceIssuer }) {
  const health = certificateHealth(issuer.certificate);
  const days = daysUntilExpiry(issuer.certificate);

  if (health === "valid") return null;

  const texto =
    health === "expired"
      ? `O certificado venceu${days != null ? ` há ${Math.abs(days)} dia${Math.abs(days) === 1 ? "" : "s"}` : ""}. Enquanto não for renovado, a loja não consegue emitir NFC-e.`
      : health === "expiring"
        ? `O certificado vence em ${days} dia${days === 1 ? "" : "s"}. Renove antes do vencimento para não parar a emissão.`
        : "Nenhum certificado ativo encontrado. Sem certificado a loja não emite NFC-e.";

  const grave = health !== "expiring";

  return (
    <p
      className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
        grave
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-warning/40 bg-warning/10 text-warning"
      }`}
    >
      {grave ? (
        <ShieldAlert size={16} className="mt-0.5 shrink-0" />
      ) : (
        <TriangleAlert size={16} className="mt-0.5 shrink-0" />
      )}
      <span>{texto}</span>
    </p>
  );
}

export function IssuerPage() {
  const { issuer: repository } = useContainer();
  const { data, isPending, error } = useQuery<NfceIssuer | null>({
    queryKey: ["issuer"],
    queryFn: () => repository.get(),
  });

  if (isPending) return <Loading label="Carregando o emitente..." />;
  if (error) return <ErrorNotice error={error} fallback="Não foi possível carregar o emitente." />;
  if (!data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Emitente NFC-e" />
        <Panel className="px-4 py-12 text-center text-sm text-muted-foreground">
          Esta loja ainda não tem emitente configurado.
        </Panel>
      </div>
    );
  }

  const { identification, address, fiscal, certificate, integrations } = data;
  const health = certificateHealth(certificate);
  const enderecoCompleto = [address.street, address.number, address.complement, address.neighborhood]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Emitente NFC-e" />
        <div className="flex gap-2">
          <Badge tone={data.isActive ? "success" : "muted"}>
            {data.isActive ? "Ativo" : "Inativo"}
          </Badge>
          {fiscal.environment != null && (
            <Badge tone={isProduction(fiscal) ? "success" : "warning"}>
              {isProduction(fiscal) ? "Produção" : "Homologação"}
            </Badge>
          )}
        </div>
      </div>

      {/* O ambiente de homologação emite notas sem valor fiscal. Quem abre esta
          tela precisa ver isso antes de qualquer outro dado. */}
      {fiscal.environment != null && !isProduction(fiscal) && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          <span>
            Emitente em homologação. As notas emitidas neste ambiente não têm valor fiscal.
          </span>
        </p>
      )}

      <CertificateAlert issuer={data} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Identificação">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Razão social" value={identification.companyName} />
            <Field label="Nome fantasia" value={identification.tradeName} />
            <Field label="CNPJ" value={identification.cnpj} />
            <Field label="Inscrição estadual" value={identification.stateRegistration} />
            <Field label="Inscrição municipal" value={identification.municipalRegistration} />
            <Field label="CNAE" value={identification.cnae} />
          </div>
        </Section>

        <Section title="Endereço">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Logradouro" value={enderecoCompleto} />
            <Field label="CEP" value={address.zipCode} />
            <Field
              label="Município"
              value={
                address.cityName
                  ? `${address.cityName}${address.cityCode ? ` (${address.cityCode})` : ""}`
                  : null
              }
            />
            <Field label="UF" value={address.uf} />
            <Field label="Telefone" value={address.phone} />
          </div>
        </Section>

        <Section title="Configuração fiscal">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Ambiente"
              value={
                fiscal.environment == null
                  ? null
                  : isProduction(fiscal)
                    ? "1 — Produção"
                    : `${fiscal.environment} — Homologação`
              }
            />
            <Field label="Série NFC-e" value={fiscal.nfceSerie?.toString() ?? null} />
            <Field label="Série NF-e" value={fiscal.nfeSerie?.toString() ?? null} />
            <Field label="Regime tributário" value={fiscal.taxRegimeCode?.toString() ?? null} />
            <Field label="Regime PIS/COFINS" value={fiscal.pisCofinsRegimeCode?.toString() ?? null} />
          </div>
        </Section>

        <Section title="Certificado digital">
          <div className="mb-4 flex items-center gap-2">
            {health === "valid" ? (
              <ShieldCheck size={18} className="text-success" />
            ) : (
              <ShieldAlert
                size={18}
                className={health === "expiring" ? "text-warning" : "text-destructive"}
              />
            )}
            <Badge tone={HEALTH[health].tone}>{HEALTH[health].label}</Badge>
          </div>
          {certificate ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Titular" value={certificate.holderName} />
              <Field label="CNPJ do titular" value={certificate.holderCnpj} />
              <Field label="Autoridade certificadora" value={certificate.authorityName} />
              <Field label="Número de série" value={certificate.serialNumber} />
              <Field
                label="Válido até"
                value={certificate.validUntil ? formatDateTime(certificate.validUntil) : null}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum certificado ativo.</p>
          )}
        </Section>
      </div>

      <Section title="Integrações">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <SecretRow label="Token de parceiro Aditum" present={integrations.aditumPartnerToken} />
            <SecretRow
              label="Código de ativação Aditum"
              present={integrations.aditumActivationCode}
            />
            <SecretRow label="Chave de API EasyERP" present={integrations.easyerpApiKey} />
            <p className="mt-3 text-xs text-muted-foreground">
              Os valores ficam cifrados no banco e não são lidos por esta tela.
            </p>
          </div>
          <div className="grid gap-4">
            <Field label="Prefixo da chave EasyERP" value={integrations.easyerpApiKeyPrefix} />
            <Field label="URL do serviço TEF" value={integrations.tefBaseUrl} />
            <Field label="Empresa no EasyERP" value={integrations.easyerpCompanyId} />
            <Field label="Loja no EasyERP" value={integrations.easyerpStoreId} />
          </div>
        </div>
      </Section>
    </div>
  );
}
