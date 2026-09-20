// Edge function: issue-bootstrap-code (H1)
//
// Gera um "código de primeiro acesso" ASSINADO que a Admin-API local verifica
// OFFLINE (ver EasyFoodManager-API/src/auth/bootstrap-code.ts). O selo é um HMAC
// sobre a chave DERIVADA (HKDF) da SENSITIVE_SECRET_MASTER_KEY_BASE64 — a mesma
// chave-mestra partilhada com Electron / Sync-Service / totens.
//
// IMPORTANTE — compatibilidade byte-a-byte com a Admin-API (provado em
// EasyFoodManager-API/tests/bootstrap-code-webcrypto.test.ts):
//   token   = "EFB1.<base64url(json)>.<base64url(hmacSha256)>"
//   assina  = HMAC-SHA256(key, "EFB1.<base64url(json)>")
//   key     = HKDF-SHA256(ikm=master, salt=vazio, info="easyfood/bootstrap-code/v1", 32B)
//   payload = { v:1, em:<email lower>, sid:<store_id>, exp:<unix s>, jti:<uuid> }
// NÃO altere info/prefixo/ordem sem alterar o verificador do outro lado.
//
// Autorização: só admin da loja (system_admin/tech_admin/company_admin da empresa
// dona da store) — via RPC is_company_admin_for_store.
//
// Secret necessário no Supabase: SENSITIVE_SECRET_MASTER_KEY_BASE64 (o mesmo já
// usado por encrypt-totem-tef-secrets).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MASTER_KEY_B64 = Deno.env.get("SENSITIVE_SECRET_MASTER_KEY_BASE64") ?? "";

const HKDF_INFO = "easyfood/bootstrap-code/v1";
const TOKEN_PREFIX = "EFB1";
const DEFAULT_TTL_HOURS = 48;
const MAX_TTL_HOURS = 72;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(status: number, obj: unknown): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function deriveHmacKey(): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(MASTER_KEY_B64.trim()), (c) => c.charCodeAt(0));
  if (raw.length !== 32) {
    throw new Error("SENSITIVE_SECRET_MASTER_KEY_BASE64 deve ter 32 bytes em base64.");
  }
  const hkdf = await crypto.subtle.importKey("raw", raw, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: new TextEncoder().encode(HKDF_INFO) },
    hkdf,
    256,
  );
  return await crypto.subtle.importKey(
    "raw",
    new Uint8Array(bits),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function signCode(payload: Record<string, unknown>): Promise<string> {
  const key = await deriveHmacKey();
  const encoded = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${TOKEN_PREFIX}.${encoded}`;
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput)));
  return `${signingInput}.${b64url(sig)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { ok: false, error: "Unauthorized" });
    const token = authHeader.replace("Bearer ", "");

    if (!MASTER_KEY_B64) {
      return json(500, {
        ok: false,
        error: "SENSITIVE_SECRET_MASTER_KEY_BASE64 não configurado nos secrets do Supabase.",
      });
    }

    // 1) Identifica o solicitante pela sessão.
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: userData, error: userErr } = await anon.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return json(401, { ok: false, error: "Sessão inválida." });
    }
    const callerId = userData.user.id;

    // 2) Valida entrada.
    const body = (await req.json().catch(() => ({}))) as {
      email?: unknown;
      store_id?: unknown;
      ttl_hours?: unknown;
    };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const storeId = typeof body.store_id === "string" ? body.store_id.trim() : "";
    let ttlHours = Number(body.ttl_hours);
    if (!Number.isFinite(ttlHours) || ttlHours <= 0) ttlHours = DEFAULT_TTL_HOURS;
    ttlHours = Math.min(ttlHours, MAX_TTL_HOURS);

    if (!EMAIL_RE.test(email)) return json(400, { ok: false, error: "Email inválido." });
    if (!UUID_RE.test(storeId)) return json(400, { ok: false, error: "store_id inválido." });

    // 3) Autoriza: só admin da loja (reusa a lógica testada is_company_admin_for_store).
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: allowed, error: authzErr } = await admin.rpc("is_company_admin_for_store", {
      _user_id: callerId,
      _store_id: storeId,
    });
    if (authzErr) {
      console.error("[issue-bootstrap-code] authz rpc error:", authzErr.message);
      return json(500, { ok: false, error: "Falha ao verificar permissão." });
    }
    if (allowed !== true) {
      return json(403, { ok: false, error: "Sem permissão para gerar código nesta loja." });
    }

    // 4) Assina o selo (verificável offline pela Admin-API).
    const nowSec = Math.floor(Date.now() / 1000);
    const exp = nowSec + Math.floor(ttlHours * 3600);
    const jti = crypto.randomUUID();
    const code = await signCode({ v: 1, em: email, sid: storeId, exp, jti });

    console.log("[issue-bootstrap-code] issued", { by: callerId, em: email, sid: storeId, jti, exp });
    return json(200, {
      ok: true,
      code,
      email,
      store_id: storeId,
      expires_at: new Date(exp * 1000).toISOString(),
    });
  } catch (err) {
    console.error("[issue-bootstrap-code] error:", err instanceof Error ? err.message : err);
    return json(500, { ok: false, error: "Falha ao gerar código." });
  }
});
