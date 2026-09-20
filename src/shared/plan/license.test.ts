import { describe, expect, it } from "vitest";
import { classifyLicense } from "./license";

const AGORA = new Date("2026-09-19T12:00:00Z");
const base = { planSlug: "ecp-standard", planName: "Standard", isActive: true };

describe("situação da licença", () => {
  it("em dia quando falta mais de uma semana", () => {
    // Caso real da CORAÇÃO MELADO: vence em 08/10/2026.
    const licenca = classifyLicense({ ...base, expiresAt: "2026-10-08T15:06:43+00:00" }, AGORA);
    expect(licenca.state).toBe("active");
    // Arredondado para cima, como no projeto anterior: 19 dias e algumas
    // horas aparecem como 20.
    expect(licenca.daysUntilExpiry).toBe(20);
  });

  it("avisa nos últimos sete dias", () => {
    expect(classifyLicense({ ...base, expiresAt: "2026-09-24T12:00:00Z" }, AGORA).state).toBe(
      "expiring_soon",
    );
    // Exatamente sete dias ainda é aviso; oito já é tranquilo.
    expect(classifyLicense({ ...base, expiresAt: "2026-09-26T12:00:00Z" }, AGORA).state).toBe(
      "expiring_soon",
    );
    expect(classifyLicense({ ...base, expiresAt: "2026-09-27T12:00:00Z" }, AGORA).state).toBe(
      "active",
    );
  });

  it("vencida quando a data passou", () => {
    const licenca = classifyLicense({ ...base, expiresAt: "2026-09-01T00:00:00Z" }, AGORA);
    expect(licenca.state).toBe("expired");
    expect(licenca.daysUntilExpiry).toBeLessThan(0);
  });

  it("licença desativada conta como vencida, mesmo com data no futuro", () => {
    // Sem isso, uma licença cancelada passaria despercebida até a data chegar.
    expect(
      classifyLicense({ ...base, isActive: false, expiresAt: "2027-01-01T00:00:00Z" }, AGORA).state,
    ).toBe("expired");
  });

  it("sem plano cadastrado não se avisa nada", () => {
    // Não é erro de quem usa; encher a tela de alerta puniria o cliente por
    // uma falta de cadastro que não é dele.
    expect(classifyLicense({ ...base, planSlug: null, expiresAt: null }, AGORA).state).toBe(
      "unknown",
    );
  });

  it("plano sem data de validade fica ativo", () => {
    const licenca = classifyLicense({ ...base, expiresAt: null }, AGORA);
    expect(licenca).toMatchObject({ state: "active", daysUntilExpiry: null });
  });
});
