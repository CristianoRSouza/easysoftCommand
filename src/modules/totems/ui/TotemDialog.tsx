import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TriangleAlert, X } from "lucide-react";
import { TOTEM_MODE_LABEL, VOUCHER_KIND_LABEL, type Totem, type TotemMode, type VoucherKind } from "../domain/totem";
import {
  draftFrom,
  emptyDraft,
  rejectionFor,
  wantsProduction,
  type TotemDraft,
} from "../domain/totem-draft";
import {
  INSTALLMENT_TYPE_LABEL,
  PAYMENT_ENVIRONMENT_LABEL,
  type InstallmentType,
  type PaymentEnvironment,
} from "../domain/totem-settings";
import { selectableFor, slotLabel, type TotemLicenseSlot } from "../domain/totem-license";
import { createTotem, saveTotem } from "../application/save-totem";
import { Escolha, Marcador, Numero, NumeroFixo, Texto } from "./TotemFields";
import { SecretField } from "@/shared/ui/SecretField";
import { useContainer } from "@/shared/container/container-context";
import { useSession } from "@/shared/auth/auth-context";

/** Os modos que se pode escolher. `unknown` não é uma escolha, é um diagnóstico. */
const MODES: TotemMode[] = ["demo", "homolog", "production"];

type Aba = "geral" | "licenca" | "fiscal" | "pagamentos" | "tef" | "equipamento";

const ABAS: { id: Aba; label: string }[] = [
  { id: "geral", label: "Geral" },
  { id: "licenca", label: "Licença" },
  { id: "fiscal", label: "NFC-e" },
  { id: "pagamentos", label: "Pagamentos" },
  { id: "tef", label: "TEF Aditum" },
  { id: "equipamento", label: "Equipamento" },
];

