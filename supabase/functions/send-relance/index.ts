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
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
      },
      body: new URLSearchParams({ To: to, From: fromPhone, Body: body }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.error("Twilio error:", err);
      return { success: false, error: `Twilio ${resp.status}` };
    }
    await resp.json();
    return { success: true };
  } catch (e) {
    console.error("SMS error:", e);
    return { success: false, error: e instanceof Error ? e.message : "Unknown" };
  }
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

interface SendRelanceRequest {
  dossier_id: string;
  type: "info_manquante" | "devis_non_signe";
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { dossier_id, type }: SendRelanceRequest = await req.json();
    if (!dossier_id || !type) throw new Error("Missing dossier_id or type");

    const { data: dossier, error: dossierError } = await supabase
      .from("dossiers")
      .select("*")
      .eq("id", dossier_id)
      .eq("user_id", user.id)
      .single();
    if (dossierError || !dossier) throw new Error("Dossier not found");

    const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();

    const artisanName =
      profile?.company_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Votre artisan";
    const signature = profile?.email_signature || `Cordialement,\n${artisanName}`;
    const smsEnabled = profile?.sms_enabled !== false;

    // Generate or reuse client token
    let clientToken = dossier.client_token;
    const tokenExpiry = dossier.client_token_expires_at ? new Date(dossier.client_token_expires_at) : null;
    if (!clientToken || !tokenExpiry || tokenExpiry < new Date()) {
      const tokenBytes = new Uint8Array(32);
      crypto.getRandomValues(tokenBytes);
      clientToken = Array.from(tokenBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from("dossiers")
        .update({ client_token: clientToken, client_token_expires_at: expiresAt })
        .eq("id", dossier_id);
    }

    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/+$/, "") || "https://bulbiz.fr";
    const clientLink = `${origin}/client?token=${clientToken}`;

    let subject: string;
    let htmlBody: string;
    let smsBody: string;

    const relanceLabel = type === "info_manquante" ? "Info manquante" : "Devis non signé";

    if (type === "info_manquante") {
      subject = `${artisanName} – Informations complémentaires nécessaires`;
      htmlBody = `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p>Bonjour ${dossier.client_first_name || ""},</p>
          <p>Nous avons bien reçu votre demande d'intervention mais il nous manque quelques informations pour pouvoir vous établir un devis.</p>
          <p>Pourriez-vous compléter votre dossier en cliquant sur le lien ci-dessous ?</p>
          <p style="margin: 24px 0;">
            <a href="${clientLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Compléter mon dossier</a>
          </p>
          <p style="font-size: 13px; color: #6b7280;">Vous pourrez ajouter des photos, vidéos et préciser votre demande.</p>
          <p>N'hésitez pas à nous contacter pour toute question.</p>
          ${profile?.email ? `<p style="font-size: 13px; color: #374151;">Email : ${profile.email}</p>` : ""}
          ${profile?.phone ? `<p style="font-size: 13px; color: #374151;">Tél : ${profile.phone}</p>` : ""}
          <br/><p style="white-space: pre-line;">${signature}</p>
        </div>
      `;
      smsBody = `Bonjour ${dossier.client_first_name || ""}, pour traiter votre demande, complétez ces infos (2 min) : ${clientLink} — ${artisanName}${profile?.phone ? ` (${profile.phone})` : ""}`;
    } else {
      subject = `${artisanName} – Suivi de votre devis`;
      htmlBody = `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p>Bonjour ${dossier.client_first_name || ""},</p>
          <p>Nous vous avons récemment envoyé un devis pour votre demande d'intervention.</p>
          <p>Souhaitez-vous que nous en discutions ? Nous restons à votre disposition pour toute question.</p>
          <p>N'hésitez pas à nous contacter pour toute question.</p>
          ${profile?.email ? `<p style="font-size: 13px; color: #374151;">Email : ${profile.email}</p>` : ""}
          ${profile?.phone ? `<p style="font-size: 13px; color: #374151;">Tél : ${profile.phone}</p>` : ""}
          <br/><p style="white-space: pre-line;">${signature}</p>
        </div>
      `;
      smsBody = `Rappel : votre devis est en attente de validation. N'hésitez pas à nous contacter. — ${artisanName}${profile?.phone ? ` (${profile.phone})` : ""}`;
    }

    // Send email
    if (dossier.client_email) {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: `${artisanName} <noreply@bulbiz.fr>`,
        to: [dossier.client_email],
        subject,
        html: htmlBody,
      });

      await supabase.from("historique").insert({
        dossier_id,
        user_id: user.id,
        action: "relance_sent",
        details: `Relance "${relanceLabel}" envoyée par email à ${dossier.client_email}`,
      });
    }

    // Send SMS
    if (dossier.client_phone && isValidPhone(dossier.client_phone) && smsEnabled) {
      const phone = normalizePhone(dossier.client_phone);
      const smsResult = await sendSms(phone, smsBody);
      if (smsResult.success) {
        await supabase.from("historique").insert({
          dossier_id,
          user_id: user.id,
          action: "relance_sent_sms",
          details: `Relance "${relanceLabel}" envoyée par SMS au ${dossier.client_phone}`,
        });
      } else if (smsResult.error !== "SMS provider not configured") {
        await supabase.from("historique").insert({
          dossier_id,
          user_id: user.id,
          action: "sms_error",
          details: `SMS non envoyé (erreur) – vérifier le numéro ${dossier.client_phone}`,
        });
      }
    }

    // Record relance
    await supabase.from("relances").insert({
      dossier_id,
      user_id: user.id,
      type,
      email_to: dossier.client_email || dossier.client_phone || "",
      status: "sent",
    });

    await supabase
      .from("dossiers")
      .update({
        relance_count: (dossier.relance_count || 0) + 1,
        last_relance_at: new Date().toISOString(),
      })
      .eq("id", dossier_id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in send-relance:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
