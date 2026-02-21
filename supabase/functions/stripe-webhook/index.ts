/**
 * Edge Function : stripe-webhook
 *
 * Reçoit les événements Stripe et met à jour la base de données.
 * À enregistrer dans Stripe Dashboard → Webhooks → Endpoint URL :
 *   https://<project>.supabase.co/functions/v1/stripe-webhook
 *
 * Événements à activer dans Stripe :
 *   - customer.subscription.created
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *   - invoice.payment_succeeded
 *   - invoice.payment_failed
 *
 * Variables d'environnement :
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET   — fourni par Stripe lors de la création du webhook
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

const adminClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  // Vérification de la signature Stripe
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig!,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(`Webhook Error: ${err}`, { status: 400 });
  }

  console.log(`Stripe event received: ${event.type}`);

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(sub);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(sub);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      case "invoice.payment_succeeded": {
        // Optionnel : envoyer un email de confirmation de paiement
        console.log("Payment succeeded for invoice:", (event.data.object as Stripe.Invoice).id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("Error processing webhook:", err);
    return new Response(`Processing error: ${err}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

async function handleSubscriptionChange(sub: Stripe.Subscription) {
  const userId = sub.metadata?.supabase_user_id;
  if (!userId) {
    console.warn("No supabase_user_id in subscription metadata", sub.id);
    return;
  }

  const plan = mapStripePlanToBulbiz(sub);
  const status = sub.status as string;

  // Mettre à jour subscriptions (upsert)
  await adminClient.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: sub.id,
      stripe_customer_id: sub.customer as string,
      plan,
      status,
      current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      cancel_at_period_end: sub.cancel_at_period_end,
      canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" }
  );

  // Mettre à jour le profil
  await adminClient
    .from("profiles")
    .update({
      subscription_plan: plan,
      subscription_status: status,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      trial_ends_at: sub.trial_end
        ? new Date(sub.trial_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  // Affiliation : si c'est la première activation, récompenser le parrain
  if (status === "active" || status === "trialing") {
    await rewardReferrer(userId);
  }
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const userId = sub.metadata?.supabase_user_id;
  if (!userId) return;

  await adminClient
    .from("profiles")
    .update({
      subscription_plan: "free",
      subscription_status: "canceled",
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  await adminClient
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;
  const { data: sub } = await adminClient
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", invoice.subscription)
    .maybeSingle();

  if (sub?.user_id) {
    await adminClient
      .from("profiles")
      .update({ subscription_status: "past_due", updated_at: new Date().toISOString() })
      .eq("user_id", sub.user_id);
  }
}

/**
 * Récompense le parrain quand son filleul passe actif.
 * Règle par défaut : +1 mois offert au parrain.
 */
async function rewardReferrer(newUserId: string) {
  // Trouver le referral non encore récompensé
  const { data: referral } = await adminClient
    .from("referrals")
    .select("id, referrer_id")
    .eq("referred_id", newUserId)
    .eq("status", "converted")
    .maybeSingle();

  if (!referral) return;

  // Incrémenter les crédits du parrain
  const { data: referrerProfile } = await adminClient
    .from("profiles")
    .select("referral_credits_months")
    .eq("user_id", referral.referrer_id)
    .maybeSingle();

  const currentCredits = referrerProfile?.referral_credits_months ?? 0;

  await adminClient
    .from("profiles")
    .update({ referral_credits_months: currentCredits + 1 })
    .eq("user_id", referral.referrer_id);

  // Marquer le referral comme récompensé
  await adminClient
    .from("referrals")
    .update({ status: "rewarded", reward_given_at: new Date().toISOString() })
    .eq("id", referral.id);

  console.log(`Referrer ${referral.referrer_id} rewarded with 1 month credit`);
}

function mapStripePlanToBulbiz(sub: Stripe.Subscription): "free" | "pro" | "enterprise" {
  // Adapte selon tes Price IDs Stripe
  const priceId = sub.items.data[0]?.price?.id ?? "";
  if (priceId === Deno.env.get("STRIPE_PRICE_ID_ENTERPRISE")) return "enterprise";
  if (priceId === Deno.env.get("STRIPE_PRICE_ID_PRO")) return "pro";
  return "free";
}
