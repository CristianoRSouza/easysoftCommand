import { describe, expect, it } from "vitest";
import {
  APP_NAME,
  chatErrorMessage,
  deltaOf,
  historyMatcher,
  panelRoute,
  splitSessions,
  suggestionsFor,
  todayKey,
  type ChatSession,
} from "./chat";

function sessao(parcial: Partial<ChatSession>): ChatSession {
  return {
    id: "s1",
    userId: "u1",
    day: "2026-09-19",
    app: APP_NAME,
    messages: [],
    startedAt: "",
    endedAt: "",
    ...parcial,
  };
}

describe("conversa de hoje e histórico", () => {
  it("abre a conversa de hoje do próprio usuário, neste painel", () => {
    const minha = sessao({ id: "minha" });
    const doColega = sessao({ id: "colega", userId: "u2" });
    const outroApp = sessao({ id: "easyml", app: "easyml" });
    const ontem = sessao({ id: "ontem", day: "2026-09-18" });

    const { today, history } = splitSessions(
      [minha, doColega, outroApp, ontem],
      "u1",
      "2026-09-19",
    );

    // A lista é da empresa inteira de propósito; sem o filtro de usuário, a
    // conversa do colega abriria como se fosse minha.
    expect(today?.id).toBe("minha");
    expect(history.map((s) => s.id)).toEqual(["colega", "easyml", "ontem"]);
  });

  it("sem conversa de hoje, tudo é histórico", () => {
    const { today, history } = splitSessions([sessao({ day: "2026-09-18" })], "u1", "2026-09-19");
    expect(today).toBeNull();
    expect(history).toHaveLength(1);
  });

  it("a chave do dia é a data local, com dois dígitos", () => {
    expect(todayKey(new Date(2026, 8, 5))).toBe("2026-09-05");
  });
});

describe("resposta do assistente", () => {
  it("lê o texto de cada pedaço do fluxo", () => {
    expect(deltaOf('data: {"choices":[{"delta":{"content":"Olá"}}]}')).toBe("Olá");
  });

  it("ignora o fim do fluxo, comentário e pedaço partido no meio", () => {
    expect(deltaOf("data: [DONE]")).toBeNull();
    expect(deltaOf(": keep-alive")).toBeNull();
    expect(deltaOf('data: {"choi')).toBeNull();
    expect(deltaOf("")).toBeNull();
  });
});

describe("erros do assistente", () => {
  it("separa acabou o crédito de calma, que pedem ações diferentes", () => {
    expect(chatErrorMessage(402, {})).toContain("Créditos insuficientes");
    expect(chatErrorMessage(429, {})).toContain("Aguarde");
  });

  it("usa o texto legível, não o código interno", () => {
    // No EasyAI, `error` é o código e `message` é o texto de gente.
    expect(chatErrorMessage(500, { error: "ai_upstream_error", message: "Serviço indisponível" })).toBe(
      "Serviço indisponível",
    );
    expect(chatErrorMessage(500, {})).toContain("assistente");
  });
});

describe("links das respostas", () => {
  it("traduz as rotas do projeto anterior para as deste painel", () => {
    // O assistente ainda cita "/products"; sem traduzir, o link cai na página
    // de não encontrado.
    expect(panelRoute("/products")).toBe("/produtos");
    expect(panelRoute("/sync")).toBe("/fila-nuvem");
    expect(panelRoute("/nfce-issuer#csc")).toBe("/emitente#csc");
    expect(panelRoute("/orders?x=1")).toBe("/comandas?x=1");
  });

  it("deixa passar a rota que já é deste painel", () => {
    expect(panelRoute("/nfce")).toBe("/nfce");
    expect(panelRoute("/receitas")).toBe("/receitas");
  });
});

describe("sugestões e busca no histórico", () => {
  it("sugere conforme a tela aberta, com um padrão para as demais", () => {
    expect(suggestionsFor("/produtos")[1]).toContain("IBS/CBS");
    expect(suggestionsFor("/tela-que-nao-existe")).toEqual(suggestionsFor("/outra"));
  });

  it("busca sem acento e sem caixa, com frase exata e prefixo", () => {
    const frase = historyMatcher('"nota fiscal"');
    expect(frase("Como emito a NOTA FISCAL?")).toBe(true);
    expect(frase("Nota sobre fiscal")).toBe(false);

    expect(historyMatcher("emi*")("Como emitir")).toBe(true);
    expect(historyMatcher("cafe")("Pedido de CAFÉ")).toBe(true);
    expect(historyMatcher("pedido cafe")("Pedido de café")).toBe(true);
    expect(historyMatcher("xyz")("abc")).toBe(false);
  });

  it("busca vazia devolve tudo", () => {
    expect(historyMatcher("")("qualquer coisa")).toBe(true);
  });
});
