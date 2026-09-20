import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

function log(...args: unknown[]) {
  console.log("[stripe-webhook]", ...args);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Stripe doesn't send any header indicating live vs sandbox.
  // We try LIVE first, then SANDBOX. Whichever signature verifies wins.
  const liveKey = Deno.env.get("STRIPE_SECRET_KEY_LIVE") || "";
  const liveSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET_LIVE") || "";
  const sandboxKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
  const sandboxSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

  const candidates: Array<{ mode: "live" | "sandbox"; key: string; secret: string }> = [];
  if (liveKey && liveSecret) candidates.push({ mode: "live", key: liveKey, secret: liveSecret });
  if (sandboxKey && sandboxSecret) candidates.push({ mode: "sandbox", key: sandboxKey, secret: sandboxSecret });

  if (candidates.length === 0) {
    log("No Stripe keys configured");
    return new Response(JSON.stringify({ error: "Stripe not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();

  let event: Stripe.Event | null = null;
  let mode: "live" | "sandbox" | null = null;
  let stripe: Stripe | null = null;
  const errors: string[] = [];

  for (const c of candidates) {
    try {
      const s = new Stripe(c.key, { apiVersion: "2025-08-27.basil" });
      const ev = await s.webhooks.constructEventAsync(rawBody, signature, c.secret);
      event = ev;
      mode = c.mode;
      stripe = s;
      break;
    } catch (err) {
      errors.push(`${c.mode}: ${(err as Error).message}`);
    }
  }

  if (!event || !mode || !stripe) {
    log("Signature verification failed for all modes:", errors.join(" | "));
    return new Response(JSON.stringify({ error: `Webhook signature failed: ${errors.join(" | ")}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  log("Received event", event.id, event.type, "mode=", mode);


  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { db: { schema: "billing" } },
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status !== "paid") {
          log("Session not paid yet, skipping:", session.id, session.payment_status);
          break;
        }
        await grantCreditsFromSession(supabase, session, event.id);
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        await grantCreditsFromSession(supabase, session, event.id);
        break;
      }
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        log("Session not completed:", (event.data.object as Stripe.Checkout.Session).id, event.type);
        break;
      }
      case "charge.refunded":
      case "payment_intent.payment_failed": {
        log("Payment issue:", event.id, event.type);
        break;
      }
      default:
        log("Unhandled event type:", event.type);
    }
  } catch (err) {
    log("Handler internal error:", (err as Error).message);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function grantCreditsFromSession(
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session,
  eventId: string,
) {
  const md = session.metadata ?? {};
  const companyId = md.company_id;
  const storeId = md.store_id;
  const totalCredits = Number(md.total_credits ?? "0");
  const packageSlug = md.package_slug ?? "";
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  if (!companyId || !/^[0-9a-f-]{36}$/i.test(companyId)) {
    log("Invalid company_id in session metadata:", session.id);
    return;
  }
  if (!storeId || !/^[0-9a-f-]{36}$/i.test(storeId)) {
    log("Invalid store_id in session metadata:", session.id);
    return;
  }
  if (!Number.isFinite(totalCredits) || totalCredits <= 0) {
    log("Invalid total_credits in session metadata:", session.id, md.total_credits);
    return;
  }

  const description = `Compra de créditos — pacote ${packageSlug || "?"} (Stripe ${session.id})`;

  const { data, error } = await supabase.rpc("grant_credits_from_stripe", {
    p_company_id: companyId,
    p_store_id: storeId,
    p_amount: totalCredits,
    p_description: description,
    p_stripe_session_id: session.id,
    p_stripe_payment_intent_id: paymentIntentId,
    p_stripe_event_id: eventId,
  });

  if (error) {
    log("RPC grant_credits_from_stripe failed:", error.message);
    throw error;
  }

  if (data) {
    log("Granted", totalCredits, "credits to company", companyId, "store", storeId, "tx_id=", data);
  } else {
    log("Idempotent skip — event/session already processed:", session.id);
  }
}
