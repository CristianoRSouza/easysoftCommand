import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-stripe-mode, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Mapeamento pacote → Stripe Price ID (conta Stripe EasySoft Sistemas — acct_1TEaAw7reuNtWCTO)
// LIVE: prices reais validados em 2026-04-30. SANDBOX ainda sem prices cadastrados.
const PACKAGE_PRICE_MAP_LIVE: Record<string, string> = {
  starter: "price_1TQooC7reuNtWCTOpWE3iRJa",     // R$ 9,90  — Starter 50 créditos
  basico: "price_1TQooA7reuNtWCTO6VeOdG7J",      // R$ 29,90 — Básico 165 créditos
  pro: "price_1TQooA7reuNtWCTOKevhBpiZ",         // R$ 79,90 — Pro 540 créditos
  enterprise: "price_1TQoo87reuNtWCTOxqYE8d84",  // R$ 199,90 — Enterprise 1560 créditos
};
const PACKAGE_PRICE_MAP_SANDBOX: Record<string, string> = {
  starter: "price_1TRw9j7reuNtWCTO880qW3O9",     // R$ 9,90
  basico: "price_1TRw9k7reuNtWCTOIC9Jqtli",      // R$ 29,90
  pro: "price_1TRw9l7reuNtWCTOsBjft2FE",         // R$ 79,90
  enterprise: "price_1TRw9l7reuNtWCTOnXc7bSiw",  // R$ 199,90
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const body = await req.json();
    const { package_slug, company_id, store_id } = body;

    if (!package_slug || !company_id || !store_id) {
      throw new Error("Missing required fields: package_slug, company_id, store_id");
    }
    if (typeof package_slug !== "string" || (!PACKAGE_PRICE_MAP_LIVE[package_slug] && !PACKAGE_PRICE_MAP_SANDBOX[package_slug])) {
      throw new Error(`Unknown package slug: ${package_slug}`);
    }
    if (typeof company_id !== "string" || !/^[0-9a-f-]{36}$/i.test(company_id)) {
      throw new Error("Invalid company_id");
    }
    if (typeof store_id !== "string" || !/^[0-9a-f-]{36}$/i.test(store_id)) {
      throw new Error("Invalid store_id");
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceRoleKey);

    // system_admin bypassa o gate por empresa (gerencia todas).
    const { data: roleRow, error: roleErr } = await adminClient
      .from("pv_user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "system_admin")
      .maybeSingle();
    if (roleErr) console.error("[create-checkout] role lookup error:", roleErr);
    const isSystemAdmin = !!roleRow;
    console.log(`[create-checkout] user=${user.id} isSystemAdmin=${isSystemAdmin} company_id=${company_id}`);

    if (!isSystemAdmin) {
      const { data: access } = await adminClient
        .from("pb_user_company_access")
        .select("company_id")
        .eq("user_id", user.id)
        .eq("company_id", company_id)
        .eq("status", "approved")
        .maybeSingle();
      if (!access) {
        throw new Error("Access denied to this company");
      }
    }

    const billingClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceRoleKey, {
      db: { schema: "billing" },
    });
    const { data: pkg, error: pkgErr } = await billingClient
      .from("credit_packages")
      .select("id, total_credits")
      .eq("slug", package_slug)
      .eq("is_active", true)
      .maybeSingle();
    if (pkgErr) {
      console.error("[create-checkout] billing.credit_packages query error:", pkgErr);
    }
    if (!pkg) {
      throw new Error(
        `Package not found: ${package_slug}` +
          (pkgErr ? ` (db: ${pkgErr.message})` : ""),
      );
    }
    const total_credits = Number(pkg.total_credits);
    const package_id = pkg.id;

    const { data: modeRow } = await billingClient
      .from("user_stripe_mode")
      .select("mode")
      .eq("user_id", user.id)
      .maybeSingle();
    const stripeMode = modeRow?.mode === "sandbox" ? "sandbox" : "live";
    const priceMap = stripeMode === "live" ? PACKAGE_PRICE_MAP_LIVE : PACKAGE_PRICE_MAP_SANDBOX;
    const priceId = priceMap[package_slug];
    if (!priceId) {
      throw new Error(
        `Stripe price not configured for package "${package_slug}" in mode=${stripeMode}. ` +
        `Cadastre o price no Stripe ${stripeMode} e atualize PACKAGE_PRICE_MAP_${stripeMode.toUpperCase()}.`,
      );
    }
    const stripeKey = (stripeMode === "live"
      ? Deno.env.get("STRIPE_SECRET_KEY_LIVE")
      : Deno.env.get("STRIPE_SECRET_KEY")) || "";
    if (!stripeKey) throw new Error(`Stripe key not configured for mode=${stripeMode}`);
    console.log(`[create-checkout] user=${user.id} stripe_mode=${stripeMode} price=${priceId}`);
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const ALLOWED_ORIGINS = new Set([
      "https://commandpay-admin.easysoftcloud.com.br",
      "https://easy-command-flow.lovable.app",
    ]);
    const requestOrigin = req.headers.get("origin") ?? "";
    const origin = ALLOWED_ORIGINS.has(requestOrigin)
      ? requestOrigin
      : "https://commandpay-admin.easysoftcloud.com.br";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      metadata: {
        company_id,
        store_id,
        package_id: package_id || "",
        package_slug,
        total_credits: String(total_credits),
        user_id: user.id,
      },
      payment_intent_data: {
        metadata: {
          company_id,
          store_id,
          package_id: package_id || "",
          package_slug,
          total_credits: String(total_credits),
          user_id: user.id,
        },
      },
      success_url: `${origin}/ai-credits?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/ai-credits?payment=canceled`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("create-checkout internal error:", error);
    const msg = (error as Error).message ?? "";
    // Whitelist of safe, user-actionable messages — everything else collapses to a generic 500.
    const SAFE = [
      "User not authenticated",
      "Access denied to this company",
      "Missing required fields: package_slug, company_id, store_id",
      "Invalid company_id",
      "Invalid store_id",
    ];
    const safeMessage =
      SAFE.includes(msg) || msg.startsWith("Unknown package slug:")
        ? msg
        : "Internal server error";
    const status = safeMessage === msg && msg !== "Internal server error" ? 400 : 500;
    return new Response(JSON.stringify({ error: safeMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
