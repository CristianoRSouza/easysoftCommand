import { asIsoDate, asNumber, asText } from "@/shared/infrastructure/convert";
import { toInboxStatus, type InboxItem } from "../domain/sync-activity";

type Row = Record<string, unknown>;

export const INBOX_COLUMNS =
  "id, entity, entity_id, op, apply_status, retry_count, last_error, received_at, applied_at";

export function toInboxItem(row: Row): InboxItem {
  return {
    id: asText(row.id) ?? "",
    entity: asText(row.entity) ?? "",
    entityId: asText(row.entity_id),
    operation: asText(row.op),
    applyStatus: toInboxStatus(row.apply_status),
    retryCount: asNumber(row.retry_count),
    lastError: asText(row.last_error),
    receivedAt: asIsoDate(row.received_at),
    appliedAt: row.applied_at == null ? null : asIsoDate(row.applied_at),
  };
}
