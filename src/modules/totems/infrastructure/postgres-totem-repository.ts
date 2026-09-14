import type { TotemRepository } from "../application/totem-repository";
import type { Totem } from "../domain/totem";
import type { ElectronApi } from "@/shared/runtime/electron-api";
import { TOTEM_COLUMNS_SQL, toTotem } from "./totem-mapper";

export class PostgresTotemRepository implements TotemRepository {
  constructor(private readonly api: ElectronApi) {}

  async list(): Promise<Totem[]> {
    const result = await this.api.query<Record<string, unknown>>(
      `SELECT ${TOTEM_COLUMNS_SQL}
       FROM nfce_totem_config t
       ORDER BY t.totem_name`,
    );
    if (!result.ok) throw new Error(`Falha ao listar totens: ${result.error}`);
    // O licenciamento é da nuvem: no banco da loja não existe essa tabela.
    return result.rows.map((row) => toTotem(row, null));
  }
}
