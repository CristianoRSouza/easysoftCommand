import { redactSecrets } from "@/shared/domain/redact";

/**
 * O registro de uma alteração de totem.
 *
 * Guarda só o que mudou. Gravar o objeto inteiro a cada salvamento — como o
 * projeto anterior faz no caminho local — enche a trilha de campos idênticos e
 * esconde a alteração de verdade no meio deles.
 */
export interface TotemAuditEntry {
  changedFields: string[];
  previousValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
}

export type TotemAuditAction = "created" | "updated" | "toggled";

/** Comparação por valor: `null` e ausente são a mesma coisa vinda do banco. */
function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * O que mudou entre o estado anterior e as colunas a gravar.
 *
 * Os valores passam pelo redator antes de entrar no registro: a trilha precisa
 * dizer que a chave do TEF foi trocada, não qual é a chave.
 */
export function diffForAudit(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
): TotemAuditEntry | null {
  const changedFields: string[] = [];
  const previousValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  for (const [name, value] of Object.entries(next)) {
    if (sameValue(previous[name], value)) continue;
    changedFields.push(name);
    previousValues[name] = previous[name] ?? null;
    newValues[name] = value;
  }

  if (changedFields.length === 0) return null;

  return {
    changedFields,
    previousValues: redactSecrets(previousValues),
    newValues: redactSecrets(newValues),
  };
}
