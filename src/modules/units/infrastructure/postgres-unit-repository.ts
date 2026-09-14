import type { UnitRepository } from "../application/unit-repository";
import type { Unit, UnitDraft, UnitQuery } from "../domain/unit";
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

  async countProductsUsing(unitId: string): Promise<number> {
    const result = await this.api.query<Record<string, unknown>>(
      "SELECT COUNT(*)::int AS total FROM products WHERE unit_id = $1",
      [unitId],
    );
    if (!result.ok) throw new Error(`Falha ao verificar o uso da unidade: ${result.error}`);
    return result.rows[0] ? asNumber(result.rows[0].total) : 0;
  }

  /**
   * Grava pelo canal de escrita, nunca por `query`.
   *
   * `updated_at` é atualizado aqui porque a auditoria e a sincronização se
   * orientam por ele: gravar sem mexer na data faz a mudança passar despercebida
   * pelo Sync-Service.
   */
  async update(unitId: string, draft: UnitDraft): Promise<void> {
    const result = await this.api.execute([
      {
        sql: `
          UPDATE units
          SET short_description = $1,
              description       = $2,
              is_fractional     = $3,
              is_active         = $4,
              updated_at        = NOW()
          WHERE id = $5
        `,
        params: [
          draft.shortDescription,
          draft.description,
          draft.isFractional,
          draft.isActive,
          unitId,
        ],
      },
    ]);

    if (!result.ok) throw new Error(`Falha ao salvar a unidade: ${result.error}`);
    // Zero linhas significa que a unidade sumiu entre abrir o formulário e
    // salvar. Silenciar isso faria a tela dizer "salvo" sem ter salvado nada.
    if (result.rowCounts[0] === 0) {
      throw new Error("A unidade não foi encontrada. Ela pode ter sido removida.");
    }
  }
}