export function TotemDialog({
  totem,
  onClose,
  onAuditMissing,
}: {
  /** `null` cadastra um totem novo. */
  totem: Totem | null;
  onClose: () => void;
  /** Chamado quando a alteração entrou mas a trilha recusou o registro. */
  onAuditMissing: (motivo: string) => void;
}) {
  const { totems } = useContainer();
  const { session } = useSession();
  const queryClient = useQueryClient();

  const [aba, setAba] = useState<Aba>("geral");
  const [draft, setDraft] = useState<TotemDraft>(() => (totem ? draftFrom(totem) : emptyDraft()));
  const [licenseId, setLicenseId] = useState<string | null>(null);

  const licencas = useQuery<TotemLicenseSlot[]>({
    queryKey: ["totems", "licencas"],
    queryFn: () => totems.licenseSlots(),
  });

  // A licença já presa a este totem é a escolha inicial; sem ela, nenhuma.
  useEffect(() => {
    if (!licencas.data || !totem) return;
    setLicenseId(licencas.data.find((slot) => slot.boundTo === totem.id)?.id ?? null);
  }, [licencas.data, totem]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: async () => {
      const contexto = {
        performedBy: session?.user.email ?? "painel",
        licenseId,
        license: totem?.license ?? null,
      };
      if (totem) return saveTotem(totems)(totem, draft, contexto);
      return createTotem(totems)(draft, contexto);
    },
    onSuccess: async (resultado) => {
      await queryClient.invalidateQueries({ queryKey: ["totems"] });
      await queryClient.invalidateQueries({ queryKey: ["audit"] });
      if (!resultado.audited && resultado.auditError) onAuditMissing(resultado.auditError);
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  const set =
    <K extends keyof TotemDraft>(chave: K) =>
    (valor: TotemDraft[K]) =>
      setDraft((d) => ({ ...d, [chave]: valor }));

  const setTef = <K extends keyof TotemDraft["tef"]>(chave: K) =>
    (valor: TotemDraft["tef"][K]) =>
      setDraft((d) => ({ ...d, tef: { ...d.tef, [chave]: valor } }));

  const setPrinter = <K extends keyof TotemDraft["printer"]>(chave: K) =>
    (valor: TotemDraft["printer"][K]) =>
      setDraft((d) => ({ ...d, printer: { ...d.printer, [chave]: valor } }));

  const setImages = <K extends keyof TotemDraft["images"]>(chave: K) =>
    (valor: TotemDraft["images"][K]) =>
      setDraft((d) => ({ ...d, images: { ...d.images, [chave]: valor } }));

  // A recusa aparece enquanto se edita, não depois de tentar salvar.
  const recusa = rejectionFor(draft, totem?.license ?? null, licenseId !== null);

  // O modo do aplicativo e o ambiente fiscal deveriam concordar: vender de
  // verdade emitindo nota de teste é o engano que custa caro.
  const divergente =
    draft.mode === "production" && draft.nfceEnvironment != null && draft.nfceEnvironment !== 1;

  const disponiveis = selectableFor(licencas.data ?? [], totem?.id ?? null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel my-8 w-full max-w-3xl space-y-5 rounded-lg p-6 shadow-elegant"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold">
              {totem ? totem.name || "Sem nome" : "Novo totem"}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {totem
                ? "Só o que você alterar é gravado"
                : "O totem nasce desligado; ligue depois de vincular a licença"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-border/60">
          {ABAS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setAba(item.id)}
              className={`rounded-t-lg px-3 py-2 text-sm transition-colors ${
                aba === item.id
                  ? "border-b-2 border-primary font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {aba === "geral" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Texto label="Nome" value={draft.name} onChange={set("name")} />
              <Escolha<TotemMode>
                label="Modo de operação"
                value={draft.mode}
                onChange={set("mode")}
                options={[
                  ...(draft.mode === "unknown"
                    ? [{ value: "unknown" as TotemMode, label: TOTEM_MODE_LABEL.unknown }]
                    : []),
                  ...MODES.map((modo) => ({ value: modo, label: TOTEM_MODE_LABEL[modo] })),
                ]}
                hint="Demonstração e homologação não vendem de verdade"
              />
            </div>
            <Marcador
              label="Totem ativo"
              hint="Um totem ativo atende clientes; o banco exige licença vinculada"
              checked={draft.isActive}
              onChange={set("isActive")}
            />
          </div>
        )}

        {aba === "licenca" && (
          <div className="space-y-4">
            {licencas.isPending ? (
              <p className="text-sm text-muted-foreground">Carregando as licenças...</p>
            ) : disponiveis.length === 0 ? (
              <p className="text-sm text-warning">
                Não há licença de totem livre nesta empresa. Contrate mais slots antes de ativar
                outro equipamento.
              </p>
            ) : (
              <Escolha
                label="Licença vinculada"
                value={licenseId ?? ""}
                onChange={(valor) => setLicenseId(valor === "" ? null : valor)}
                options={[
                  { value: "", label: "Sem licença" },
                  ...disponiveis.map((slot) => ({ value: slot.id, label: slotLabel(slot) })),
                ]}
                hint="Só aparecem as livres e a que já é deste totem"
              />
            )}

            {totem?.license && (
              <p className="text-xs text-muted-foreground">
                Licença atual: {totem.license.planSlug ?? totem.license.type ?? "sem plano"}
                {totem.license.expiresAt ? ` · vence em ${totem.license.expiresAt.slice(0, 10)}` : ""}
              </p>
            )}
          </div>
        )}

        {aba === "fiscal" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Escolha
                label="Ambiente da NFC-e"
                value={draft.nfceEnvironment == null ? "" : String(draft.nfceEnvironment)}
                onChange={(valor) => set("nfceEnvironment")(valor === "" ? null : Number(valor))}
                options={[
                  { value: "", label: "Não definido" },
                  { value: "1", label: "Produção" },
                  { value: "2", label: "Homologação" },
                ]}
              />
              <Numero label="Série" value={draft.nfceSerie} onChange={set("nfceSerie")} />
              <Texto
                label="URL do serviço fiscal"
                value={draft.nfceServiceUrl}
                placeholder="https://..."
                onChange={set("nfceServiceUrl")}
              />
              <Numero
                label="Tempo limite de emissão (ms)"
                value={draft.nfceEmitTimeoutMs}
                hint="Entre 10.000 e 300.000; fora disso o banco guarda vazio"
                onChange={set("nfceEmitTimeoutMs")}
              />
            </div>

            <SecretField
              label="Chave do serviço fiscal"
              present={totem?.integrations.nfceServiceApiKey ?? false}
              edit={draft.nfceServiceApiKey}
              onChange={set("nfceServiceApiKey")}
            />

            {divergente && (
              <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                <span>
                  Totem em produção emitindo NFC-e em homologação: as notas não terão valor fiscal.
                </span>
              </p>
            )}
          </div>
        )}

        {aba === "pagamentos" && (
          <div className="space-y-4">
            <Escolha<PaymentEnvironment>
              label="Ambiente de pagamento (PIX e TEF)"
              value={draft.paymentEnvironment}
              onChange={set("paymentEnvironment")}
              options={(["homologacao", "producao"] as PaymentEnvironment[]).map((valor) => ({
                value: valor,
                label: PAYMENT_ENVIRONMENT_LABEL[valor],
              }))}
              hint="Em homologação o dinheiro não é real"
            />

            <div className="flex flex-wrap gap-5">
              <Marcador label="Crédito" checked={draft.creditEnabled} onChange={set("creditEnabled")} />
              <Marcador label="Débito" checked={draft.debitEnabled} onChange={set("debitEnabled")} />
              <Marcador label="PIX" checked={draft.pixEnabled} onChange={set("pixEnabled")} />
              <Marcador label="Voucher" checked={draft.voucherEnabled} onChange={set("voucherEnabled")} />
            </div>
            {draft.voucherEnabled && (
              <Escolha<VoucherKind>
                label="Tipo do voucher na NFC-e"
                value={draft.voucherKind}
                onChange={set("voucherKind")}
                options={(["meal", "food"] as VoucherKind[]).map((valor) => ({
                  value: valor,
                  label: VOUCHER_KIND_LABEL[valor],
                }))}
                hint="Refeição para restaurantes; Alimentação para mercados"
              />
            )}
            {!draft.creditEnabled && !draft.debitEnabled && !draft.pixEnabled && !draft.voucherEnabled && (
              <p className="text-xs text-warning">
                Sem nenhum meio habilitado o totem não recebe pagamento algum.
              </p>
            )}

            <div className="grid gap-4 border-t border-border/60 pt-4 sm:grid-cols-2">
              <Texto
                label="URL do serviço TEF"
                value={draft.tefHttpBaseUrl}
                placeholder="https://..."
                onChange={set("tefHttpBaseUrl")}
              />
              <Texto
                label="URL do serviço PIX"
                value={draft.pixHttpBaseUrl}
                placeholder="https://..."
                onChange={set("pixHttpBaseUrl")}
              />
              <SecretField
                label="Chave do serviço TEF"
                present={totem?.integrations.tefApiKey ?? false}
                edit={draft.tefHttpApiKey}
                onChange={set("tefHttpApiKey")}
              />
              <SecretField
                label="Chave do serviço PIX"
                present={totem?.integrations.pixApiKey ?? false}
                edit={draft.pixHttpApiKey}
                onChange={set("pixHttpApiKey")}
              />
            </div>
          </div>
        )}

        {aba === "tef" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Texto
                label="URL da Aditum"
                value={draft.tef.baseUrl}
                placeholder="https://..."
                onChange={setTef("baseUrl")}
              />
              <Texto
                label="CNPJ do estabelecimento"
                value={draft.establishmentCnpj}
                onChange={set("establishmentCnpj")}
              />
              <SecretField
                label="Token de parceiro"
                present={totem?.integrations.aditumPartnerToken ?? false}
                edit={draft.aditumPartnerToken}
                onChange={set("aditumPartnerToken")}
              />
              <SecretField
                label="Código de ativação"
                present={totem?.integrations.aditumActivationCode ?? false}
                edit={draft.aditumActivationCode}
                onChange={set("aditumActivationCode")}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Os segredos da Aditum são cifrados no servidor antes de gravados. A auditoria registra
              que a chave mudou, nunca o valor dela.
            </p>

            <div className="grid gap-4 border-t border-border/60 pt-4 sm:grid-cols-2">
              <Texto
                label="Nome da aplicação"
                value={draft.tef.applicationName}
                onChange={setTef("applicationName")}
              />
              <Texto
                label="Versão da aplicação"
                value={draft.tef.applicationVersion}
                onChange={setTef("applicationVersion")}
              />
              <NumeroFixo
                label="Intervalo de consulta (ms)"
                value={draft.tef.pollIntervalMs}
                onChange={setTef("pollIntervalMs")}
              />
              <NumeroFixo
                label="Espera máxima (ms)"
                value={draft.tef.pollMaxMs}
                onChange={setTef("pollMaxMs")}
              />
              <Escolha<InstallmentType>
                label="Juros do parcelado"
                value={draft.tef.installmentType}
                onChange={setTef("installmentType")}
                options={(["Merchant", "Issuer"] as InstallmentType[]).map((valor) => ({
                  value: valor,
                  label: INSTALLMENT_TYPE_LABEL[valor],
                }))}
              />
              <Texto
                label="Status reivindicáveis"
                value={draft.tef.claimSourceStatuses}
                hint="Separados por vírgula"
                onChange={setTef("claimSourceStatuses")}
              />
            </div>

            <div className="grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2">
              <Marcador
                label="Aproximação (contactless)"
                checked={draft.tef.contactless}
                onChange={setTef("contactless")}
              />
              <Marcador
                label="Confirmar após a cobrança"
                checked={draft.tef.confirmAfterCharge}
                onChange={setTef("confirmAfterCharge")}
              />
              <Marcador
                label="Worker de pendências ligado"
                checked={draft.tef.workerPendingJob}
                onChange={setTef("workerPendingJob")}
              />
              <Marcador
                label="Aceitar certificado inválido (TLS inseguro)"
                hint="Só para teste em rede local"
                checked={draft.tef.insecureTls}
                onChange={setTef("insecureTls")}
              />
            </div>
          </div>
        )}

        {aba === "equipamento" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Texto
                label="Servidor de imagens"
                value={draft.images.host}
                onChange={setImages("host")}
              />
              <NumeroFixo
                label="Porta"
                value={draft.images.port}
                onChange={setImages("port")}
              />
            </div>

            <div className="space-y-3 border-t border-border/60 pt-4">
              <Marcador
                label="Impressora habilitada"
                checked={draft.printer.enabled}
                onChange={setPrinter("enabled")}
              />

              {draft.printer.enabled && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Texto
                      label="Modelo"
                      value={draft.printer.model}
                      onChange={setPrinter("model")}
                    />
                    <Texto
                      label="Porta"
                      value={draft.printer.port}
                      placeholder="COM1, USB, 192.168.0.50:9100"
                      onChange={setPrinter("port")}
                    />
                    <NumeroFixo
                      label="Página de código"
                      value={draft.printer.codePage}
                      onChange={setPrinter("codePage")}
                    />
                    <NumeroFixo
                      label="Colunas"
                      value={draft.printer.columns}
                      onChange={setPrinter("columns")}
                    />
                    <NumeroFixo
                      label="Tipo de corte"
                      value={draft.printer.cutType}
                      onChange={setPrinter("cutType")}
                    />
                    <NumeroFixo
                      label="Linhas após a impressão"
                      value={draft.printer.lineFeedAfter}
                      onChange={setPrinter("lineFeedAfter")}
                    />
                    <NumeroFixo
                      label="Cópias"
                      value={draft.printer.copies}
                      onChange={setPrinter("copies")}
                    />
                    <NumeroFixo
                      label="Tempo limite (ms)"
                      value={draft.printer.timeoutMs}
                      onChange={setPrinter("timeoutMs")}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Marcador
                      label="Cortar papel"
                      checked={draft.printer.cutPaper}
                      onChange={setPrinter("cutPaper")}
                    />
                    <Marcador
                      label="Traduzir marcações"
                      checked={draft.printer.translateTags}
                      onChange={setPrinter("translateTags")}
                    />
                    <Marcador
                      label="Ignorar marcações"
                      checked={draft.printer.ignoreTags}
                      onChange={setPrinter("ignoreTags")}
                    />
                    <Marcador
                      label="Verificar impressão"
                      checked={draft.printer.verify}
                      onChange={setPrinter("verify")}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {recusa && (
          <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <span>{recusa}</span>
          </p>
        )}

        {mutation.error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {mutation.error instanceof Error ? mutation.error.message : "Não foi possível salvar."}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-4">
          <span className="text-xs text-muted-foreground">
            {wantsProduction(draft) && !recusa ? "A licença permite operação em produção." : ""}
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || recusa !== null}
              title={recusa ?? undefined}
              className="rounded-lg bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {mutation.isPending ? "Salvando..." : totem ? "Salvar" : "Cadastrar"}
            </button>
          </span>
        </div>
      </form>
    </div>
  );
}
