import { asIsoDate, asText } from "@/shared/infrastructure/convert";
import { buildChanges, toAction, toSource, type AuditEntry } from "../domain/audit-entry";

type Row = Record<string, unknown>;

/** Aceita tanto um objeto já decodificado quanto JSON em texto, como o banco guarda. */
function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function asFieldList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return value ? value.split(",").map((v) => v.trim()) : [];
    }
  }
  return [];
}

export function toAuditEntry(row: Row): AuditEntry {
  const fields = asFieldList(row.changed_fields);
  return {
    id: asText(row.id) ?? "",
    source: toSource(row.source),
    entityId: asText(row.entity_id) ?? "",
    entityName: asText(row.entity_name),
    action: toAction(row.action),
    changes: buildChanges(fields, asRecord(row.previous_values), asRecord(row.new_values)),
    performedBy: asText(row.performed_by),
    createdAt: asIsoDate(row.created_at),
  };
}
