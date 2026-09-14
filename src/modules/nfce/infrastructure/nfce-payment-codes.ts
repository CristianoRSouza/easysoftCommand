/**
 * Códigos fiscais de forma de pagamento e bandeira de cartão.
 *
 * São tabelas da SEFAZ: o XML carrega o número, não o nome. Sem a tradução, a
 * tela de uma nota mostraria "03" onde deveria dizer "Cartão de Crédito" — e
 * quem confere a nota com o cupom na mão não conseguiria comparar.
 *
 * Um código desconhecido volta como veio: inventar um nome seria pior que
 * mostrar o número.
 */

const FORMA_DE_PAGAMENTO: Record<string, string> = {
  "01": "Dinheiro",
  "02": "Cheque",
  "03": "Cartão de Crédito",
  "04": "Cartão de Débito",
  "05": "Crédito Loja",
  "10": "Vale Alimentação",
  "11": "Vale Refeição",
  "12": "Vale Presente",
  "13": "Vale Combustível",
  "15": "Boleto Bancário",
  "16": "Depósito Bancário",
  "17": "PIX",
  "18": "TED / DOC",
  "19": "Programa Fidelidade",
  "90": "Sem Pagamento",
  "99": "Outros",
};

export function paymentMethodName(code: string | null): string | null {
  if (!code) return null;
  return FORMA_DE_PAGAMENTO[code] ?? code;
}

const BANDEIRA: Record<string, string> = {
  "01": "Visa",
  "02": "Mastercard",
  "03": "American Express",
  "04": "Sorocred",
  "05": "Diners Club",
  "06": "Elo",
  "07": "Hipercard",
  "08": "Aura",
  "09": "Cabal",
  "99": "Outros",
};

export function cardBrandName(code: string | null): string | null {
  if (!code) return null;
  return BANDEIRA[code] ?? code;
}
