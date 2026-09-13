import type { UnitRepository } from "../application/unit-repository";
import type { Unit, UnitQuery } from "../domain/unit";
import type { ElectronApi } from "@/shared/runtime/electron-api";
import { asBoolean, asNumber, asText } from "@/shared/infrastructure/convert";

function toUnit(row: Record<string, unknown>): Unit {
  return {
    id: asText(row.id) ?? "",
    legacyCode: asNumber(row.legacy_code),
    shortDescription: asText(row.short_description) ?? "",
    description: asText(row.description) ?? "",
    isFractional: asBoolean(row.is_fractional),
    isActive: asBoolean(row.is_active),
  };
}

export class PostgresUnitRepository implements UnitRepository {
  constructor(private readonly api: ElectronApi) {}

  async list(query: UnitQuery): Promise<Unit[]> {
    const params: unknown[] = [];
    let where = "";

    const term = query.search.trim();
    if (term) {
      params.push(`%${term}%`);
      where = "WHERE (u.short_description ILIKE $1 OR u.description ILIKE $1)";
    }

    const sql = `
      SELECT u.id, u.legacy_code, u.short_description, u.description,
             u.is_fractional, u.is_active
      FROM units u
      ${where}
      ORDER BY u.legacy_code
    `;

    const result = await this.api.query<Record<string, unknown>>(sql, params);
    if (!result.ok) throw new Error(`Falha ao listar unidades: ${result.error}`);

    return result.rows.map(toUnit);
  }
}
