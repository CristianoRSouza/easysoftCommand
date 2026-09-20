// Edge Function: sso-support
// Generates a short-lived signed token (HMAC-SHA256) carrying the
// authenticated user's email + name so the Support project can
// auto-login the user without sharing a Supabase session.
//
// Auth: validates the caller JWT manually using getClaims (anon client).
// Output: { token, redirect_url }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SHARED_SECRET = Deno.env.get("SSO_SHARED_SECRET") ?? "";
const SUPPORT_BASE_URL = "https://biz-chat-bright.lovable.app";
const SUPPORT_SSO_ENDPOINT = "https://puqybpgzhwaxmhedqhqu.supabase.co/functions/v1/sso";

function base64UrlEncode(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return base64UrlEncode(new Uint8Array(sig));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SHARED_SECRET) {
      return new Response(
        JSON.stringify({ error: "SSO_SHARED_SECRET not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");

    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = (claimsData.claims as any).email as string | undefined;
    const userId = (claimsData.claims as any).sub as string | undefined;
    const userMeta = (claimsData.claims as any).user_metadata ?? {};
    const name = userMeta.full_name || userMeta.name || email?.split("@")[0] || "Usuário";

    if (!email || !userId) {
      return new Response(JSON.stringify({ error: "Token missing email/sub" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      email,
      name,
      source_user_id: userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 120, // 2 minutes
      iss: "easycommandpay",
    };
    const payloadStr = btoa(JSON.stringify(payload))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    const signature = await hmacSign(payloadStr, SHARED_SECRET);
    const ssoToken = `${payloadStr}.${signature}`;

    const redirectUrl = `${SUPPORT_SSO_ENDPOINT}?token=${encodeURIComponent(ssoToken)}`;

    return new Response(
      JSON.stringify({ token: ssoToken, redirect_url: redirectUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sso-support internal error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
