import type { Totem } from "../domain/totem";
import type { TotemDraft } from "../domain/totem-draft";
import type { TotemLicenseSlot } from "../domain/totem-license";

/**
 * O que aconteceu com o registro na trilha de auditoria.
 *
 * A gravação do totem e o registro dela são duas escritas, e o banco pode
 * aceitar a primeira e recusar a segunda — é o que acontece com quem não é
 * administrador. Dizer "não salvou" seria mentira; ficar calado esconderia
 * que a trilha tem um buraco.
 */
export interface SaveOutcome {
  audited: boolean;
  auditError: string | null;
}

export interface CreateOutcome extends SaveOutcome {
  id: string;
}

/** Totens são poucos por loja: a lista inteira vem de uma vez. */
export interface TotemRepository {
  list(): Promise<Totem[]>;

  /** As licenças de totem da empresa, para escolher qual vincular. */
  licenseSlots(): Promise<TotemLicenseSlot[]>;

  /** Cadastra e devolve o identificador do totem novo. */
  create(draft: TotemDraft, licenseId: string | null, performedBy: string): Promise<CreateOutcome>;

  /** Grava as alterações e registra na auditoria quem mudou o quê. */
  update(id: string, draft: TotemDraft, performedBy: string): Promise<SaveOutcome>;

  /** Prende a licença ao totem; `null` solta a que estiver presa. */
  bindLicense(totemId: string, licenseId: string | null): Promise<void>;

  /** Liga ou desliga, sem tocar no resto da configuração. */
  setActive(id: string, isActive: boolean, performedBy: string): Promise<SaveOutcome>;
}
