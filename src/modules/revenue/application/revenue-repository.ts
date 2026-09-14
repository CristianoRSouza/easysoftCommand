import type { DateRange } from "@/shared/domain/paging";
import type { RevenueReport } from "../domain/revenue";

export interface RevenueRepository {
  report(range: DateRange): Promise<RevenueReport>;
}
