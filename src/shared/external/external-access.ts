import { supabase } from "@/shared/supabase/client";

/**
 * Os outros sistemas da EasySoft, abertos já com o login feito.
 *
 * EasyBilling (planos e créditos de IA): a função `mint-derived-session` gera
 * um link de acesso de uso único para o mesmo usuário, e o destino o valida na
 * rota `/sso`. Suporte: a função `sso-support` devolve o endereço pronto.
 *
 * A aba é aberta antes de pedir o link. O navegador só permite abrir janela
 * como resposta direta a um clique; aberta depois de esperar a rede, ela seria
 * bloqueada como pop-up.
 */
const PLATAFORMA_PADRAO = "https://billing.easysoftcloud.com.br";

function plataforma(): string {
  const configurada = import.meta.env.VITE_ADMIN_PLATFORM_URL?.trim();
  return (configurada || PLATAFORMA_PADRAO).replace(/\/+$/, "");
}

export type ExternalDestination = "billing" | "ai-credits" | "support";

const CAMINHO: Record<Exclude<ExternalDestination, "support">, string> = {
  billing: "/modules/easycommandpay",
  "ai-credits": "/ai-credits",
};

/** O endereço de entrada no destino, com o link de acesso e para onde seguir depois. */
export function ssoUrl(base: string, caminho: string, tokenHash: string): string {
  const url = new URL("/sso", base);
  url.searchParams.set("sso_token", tokenHash);
  url.searchParams.set("sso_type", "magiclink");
  url.searchParams.set("next", caminho);
  return url.toString();
}

async function enderecoDoBilling(caminho: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ token_hash?: string }>(
    "mint-derived-session",
    { method: "POST", body: {} },
  );
  if (error) throw new Error(`Não foi possível gerar o acesso: ${error.message}`);
  if (!data?.token_hash) throw new Error("O servidor não devolveu o link de acesso.");
  return ssoUrl(plataforma(), caminho, data.token_hash);
}

async function enderecoDoSuporte(): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ redirect_url?: string }>(
    "sso-support",
    { method: "POST" },
  );
  if (error) throw new Error(`Não foi possível acessar o suporte: ${error.message}`);
  if (!data?.redirect_url) throw new Error("O servidor não devolveu o endereço do suporte.");
  return data.redirect_url;
}

export async function openExternal(destino: ExternalDestination): Promise<void> {
  const aba = window.open("about:blank", "_blank");
  try {
    const endereco =
      destino === "support" ? await enderecoDoSuporte() : await enderecoDoBilling(CAMINHO[destino]);
    if (aba) {
      // Sem acesso à janela que abriu: o destino não pode mexer no painel.
      aba.opener = null;
      aba.location.href = endereco;
    } else {
      window.location.href = endereco;
    }
  } catch (erro) {
    aba?.close();
    throw erro;
  }
}
