import { describe, expect, it } from "vitest";
import {
  accumulatesWithoutSending,
  agentHealth,
  emptyAgentDraft,
  inspectAgent,
  missingName,
  missingNumbers,
  normalizeAgent,
  type Agent,
  type AgentDraft,
} from "./agent";

function rascunho(parcial: Partial<AgentDraft> = {}): AgentDraft {
  const { name: _name, ...base } = emptyAgentDraft();
  return { ...base, ...parcial };
}

function agente(parcial: Partial<Agent> = {}): Agent {
  return {
    id: "a1",
    name: "NFCe-SRV-MATRIZ",
    isActive: true,
    logLevel: "info",
    installPath: null,
    createdAt: "",
    updatedAt: "",
    sefaz: { timeoutMs: 30000, retryMaxAttempts: 3, retryBackoffMs: 1000, apiRateLimit: 100 },
    contingency: {
      enabled: false,
      reason: null,
      autoTransmit: true,
      workerEnabled: true,
      workerIntervalMs: null,
      substitutionWorkerEnabled: false,
      substitutionWorkerIntervalMs: null,
      substitutionJustification: null,
      slaWarnHours: null,
      slaBlockHours: null,
    },
    ...parcial,
  } as Agent;
}

describe("situação do agente", () => {
  it("parado, em contingência ou em operação", () => {
    expect(agentHealth(agente({ isActive: false }))).toBe("stopped");
    expect(agentHealth(agente())).toBe("running");
    expect(
      agentHealth(agente({ contingency: { ...agente().contingency, enabled: true } })),
    ).toBe("contingency");
  });

  it("aponta a combinação que trava a loja em silêncio", () => {
    // Contingência ligada sem transmissão automática: as notas se acumulam e
    // ninguém as envia à SEFAZ.
    const travado = agente({
      contingency: { ...agente().contingency, enabled: true, autoTransmit: false },
    });
    expect(accumulatesWithoutSending(travado)).toBe(true);
    expect(accumulatesWithoutSending(agente())).toBe(false);
  });
});

describe("avisos do formulário do agente", () => {
  it("avisa, sem impedir, quando o valor foge da faixa usual", () => {
    const avisos = inspectAgent(rascunho({ timeoutMs: 600_000 }));
    expect(avisos.some((a) => a.field === "timeoutMs")).toBe(true);
    expect(avisos.every((a) => a.severity !== "danger")).toBe(true);
  });

  it("marca como grave a contingência que acumula sem enviar", () => {
    const avisos = inspectAgent(
      rascunho({ contingencyEnabled: true, contingencyAutoTransmit: false }),
    );
    const grave = avisos.find((a) => a.field === "contingencyAutoTransmit");
    expect(grave?.severity).toBe("danger");
  });

  it("pede o motivo da contingência, para quem vier depois entender", () => {
    const avisos = inspectAgent(rascunho({ contingencyEnabled: true, contingencyReason: "  " }));
    expect(avisos.some((a) => a.field === "contingencyReason")).toBe(true);
  });

  it("rascunho padrão não gera aviso nenhum", () => {
    expect(inspectAgent(rascunho())).toEqual([]);
  });
});

describe("o que impede gravar o agente", () => {
  it("campo numérico vazio não tem valor a gravar", () => {
    const faltando = missingNumbers(rascunho({ timeoutMs: Number.NaN }));
    expect(faltando).toContain("timeoutMs");
    expect(missingNumbers(rascunho())).toEqual([]);
  });

  it("agente novo precisa de nome, que depois não muda", () => {
    expect(missingName({ ...emptyAgentDraft(), name: "   " })).toBe(true);
    expect(missingName({ ...emptyAgentDraft(), name: "NFCe-SRV-02" })).toBe(false);
  });
});

describe("normalização antes de gravar", () => {
  it("padroniza o nível de log e limpa o motivo quando a contingência sai", () => {
    const limpo = normalizeAgent(
      rascunho({ logLevel: " INFO ", contingencyEnabled: false, contingencyReason: "queda SEFAZ" }),
    );
    expect(limpo.logLevel).toBe("info");
    expect(limpo.contingencyReason).toBe("");
  });

  it("mantém o motivo enquanto a contingência estiver ligada", () => {
    const limpo = normalizeAgent(
      rascunho({ contingencyEnabled: true, contingencyReason: "  queda SEFAZ  " }),
    );
    expect(limpo.contingencyReason).toBe("queda SEFAZ");
  });
});
