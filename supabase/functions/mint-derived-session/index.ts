// Edge function: mint-derived-session
//
// Emite uma sessão Supabase isolada (token_hash de magiclink) para um app
// derivado consumir via supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }).
//
// Body (opcional): { redirect_to?: string }
// Header obrigatório: Authorization: Bearer <access_token do caller>

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.warn("[mint-derived-session] missing bearer");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let redirectTo: string | undefined;
    if (req.method === "POST") {
      try {
        const body = await req.json().catch(() => null);
        if (body && typeof body.redirect_to === "string") {
          redirectTo = body.redirect_to;
        }
      } catch {
        // ignora body inválido
      }
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user?.email) {
      console.warn("[mint-derived-session] invalid session", userErr?.message);
      return new Response(
        JSON.stringify({ error: "Invalid session", details: userErr?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const email = userData.user.email;
    console.log("[mint-derived-session] minting for", email, "redirect_to=", redirectTo ?? "(none)");

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: redirectTo ? { redirectTo } : undefined,
    });

    const hashed = linkData?.properties?.hashed_token;
    if (linkErr || !hashed) {
      console.error("[mint-derived-session] generateLink failed", linkErr?.message);
      return new Response(
        JSON.stringify({ error: "Failed to mint session", details: linkErr?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[mint-derived-session] ok for", email);
    return new Response(
      JSON.stringify({
        email,
        token_hash: hashed,
        type: "magiclink",
        expires_in: 3600,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("[mint-derived-session] unexpected", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
