/** Resultado de uma consulta vinda do processo principal. */
export type QueryResult<T> = { ok: true; rows: T[] } | { ok: false; error: string };

export interface ElectronApi {
  query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
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
