import { describe, expect, it } from "vitest";
import { toEntityStatus, toQueueEvent, toSummary } from "./queue-mapper";

/**
 * As colunas das duas filas têm nomes diferentes onde a direção muda o
 * sentido. A tela migrada lia `id`, `entity` e `last_error`, que não existem:
 * a entidade saía vazia e o erro nunca aparecia. Os nomes abaixo são os que as
 * funções do banco devolvem de verdade.
 */
describe("mapeamento da fila de entrada", () => {
  it("lê as colunas da entrada, com o sucesso chamado de aplicado", () => {
    const evento = toQueueEvent("inbox", {
      event_id: "e1",
      entity_name: "command.order_items",
      entity_id: "i1",
      op: "U",
      apply_status: "applied",
      retry_count: 3,
      applied_at: "2026-09-13T01:55:10Z",
      received_at: "2026-09-10T21:38:00Z",
      apply_error: "",
      payload: { fb_id: 6706 },
    });

    expect(evento).toMatchObject({
      eventId: "e1",
      entity: "command.order_items",
      entityId: "i1",
      status: "done",
      retryCount: 3,
      queuedAt: "2026-09-10T21:38:00Z",
      doneAt: "2026-09-13T01:55:10Z",
      error: null,
    });
  });

  it("lê as colunas da saída, com o sucesso chamado de despachado", () => {
    const evento = toQueueEvent("outbox", {
      event_id: "e2",
      entity_name: "devices.totem_config",
      op: "U",
      dispatch_status: "dispatched",
      dispatched_at: "2026-07-13T16:45:20Z",
      changed_at: "2026-07-13T16:44:10Z",
      dispatch_error: "",
    });

    expect(evento).toMatchObject({
      status: "done",
      queuedAt: "2026-07-13T16:44:10Z",
      doneAt: "2026-07-13T16:45:20Z",
    });
  });

  it("trata a linha de falha recente, que vem sem status e com o erro em `erro`", () => {
    const evento = toQueueEvent("inbox", {
      event_id: "e3",
      entity_name: "command.order_items",
      received_at: "2026-09-04T22:01:00Z",
      retry_count: 3,
      erro: 'duplicate key value violates unique constraint "uq_order_items"',
    });

    expect(evento.status).toBe("failed");
    expect(evento.error).toContain("duplicate key");
  });

  it("soma os dois tipos de pendente e a taxa da última hora", () => {
    const resumo = toSummary(
      "inbox",
      { pending_novos: 2, pending_em_retry: 1, applied_total: 8, failed_terminal: 5 },
      [{ aplicados_por_minuto: 3 }, { aplicados_por_minuto: 4 }],
    );

    expect(resumo).toEqual({
      newPending: 2,
      retrying: 1,
      done: 8,
      failed: 5,
      doneLastHour: 7,
    });
  });

  it("classifica a situação por entidade e não deixa o nome vazio", () => {
    expect(toEntityStatus("inbox", { apply_status: "failed", qtd: 5 })).toMatchObject({
      entity: "—",
      status: "failed",
      count: 5,
    });
    expect(toEntityStatus("outbox", { dispatch_status: "pending" }).status).toBe("pending");
  });
});
