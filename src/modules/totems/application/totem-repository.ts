import type { Totem } from "../domain/totem";

/** Totens são poucos por loja: a lista inteira vem de uma vez. */
export interface TotemRepository {
  list(): Promise<Totem[]>;
}
