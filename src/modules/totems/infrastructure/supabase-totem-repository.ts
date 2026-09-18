import type { SupabaseClient } from "@supabase/supabase-js";
import type { TotemRepository } from "../application/totem-repository";
import type { Totem } from "../domain/totem";
import { toColumns, type TotemDraft } from "../domain/totem-draft";
import type { TotemLicenseSlot } from "../domain/totem-license";
import { diffForAudit, type TotemAuditAction } from "../domain/totem-audit";
import type { CreateOutcome, SaveOutcome } from "../application/totem-repository";
import type { Tenant } from "@/shared/tenant/tenant";
import { secretToColumn } from "@/shared/domain/secret-edit";
import { asText } from "@/shared/infrastructure/convert";
import { TOTEM_COLUMNS_CLOUD, TOTEM_COLUMNS_FOR_DIFF, toLicense, toTotem } from "./totem-mapper";
import { encryptTefSecrets } from "./totem-secrets";

type Row = Record<string, unknown>;

const TOTENS = "vw_devices_totem_config";
const AUDITORIA = "vw_devices_totem_config_audit";

/**
 * As licenças moram no esquema `billing`, não no `public`.
 *
 * Procurá-las no `public` devolve 404, e o erro era descartado: o painel
 * seguia em frente com a lista vazia e desenhava "licença ausente" em todos os
 * totens. Um alarme falso em cima de um dado que nunca chegou a ser lido.
 */
const LICENCAS_ESQUEMA = "billing";
const LICENCAS = "device_licenses";

const LICENCA_COLUNAS =
  "totem_config_id, license_type, plan_slug, status, starts_at, expires_at, max_transactions_month";

const SLOT_COLUNAS = "id, device_key, license_type, plan_slug, status, totem_config_id";

