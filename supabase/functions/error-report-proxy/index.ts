/**
 * Proxy edge function — recebe o relatório de erro do frontend e
 * encaminha para a edge function `error-report` do EasyGuardian,
 * injetando o secret no header `x-report-secret`.
 *
 * O frontend nunca vê o secret. Requer Authorization Bearer (Supabase JWT)
 * para impedir spam anônimo do endpoint.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EASYGUARDIAN_URL =
  "https://ohjyqafgcxvrvbtiuvpq.supabase.co/functions/v1/error-report";

const REPORT_SECRET = Deno.env.get("ERROR_REPORT_SECRET") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Require an authenticated Supabase user — blocks anonymous spam.
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const token = auth.replace("Bearer ", "");
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("error-report-proxy auth error:", err);
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.text();

    // Forward to EasyGuardian
    const upstream = await fetch(EASYGUARDIAN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-report-secret": REPORT_SECRET,
      },
      body,
    });

    const data = await upstream.text();
    return new Response(data, {
      status: upstream.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("error-report-proxy internal error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
