// Wrapper modular: gera link de recovery do Supabase Auth e dispara o email
// via plataforma EasyMail (`send-easymail`).
//
// Reutilizável por vários módulos/apps que compartilham o mesmo Supabase.
// A resolução de domínio + branding por app é centralizada em
// `./app-registry.ts` — esta função apenas orquestra geração de token,
// montagem do template e envio.
//
// Frontend chama:
//   supabase.functions.invoke('send-recovery-email', {
//     body: { email, app: 'manager' }
//   })
//
// Ou, para apps customizados / domínios novos (validado contra allowlist):
//   supabase.functions.invoke('send-recovery-email', {
//     body: { email, redirect_to: 'https://outro.easysoftcloud.com.br/reset-password',
//             app_name: 'Outro App', source: 'outro-app/reset' }
//   })

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type AppConfig, resolveAppConfig } from "./app-registry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface RecoveryPayload {
  email?: string;
  app?: string;
  redirect_to?: string;
  app_name?: string;
  subject?: string;
  source?: string;
  brand_color?: string;
}

function buildDirectRecoveryLink(resetUrl: string, tokenHash: string) {
  const url = new URL(resetUrl);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", "recovery");
  return url.toString();
}

function buildRecoveryHtml(
  actionLink: string,
  recipientEmail: string,
  cfg: AppConfig,
) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#0f172a;font-family:'Manrope',Arial,sans-serif;color:#e2e8f0;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f172a;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#111c34;border:1px solid #1e293b;border-radius:12px;padding:32px;">
            <tr><td style="font-family:'Sora',Arial,sans-serif;font-size:22px;font-weight:700;color:#ffffff;padding-bottom:12px;">
              Redefinição de senha
            </td></tr>
            <tr><td style="font-size:14px;line-height:22px;color:#cbd5e1;padding-bottom:20px;">
              Olá,<br/><br/>
              Recebemos um pedido para redefinir a senha da conta <strong style="color:#ffffff;">${recipientEmail}</strong>
              no <strong style="color:#ffffff;">${cfg.appName}</strong>.<br/><br/>
              Clique no botão abaixo para criar uma nova senha. Este link expira em 1 hora.
            </td></tr>
            <tr><td align="center" style="padding:8px 0 24px 0;">
              <a href="${actionLink}" style="display:inline-block;background:${cfg.brandColor};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;">
                Redefinir senha
              </a>
            </td></tr>
            <tr><td style="font-size:12px;line-height:18px;color:#94a3b8;padding-bottom:8px;">
              Se o botão não funcionar, copie e cole este endereço no navegador:<br/>
              <span style="color:#cbd5e1;word-break:break-all;">${actionLink}</span>
            </td></tr>
            <tr><td style="font-size:12px;line-height:18px;color:#64748b;border-top:1px solid #1e293b;padding-top:16px;margin-top:16px;">
              Se você não solicitou esta alteração, pode ignorar este email — a senha permanece a mesma.
            </td></tr>
          </table>
          <div style="font-size:11px;color:#475569;margin-top:16px;">${cfg.brandFooter}</div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ error: "Servidor mal configurado" }, 500);
  }

  let payload: RecoveryPayload;
  try {
    payload = (await req.json()) as RecoveryPayload;
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const email = (payload.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Email inválido" }, 400);
  }

  const resolved = resolveAppConfig(payload);
  if (!resolved.ok) {
    return json({ error: resolved.error }, 400);
  }
  const cfg = resolved.cfg;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  // Privacidade: sempre 200, não revelamos se o email existe.
  if (linkError || !linkData?.properties?.hashed_token) {
    console.warn("[send-recovery-email] generateLink falhou:", linkError?.message);
    return json({ ok: true });
  }

  // NÃO usamos `action_link` / `/auth/v1/verify` — dependem de Site URL e
  // podem cair no preview do Lovable. Link aponta direto para o domínio do app.
  const hashedToken = linkData.properties.hashed_token;
  const actionLink = buildDirectRecoveryLink(cfg.resetUrl, hashedToken);

  const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/send-easymail`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      to_email: email,
      subject: cfg.subject,
      body_html: buildRecoveryHtml(actionLink, email, cfg),
      body_text:
        `Recebemos um pedido para redefinir a senha da conta ${email} no ${cfg.appName}.\n\n` +
        `Acesse o link abaixo para criar uma nova senha (expira em 1 hora):\n${actionLink}\n\n` +
        `Se você não solicitou esta alteração, ignore este email.`,
      priority: 2,
      source: cfg.source,
    }),
  });

  if (!sendRes.ok) {
    const text = await sendRes.text();
    console.error("[send-recovery-email] send-easymail falhou:", sendRes.status, text);
    return json({ ok: false, error: "Falha no envio do email" }, 502);
  }

  await sendRes.text();
  return json({ ok: true, app: cfg.appName });
});
