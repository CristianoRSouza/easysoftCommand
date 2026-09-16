import type { SupabaseClient } from "@supabase/supabase-js";
import type { TotemRepository } from "../application/totem-repository";
import type { Totem } from "../domain/totem";
import { toColumns, type TotemDraft } from "../domain/totem-draft";
import { diffForAudit } from "../domain/totem-audit";
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

export class SupabaseTotemRepository implements TotemRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

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
    const { data: licencas, error: erroLicencas } = await this.client
      .schema(LICENCAS_ESQUEMA)
      .from(LICENCAS)
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

  /**
   * Grava as alterações de um totem e registra o que mudou.
   *
   * A gravação é parcial: só as colunas do rascunho entram no comando. Os
   * segredos entram apenas quando o operador pediu para trocá-los ou apagá-los.
   */
  async update(id: string, draft: TotemDraft, performedBy: string): Promise<void> {
    const anterior = await this.linhaAtual(id);

    const colunas = toColumns(draft);

    // Chaves de serviço são guardadas em claro pelo esquema; os segredos da
    // Aditum, cifrados. A diferença é do banco, não desta camada.
    const nfceKey = secretToColumn(draft.nfceServiceApiKey);
    if (nfceKey !== undefined) colunas.nfce_service_api_key = nfceKey;
    const tefKey = secretToColumn(draft.tefApiKey);
    if (tefKey !== undefined) colunas.tef_http_api_key = tefKey;

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

    const registro = diffForAudit(anterior, colunas);
    if (!registro) return;

    const { error } = await this.client
      .from(TOTENS)
      .update({ ...colunas, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", this.tenant.companyId);

    if (error) throw new Error(`Falha ao salvar o totem: ${error.message}`);

    const { error: erroAuditoria } = await this.client.from(AUDITORIA).insert({
      company_id: this.tenant.companyId,
      store_id: this.tenant.storeId,
      totem_config_id: id,
      action: "updated",
      changed_fields: registro.changedFields,
      previous_values: registro.previousValues,
      new_values: registro.newValues,
      performed_by: performedBy,
    });

    // A alteração já está gravada. Falhar aqui apagaria da tela uma mudança que
    // aconteceu de verdade; o que falta é o registro dela, e é isso que se diz.
    if (erroAuditoria) {
      throw new Error(
        `O totem foi salvo, mas a alteração não pôde ser registrada na auditoria: ${erroAuditoria.message}`,
      );
    }
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
}
