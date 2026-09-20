import { describe, expect, it } from "vitest";
import { buildChanges, describeValue, isSensitiveField, toAction, toSource } from "./audit-entry";

describe("auditoria", () => {
  it("esconde o valor de campo sensível, mas registra que ele mudou", () => {
    expect(isSensitiveField("nfce_service_api_key")).toBe(true);
    expect(describeValue("nfce_service_api_key", "abc123")).toBe("•••••");
    expect(describeValue("aditum_activation_code", null)).toBe("vazio");
  });

  it("mostra o valor comum em português", () => {
    expect(describeValue("is_active", true)).toBe("sim");
    expect(describeValue("is_active", false)).toBe("não");
    expect(describeValue("totem_name", "TOTEM-01")).toBe("TOTEM-01");
    expect(describeValue("totem_name", null)).toBeNull();
  });

  it("monta o antes e o depois de cada campo alterado", () => {
    const mudancas = buildChanges(
      ["totem_name", "tef_http_api_key"],
      { totem_name: "TOTEM-01", tef_http_api_key: "velha" },
      { totem_name: "TOTEM-02", tef_http_api_key: "nova" },
    );

    expect(mudancas[0]).toEqual({ field: "totem_name", previous: "TOTEM-01", next: "TOTEM-02" });
    // A chave mudou; qual era e qual é ninguém precisa saber pela auditoria.
    expect(mudancas[1]).toEqual({ field: "tef_http_api_key", previous: "•••••", next: "•••••" });
  });

  it("classifica origem e ação, com padrão para o desconhecido", () => {
    expect(toSource("totem")).toBe("totem");
    expect(toAction("updated")).toBe("updated");
    // Ação desconhecida não vira "alteração": inventar o tipo do registro
    // seria pior que admitir que não se sabe.
    expect(toAction("coisa-que-nao-existe")).toBe("unknown");
  });
});
