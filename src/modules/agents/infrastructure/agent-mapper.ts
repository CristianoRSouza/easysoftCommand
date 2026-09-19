import { asBoolean, asNumber, asText } from "@/shared/infrastructure/convert";
import type { Agent } from "../domain/agent";

type Row = Record<string, unknown>;

/** Número opcional: distingue "não configurado" de "zero". */
function optionalNumber(value: unknown): number | null {
  return value == null ? null : asNumber(value);
}

export const AGENT_COLUMNS = [
  "id, agent_name, is_active, install_path, log_level, api_rate_limit",
  "sefaz_timeout_ms, retry_max_attempts, retry_backoff_ms",
  "contingency_enabled, contingency_reason, contingency_auto_transmit",
  "contingency_worker_enabled, contingency_worker_interval_ms",
  "contingency_substitution_worker_enabled, contingency_substitution_worker_interval_ms",
  "contingency_substitution_xjust, contingency_sla_warn_hours, contingency_sla_block_hours",
].join(", ");

export function toAgent(row: Row): Agent {
  return {
    id: asText(row.id) ?? "",
    name: asText(row.agent_name) ?? "",
    isActive: asBoolean(row.is_active),
    installPath: asText(row.install_path),
    logLevel: asText(row.log_level),
    sefaz: {
      timeoutMs: optionalNumber(row.sefaz_timeout_ms),
      retryMaxAttempts: optionalNumber(row.retry_max_attempts),
      retryBackoffMs: optionalNumber(row.retry_backoff_ms),
      apiRateLimit: optionalNumber(row.api_rate_limit),
    },
    contingency: {
      enabled: asBoolean(row.contingency_enabled),
      reason: asText(row.contingency_reason),
      autoTransmit: asBoolean(row.contingency_auto_transmit),
      workerEnabled: asBoolean(row.contingency_worker_enabled),
      workerIntervalMs: optionalNumber(row.contingency_worker_interval_ms),
      substitutionWorkerEnabled: row.contingency_substitution_worker_enabled === true,
      substitutionWorkerIntervalMs: optionalNumber(
        row.contingency_substitution_worker_interval_ms,
      ),
      substitutionJustification: asText(row.contingency_substitution_xjust),
      slaWarnHours: optionalNumber(row.contingency_sla_warn_hours),
      slaBlockHours: optionalNumber(row.contingency_sla_block_hours),
    },
  };
}
