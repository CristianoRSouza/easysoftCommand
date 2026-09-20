import { describe, expect, it } from "vitest";
import { parseSyncError, SYNC_ERROR_HINT, SYNC_ERROR_LABEL } from "./sync-error";

describe("erro da fila", () => {
  it("classifica pelo código do PostgreSQL, que é o caminho mais confiável", () => {
    expect(parseSyncError("falhou, SQLSTATE: 23503")?.category).toBe("foreign_key");
    expect(parseSyncError("erro code 42501 ao gravar")?.category).toBe("permission");
  });

  it("classifica pelo texto quando não há código — caso real desta loja", () => {
    const erro = parseSyncError(
      'duplicate key value violates unique constraint "uq_order_items_2026_h2_fb_id"',
    );
    expect(erro?.category).toBe("unique");
    expect(erro?.constraint).toBe("uq_order_items_2026_h2_fb_id");
  });

  it("extrai tabela e coluna quando a mensagem as cita", () => {
    const erro = parseSyncError('column "fb_id" of relation "order_items" does not exist');
    expect(erro).toMatchObject({ category: "undefined_column", column: "fb_id", table: "order_items" });
  });

  it("guarda a mensagem original mesmo sem reconhecer o padrão", () => {
    const erro = parseSyncError("pane geral no servidor");
    expect(erro).toMatchObject({ category: "unknown", raw: "pane geral no servidor" });
  });

  it("não inventa erro onde não há", () => {
    expect(parseSyncError(null)).toBeNull();
    expect(parseSyncError("   ")).toBeNull();
  });

  it("toda categoria tem rótulo e explicação para quem opera", () => {
    for (const categoria of Object.keys(SYNC_ERROR_LABEL) as (keyof typeof SYNC_ERROR_LABEL)[]) {
      expect(SYNC_ERROR_LABEL[categoria]).toBeTruthy();
      expect(SYNC_ERROR_HINT[categoria]).toBeTruthy();
    }
  });
});
