import { getElectronApi } from "./electron-api";

export type DataSource = "postgres" | "supabase";

/**
 * Decide de onde vêm os dados. Uma regra, um lugar, sem exceções.
 *
 * O projeto anterior espalhava essa decisão por três funções encadeadas, e o
 * resultado surpreendia: em `localhost`, o resolvedor de endereço da API
 * devolvia a origem da própria página; a aplicação concluía que havia
 * encontrado uma API e nunca alcançava o Supabase. Sem heurística de nome de
 * host, esse problema não tem como existir.
 */
export function detectDataSource(): DataSource {
  return getElectronApi() ? "postgres" : "supabase";
}
