// Edge function: cifra segredos TEF Aditum (partner_token / ativation_code)
// usando o mesmo envelope `enc:v1:<iv_b64>:<tag_b64>:<data_b64>` (AES-256-GCM, IV 12B)
// que o backend Electron — ver electron/main.cjs encryptSensitiveLocalAesGcmV1.
//
// Necessário para Cloud Mode (browser puro), onde não há Electron para cifrar localmente.
// O segredo `SENSITIVE_SECRET_MASTER_KEY_BASE64` DEVE ser o mesmo valor configurado nos
// totens (.env) — caso contrário o runtime Aditum não consegue decifrar.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const MASTER_KEY_B64 = Deno.env.get("SENSITIVE_SECRET_MASTER_KEY_BASE64") ?? "";
const KID = (Deno.env.get("SENSITIVE_SECRET_KEY_ID") ?? "kid-sensitive-local-aes-sync").trim();

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

async function importKey(): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(MASTER_KEY_B64.trim()), (c) => c.charCodeAt(0));
  if (raw.length !== 32) {
    throw new Error("SENSITIVE_SECRET_MASTER_KEY_BASE64 deve ter 32 bytes em base64 (AES-256-GCM).");
  }
  return await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt"]);
}

async function encryptEnvelopeV1(plain: string): Promise<string> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plain);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, enc),
  );
  // Web Crypto retorna ciphertext || tag(16). Separar para casar com o Node (`enc:v1:iv:tag:data`).
  const tag = ct.slice(ct.length - 16);
  const data = ct.slice(0, ct.length - 16);
  return `enc:v1:${b64encode(iv)}:${b64encode(tag)}:${b64encode(data)}`;
}

interface ReqBody {
  partner_token?: string | null;
  ativation_code?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: requer sessão válida (qualquer usuário autenticado pode cifrar
    // — a UI já controla quem acede à página de totens via RLS na tabela).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!MASTER_KEY_B64) {
      return new Response(
        JSON.stringify({ ok: false, error: "SENSITIVE_SECRET_MASTER_KEY_BASE64 não configurado nos secrets do Supabase." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json().catch(() => ({}))) as ReqBody;
    const partner = body.partner_token;
    const ativation = body.ativation_code;

    // Validação: tokens devem ter tamanho razoável (até 4KB, sem caracteres de controle nulos).
    const MAX_LEN = 4096;
    const isValid = (v: unknown) =>
      v == null || (typeof v === "string" && v.length <= MAX_LEN && !v.includes("\0"));
    if (!isValid(partner) || !isValid(ativation)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Tokens inválidos (max 4096 chars, sem null bytes)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result: Record<string, string | null> = {
      partner_token_encrypted: null,
      partner_token_kid: null,
      ativation_code_encrypted: null,
      ativation_code_kid: null,
    };

    if (typeof partner === "string" && partner.trim() !== "") {
      result.partner_token_encrypted = await encryptEnvelopeV1(partner);
      result.partner_token_kid = KID;
    }
    if (typeof ativation === "string" && ativation.trim() !== "") {
      result.ativation_code_encrypted = await encryptEnvelopeV1(ativation);
      result.ativation_code_kid = KID;
    }

    return new Response(JSON.stringify({ ok: true, kid: KID, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[encrypt-totem-tef-secrets] error:", err);
    return new Response(JSON.stringify({ ok: false, error: "Encryption failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
