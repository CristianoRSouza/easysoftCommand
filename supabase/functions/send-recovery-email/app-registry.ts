// Registry centralizado de apps suportados pela edge function
// `send-recovery-email`. Todos os módulos conectados ao mesmo Supabase
// resolvem domínio + branding a partir daqui.
//
// Para adicionar um novo módulo:
//   1. Adicione uma entrada em APP_REGISTRY com a `key` única.
//   2. Garanta que o domínio (host de `resetUrl`) corresponda a uma das
//      regex em ALLOWED_REDIRECT_HOSTS — caso contrário, atualize a lista.
//   3. No frontend do módulo, chame:
//        supabase.functions.invoke('send-recovery-email',
//          { body: { email, app: '<key>' } })
//
// Nada além deste arquivo precisa ser alterado para suportar um novo app.

export interface AppConfig {
  /** URL absoluta da página que processa `?token_hash=...&type=recovery`. */
  resetUrl: string;
  /** Nome do produto exibido no corpo do email. */
  appName: string;
  /** Assinatura/rodapé do email. */
  brandFooter: string;
  /** Cor primária do botão (HEX). */
  brandColor: string;
  /** Tag enviada para o EasyMail em `source` (rastreio). */
  source: string;
  /** Assunto do email. */
  subject: string;
}

/**
 * Apps registrados. A chave deve ser curta, lowercase e estável — é o valor
 * que o frontend envia em `body.app`.
 */
export const APP_REGISTRY: Record<string, AppConfig> = {
  manager: {
    resetUrl: "https://manager.easysoftcloud.com.br/reset-password",
    appName: "EasyCommandPay Manager",
    brandFooter: "EasySoft · EasyCommandPay",
    brandColor: "#3B8EE8",
    source: "manager-web/reset-password",
    subject: "Redefinição de senha — EasyCommandPay Manager",
  },
  // Exemplos para registrar quando os módulos forem publicados — basta
  // descomentar e ajustar o host/branding:
  //
  // billing: {
  //   resetUrl: "https://billing.easysoftcloud.com.br/reset-password",
  //   appName: "EasyBilling",
  //   brandFooter: "EasySoft · EasyBilling",
  //   brandColor: "#3B8EE8",
  //   source: "billing-web/reset-password",
  //   subject: "Redefinição de senha — EasyBilling",
  // },
  // vendas: {
  //   resetUrl: "https://vendas.easysoftcloud.com.br/reset-password",
  //   appName: "EasyVendas",
  //   brandFooter: "EasySoft · EasyVendas",
  //   brandColor: "#3B8EE8",
  //   source: "vendas-web/reset-password",
  //   subject: "Redefinição de senha — EasyVendas",
  // },
};

/** Chave usada quando o caller não envia `app`. */
export const DEFAULT_APP_KEY = "manager";

/**
 * Allowlist de hosts permitidos quando o caller envia `redirect_to`
 * customizado (módulos não registrados / ambientes de QA).
 *
 * Mantém-se restrito a domínios EasySoft + previews do Lovable para evitar
 * uso como open-redirect.
 */
export const ALLOWED_REDIRECT_HOSTS: RegExp[] = [
  /\.easysoftcloud\.com\.br$/i,
  /^easysoftcloud\.com\.br$/i,
  /\.lovable\.app$/i,
];

export interface CustomRedirectInput {
  redirect_to: string;
  app_name?: string;
  subject?: string;
  source?: string;
  brand_color?: string;
}

export type ResolveResult = { ok: true; cfg: AppConfig } | { ok: false; error: string };

function isRedirectAllowed(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  return ALLOWED_REDIRECT_HOSTS.some((rx) => rx.test(url.hostname));
}

/**
 * Resolve a configuração do app a partir do payload da requisição.
 * Precedência:
 *   1) `redirect_to` explícito (validado contra `ALLOWED_REDIRECT_HOSTS`)
 *   2) `app` (lookup em `APP_REGISTRY`)
 *   3) `DEFAULT_APP_KEY`
 */
export function resolveAppConfig(input: {
  app?: string;
  redirect_to?: string;
  app_name?: string;
  subject?: string;
  source?: string;
  brand_color?: string;
}): ResolveResult {
  // 1) redirect_to explícito.
  if (input.redirect_to) {
    let parsed: URL;
    try {
      parsed = new URL(input.redirect_to);
    } catch {
      return { ok: false, error: "redirect_to inválido" };
    }
    if (!isRedirectAllowed(parsed)) {
      return { ok: false, error: "Domínio de redirect_to não autorizado" };
    }
    const appName = input.app_name?.trim() || parsed.hostname;
    return {
      ok: true,
      cfg: {
        resetUrl: parsed.toString(),
        appName,
        brandFooter: `EasySoft · ${appName}`,
        brandColor: input.brand_color || "#3B8EE8",
        source: input.source || `custom/${parsed.hostname}`,
        subject: input.subject || `Redefinição de senha — ${appName}`,
      },
    };
  }

  // 2) Lookup no registry.
  const key = (input.app || DEFAULT_APP_KEY).toLowerCase();
  const base = APP_REGISTRY[key];
  if (!base) {
    return { ok: false, error: `App desconhecido: ${key}` };
  }

  // Permite overrides pontuais (subject, source, cor) mesmo via app registrado.
  return {
    ok: true,
    cfg: {
      ...base,
      subject: input.subject || base.subject,
      source: input.source || base.source,
      brandColor: input.brand_color || base.brandColor,
    },
  };
}
