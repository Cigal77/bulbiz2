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
    console.error("SMS send error:", e);
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

    const { quote_id } = await req.json();
    if (!quote_id) throw new Error("Missing quote_id");

    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quote_id)
      .eq("user_id", user.id)
      .single();
    if (qErr || !quote) throw new Error("Devis introuvable");

    const { data: dossier, error: dErr } = await supabase
      .from("dossiers")
      .select("*")
      .eq("id", quote.dossier_id)
      .eq("user_id", user.id)
      .single();
    if (dErr || !dossier) throw new Error("Dossier introuvable");

    const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();

    const artisanName =
      profile?.company_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Votre artisan";
    const signature = profile?.email_signature || `Cordialement,\n${artisanName}`;
    const smsEnabled = profile?.sms_enabled !== false;

    // Generate signature token
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const signatureToken = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/+$/, "") || "https://bulbiz.fr";
    const validationUrl = `${origin}/devis/validation?token=${signatureToken}`;

    // Send email
    if (dossier.client_email) {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: `${artisanName} <noreply@bulbiz.fr>`,
        to: [dossier.client_email],
        subject: `${artisanName} – Votre devis`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <p>Bonjour ${dossier.client_first_name || ""},</p>
            <p>Veuillez trouver ci-joint votre devis.</p>
            <p style="margin: 24px 0;">
              <a href="${validationUrl}" style="background-color: #16a34a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                ✅ Voir et valider le devis
              </a>
            </p>
            <p style="font-size: 13px; color: #6b7280;">Ce lien est valable 30 jours.</p>
            <p>N'hésitez pas à nous contacter pour toute question.</p>
            ${profile?.email ? `<p style="font-size: 13px; color: #374151;">Email : ${profile.email}</p>` : ""}
            ${profile?.phone ? `<p style="font-size: 13px; color: #374151;">Tél : ${profile.phone}</p>` : ""}
            <br/>
            <p style="white-space: pre-line;">${signature}</p>
          </div>
        `,
      });

      await supabase.from("historique").insert({
        dossier_id: dossier.id,
        user_id: user.id,
        action: "quote_sent",
        details: `Devis ${quote.quote_number} envoyé par email à ${dossier.client_email}`,
      });
    }

    // Send SMS
    if (dossier.client_phone && isValidPhone(dossier.client_phone) && smsEnabled) {
      const phone = normalizePhone(dossier.client_phone);
      const smsBody = `Votre devis est disponible. Pour le consulter : ${validationUrl} — ${artisanName}`;
      const smsResult = await sendSms(phone, smsBody);
      if (smsResult.success) {
        await supabase.from("historique").insert({
          dossier_id: dossier.id,
          user_id: user.id,
          action: "quote_sent_sms",
          details: `Devis ${quote.quote_number} envoyé par SMS au ${dossier.client_phone}`,
        });
      } else if (smsResult.error !== "SMS provider not configured") {
        await supabase.from("historique").insert({
          dossier_id: dossier.id,
          user_id: user.id,
          action: "sms_error",
          details: `SMS non envoyé (erreur) – vérifier le numéro ${dossier.client_phone}`,
        });
      }
    }

    // Update quote status
    await supabase
      .from("quotes")
      .update({
        status: "envoye",
        sent_at: new Date().toISOString(),
        signature_token: signatureToken,
        signature_token_expires_at: expiresAt,
      })
      .eq("id", quote_id);

    await supabase
      .from("dossiers")
      .update({
        status: "devis_envoye",
        status_changed_at: new Date().toISOString(),
      })
      .eq("id", dossier.id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in send-quote:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
