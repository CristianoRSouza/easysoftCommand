import { isSecretField } from "@/shared/domain/redact";

/**
 * O que aconteceu antes do erro: console, rede e os passos do usuário.
 *
 * Uma mensagem de erro sozinha raramente diz como se chegou até ela. Estes
 * registros circulares guardam só os últimos eventos e vão junto no relatório.
 */

const LIMITE_DE_TEXTO = 2048;

class Recentes<T> {
  private itens: T[] = [];
  constructor(private readonly capacidade: number) {}
  add(item: T) {
    if (this.itens.length >= this.capacidade) this.itens.shift();
    this.itens.push(item);
  }
  snapshot(): T[] {
    return [...this.itens];
  }
}

export const consoleLog = new Recentes<{ level: string; ts: string; args: unknown[] }>(100);
export const networkLog = new Recentes<{
  method: string;
  url: string;
  status: number | null;
  duration_ms: number;
  timestamp: string;
}>(50);
export const stepsLog = new Recentes<{ type: "nav" | "click"; ts: string; [k: string]: unknown }>(50);

/**
 * Tira segredos antes de guardar. Campo com nome de segredo perde o valor; em
 * texto, somem o token de `Bearer` e os JWT — que aparecem em URL e em log de
 * erro do cliente HTTP sem ninguém pedir.
 */
export function mask(valor: unknown): unknown {
  if (typeof valor === "string") {
    const limpo = valor
      .replace(/(Bearer\s+)\S+/gi, "$1****")
      .replace(/(eyJ[A-Za-z0-9_-]{10})[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*/g, "$1****")
      .replace(/([?&](?:apikey|token|access_token|token_hash)=)[^&#]+/gi, "$1****");
    return limpo.length > LIMITE_DE_TEXTO ? `${limpo.slice(0, LIMITE_DE_TEXTO)}…[cortado]` : limpo;
  }
  if (Array.isArray(valor)) return valor.map(mask);
  if (valor instanceof Error) return mask(`${valor.name}: ${valor.message}`);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor).map(([chave, v]) => [chave, isSecretField(chave) || /authorization|cookie/i.test(chave) ? "****" : mask(v)]),
    );
  }
  return valor;
}

/** Identifica o próprio envio do relatório, para ele não se registrar a si mesmo. */
export const REPORT_PATH = "/functions/v1/error-report-proxy";

let instalado = false;

/** Passa a registrar console, rede e passos. Chamado uma vez, na inicialização. */
export function installTelemetry() {
  if (instalado) return;
  instalado = true;

  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      consoleLog.add({ level, ts: new Date().toISOString(), args: args.map(mask) });
      original(...args);
    };
  }

  const fetchOriginal = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes(REPORT_PATH)) return fetchOriginal(input, init);

    const inicio = performance.now();
    const registro = {
      method: (init?.method ?? "GET").toUpperCase(),
      url: mask(url) as string,
      timestamp: new Date().toISOString(),
    };
    try {
      const resposta = await fetchOriginal(input, init);
      networkLog.add({ ...registro, status: resposta.status, duration_ms: Math.round(performance.now() - inicio) });
      return resposta;
    } catch (erro) {
      networkLog.add({ ...registro, status: null, duration_ms: Math.round(performance.now() - inicio) });
      throw erro;
    }
  };

  // O painel navega por hash: `hashchange` pega toda troca de tela.
  window.addEventListener("hashchange", (e) =>
    stepsLog.add({ type: "nav", ts: new Date().toISOString(), from: mask(e.oldURL), to: mask(e.newURL) }),
  );

  document.addEventListener(
    "click",
    (e) => {
      const alvo = e.target as HTMLElement | null;
      if (!alvo?.tagName) return;
      stepsLog.add({
        type: "click",
        ts: new Date().toISOString(),
        target: alvo.tagName.toLowerCase() + (alvo.id ? `#${alvo.id}` : ""),
        // Campo de formulário não tem o texto registrado: pode ser senha.
        text: alvo instanceof HTMLInputElement ? "" : (alvo.textContent ?? "").trim().slice(0, 80),
      });
    },
    { capture: true, passive: true },
  );
}
