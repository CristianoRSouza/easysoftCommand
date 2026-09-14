/**
 * Unidade de medida — UND, KG, LT.
 *
 * `isFractional` decide se a quantidade aceita casas decimais: 2,5 kg faz
 * sentido; 2,5 unidades, não.
 */
export interface Unit {
  id: string;
  legacyCode: number;
  shortDescription: string;
  description: string;
  isFractional: boolean;
  isActive: boolean;
}

export interface UnitQuery {
  search: string;
}

export const DEFAULT_UNIT_QUERY: UnitQuery = { search: "" };

/** O que o formulário edita. O código legado e o identificador não mudam. */
export interface UnitDraft {
  shortDescription: string;
  description: string;
  isFractional: boolean;
  isActive: boolean;
}

export function draftFrom(unit: Unit): UnitDraft {
  return {
    shortDescription: unit.shortDescription,
    description: unit.description,
    isFractional: unit.isFractional,
    isActive: unit.isActive,
  };
}

/** Sigla curta porque é ela que aparece no cupom fiscal, ao lado da quantidade. */
export const SHORT_DESCRIPTION_MAX = 6;

export interface FieldError {
  field: keyof UnitDraft;
  message: string;
}

/**
 * Valida o rascunho antes de qualquer ida ao banco.
 *
 * Vive no domínio, e não na tela, porque a regra é a mesma independentemente de
 * quem chama — e porque validação que só existe no formulário deixa de valer
 * assim que alguém grava por outro caminho.
 */
export function validateUnit(draft: UnitDraft): FieldError[] {
  const errors: FieldError[] = [];
  const sigla = draft.shortDescription.trim();
  const descricao = draft.description.trim();

  if (sigla === "") {
    errors.push({ field: "shortDescription", message: "A sigla é obrigatória." });
  } else if (sigla.length > SHORT_DESCRIPTION_MAX) {
    errors.push({
      field: "shortDescription",
      message: `A sigla cabe em até ${SHORT_DESCRIPTION_MAX} caracteres — é ela que sai no cupom.`,
    });
  } else if (!/^[\p{L}\p{N}]+$/u.test(sigla)) {
    errors.push({
      field: "shortDescription",
      message: "A sigla aceita apenas letras e números.",
    });
  }

  if (descricao === "") {
    errors.push({ field: "description", message: "A descrição é obrigatória." });
  }

  return errors;
}

/** Normaliza o rascunho: o que vai ao banco não deve depender de como foi digitado. */
export function normalizeUnit(draft: UnitDraft): UnitDraft {
  return {
    shortDescription: draft.shortDescription.trim().toUpperCase(),
    description: draft.description.trim(),
    isFractional: draft.isFractional,
    isActive: draft.isActive,
  };
}

/** `true` quando o rascunho não muda nada — não vale gravar por gravar. */
export function isUnchanged(unit: Unit, draft: UnitDraft): boolean {
  const normalizado = normalizeUnit(draft);
  return (
    unit.shortDescription === normalizado.shortDescription &&
    unit.description === normalizado.description &&
    unit.isFractional === normalizado.isFractional &&
    unit.isActive === normalizado.isActive
  );
}

/**
 * Motivo pelo qual uma gravação foi recusada por regra de negócio.
 *
 * Distinto de erro de campo: aqui o formulário está correto, mas o efeito da
 * mudança é que não pode acontecer.
 */
export class UnitRuleViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnitRuleViolation";
  }
}

/**
 * Desativar uma unidade em uso quebra os produtos que dependem dela.
 *
 * No cupom fiscal a unidade é obrigatória: um produto que aponta para unidade
 * inativa passa a emitir nota com campo inválido — e o erro aparece só na hora
 * da venda, na SEFAZ.
 */
export function ensureCanDeactivate(unit: Unit, draft: UnitDraft, productsUsing: number): void {
  const desativando = unit.isActive && !draft.isActive;
  if (desativando && productsUsing > 0) {
    throw new UnitRuleViolation(
      `${productsUsing} ${productsUsing === 1 ? "produto usa" : "produtos usam"} esta unidade. ` +
        "Troque a unidade deles antes de desativá-la, ou a emissão de nota vai falhar.",
    );
  }
}
