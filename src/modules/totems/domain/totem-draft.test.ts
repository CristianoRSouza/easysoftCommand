import { describe, expect, it } from "vitest";
import {
  DEMO_BLOCK_MESSAGE,
  emptyDraft,
  isDemoLicense,
  NO_LICENSE_MESSAGE,
  rejectionFor,
  toColumns,
  wantsProduction,
} from "./totem-draft";
import type { TotemLicense } from "./totem";

function licenca(parcial: Partial<TotemLicense> = {}): TotemLicense {
  return {
    type: "monthly",
    planSlug: "ecp-standard",
    status: "active",
    startsAt: null,
    expiresAt: null,
    maxTransactionsMonth: null,
    ...parcial,
  };
}

describe("licença de demonstração", () => {
  it("o plano manda, quando existe", () => {
    expect(isDemoLicense(licenca({ planSlug: "ecp-demo" }))).toBe(true);
    expect(isDemoLicense(licenca({ planSlug: "ecp-standard", type: "demo" }))).toBe(false);
  });

  it("sem plano, o tipo decide", () => {
    expect(isDemoLicense(licenca({ planSlug: null, type: "trial" }))).toBe(true);
    expect(isDemoLicense(licenca({ planSlug: null, type: "TRIAL" }))).toBe(true);
    expect(isDemoLicense(licenca({ planSlug: null, type: "annual" }))).toBe(false);
  });

  it("totem sem licença não é tratado como demonstração", () => {
    // É o que o sistema em produção faz ao editar um totem já existente.
    expect(isDemoLicense(null)).toBe(false);
  });
});

describe("o que impede gravar o totem", () => {
  const produção = { ...emptyDraft(), mode: "production" as const };

  it("demonstração não vende de verdade, por nenhum dos três caminhos", () => {
    const demo = licenca({ planSlug: "ecp-demo" });
    expect(rejectionFor(produção, demo, true)).toBe(DEMO_BLOCK_MESSAGE);
    expect(rejectionFor({ ...emptyDraft(), nfceEnvironment: 1 }, demo, true)).toBe(DEMO_BLOCK_MESSAGE);
    expect(rejectionFor({ ...emptyDraft(), paymentEnvironment: "producao" }, demo, true)).toBe(
      DEMO_BLOCK_MESSAGE,
    );
  });

  it("licença paga libera produção", () => {
    expect(rejectionFor(produção, licenca(), true)).toBeNull();
  });

  it("totem ativo exige licença vinculada, porque o banco recusa sem ela", () => {
    expect(rejectionFor({ ...emptyDraft(), isActive: true }, licenca(), false)).toBe(
      NO_LICENSE_MESSAGE,
    );
    expect(rejectionFor({ ...emptyDraft(), isActive: true }, licenca(), true)).toBeNull();
  });

  it("reconhece o pedido de produção em qualquer um dos três campos", () => {
    expect(wantsProduction(emptyDraft())).toBe(false);
    expect(wantsProduction({ ...emptyDraft(), nfceEnvironment: 1 })).toBe(true);
  });
});

describe("colunas gravadas", () => {
  it("recusa tempo de emissão fora da faixa que o banco aceita", () => {
    expect(toColumns({ ...emptyDraft(), nfceEmitTimeoutMs: 30_000 }).nfce_emit_timeout_ms).toBe(30_000);
    expect(toColumns({ ...emptyDraft(), nfceEmitTimeoutMs: 5_000 }).nfce_emit_timeout_ms).toBeNull();
    expect(toColumns({ ...emptyDraft(), nfceEmitTimeoutMs: 400_000 }).nfce_emit_timeout_ms).toBeNull();
  });

  it("ambiente da NFC-e só tem dois valores: o que não for produção é homologação", () => {
    expect(toColumns({ ...emptyDraft(), nfceEnvironment: 1 }).nfce_environment).toBe(1);
    expect(toColumns({ ...emptyDraft(), nfceEnvironment: 7 }).nfce_environment).toBe(2);
    expect(toColumns({ ...emptyDraft(), nfceEnvironment: null }).nfce_environment).toBeNull();
  });

  it("tira os espaços do nome antes de gravar", () => {
    expect(toColumns({ ...emptyDraft(), name: "  TOTEM-01  " }).totem_name).toBe("TOTEM-01");
  });
});
