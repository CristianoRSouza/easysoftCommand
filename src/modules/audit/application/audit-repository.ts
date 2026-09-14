import type { Page } from "@/shared/domain/paging";
import type { AuditEntry, AuditQuery } from "../domain/audit-entry";

export interface AuditRepository {
  list(query: AuditQuery): Promise<Page<AuditEntry>>;
}
