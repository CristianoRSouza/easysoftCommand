/** Resultado de uma consulta vinda do processo principal. */
export type QueryResult<T> = { ok: true; rows: T[] } | { ok: false; error: string };

/** Resultado de uma gravação. `rowCounts` traz uma entrada por comando. */
export type ExecuteResult = { ok: true; rowCounts: number[] } | { ok: false; error: string };

/** Um comando de alteração, com os parâmetros separados do texto. */
export interface Statement {
  sql: string;
  params?: unknown[];
}

export interface ElectronApi {
  /**
   * Leitura. Roda em transação READ ONLY: o PostgreSQL recusa qualquer
   * alteração por este caminho.
   */
  query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;

  /**
   * Escrita. Os comandos são aplicados numa transação só — ou todos valem, ou
   * nenhum.
   */
  execute(statements: Statement[]): Promise<ExecuteResult>;
}

declare global {
  interface Window {
    electronAPI?: ElectronApi;
  }
}

/** Devolve a ponte, ou `null` quando a aplicação roda no navegador. */
export function getElectronApi(): ElectronApi | null {
  return typeof window === "undefined" ? null : (window.electronAPI ?? null);
}
