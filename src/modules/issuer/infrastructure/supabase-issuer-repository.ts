import type { SupabaseClient } from "@supabase/supabase-js";
import type { IssuerRepository } from "../application/issuer-repository";
import type { NfceIssuer } from "../domain/nfce-issuer";
import { toColumns, type IssuerDraft } from "../domain/issuer-draft";
import type { Tenant } from "@/shared/tenant/tenant";
import { asBoolean, asIsoDate, asNumber, asText } from "@/shared/infrastructure/convert";

/**
 * Na nuvem o emitente não é uma tabela própria: é a própria loja, mais o
 * certificado ativo e a chave de API. Três origens compondo o mesmo conceito
 * que, no PostgreSQL local, mora numa linha só de `nfce_issuer_config`.
 *
 * A chave de API é lida apenas pelo prefixo (`key_prefix`), nunca pelo valor —
 * o prefixo identifica qual chave é sem revelar o segredo.
 */
const STORE_COLUMNS = [
  "id, legacy_store_code, legal_name, trade_name, cnpj, state_registration",
  "municipal_registration, cnae, address, address_number, address_complement",
  "neighborhood, zip_code, phone1, is_active, nfe_series, nfce_series",
  "tax_regime:tax_regime_id(code)",
  "pis_cofins_regime:pis_cofins_regime_id(code)",
  "city:city_id(code, name, state_acronym)",
].join(", ");

type Row = Record<string, unknown>;

/** Lê `{ code }` de uma relação que o PostgREST devolve como objeto ou array. */
function relationCode(value: unknown): number | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  const code = (row as Row).code;
  return code == null ? null : asNumber(code);
}

function relationField(value: unknown, field: string): string | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  return asText((row as Row)[field]);
}

export class SupabaseIssuerRepository implements IssuerRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  async get(): Promise<NfceIssuer | null> {
    const [storeRes, certRes, keyRes] = await Promise.all([
      this.client
        .from("pv_stores")
        .select(STORE_COLUMNS)
        .eq("id", this.tenant.storeId)
        .maybeSingle(),
      this.client
        .from("vw_nfce_certificate_active")
        .select("subject_name, subject_cnpj, issuer_name, serial_number, valid_until")
        .eq("store_id", this.tenant.storeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      this.client
        .from("pv_store_api_keys")
        .select("key_prefix, is_active")
        .eq("store_id", this.tenant.storeId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (storeRes.error) throw new Error(`Falha ao carregar o emitente: ${storeRes.error.message}`);
    if (!storeRes.data) return null;

    const store = storeRes.data as unknown as Row;
    const cert = (certRes.data ?? null) as Row | null;
    const key = (keyRes.data ?? null) as Row | null;

    return {
      id: asText(store.id) ?? "",
      identification: {
        cnpj: asText(store.cnpj) ?? "",
        companyName: asText(store.legal_name) ?? "",
        tradeName: asText(store.trade_name),
        stateRegistration: asText(store.state_registration),
        municipalRegistration: asText(store.municipal_registration),
        cnae: asText(store.cnae),
      },
      address: {
        street: asText(store.address),
        number: asText(store.address_number),
        complement: asText(store.address_complement),
        neighborhood: asText(store.neighborhood),
        cityName: relationField(store.city, "name"),
        cityCode: relationField(store.city, "code"),
        uf: relationField(store.city, "state_acronym"),
        zipCode: asText(store.zip_code),
        phone: asText(store.phone1),
      },
      fiscal: {
        nfceSerie: store.nfce_series == null ? null : asNumber(store.nfce_series),
        nfeSerie: store.nfe_series == null ? null : asNumber(store.nfe_series),
        taxRegimeCode: relationCode(store.tax_regime),
        pisCofinsRegimeCode: relationCode(store.pis_cofins_regime),
      },
      certificate: cert
        ? {
            holderName: asText(cert.subject_name),
            holderCnpj: asText(cert.subject_cnpj),
            authorityName: asText(cert.issuer_name),
            serialNumber: asText(cert.serial_number),
            validUntil: cert.valid_until == null ? null : asIsoDate(cert.valid_until),
          }
        : null,
      integrations: {
        // Os segredos da Aditum vivem só no banco da loja; a nuvem não os guarda.
        aditumPartnerToken: false,
        aditumActivationCode: false,
        easyerpApiKey: key ? asBoolean(key.is_active) : false,
        easyerpApiKeyPrefix: asText(key?.key_prefix),
        tefBaseUrl: null,
        easyerpCompanyId: this.tenant.companyId,
        easyerpStoreId: this.tenant.storeId,
      },
      isActive: asBoolean(store.is_active),
    };
  }

  /**
   * Grava o cadastro da loja — que é o emitente, na nuvem.
   *
   * O projeto anterior não tem este caminho: fora do programa instalado, a
   * função de salvar o emitente devolve `{ ok: true }` sem escrever nada
   * (`if (!isElectron()) return { ok: true };`). Quem edita pelo navegador vê
   * a confirmação de sucesso, fecha a tela e perde a alteração — e só
   * descobre na próxima vez que abrir, ou quando a nota sair com o dado
   * antigo.
   */
  async update(draft: IssuerDraft): Promise<NfceIssuer> {
    const { error } = await this.client
      .from("pv_stores")
      .update(toColumns(draft))
      .eq("id", this.tenant.storeId);

    if (error) throw new Error(`Falha ao salvar o emitente: ${error.message}`);

    const salvo = await this.get();
    if (!salvo) throw new Error("O emitente foi salvo mas não pôde ser lido de volta.");
    return salvo;
  }
}
