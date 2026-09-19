/**
 * O assistente de IA do painel.
 *
 * Quem responde é o EasyAI, a porta única de IA da EasySoft. As conversas
 * ficam em `billing.ai_chat_sessions`, uma por usuário e dia: a de hoje fica
 * aberta no chat, as anteriores viram histórico.
 */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  ts?: number;
}

export interface ChatSession {
  id: string;
  userId: string;
  /** `AAAA-MM-DD`. */
  day: string;
  app: string | null;
  messages: ChatMessage[];
  startedAt: string;
  endedAt: string;
}

/** Como este painel se identifica ao EasyAI e nas conversas gravadas. */
export const APP_NAME = "easyfood-manager";

export function todayKey(now: Date = new Date()): string {
  const mes = String(now.getMonth() + 1).padStart(2, "0");
  const dia = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mes}-${dia}`;
}

/**
 * A conversa de hoje é a do próprio usuário, deste painel. A lista é da
 * empresa inteira de propósito — o histórico é compartilhado —, e sem o
 * filtro de usuário a conversa de um colega abriria como se fosse minha.
 */
export function splitSessions(
  sessoes: ChatSession[],
  userId: string,
  hoje: string,
): { today: ChatSession | null; history: ChatSession[] } {
  const today =
    sessoes.find((s) => s.day === hoje && s.userId === userId && s.app === APP_NAME) ?? null;
  return { today, history: sessoes.filter((s) => s !== today) };
}

/**
 * O texto de uma linha do fluxo de resposta (SSE no formato da OpenAI).
 * Linha incompleta devolve `null`: o próximo pedaço da rede a completa.
 */
export function deltaOf(linha: string): string | null {
  if (!linha.startsWith("data: ")) return null;
  const dados = linha.slice(6).trim();
  if (dados === "[DONE]") return null;
  try {
    const conteudo = JSON.parse(dados)?.choices?.[0]?.delta?.content;
    return typeof conteudo === "string" && conteudo ? conteudo : null;
  } catch {
    return null;
  }
}

/**
 * A mensagem de erro para quem usa. 402 e 429 querem dizer coisas diferentes
 * — acabou o crédito, ou calma —, e um texto genérico faria os dois parecerem
 * defeito do sistema. No EasyAI o texto legível mora em `message`; `error` é
 * o código.
 */
export function chatErrorMessage(status: number, corpo: { message?: string; error?: string }): string {
  if (status === 402) return "Créditos insuficientes. Acesse Créditos IA no menu.";
  if (status === 429) return "Muitas perguntas seguidas. Aguarde alguns segundos.";
  return corpo.message || corpo.error || "Não foi possível falar com o assistente.";
}

/**
 * Rotas do projeto anterior, que o assistente ainda cita nas respostas, para
 * as deste painel. Sem isto, o link "/products" da resposta cairia na página
 * de não encontrado.
 */
const ROTA_ANTIGA: Record<string, string> = {
  "/products": "/produtos",
  "/orders": "/comandas",
  "/transactions": "/transacoes",
  "/units": "/unidades",
  "/nfce-issuer": "/emitente",
  "/nfce-issuer-fiscal": "/reforma-tributaria",
  "/totems": "/totens",
  "/agents": "/agentes",
  "/sync": "/fila-nuvem",
  "/audit-logs": "/auditoria",
  "/wizard": "/assistente",
  "/bootstrap-codes": "/primeiro-acesso",
};

export function panelRoute(href: string): string {
  const [caminho = "", resto = ""] = href.split(/(?=[?#])/, 2);
  return (ROTA_ANTIGA[caminho] ?? caminho) + resto;
}

/** Perguntas sugeridas conforme a tela aberta — as do projeto anterior. */
const SUGESTOES: Record<string, string[]> = {
  "/": ["Como leio o Dashboard?", "Onde vejo o faturamento de hoje?", "O que é a Reforma Tributária aqui?"],
  "/fila-nuvem": ["Como sei se a sincronização está OK?", "O que significa cada status?", "Como reprocesso um evento?"],
  "/produtos": ["Como vejo detalhes fiscais de um produto?", "O que é IBS/CBS?", "Onde edito a unidade?"],
  "/comandas": ["Como filtro comandas por totem?", "O que significa cancelado em vermelho?", "Onde vejo o ID Firebird?"],
  "/transacoes": ["Como filtro por bandeira?", "Onde vejo o total de PIX?", "Como exporto transações?"],
  "/nfce": ["Como consulto uma NFC-e?", "O que significa Inutilizada?", "Onde vejo o XML?"],
  "/emitente": ["Como configuro o emitente?", "Onde edito CSC e CSC ID?", "O que é multitenant?"],
  "/totens": ["Como ativo/desativo um totem?", "Onde configuro o TEF Aditum?", "O que é heartbeat?"],
  "/agentes": ["Como instalo o agente de serviço?", "Como gero uma nova API key?", "Onde vejo os logs?"],
};

const SUGESTOES_PADRAO = [
  "Como começo a usar o sistema?",
  "Onde acompanho meus pedidos?",
  "Como configuro a NFC-e?",
];

export function suggestionsFor(rota: string): string[] {
  return SUGESTOES[rota] ?? SUGESTOES_PADRAO;
}

/** Busca no histórico: `"frase exata"`, palavra, ou prefixo com `*`. Sem acento e sem caixa. */
function dobrar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function historyMatcher(busca: string): (texto: string) => boolean {
  const termos = [...busca.matchAll(/"([^"]+)"|(\S+)/g)]
    .map((m) => (m[1] ?? m[2] ?? "").trim())
    .filter(Boolean)
    .map((termo) => new RegExp(dobrar(termo).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")));
  return (texto) => {
    const dobrado = dobrar(texto);
    return termos.every((termo) => termo.test(dobrado));
  };
}
