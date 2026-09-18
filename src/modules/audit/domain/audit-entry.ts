import type { DateRange } from "@/shared/domain/paging";

/**
 * Registro de auditoria — quem mudou o quê, e quando.
 *
 * Existe para responder à pergunta que aparece depois do problema: "quem mexeu
 * nessa configuração?". Por isso guarda o valor anterior, não só o novo.
 */
export interface AuditEntry {
  id: string;
  source: AuditSource;
  entityId: string;
  entityName: string | null;
  action: AuditAction;
  changes: AuditChange[];
  performedBy: string | null;
  createdAt: string;
}

export type AuditSource = "totem" | "agent" | "unknown";
export type AuditAction = "created" | "updated" | "toggled" | "deleted" | "unknown";

export const SOURCE_LABEL: Record<AuditSource, string> = {
  totem: "Totem",
  agent: "Agente de serviço",
  unknown: "—",
};

export const ACTION_LABEL: Record<AuditAction, string> = {
  created: "Criado",
  updated: "Alterado",
  toggled: "Ativado/desativado",
  deleted: "Excluído",
  unknown: "—",
};

export function toSource(value: unknown): AuditSource {
  return value === "totem" || value === "agent" ? value : "unknown";
}

export function toAction(value: unknown): AuditAction {
  return value === "created" || value === "updated" || value === "toggled" || value === "deleted"
    ? value
    : "unknown";
}

/** Uma alteração de campo, com o antes e o depois já legíveis. */
export interface AuditChange {
  field: string;
  previous: string | null;
  next: string | null;
}

/**
 * Campos cujo valor nunca deve ser exibido na auditoria.
 *
 * Um registro de "quem mudou o token" é útil; o valor do token não é, e
 * guardá-lo na tela recriaria o vazamento que o resto do sistema evita.
 */
const SENSITIVE = [
  "token",
  "api_key",
  "apikey",
  "password",
  "senha",
  "secret",
  "activation_code",
];

export function isSensitiveField(field: string): boolean {
  const name = field.toLowerCase();
  return SENSITIVE.some((part) => name.includes(part));
}

/** Converte um valor de campo em texto legível, escondendo o que é sensível. */
export function describeValue(field: string, value: unknown): string | null {
  if (isSensitiveField(field)) return value == null || value === "" ? "vazio" : "•••••";
  if (value == null) return null;
  if (typeof value === "boolean") return value ? "sim" : "não";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Junta os valores antigo e novo de cada campo alterado num par legível. */
export function buildChanges(
  fields: string[],
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
): AuditChange[] {
  return fields.map((field) => ({
    field,
    previous: describeValue(field, previous[field]),
    next: describeValue(field, next[field]),
  }));
}

export interface AuditQuery {
  search: string;
  source: "all" | AuditSource;
  /** Filtra o histórico de um equipamento só — usado pela tela dele. */
  entityId: string | null;
  action: "all" | AuditAction;
  range: DateRange;
  page: number;
  pageSize: number;
}

export const DEFAULT_AUDIT_QUERY: AuditQuery = {
  search: "",
  source: "all",
  entityId: null,
  action: "all",
  range: { from: null, to: null },
  page: 1,
  pageSize: 50,
};
