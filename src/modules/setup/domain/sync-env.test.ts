import { describe, expect, it } from "vitest";
import { buildSyncEnv, DEFAULT_SYNC_ENV, parseIbConfig } from "./sync-env";

describe("parseIbConfig", () => {
  const arquivo = [
    "[Config]",
    "DataPath=C:\\ERRADO\\X.FDB",
    "Path=C:\\EasySoft\\Dados\\NOVOBANCO.FDB",
    "Path_Midia=C:\\EasySoft\\Dados\\MIDIAS.FDB",
  ].join("\r\n");

  it("lê os dois caminhos e ignora chave parecida que vem antes", () => {
    // O projeto anterior procurava "Path=" em qualquer lugar da linha e pegaria
    // a DataPath, que aponta para outro banco.
    expect(parseIbConfig(arquivo)).toEqual({
      database: "C:\\EasySoft\\Dados\\NOVOBANCO.FDB",
      mediaDatabase: "C:\\EasySoft\\Dados\\MIDIAS.FDB",
    });
  });

  it("devolve nulo para o que o arquivo não tem", () => {
    expect(parseIbConfig("[Config]\nPath=C:\\D.FDB")).toEqual({
      database: "C:\\D.FDB",
      mediaDatabase: null,
    });
    expect(parseIbConfig("arquivo qualquer")).toEqual({ database: null, mediaDatabase: null });
  });
});

describe("buildSyncEnv", () => {
  it("gera as chaves que o Sync-Service espera, com a senha entre aspas", () => {
    const env = buildSyncEnv({ ...DEFAULT_SYNC_ENV, fbPassword: "senha#comjogodavelha" });

    expect(env).toContain('FB_PASSWORD="senha#comjogodavelha"');
    expect(env).toContain("FB_MEDIA_DATABASE=");
    expect(env).toContain("PORT=3001");
    expect(env).toContain("SYNC_INTERVAL=60000");
    // Vinham do .env.example do painel, não do serviço, e a segunda contradizia
    // o passo que manda ativar o WireCrypt.
    expect(env).not.toContain("FB_CHARSET");
    expect(env).not.toContain("FB_WIRE_CRYPT");
  });

  it("não escapa nada dentro das aspas: o dotenv não desfaz escape", () => {
    const env = buildSyncEnv({ ...DEFAULT_SYNC_ENV, pgPassword: "c:\\senha" });
    expect(env).toContain('PG_PASSWORD="c:\\senha"');
  });
});
