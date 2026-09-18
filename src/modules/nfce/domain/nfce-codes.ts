/**
 * Os códigos da NFC-e em português.
 *
 * O XML fala em números — `tpAmb 2`, `tpEmis 9`, `finNFe 4`. Na tela isso
 * precisa virar frase: é a diferença entre "a nota está em homologação" e um
 * dois solto que ninguém sabe ler.
 */
function label(mapa: Record<number, string>) {
  return (codigo: number | null | undefined): string | null =>
    codigo == null ? null : (mapa[codigo] ?? `Código ${codigo}`);
}

/** 1 = produção; 2 = homologação, onde a nota não tem valor fiscal. */
export const environmentLabel = label({ 1: "Produção", 2: "Homologação" });

/** Fora do 1, toda emissão é contingência — a nota saiu sem falar com a SEFAZ na hora. */
export const emissionTypeLabel = label({
  1: "Normal",
  2: "Contingência FS-IA",
  3: "Contingência SCAN",
  4: "Contingência DPEC",
  5: "Contingência FS-DA",
  6: "Contingência SVC-AN",
  7: "Contingência SVC-RS",
  9: "Contingência offline",
});

export const emissionPurposeLabel = label({
  1: "Normal",
  2: "Complementar",
  3: "Ajuste",
  4: "Devolução",
});

export const finalConsumerLabel = label({ 0: "Não", 1: "Sim" });

export const presenceLabel = label({
  0: "Não se aplica",
  1: "Presencial",
  2: "Internet",
  3: "Teleatendimento",
  4: "Entrega a domicílio",
  5: "Presencial fora do estabelecimento",
  9: "Não presencial, outros",
});

export const intermediaryLabel = label({
  0: "Sem intermediador",
  1: "Site ou plataforma de terceiros",
});

export const danfePrintLabel = label({
  0: "Sem DANFE",
  1: "Retrato",
  2: "Paisagem",
  3: "Simplificado",
  4: "NFC-e",
  5: "NFC-e em mensagem eletrônica",
});

export const emissionProcessLabel = label({
  0: "Aplicativo do contribuinte",
  1: "Avulsa pelo fisco",
  2: "Avulsa pelo contribuinte",
  3: "Aplicativo fornecido pelo fisco",
});

/**
 * Situação da conferência entre a nota e a venda.
 *
 * Os valores vêm do banco em inglês; o que o operador precisa saber é se
 * alguém tem de fazer alguma coisa.
 */
export const RECONCILE_LABEL: Record<string, string> = {
  pending: "Aguardando conferência",
  matched: "Conferida",
  mismatch: "Divergente",
  failed: "Falhou",
  manual: "Correção manual",
  ignored: "Ignorada",
};

export function reconcileLabel(status: string | null): string | null {
  if (!status) return null;
  return RECONCILE_LABEL[status] ?? status;
}
