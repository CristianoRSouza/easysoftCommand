/**
 * Uma licença de totem, como slot a ser vinculado.
 *
 * As licenças são compradas por plano e ficam livres até alguém prendê-las a
 * um equipamento. O banco recusa totem ativo sem licença, então vincular é
 * pré-requisito de ligar — e não um detalhe de cadastro.
 */
export interface TotemLicenseSlot {
  id: string;
  deviceKey: string | null;
  type: string | null;
  planSlug: string | null;
  status: string | null;
  /** A que totem está presa, ou `null` quando está livre. */
  boundTo: string | null;
}

/** Só licença ativa pode ser vinculada; o banco recusa as demais. */
export function isBindable(slot: TotemLicenseSlot): boolean {
  return (slot.status ?? "").toLowerCase() === "active";
}

/**
 * As licenças que este totem pode receber: as livres, mais a que já é dele.
 *
 * Mostrar as presas a outros equipamentos só produziria a tentativa que o
 * banco vai recusar.
 */
export function selectableFor(
  slots: TotemLicenseSlot[],
  totemId: string | null,
): TotemLicenseSlot[] {
  return slots.filter(
    (slot) => isBindable(slot) && (slot.boundTo === null || slot.boundTo === totemId),
  );
}

/** Como a licença aparece na lista de escolha. */
export function slotLabel(slot: TotemLicenseSlot): string {
  const partes = [slot.deviceKey, slot.planSlug ?? slot.type].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : slot.id.slice(0, 8);
}
