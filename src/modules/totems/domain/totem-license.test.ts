import { describe, expect, it } from "vitest";
import { isBindable, selectableFor, slotLabel, type TotemLicenseSlot } from "./totem-license";

function slot(parcial: Partial<TotemLicenseSlot> = {}): TotemLicenseSlot {
  return {
    id: "l1",
    deviceKey: "TOTEM-001",
    type: "monthly",
    planSlug: "ecp-standard",
    status: "active",
    boundTo: null,
    ...parcial,
  };
}

describe("licenças que o totem pode receber", () => {
  it("só licença ativa pode ser vinculada", () => {
    expect(isBindable(slot())).toBe(true);
    expect(isBindable(slot({ status: "expired" }))).toBe(false);
    expect(isBindable(slot({ status: null }))).toBe(false);
  });

  it("mostra as livres e a que já é deste totem", () => {
    // Oferecer a licença presa a outro equipamento só produz a tentativa que
    // o banco vai recusar.
    const escolhas = selectableFor(
      [
        slot({ id: "livre" }),
        slot({ id: "minha", boundTo: "t1" }),
        slot({ id: "de-outro", boundTo: "t2" }),
        slot({ id: "vencida", status: "expired" }),
      ],
      "t1",
    );

    expect(escolhas.map((s) => s.id)).toEqual(["livre", "minha"]);
  });

  it("totem novo só vê as livres", () => {
    const escolhas = selectableFor([slot({ id: "livre" }), slot({ id: "presa", boundTo: "t9" })], null);
    expect(escolhas.map((s) => s.id)).toEqual(["livre"]);
  });

  it("o rótulo identifica a licença pelo equipamento e pelo plano", () => {
    expect(slotLabel(slot())).toContain("TOTEM-001");
    expect(slotLabel(slot())).toContain("ecp-standard");
    expect(slotLabel(slot({ planSlug: null }))).toContain("monthly");
  });
});