export class SupabaseTotemRepository implements TotemRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  private licencas() {
    return this.client.schema(LICENCAS_ESQUEMA).from(LICENCAS);
  }

  async list(): Promise<Totem[]> {
    // Totens pertencem à empresa, como as unidades — não à loja.
    const { data, error } = await this.client
      .from(TOTENS)
      .select(TOTEM_COLUMNS_CLOUD)
      .eq("company_id", this.tenant.companyId)
      .order("totem_name");

    if (error) throw new Error(`Falha ao listar totens: ${error.message}`);

    const rows = (data ?? []) as unknown as Row[];
    if (rows.length === 0) return [];

    const ids = rows.map((row) => asText(row.id)).filter((id): id is string => id !== null);
    const { data: licencas, error: erroLicencas } = await this.licencas()
      .select(LICENCA_COLUNAS)
      .in("totem_config_id", ids);

    if (erroLicencas) throw new Error(`Falha ao ler as licenças: ${erroLicencas.message}`);

    const porTotem = new Map<string, Row>();
    for (const licenca of (licencas ?? []) as unknown as Row[]) {
      const id = asText(licenca.totem_config_id);
      if (id) porTotem.set(id, licenca);
    }

    return rows.map((row) => toTotem(row, toLicense(porTotem.get(asText(row.id) ?? ""))));
  }

  /** As licenças de totem da empresa, livres ou não — a tela decide o que mostrar. */
  async licenseSlots(): Promise<TotemLicenseSlot[]> {
    const { data, error } = await this.licencas()
      .select(SLOT_COLUNAS)
      .eq("company_id", this.tenant.companyId)
      .eq("device_type", "totem")
      .order("device_key");

    if (error) throw new Error(`Falha ao listar as licenças: ${error.message}`);

    return ((data ?? []) as unknown as Row[]).map((row) => ({
      id: asText(row.id) ?? "",
      deviceKey: asText(row.device_key),
      type: asText(row.license_type),
      planSlug: asText(row.plan_slug),
      status: asText(row.status),
      boundTo: asText(row.totem_config_id),
    }));
  }

  /**
   * Prende a licença ao totem, soltando antes a que ele tinha.
   *
   * A ordem importa: o banco recusa duas licenças no mesmo totem, e recusa
   * totem ativo sem licença. Soltar depois de prender deixaria um instante
   * inválido entre os dois comandos.
   */
  async bindLicense(totemId: string, licenseId: string | null): Promise<void> {
    const { data: atuais, error: erroAtuais } = await this.licencas()
      .select("id")
      .eq("totem_config_id", totemId);

    if (erroAtuais) throw new Error(`Falha ao ler a licença atual: ${erroAtuais.message}`);

    for (const row of (atuais ?? []) as unknown as Row[]) {
      const id = asText(row.id);
      if (!id || id === licenseId) continue;
      const { error } = await this.licencas().update({ totem_config_id: null }).eq("id", id);
      if (error) throw new Error(`Falha ao soltar a licença anterior: ${error.message}`);
    }

    if (!licenseId) return;

    const { error } = await this.licencas()
      .update({ totem_config_id: totemId })
      .eq("id", licenseId)
      .eq("company_id", this.tenant.companyId)
      .eq("status", "active");

    if (error) throw new Error(`Falha ao vincular a licença: ${error.message}`);
  }

  /**
   * Cadastra um totem.
   *
   * Nasce inativo mesmo quando o formulário pede ativo: o banco recusa totem
   * ativo sem licença, e a licença só pode ser presa depois que o registro
   * existe. Ativar é o último passo.
   */
  async create(
    draft: TotemDraft,
    licenseId: string | null,
    performedBy: string,
  ): Promise<CreateOutcome> {
    const colunas = await this.columnsWithSecrets(draft);

    const { data, error } = await this.client
      .from(TOTENS)
      .insert({
        ...colunas,
        is_active: false,
        company_id: this.tenant.companyId,
        store_id: this.tenant.storeId,
      })
      .select("id")
      .single();

    if (error) throw new Error(`Falha ao cadastrar o totem: ${error.message}`);

    const id = asText((data as Row | null)?.id);
    if (!id) throw new Error("O totem foi cadastrado mas o banco não devolveu o identificador.");

    if (licenseId) await this.bindLicense(id, licenseId);
    if (draft.isActive) await this.setActive(id, true);

    const auditoria = await this.writeAudit(
      id,
      "created",
      { changedFields: Object.keys(colunas), previousValues: {}, newValues: colunas },
      performedBy,
    );

    return { id, ...auditoria };
  }

  /**
   * Grava as alterações de um totem e registra o que mudou.
   *
   * A gravação é parcial: só as colunas do rascunho entram no comando. Os
   * segredos entram apenas quando o operador pediu para trocá-los ou apagá-los.
   */
  async update(id: string, draft: TotemDraft, performedBy: string): Promise<SaveOutcome> {
    const anterior = await this.linhaAtual(id);
    const colunas = await this.columnsWithSecrets(draft);

    const registro = diffForAudit(anterior, colunas);
    if (!registro) return { audited: true, auditError: null };

    const { error } = await this.client
      .from(TOTENS)
      .update({ ...colunas, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", this.tenant.companyId);

    if (error) throw new Error(`Falha ao salvar o totem: ${error.message}`);

    return this.writeAudit(id, "updated", registro, performedBy);
  }

  /** Liga ou desliga o totem, sem tocar no resto da configuração. */
  async setActive(id: string, isActive: boolean, performedBy = "painel"): Promise<SaveOutcome> {
    const { error } = await this.client
      .from(TOTENS)
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", this.tenant.companyId);

    if (error) throw new Error(`Falha ao alterar o totem: ${error.message}`);

    return this.writeAudit(
      id,
      "toggled",
      {
        changedFields: ["is_active"],
        previousValues: { is_active: !isActive },
        newValues: { is_active: isActive },
      },
      performedBy,
    );
  }

  /** Cifra o que precisa e devolve todas as colunas a gravar. */
  private async columnsWithSecrets(draft: TotemDraft): Promise<Record<string, unknown>> {
    const colunas = toColumns(draft);

    // Chaves de serviço são guardadas em claro pelo esquema; os segredos da
    // Aditum, cifrados. A diferença é do banco, não desta camada.
    const emClaro: Array<[string, ReturnType<typeof secretToColumn>]> = [
      ["nfce_service_api_key", secretToColumn(draft.nfceServiceApiKey)],
      ["tef_http_api_key", secretToColumn(draft.tefHttpApiKey)],
      ["pix_http_api_key", secretToColumn(draft.pixHttpApiKey)],
    ];
    for (const [coluna, valor] of emClaro) {
      if (valor !== undefined) colunas[coluna] = valor;
    }

    const cifrados = await encryptTefSecrets(
      this.client,
      draft.aditumPartnerToken,
      draft.aditumActivationCode,
    );
    if (cifrados.partnerToken) {
      colunas.aditum_partner_token_encrypted = cifrados.partnerToken.encrypted;
      colunas.aditum_partner_token_kid = cifrados.partnerToken.kid;
    }
    if (cifrados.activationCode) {
      colunas.aditum_activation_code_encrypted = cifrados.activationCode.encrypted;
      colunas.aditum_activation_code_kid = cifrados.activationCode.kid;
    }

    return colunas;
  }

  /** O estado atual, para comparar com o que se vai gravar. */
  private async linhaAtual(id: string): Promise<Row> {
    const { data, error } = await this.client
      .from(TOTENS)
      .select(TOTEM_COLUMNS_FOR_DIFF)
      .eq("id", id)
      .eq("company_id", this.tenant.companyId)
      .maybeSingle();

    if (error) throw new Error(`Falha ao ler o totem: ${error.message}`);
    if (!data) throw new Error("Este totem não existe mais ou pertence a outra empresa.");
    return data as unknown as Row;
  }

  /**
   * Registra a alteração na trilha — e devolve o que aconteceu, em vez de
   * lançar.
   *
   * A alteração já está gravada quando isto roda: falhar aqui não desfaz nada,
   * e transformar a falha em erro faria a tela dizer que não salvou algo que
   * salvou. Mas o banco recusa esta escrita para quem não é administrador
   * (`permission denied for table totem_config_audit`), e o projeto anterior
   * engole essa recusa em silêncio — as alterações entram e a trilha fica
   * vazia, sem ninguém saber. Aqui a recusa sobe até a tela como aviso.
   */
  private async writeAudit(
    totemId: string,
    action: TotemAuditAction,
    registro: { changedFields: string[]; previousValues: Row; newValues: Row },
    performedBy: string,
  ): Promise<SaveOutcome> {
    const { error } = await this.client.from(AUDITORIA).insert({
      company_id: this.tenant.companyId,
      store_id: this.tenant.storeId,
      totem_config_id: totemId,
      action,
      changed_fields: registro.changedFields,
      previous_values: registro.previousValues,
      new_values: registro.newValues,
      performed_by: performedBy,
    });

    return { audited: !error, auditError: error?.message ?? null };
  }
}
