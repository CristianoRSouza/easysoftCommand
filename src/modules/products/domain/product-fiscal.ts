/**
 * A classificação fiscal de um produto.
 *
 * É o que determina o imposto que sai na nota. Quando a SEFAZ rejeita uma
 * NFC-e por NCM ou CFOP, é aqui que está a causa — por isso a tela de produtos
 * mostra estes campos, mesmo sendo dado técnico.
 *
 * Os valores são guardados como texto porque vêm assim do cadastro do PDV:
 * convertê-los para número transformaria "0,00" e vazio na mesma coisa, e a
 * diferença entre alíquota zero e alíquota não informada importa.
 */
export interface ProductFiscal {
  productId: string;
  identification: FiscalIdentification;
  icms: FiscalIcms;
  pis: FiscalContribution;
  cofins: FiscalContribution;
  taxReform: FiscalTaxReform;
}

export interface FiscalIdentification {
  ncm: string | null;
  cfop: string | null;
  cfopDescription: string | null;
  cfopEntryExit: string | null;
  cest: string | null;
  fiscalUnit: string | null;
  taxRuleCode: number | null;
  taxRuleDescription: string | null;
  taxBenefitCode: string | null;
  ipiTaxSituation: string | null;
}

export interface FiscalIcms {
  /** 0 = nacional; os demais indicam importação, total ou parcial. */
  origin: number | null;
  originState: string | null;
  /** CST no Regime Normal, CSOSN no Simples Nacional. Nunca os dois. */
  cst: string | null;
  csosn: string | null;
  description: string | null;
  type: string | null;
  rate: string | null;
  rateFundoPobreza: string | null;
  reductionPercent: string | null;
  creditRateSimples: string | null;
  substitutionRate: string | null;
  substitutionRateFundoPobreza: string | null;
  substitutionMargin: string | null;
  resellerFlag: string | null;
}

export interface FiscalContribution {
  cst: string | null;
  description: string | null;
  calculationType: string | null;
  rate: string | null;
  rateValue: string | null;
}

/** Classificação da reforma tributária e as alíquotas de referência do NCM. */
export interface FiscalTaxReform {
  taxClassCode: string | null;
  nationalRate: string | null;
  importedRate: string | null;
  stateRate: string | null;
}

/** `true` quando a reforma já classificou este produto. */
export function hasTaxReformClass(reform: FiscalTaxReform): boolean {
  return Boolean(reform.taxClassCode || reform.nationalRate || reform.stateRate);
}

/**
 * Regime pelo código de ICMS presente.
 *
 * O CSOSN é do Simples Nacional e o CST do Regime Normal; ter os dois
 * preenchidos é sinal de cadastro inconsistente, não de produto especial.
 */
export type IcmsRegime = "simples" | "normal" | "indefinido" | "conflito";

export function icmsRegime(icms: FiscalIcms): IcmsRegime {
  const temCsosn = Boolean(icms.csosn);
  const temCst = Boolean(icms.cst);
  if (temCsosn && temCst) return "conflito";
  if (temCsosn) return "simples";
  if (temCst) return "normal";
  return "indefinido";
}

export const ICMS_REGIME_LABEL: Record<IcmsRegime, string> = {
  simples: "Simples Nacional (CSOSN)",
  normal: "Regime Normal (CST)",
  indefinido: "Sem código de ICMS",
  conflito: "CST e CSOSN preenchidos ao mesmo tempo",
};

/** A origem da mercadoria em palavras. */
const ORIGIN_LABEL: Record<number, string> = {
  0: "Nacional",
  1: "Estrangeira — importação direta",
  2: "Estrangeira — mercado interno",
  3: "Nacional com mais de 40% de conteúdo importado",
  4: "Nacional por processo produtivo básico",
  5: "Nacional com até 40% de conteúdo importado",
  6: "Estrangeira — importação direta, sem similar nacional",
  7: "Estrangeira — mercado interno, sem similar nacional",
  8: "Nacional com mais de 70% de conteúdo importado",
};

export function originLabel(origin: number | null): string | null {
  if (origin == null) return null;
  return ORIGIN_LABEL[origin] ?? `Origem ${origin}`;
}
