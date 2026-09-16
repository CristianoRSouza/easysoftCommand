import { textOrNull } from "@/shared/domain/text";
import type { NfceIssuer } from "./nfce-issuer";

/**
 * O que a tela do emitente pode alterar.
 *
 * Na nuvem o emitente é a própria loja: os dados que a NFC-e assina saem do
 * cadastro dela. Por isso a edição para no cadastro, e não alcança o que é
 * decidido em outro lugar — o certificado vem de quem o instalou, o município
 * e os regimes tributários são referências a tabelas próprias, e a situação
 * ativa da loja é assunto de comercial, não de configuração fiscal.
 */
export interface IssuerDraft {
  companyName: string;
  tradeName: string | null;
  cnpj: string;
  stateRegistration: string | null;
  municipalRegistration: string | null;
  cnae: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  zipCode: string | null;
  phone: string | null;
  nfceSerie: number | null;
  nfeSerie: number | null;
}

export function draftFrom(issuer: NfceIssuer): IssuerDraft {
  return {
    companyName: issuer.identification.companyName,
    tradeName: issuer.identification.tradeName,
    cnpj: issuer.identification.cnpj,
    stateRegistration: issuer.identification.stateRegistration,
    municipalRegistration: issuer.identification.municipalRegistration,
    cnae: issuer.identification.cnae,
    street: issuer.address.street,
    number: issuer.address.number,
    complement: issuer.address.complement,
    neighborhood: issuer.address.neighborhood,
    zipCode: issuer.address.zipCode,
    phone: issuer.address.phone,
    nfceSerie: issuer.fiscal.nfceSerie,
    nfeSerie: issuer.fiscal.nfeSerie,
  };
}

export interface IssuerWarning {
  field: keyof IssuerDraft;
  message: string;
}

const DIGITS = /\D/g;
const CNPJ_DIGITS = 14;
const ZIP_DIGITS = 8;
const CNAE_DIGITS = 7;

function digitCount(value: string | null): number {
  return (value ?? "").replace(DIGITS, "").length;
}

/**
 * O que está estranho — sem impedir a gravação.
 *
 * O sistema em produção não recusa nada aqui, e transformar uma migração em
 * decisão de produto travaria quem hoje consegue salvar. Os avisos existem
 * porque um CNPJ com dígito faltando só aparece quando a SEFAZ rejeita a nota,
 * e aí a venda já aconteceu.
 */
export function inspectIssuer(draft: IssuerDraft): IssuerWarning[] {
  const warnings: IssuerWarning[] = [];

  if (draft.companyName.trim() === "") {
    warnings.push({ field: "companyName", message: "A razão social sai impressa na nota." });
  }

  const cnpj = digitCount(draft.cnpj);
  if (cnpj !== CNPJ_DIGITS) {
    warnings.push({
      field: "cnpj",
      message: `O CNPJ tem ${cnpj} dígitos; a SEFAZ espera ${CNPJ_DIGITS}.`,
    });
  }

  if (draft.zipCode && digitCount(draft.zipCode) !== ZIP_DIGITS) {
    warnings.push({ field: "zipCode", message: `O CEP tem ${ZIP_DIGITS} dígitos.` });
  }

  if (draft.cnae && digitCount(draft.cnae) !== CNAE_DIGITS) {
    warnings.push({ field: "cnae", message: `O CNAE tem ${CNAE_DIGITS} dígitos.` });
  }

  if (draft.stateRegistration == null || draft.stateRegistration.trim() === "") {
    warnings.push({
      field: "stateRegistration",
      message: "Sem inscrição estadual a NFC-e costuma ser rejeitada.",
    });
  }

  return warnings;
}

/** As colunas do cadastro da loja, já normalizadas. */
export function toColumns(draft: IssuerDraft): Record<string, unknown> {
  return {
    legal_name: draft.companyName.trim(),
    trade_name: textOrNull(draft.tradeName),
    cnpj: draft.cnpj.trim(),
    state_registration: textOrNull(draft.stateRegistration),
    municipal_registration: textOrNull(draft.municipalRegistration),
    cnae: textOrNull(draft.cnae),
    address: textOrNull(draft.street),
    address_number: textOrNull(draft.number),
    address_complement: textOrNull(draft.complement),
    neighborhood: textOrNull(draft.neighborhood),
    zip_code: textOrNull(draft.zipCode),
    phone1: textOrNull(draft.phone),
    nfce_series: draft.nfceSerie,
    nfe_series: draft.nfeSerie,
  };
}
