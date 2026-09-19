/**
 * As tabelas de referência da reforma tributária.
 *
 * São as listas oficiais que dizem qual código usar: situação tributária,
 * classificação, alíquotas por ente e crédito presumido. Ninguém as edita —
 * elas chegam prontas e servem para conferir o que o cadastro do produto diz.
 *
 * Em vez de uma tela por tabela, como no projeto anterior, há uma tela com um
 * seletor: a estrutura é a mesma em todas — código, descrição, vigência — e
 * quinze telas iguais são quinze lugares para o mesmo defeito.
 */
export interface ReferenceTable {
  id: ReferenceTableId;
  label: string;
  /** O que esta tabela responde, em uma frase. */
  purpose: string;
  view: string;
  columns: ReferenceColumn[];
  /** Colunas em que a busca procura. Vazio desliga a busca. */
  searchable: string[];
  orderBy: string;
}

export interface ReferenceColumn {
  key: string;
  label: string;
  align?: "right";
  /** Percentual guardado como fração ou como número inteiro, conforme a fonte. */
  format?: "rate" | "date" | "boolean";
}

export type ReferenceTableId =
  | "cst"
  | "cclasstrib"
  | "credito-presumido"
  | "fundamentos"
  | "aliquota-uniao"
  | "aliquota-estado"
  | "aliquota-municipio"
  | "seletivo-ncm";

const VIGENCIA: ReferenceColumn[] = [
  { key: "validity_start", label: "Vigência de", format: "date" },
  { key: "validity_end", label: "Vigência até", format: "date" },
];

export const REFERENCE_TABLES: ReferenceTable[] = [
  {
    id: "cst",
    label: "Situação tributária (CST)",
    purpose: "Os códigos de situação tributária de IBS e CBS.",
    view: "pb_cbs_cst",
    columns: [
      { key: "code", label: "Código" },
      { key: "description", label: "Descrição" },
      { key: "nomenclature", label: "Nomenclatura" },
      ...VIGENCIA,
    ],
    searchable: ["code", "description"],
    orderBy: "code",
  },
  {
    id: "cclasstrib",
    label: "Classificação tributária",
    purpose: "A classificação que detalha o CST e define reduções e créditos.",
    view: "pb_cbs_cclasstrib",
    columns: [
      { key: "code", label: "Código" },
      { key: "description", label: "Descrição" },
      { key: "rate_type", label: "Tipo de alíquota" },
      { key: "has_reduction_percentage", label: "Tem redução", format: "boolean" },
      ...VIGENCIA,
    ],
    searchable: ["code", "description"],
    orderBy: "code",
  },
  {
    id: "credito-presumido",
    label: "Crédito presumido",
    purpose: "Os códigos de crédito presumido e as alíquotas de cada um.",
    view: "pb_cbs_ccredpres",
    columns: [
      { key: "code", label: "Código" },
      { key: "description", label: "Descrição" },
      { key: "cbs_presumed_credit_rate", label: "Crédito CBS", align: "right", format: "rate" },
      { key: "ibs_tax_rate", label: "Alíquota IBS", align: "right", format: "rate" },
      ...VIGENCIA,
    ],
    searchable: ["code", "description"],
    orderBy: "code",
  },
  {
    id: "fundamentos",
    label: "Fundamentos legais",
    purpose: "O texto legal que ampara cada combinação de classificação e situação.",
    view: "pb_cbs_fund_legais",
    columns: [
      { key: "tax_classification_code", label: "Classificação" },
      { key: "tax_situation_code", label: "Situação" },
      { key: "text", label: "Fundamento" },
      ...VIGENCIA,
    ],
    searchable: ["tax_classification_code", "tax_situation_code", "text"],
    orderBy: "tax_classification_code",
  },
  {
    id: "aliquota-uniao",
    label: "Alíquota da União (CBS)",
    purpose: "A alíquota de referência da CBS por período.",
    view: "pb_cbs_union_rates",
    columns: [
      { key: "rate", label: "Alíquota", align: "right", format: "rate" },
      { key: "reference_date", label: "Referência", format: "date" },
      ...VIGENCIA,
    ],
    searchable: [],
    orderBy: "validity_start",
  },
  {
    id: "aliquota-estado",
    label: "Alíquota por estado (IBS)",
    purpose: "A alíquota de referência estadual do IBS.",
    view: "pb_cbs_state_rates",
    columns: [
      { key: "state_code", label: "UF" },
      { key: "rate", label: "Alíquota", align: "right", format: "rate" },
      { key: "reference_date", label: "Referência", format: "date" },
      ...VIGENCIA,
    ],
    searchable: ["state_code"],
    orderBy: "state_code",
  },
  {
    id: "aliquota-municipio",
    label: "Alíquota por município (IBS)",
    purpose: "A alíquota de referência municipal do IBS.",
    view: "pb_cbs_municipal_rates",
    columns: [
      { key: "city_code", label: "Código do município" },
      { key: "rate", label: "Alíquota", align: "right", format: "rate" },
      { key: "reference_date", label: "Referência", format: "date" },
      ...VIGENCIA,
    ],
    searchable: ["city_code"],
    orderBy: "city_code",
  },
  {
    id: "seletivo-ncm",
    label: "Imposto Seletivo por NCM",
    purpose: "Quais NCM são tributados pelo Imposto Seletivo, e a que alíquota.",
    view: "pb_cbs_is_ncm",
    columns: [
      { key: "ncm", label: "NCM" },
      { key: "tributado_is", label: "Tributado", format: "boolean" },
      { key: "ad_valorem_rate", label: "Ad valorem", align: "right", format: "rate" },
      { key: "ad_rem_rate", label: "Ad rem", align: "right" },
      ...VIGENCIA,
    ],
    searchable: ["ncm"],
    orderBy: "ncm",
  },
];

export function tableById(id: ReferenceTableId): ReferenceTable {
  return REFERENCE_TABLES.find((table) => table.id === id) ?? REFERENCE_TABLES[0]!;
}

/** As colunas que a consulta precisa pedir ao banco. */
export function columnsOf(table: ReferenceTable): string {
  return ["id", ...table.columns.map((column) => column.key)].join(", ");
}
