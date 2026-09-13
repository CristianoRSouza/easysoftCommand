/**
 * Emitente da NFC-e — quem assina fiscalmente as vendas da loja.
 *
 * Sem emitente configurado e certificado válido, a loja não emite documento
 * fiscal. É a configuração que, quando vence, para a operação.
 */
export interface NfceIssuer {
  id: string;
  identification: IssuerIdentification;
  address: IssuerAddress;
  fiscal: IssuerFiscalSettings;
  certificate: IssuerCertificate | null;
  integrations: IssuerIntegrations;
  isActive: boolean;
}

export interface IssuerIdentification {
  cnpj: string;
  companyName: string;
  tradeName: string | null;
  stateRegistration: string | null;
  municipalRegistration: string | null;
  cnae: string | null;
}

export interface IssuerAddress {
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  cityName: string | null;
  cityCode: string | null;
  uf: string | null;
  zipCode: string | null;
  phone: string | null;
}

export interface IssuerFiscalSettings {
  /** 1 = produção, 2 = homologação. Emitir em homologação não vale fiscalmente. */
  environment: number | null;
  nfceSerie: number | null;
  nfeSerie: number | null;
  taxRegimeCode: number | null;
  pisCofinsRegimeCode: number | null;
}

export interface IssuerCertificate {
  holderName: string | null;
  holderCnpj: string | null;
  authorityName: string | null;
  serialNumber: string | null;
  validUntil: string | null;
}

/**
 * Presença dos segredos de integração — nunca os valores.
 *
 * O token da Aditum e a chave do EasyERP ficam cifrados no banco (`enc:v1:`
 * AES-256-GCM) e não são lidos por esta tela. Quem administra precisa saber se
 * *está configurado*, não qual é: mostrar o segredo na tela o exporia a quem
 * olha o monitor, à captura de tela e ao log do navegador, sem benefício.
 */
export interface IssuerIntegrations {
  aditumPartnerToken: boolean;
  aditumActivationCode: boolean;
  easyerpApiKey: boolean;
  /** Prefixo público da chave, quando existe — serve para identificar qual é. */
  easyerpApiKeyPrefix: string | null;
  tefBaseUrl: string | null;
  easyerpCompanyId: string | null;
  easyerpStoreId: string | null;
}

export type CertificateHealth = "missing" | "expired" | "expiring" | "valid";

/** Dias de antecedência em que o vencimento já merece aviso. */
export const CERTIFICATE_WARNING_DAYS = 30;

/**
 * Situação do certificado.
 *
 * Vencido significa que a loja não consegue emitir nota — não é um detalhe de
 * cadastro, é uma parada de operação. Por isso a antecedência do aviso.
 */
export function certificateHealth(
  certificate: IssuerCertificate | null,
  now: Date = new Date(),
): CertificateHealth {
  const validUntil = certificate?.validUntil;
  if (!validUntil) return "missing";

  const expiry = new Date(validUntil);
  if (Number.isNaN(expiry.getTime())) return "missing";
  if (expiry.getTime() <= now.getTime()) return "expired";

  const days = (expiry.getTime() - now.getTime()) / 86_400_000;
  return days <= CERTIFICATE_WARNING_DAYS ? "expiring" : "valid";
}

/** Dias restantes até o vencimento; negativo quando já venceu. */
export function daysUntilExpiry(
  certificate: IssuerCertificate | null,
  now: Date = new Date(),
): number | null {
  const validUntil = certificate?.validUntil;
  if (!validUntil) return null;
  const expiry = new Date(validUntil);
  if (Number.isNaN(expiry.getTime())) return null;
  return Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000);
}

/** 1 = produção; qualquer outro valor emite sem valor fiscal. */
export function isProduction(fiscal: IssuerFiscalSettings): boolean {
  return fiscal.environment === 1;
}
