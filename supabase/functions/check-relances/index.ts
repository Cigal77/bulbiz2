import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sendSms(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromPhone = Deno.env.get("TWILIO_PHONE_NUMBER");
  if (!accountSid || !authToken || !fromPhone) {
    console.log(`[SMS placeholder] To: ${to} | Body: ${body}`);
    return { success: false, error: "SMS provider not configured" };
  }
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + btoa(`${accountSid}:${authToken}`) },
      body: new URLSearchParams({ To: to, From: fromPhone, Body: body }),
    });
    if (!resp.ok) { const err = await resp.text(); console.error("Twilio error:", err); return { success: false, error: `Twilio ${resp.status}` }; }
    await resp.json();
    return { success: true };
  } catch (e) { console.error("SMS error:", e); return { success: false, error: e instanceof Error ? e.message : "Unknown" }; }
}

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-().]/g, "");
  if (cleaned.startsWith("0") && cleaned.length === 10) cleaned = "+33" + cleaned.slice(1);
  if (!cleaned.startsWith("+")) cleaned = "+" + cleaned;
  return cleaned;
}

function isValidPhone(phone: string): boolean {
  return /^\+?\d{10,15}$/.test(phone.replace(/[\s\-().]/g, ""));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendKey);
    const now = new Date();
    let totalSent = 0;

    // ── 1. Info manquante ──
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: infoMDossiers } = await supabase
      .from("dossiers").select("*")
      .eq("status", "a_qualifier").eq("relance_active", true).eq("relance_count", 0)
      .not("client_email", "is", null).lt("created_at", oneDayAgo);

    if (infoMDossiers && infoMDossiers.length > 0) {
      for (const dossier of infoMDossiers) {
        const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", dossier.user_id).single();
        if (!profile?.auto_relance_enabled) continue;

        const artisanName = profile?.company_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Votre artisan";
        const signature = profile?.email_signature || `Cordialement,\n${artisanName}`;
        const smsEnabled = profile?.sms_enabled !== false;

        let clientToken = dossier.client_token;
        const tokenExpiry = dossier.client_token_expires_at ? new Date(dossier.client_token_expires_at) : null;
        if (!clientToken || !tokenExpiry || tokenExpiry < now) {
          const tokenBytes = new Uint8Array(32);
          crypto.getRandomValues(tokenBytes);
          clientToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");
          const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
          await supabase.from("dossiers").update({ client_token: clientToken, client_token_expires_at: expiresAt }).eq("id", dossier.id);
        }
        const siteUrl = Deno.env.get("SITE_URL") || "https://bulbiz.fr";
        const clientLink = `${siteUrl}/client?token=${clientToken}`;

        try {
          // Email
          await resend.emails.send({
            from: `${artisanName} <onboarding@resend.dev>`,
            to: [dossier.client_email!],
            subject: `${artisanName} – Informations complémentaires nécessaires`,
            html: `<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <p>Bonjour ${dossier.client_first_name || ""},</p>
              <p>Nous avons bien reçu votre demande mais il nous manque quelques informations pour établir un devis.</p>
              <p style="margin: 24px 0;"><a href="${clientLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Compléter mon dossier</a></p>
              <p style="font-size: 13px; color: #6b7280;">Vous pourrez ajouter des photos, vidéos et préciser votre demande.</p>
              <br/><p style="white-space: pre-line;">${signature}</p>
            </div>`,
          });

          await supabase.from("historique").insert({
            dossier_id: dossier.id, user_id: dossier.user_id,
            action: "relance_sent",
            details: `Relance auto "Info manquante" envoyée par email à ${dossier.client_email}`,
          });

          // SMS
          if (dossier.client_phone && isValidPhone(dossier.client_phone) && smsEnabled) {
            const phone = normalizePhone(dossier.client_phone);
            const smsBody = `Bonjour ${dossier.client_first_name || ""}, pour traiter votre demande, complétez ces infos : ${clientLink} — ${artisanName}`;
            const smsResult = await sendSms(phone, smsBody);
            if (smsResult.success) {
              await supabase.from("historique").insert({
                dossier_id: dossier.id, user_id: dossier.user_id,
                action: "relance_sent_sms",
                details: `Relance auto "Info manquante" envoyée par SMS au ${dossier.client_phone}`,
              });
            }
          }

          await supabase.from("relances").insert({ dossier_id: dossier.id, user_id: dossier.user_id, type: "info_manquante", email_to: dossier.client_email!, status: "sent" });
          await supabase.from("dossiers").update({ relance_count: 1, last_relance_at: now.toISOString() }).eq("id", dossier.id);
          totalSent++;
        } catch (e) {
          console.error(`Failed to send relance for dossier ${dossier.id}:`, e);
        }
      }
    }

    // ── 2. Devis non signé ──
    const { data: devisDossiers } = await supabase
      .from("dossiers").select("*")
      .eq("status", "devis_envoye").eq("relance_active", true).lt("relance_count", 2)
      .not("client_email", "is", null);

    if (devisDossiers && devisDossiers.length > 0) {
      for (const dossier of devisDossiers) {
        const statusChanged = new Date(dossier.status_changed_at);
        const daysSinceStatus = (now.getTime() - statusChanged.getTime()) / (24 * 60 * 60 * 1000);

        const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", dossier.user_id).single();
        if (!profile?.auto_relance_enabled) continue;

        const delay1 = profile?.relance_delay_devis_1 ?? 2;
        const delay2 = profile?.relance_delay_devis_2 ?? 5;
        const shouldSend = (dossier.relance_count === 0 && daysSinceStatus >= delay1) || (dossier.relance_count === 1 && daysSinceStatus >= delay2);
        if (!shouldSend) continue;

        if (dossier.last_relance_at) {
          const hoursSince = (now.getTime() - new Date(dossier.last_relance_at).getTime()) / (60 * 60 * 1000);
          if (hoursSince < 20) continue;
        }

        const artisanName = profile?.company_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Votre artisan";
        const signature = profile?.email_signature || `Cordialement,\n${artisanName}`;
        const smsEnabled = profile?.sms_enabled !== false;

        try {
          // Email
          await resend.emails.send({
            from: `${artisanName} <onboarding@resend.dev>`,
            to: [dossier.client_email!],
            subject: `${artisanName} – Suivi de votre devis`,
            html: `<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <p>Bonjour ${dossier.client_first_name},</p>
              <p>Nous vous avons récemment envoyé un devis. Souhaitez-vous que nous en discutions ?</p>
              <p>Nous restons à votre disposition pour toute question.</p>
              <br/><p style="white-space: pre-line;">${signature}</p>
            </div>`,
          });

          await supabase.from("historique").insert({
            dossier_id: dossier.id, user_id: dossier.user_id,
            action: "relance_sent",
            details: `Relance auto "Devis non signé" (${dossier.relance_count + 1}/2) envoyée par email à ${dossier.client_email}`,
          });

          // SMS
          if (dossier.client_phone && isValidPhone(dossier.client_phone) && smsEnabled) {
            const phone = normalizePhone(dossier.client_phone);
            const smsBody = `Rappel : votre devis est en attente de validation. N'hésitez pas à nous contacter. — ${artisanName}`;
            const smsResult = await sendSms(phone, smsBody);
            if (smsResult.success) {
              await supabase.from("historique").insert({
                dossier_id: dossier.id, user_id: dossier.user_id,
                action: "relance_sent_sms",
                details: `Relance auto "Devis non signé" (${dossier.relance_count + 1}/2) envoyée par SMS au ${dossier.client_phone}`,
              });
            }
          }

          await supabase.from("relances").insert({ dossier_id: dossier.id, user_id: dossier.user_id, type: "devis_non_signe", email_to: dossier.client_email!, status: "sent" });
          await supabase.from("dossiers").update({ relance_count: dossier.relance_count + 1, last_relance_at: now.toISOString() }).eq("id", dossier.id);
          totalSent++;
        } catch (e) {
          console.error(`Failed to send devis relance for dossier ${dossier.id}:`, e);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, relances_sent: totalSent }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in check-relances:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
