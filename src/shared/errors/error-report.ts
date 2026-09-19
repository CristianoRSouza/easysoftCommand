import { supabase } from "@/shared/supabase/client";
import { consoleLog, installTelemetry, networkLog, REPORT_PATH, stepsLog, mask } from "./telemetry";

/**
 * Envia ao EasyGuardian o erro que escapou do código.
 *
 * O envio passa pela função `error-report-proxy`, que guarda o segredo do
 * EasyGuardian e exige usuário logado — sem isso o endereço viraria alvo de
 * spam. Sem sessão, o relatório não sai.
 *
 * Não vai captura de tela. O projeto anterior mandava uma, com nomes de
 * clientes, CNPJ e valores à mostra, enquanto mascarava o texto do relatório
 * com cuidado. O campo aceita vazio.
 */

const APP = "EasyFoodManager";
const PROJECT_ID = "d5bb6892-1559-41c8-8458-567d55a934eb";
const MAXIMO_POR_SESSAO = 5;
const JANELA_DE_REPETICAO_MS = 60_000;

let enviados = 0;
const ultimosEnvios = new Map<string, number>();

/** Erro de desenvolvimento não é relatório: só produção envia. */
function ambienteLocal(): boolean {
  return ["localhost", "127.0.0.1"].includes(location.hostname);
}

/** Mesmo erro em sequência vira um relatório só, e a sessão tem teto. */
function devePular(mensagem: string): boolean {
  if (enviados >= MAXIMO_POR_SESSAO) return true;
  const ultimo = ultimosEnvios.get(mensagem);
  return ultimo !== undefined && Date.now() - ultimo < JANELA_DE_REPETICAO_MS;
}

/**
 * Nunca lança. O relatório de erro não pode virar um segundo erro dentro do
 * tratador do primeiro: se a entrega falhar, perde-se o relatório em silêncio.
 */
export async function reportError(erro: unknown, componentStack?: string): Promise<void> {
  try {
    const objeto = erro instanceof Error ? erro : new Error(String(erro));
    const mensagem = objeto.message || String(erro);
    if (ambienteLocal() || devePular(mensagem)) return;

    const { data } = await supabase.auth.getSession();
    const sessao = data.session;
    if (!sessao) return;

    ultimosEnvios.set(mensagem, Date.now());
    enviados += 1;

    const corpo = {
      source_app: APP,
      source_project_id: PROJECT_ID,
      user_id: sessao.user.id,
      user_email: sessao.user.email ?? null,
      company_id: null,
      url: mask(location.href),
      user_agent: navigator.userAgent,
      error_message: mask(mensagem),
      error_stack: objeto.stack ?? null,
      component_stack: componentStack ?? null,
      console_logs: consoleLog.snapshot(),
      steps: stepsLog.snapshot(),
      screenshot: null,
      metadata: {
        viewport: { w: window.innerWidth, h: window.innerHeight },
        network: networkLog.snapshot(),
        release: __APP_VERSION__,
        route: location.hash.replace("#", "") || location.pathname,
      },
    };

    // `keepalive` deixa o envio terminar mesmo se a aba for fechada.
    void fetch(`${import.meta.env.VITE_SUPABASE_URL}${REPORT_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${sessao.access_token}`,
      },
      body: JSON.stringify(corpo),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Ver o comentário da função: aqui nada pode escapar.
  }
}

/** Liga o registro e passa a relatar erros que ninguém tratou. */
export function installErrorReporting() {
  installTelemetry();
  window.addEventListener("error", (e) => void reportError(e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) =>
    void reportError(e.reason ?? "Promise rejeitada sem tratamento"),
  );
}
