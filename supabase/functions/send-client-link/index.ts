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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    // Verify user
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { dossier_id, force_regenerate } = await req.json();
    if (!dossier_id) throw new Error("Missing dossier_id");

    // Get dossier
    const { data: dossier, error: dErr } = await supabase
      .from("dossiers")
      .select("*")
      .eq("id", dossier_id)
      .eq("user_id", user.id)
      .single();
    if (dErr || !dossier) throw new Error("Dossier introuvable");

    // Get profile
    const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();

    const validityDays = profile?.client_link_validity_days || 7;

    // Check for existing active token (anti-duplicate)
    let token = dossier.client_token;
    let expiresAt = dossier.client_token_expires_at;
    let tokenGenerated = false;

    const isExpired = !expiresAt || new Date(expiresAt) < new Date();

    if (!token || isExpired || force_regenerate) {
      // Generate new token
      const tokenBytes = new Uint8Array(32);
      crypto.getRandomValues(tokenBytes);
      token = Array.from(tokenBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString();

      await supabase
        .from("dossiers")
        .update({ client_token: token, client_token_expires_at: expiresAt })
        .eq("id", dossier_id);

      tokenGenerated = true;

      // Historique
      await supabase.from("historique").insert({
        dossier_id,
        user_id: user.id,
        action: "client_link_generated",
        details: `Lien client généré (expire le ${new Date(expiresAt).toLocaleDateString("fr-FR")})`,
      });
    }

    // Build client link
    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer")?.replace(/\/+$/, "") ||
      Deno.env.get("PUBLIC_URL") ||
      "https://bulbiz.fr";
    const clientLink = `${origin}/client?token=${token}`;

    // Try to send email
    let emailSent = false;
    let emailError: string | null = null;

    if (dossier.client_email) {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        try {
          const resend = new Resend(resendKey);
          const artisanName =
            profile?.company_name ||
            [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
            "Votre artisan";
          const signature = profile?.email_signature || `Cordialement,\n${artisanName}`;

          await resend.emails.send({
            from: "noreply@bulbiz.fr",
            to: [dossier.client_email],
            subject: `${artisanName} – Complétez votre demande d'intervention`,
            html: `
              <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <p>Bonjour ${dossier.client_first_name || ""},</p>
                <p>Merci pour votre demande. Pour préparer au mieux notre intervention, nous avons besoin de quelques informations complémentaires.</p>
                <p style="margin: 24px 0;">
                  <a href="${clientLink}" style="background-color: #2563eb; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                    📝 Compléter ma demande
                  </a>
                </p>
                <p style="font-size: 13px; color: #6b7280;">Ce lien est valable ${validityDays} jours.</p>
                <p>N'hésitez pas à nous contacter pour toute question.</p>
                ${profile?.email ? `<p style="font-size: 13px; color: #374151;">Email : ${profile.email}</p>` : ""}
                ${profile?.phone ? `<p style="font-size: 13px; color: #374151;">Tél : ${profile.phone}</p>` : ""}
                <br/>
                <p style="white-space: pre-line;">${signature}</p>
              </div>
            `,
          });
          emailSent = true;

          await supabase.from("historique").insert({
            dossier_id,
            user_id: user.id,
            action: "client_link_sent_email",
            details: `Lien client envoyé par email à ${dossier.client_email}`,
          });
        } catch (err: any) {
          emailError = err.message;
          console.error("Email send error:", err);
        }
      }
    }

    // Send SMS
    let smsSent = false;
    if (dossier.client_phone && isValidPhone(dossier.client_phone)) {
      const artisanName =
        profile?.company_name ||
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
        "Votre artisan";
      const smsEnabled = profile?.sms_enabled !== false;
      if (smsEnabled) {
        const phone = normalizePhone(dossier.client_phone);
        const smsBody = `Bonjour, complétez votre demande d'intervention ici : ${clientLink} — ${artisanName}`;
        const smsResult = await sendSms(phone, smsBody);
        if (smsResult.success) {
          smsSent = true;
          await supabase.from("historique").insert({
            dossier_id,
            user_id: user.id,
            action: "client_link_sent_sms",
            details: `Lien client envoyé par SMS au ${dossier.client_phone}`,
          });
        }
      }
    }

    // Log if no contact info
    if (!dossier.client_email && !dossier.client_phone) {
      await supabase.from("historique").insert({
        dossier_id,
        user_id: user.id,
        action: "client_link_not_sent",
        details: "Coordonnées manquantes : lien non envoyé",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        token,
        expires_at: expiresAt,
        client_link: clientLink,
        token_generated: tokenGenerated,
        email_sent: emailSent,
        email_error: emailError,
        sms_sent: smsSent,
        no_contact: !dossier.client_email && !dossier.client_phone,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("Error in send-client-link:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
