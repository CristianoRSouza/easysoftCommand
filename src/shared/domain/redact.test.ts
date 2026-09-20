import { describe, expect, it } from "vitest";
import { isSecretField, REDACTED, redactSecrets } from "./redact";

/**
 * A auditoria do projeto anterior gravava `nfce_service_api_key` e
 * `tef_http_api_key` em claro, num JSON que a própria tela de auditoria
 * exibia — e o registro é permanente: trocar a chave não apaga o que ficou
 * gravado. Aqui a decisão é pelo nome do campo, para um campo novo nascer
 * protegido.
 */
describe("campos que não podem ser gravados em claro", () => {
  it("reconhece token, chave, senha e código de ativação", () => {
    for (const campo of [
      "nfce_service_api_key",
      "tef_http_api_key",
      "aditum_partner_token",
      "aditum_activation_code",
      "pix_client_secret",
      "senha_do_banco",
      "certificate_password",
    ]) {
      expect(isSecretField(campo), campo).toBe(true);
    }
  });

  it("deixa passar o que descreve o segredo sem revelá-lo", () => {
    // Sem isto, a tela perderia a informação de que existe uma chave gravada.
    for (const campo of ["token_encrypted", "api_key_set", "secret_kid", "token_prefix"]) {
      expect(isSecretField(campo), campo).toBe(false);
    }
  });

  it("não protege campo comum", () => {
    expect(isSecretField("totem_name")).toBe(false);
    expect(isSecretField("is_active")).toBe(false);
  });

  it("troca o valor pelo marcador, sem apagar o campo", () => {
    // Quem lê a auditoria precisa saber que a chave mudou, mesmo sem ver para quê.
    expect(
      redactSecrets({ totem_name: "TOTEM-01", nfce_service_api_key: "abc123", api_key_set: true }),
    ).toEqual({ totem_name: "TOTEM-01", nfce_service_api_key: REDACTED, api_key_set: true });
  });

  it("campo vazio continua vazio, e não vira 'removido'", () => {
    expect(redactSecrets({ token: null })).toEqual({ token: null });
  });
});
