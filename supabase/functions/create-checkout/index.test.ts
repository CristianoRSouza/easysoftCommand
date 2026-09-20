// Testes de CORS preflight para a edge function `create-checkout`.
//
// Garante que o navegador consiga enviar o header customizado
// `x-stripe-mode` (usado para alternar Stripe live/sandbox por usuário).
// Regressão protegida: já tivemos falha "Failed to send a request to the
// Edge Function" causada pelo preflight bloquear esse header.
import { loadSync } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
loadSync({ export: true, examplePath: null });
import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/create-checkout`;

Deno.test("create-checkout OPTIONS preflight responde com CORS válido", async () => {
  const res = await fetch(FN_URL, {
    method: "OPTIONS",
    headers: {
      "Origin": "https://commandpay-admin.easysoftcloud.com.br",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers":
        "authorization, content-type, x-stripe-mode",
      "apikey": SUPABASE_ANON_KEY,
    },
  });
  // Drena o body para evitar resource leak no Deno
  await res.text();

  assert(
    res.status === 200 || res.status === 204,
    `Esperado 200/204, recebeu ${res.status}`,
  );
  assertEquals(res.headers.get("access-control-allow-origin"), "*");

  const allowHeaders =
    res.headers.get("access-control-allow-headers")?.toLowerCase() ?? "";
  assertStringIncludes(allowHeaders, "x-stripe-mode");
  assertStringIncludes(allowHeaders, "authorization");
  assertStringIncludes(allowHeaders, "content-type");
  assertStringIncludes(allowHeaders, "apikey");
});

Deno.test("create-checkout aceita header x-stripe-mode em POST (sem CORS error)", async () => {
  // Sem auth válida deve retornar 500 ('User not authenticated'), mas
  // o importante aqui é o preflight passar e a resposta trazer CORS headers.
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Origin": "https://commandpay-admin.easysoftcloud.com.br",
      "Content-Type": "application/json",
      "Authorization": "Bearer invalid-token",
      "apikey": SUPABASE_ANON_KEY,
      "x-stripe-mode": "sandbox",
    },
    body: JSON.stringify({ package_slug: "starter", company_id: "x" }),
  });
  await res.text();
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});
