import type { IssuerRepository } from "../application/issuer-repository";
import type { NfceIssuer } from "../domain/nfce-issuer";
import type { ElectronApi } from "@/shared/runtime/electron-api";
import { asBoolean, asIsoDate, asNumber, asText } from "@/shared/infrastructure/convert";

/**
 * Colunas do emitente — listadas uma a uma, de propósito.
 *
 * As colunas de segredo em claro (`aditum_tef_partner_token`,
 * `aditum_tef_activation_code`, `apikey_easyerp`) NÃO aparecem aqui, e é assim
 * que devem continuar. O projeto anterior fazia `SELECT *` e apagava esses
 * campos depois, no processo principal; a proteção existia, mas o valor já
 * havia saído do banco. Não pedir é mais forte que apagar depois.
 *
 * Das colunas cifradas lê-se apenas se existem, nunca o conteúdo — é o que a
 * tela precisa saber.
 */
const COLUMNS = `
  c.id, c.cnpj, c.company_name, c.trade_name, c.state_registration,
  c.municipal_registration, c.cnae,
  c.street, c.number, c.complement, c.neighborhood,
  c.municipality_code, c.municipality_name, c.uf, c.zip_code, c.phone,
  c.environment, c.nfce_serie, c.nfe_serie, c.tax_regime_code, c.pis_cofins_regime_code,
  c.certificate_holder_name, c.certificate_holder_cnpj, c.certificate_authority_name,
  c.certificate_series, c.certificate_valid_until,
  c.tef_admin_http_base_url, c.companyid_easyerp, c.storeid_easyerp,
  c.is_active,
  (c.aditum_tef_partner_token_encrypted    IS NOT NULL) AS has_partner_token,
  (c.aditum_tef_activation_code_encrypted  IS NOT NULL) AS has_activation_code,
  (c.apikey_easyerp_encrypted              IS NOT NULL) AS has_easyerp_api_key
`;

export class PostgresIssuerRepository implements IssuerRepository {
  constructor(private readonly api: ElectronApi) {}

  async get(): Promise<NfceIssuer | null> {
    const result = await this.api.query<Record<string, unknown>>(
      `SELECT ${COLUMNS}
       FROM nfce_issuer_config c
       ORDER BY c.is_active DESC, c.updated_at DESC NULLS LAST
       LIMIT 1`,
    );
    if (!result.ok) throw new Error(`Falha ao carregar o emitente: ${result.error}`);

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: asText(row.id) ?? "",
      identification: {
        cnpj: asText(row.cnpj) ?? "",
        companyName: asText(row.company_name) ?? "",
        tradeName: asText(row.trade_name),
        stateRegistration: asText(row.state_registration),
        municipalRegistration: asText(row.municipal_registration),
        cnae: asText(row.cnae),
      },
      address: {
        street: asText(row.street),
        number: asText(row.number),
        complement: asText(row.complement),
        neighborhood: asText(row.neighborhood),
        cityName: asText(row.municipality_name),
        cityCode: asText(row.municipality_code),
        uf: asText(row.uf),
        zipCode: asText(row.zip_code),
        phone: asText(row.phone),
      },
      fiscal: {
        environment: row.environment == null ? null : asNumber(row.environment),
        nfceSerie: row.nfce_serie == null ? null : asNumber(row.nfce_serie),
        nfeSerie: row.nfe_serie == null ? null : asNumber(row.nfe_serie),
        taxRegimeCode: row.tax_regime_code == null ? null : asNumber(row.tax_regime_code),
        pisCofinsRegimeCode:
          row.pis_cofins_regime_code == null ? null : asNumber(row.pis_cofins_regime_code),
      },
      certificate: {
        holderName: asText(row.certificate_holder_name),
        holderCnpj: asText(row.certificate_holder_cnpj),
        authorityName: asText(row.certificate_authority_name),
        serialNumber: asText(row.certificate_series),
        validUntil: row.certificate_valid_until == null ? null : asIsoDate(row.certificate_valid_until),
      },
      integrations: {
        aditumPartnerToken: asBoolean(row.has_partner_token),
        aditumActivationCode: asBoolean(row.has_activation_code),
        easyerpApiKey: asBoolean(row.has_easyerp_api_key),
        easyerpApiKeyPrefix: null,
        tefBaseUrl: asText(row.tef_admin_http_base_url),
        easyerpCompanyId: asText(row.companyid_easyerp),
        easyerpStoreId: asText(row.storeid_easyerp),
      },
      isActive: asBoolean(row.is_active),
    };
  }
}
