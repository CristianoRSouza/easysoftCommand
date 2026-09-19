/**
 * O que a mensagem de erro do banco quer dizer.
 *
 * A fila guarda o erro cru do PostgreSQL. Ele é preciso e ilegível: quem abre
 * a tela quer saber se é dado faltando, cadastro duplicado ou permissão — e
 * qual tabela e coluna. Sem isto, o operador copia a mensagem e manda para o
 * desenvolvedor, que era justamente o trabalho que a tela deveria poupar.
 */
export type SyncErrorCategory =
  | "foreign_key"
  | "unique"
  | "not_null"
  | "check"
  | "undefined_table"
  | "undefined_column"
  | "permission"
  | "syntax"
  | "unknown";

export const SYNC_ERROR_LABEL: Record<SyncErrorCategory, string> = {
  foreign_key: "Dependência ausente",
  unique: "Registro duplicado",
  not_null: "Campo obrigatório vazio",
  check: "Valor recusado por regra do banco",
  undefined_table: "Tabela inexistente",
  undefined_column: "Coluna inexistente",
  permission: "Permissão negada",
  syntax: "Erro de sintaxe",
  unknown: "Erro não classificado",
};

/** O que cada categoria costuma significar para quem opera. */
export const SYNC_ERROR_HINT: Record<SyncErrorCategory, string> = {
  foreign_key: "O registro depende de outro que ainda não chegou. Costuma resolver-se sozinho quando a fila avança.",
  unique: "A nuvem já tem esse registro. Reenvio repetido ou conflito de identificador.",
  not_null: "A loja enviou sem um campo que a nuvem exige.",
  check: "O valor existe mas está fora do que a regra do banco aceita.",
  undefined_table: "A nuvem não tem essa tabela — versões diferentes entre loja e nuvem.",
  undefined_column: "A nuvem não tem essa coluna — versões diferentes entre loja e nuvem.",
  permission: "Quem aplica a fila não tem permissão para gravar aqui.",
  syntax: "O comando gerado está malformado. É defeito de programa, não de dado.",
  unknown: "Sem padrão conhecido. A mensagem original está abaixo.",
};

/** Código do PostgreSQL para categoria. É o caminho mais confiável. */
const POR_SQLSTATE: Record<string, SyncErrorCategory> = {
  "23503": "foreign_key",
  "23505": "unique",
  "23502": "not_null",
  "23514": "check",
  "42P01": "undefined_table",
  "42703": "undefined_column",
  "42501": "permission",
  "42601": "syntax",
};

/** Quando não há código, o texto denuncia. Ordem importa: a primeira vence. */
const POR_TEXTO: [RegExp, SyncErrorCategory][] = [
  [/foreign key/i, "foreign_key"],
  [/duplicate key|unique constraint/i, "unique"],
  [/null value.*not.?null/i, "not_null"],
  [/relation .* does not exist/i, "undefined_table"],
  [/column .* does not exist/i, "undefined_column"],
  [/permission denied|\brls\b/i, "permission"],
  [/syntax error/i, "syntax"],
  [/check constraint/i, "check"],
];

export interface ParsedSyncError {
  category: SyncErrorCategory;
  sqlstate: string | null;
  table: string | null;
  column: string | null;
  constraint: string | null;
  /** A mensagem original, sempre preservada. */
  raw: string;
}

function primeiroGrupo(texto: string, padroes: RegExp[]): string | null {
  for (const padrao of padroes) {
    const encontrado = texto.match(padrao);
    if (encontrado?.[1]) return encontrado[1];
  }
  return null;
}

export function parseSyncError(raw: string | null): ParsedSyncError | null {
  if (!raw || raw.trim() === "") return null;

  const sqlstate = raw.match(/(?:SQLSTATE|code)[:\s]+([0-9A-Z]{5})/i)?.[1] ?? null;
  const category =
    (sqlstate ? POR_SQLSTATE[sqlstate] : undefined) ??
    POR_TEXTO.find(([padrao]) => padrao.test(raw))?.[1] ??
    "unknown";

  return {
    category,
    sqlstate,
    table: primeiroGrupo(raw, [/relation "([^"]+)"/i, /table "([^"]+)"/i]),
    column: primeiroGrupo(raw, [/column "([^"]+)"/i]),
    constraint: primeiroGrupo(raw, [/constraint "([^"]+)"/i]),
    raw,
  };
}

/** Agrupa as falhas por categoria, da mais frequente para a menos. */
export function groupByCategory(erros: (string | null)[]): {
  category: SyncErrorCategory;
  count: number;
}[] {
  const contagem = new Map<SyncErrorCategory, number>();
  for (const bruto of erros) {
    const analisado = parseSyncError(bruto);
    if (!analisado) continue;
    contagem.set(analisado.category, (contagem.get(analisado.category) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}
