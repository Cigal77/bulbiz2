/**
 * Edge Function : create-checkout-session
 *
 * Crée une Stripe Checkout Session pour l'abonnement Pro.
 * Le frontend redirige l'utilisateur vers l'URL Stripe retournée.
 *
 * Variables d'environnement requises (Supabase secrets) :
 *   STRIPE_SECRET_KEY        — clé secrète Stripe (sk_live_... ou sk_test_...)
 *   STRIPE_PRICE_ID_PRO      — ID du prix mensuel Pro dans Stripe
 *   SITE_URL                 — URL de base du frontend (ex: https://app.bulbiz.fr)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Récupérer l'utilisateur authentifié
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Récupérer le profil (stripe_customer_id éventuel)
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, email, first_name, last_name, company_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-06-20",
    });

    const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:8080";

    // 3. Créer ou réutiliser le Stripe Customer
    let stripeCustomerId = profile?.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || undefined,
        metadata: {
          supabase_user_id: user.id,
          company: profile?.company_name ?? "",
        },
      });
      stripeCustomerId = customer.id;

      // Sauvegarder l'ID Stripe en base
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await adminClient
        .from("profiles")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("user_id", user.id);
    }

    // 4. Créer la Checkout Session
    const body = await req.json().catch(() => ({}));
    const { referral_code } = body; // code de parrainage éventuel (promo)

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [
        {
          price: Deno.env.get("STRIPE_PRICE_ID_PRO")!,
          quantity: 1,
        },
      ],
      // Période d'essai 14 jours (peut aussi être configuré côté Stripe)
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          supabase_user_id: user.id,
        },
      },
      success_url: `${siteUrl}/settings?payment=success`,
      cancel_url: `${siteUrl}/pricing?payment=canceled`,
      allow_promotion_codes: true, // Active les codes promo Stripe
      metadata: {
        supabase_user_id: user.id,
        referral_code: referral_code ?? "",
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-checkout-session error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
