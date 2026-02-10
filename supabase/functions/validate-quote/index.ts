import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { token, action, reason } = await req.json();

    if (!token || !action) {
      return new Response(JSON.stringify({ error: "Token et action requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["accept", "refuse"].includes(action)) {
      return new Response(JSON.stringify({ error: "Action invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select("*, dossiers!inner(id, client_email, client_phone, client_first_name, client_last_name, user_id)")
      .eq("signature_token", token)
      .maybeSingle();

    if (qErr || !quote) {
      return new Response(JSON.stringify({ error: "Lien invalide ou expiré" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (quote.signature_token_expires_at && new Date(quote.signature_token_expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Ce lien a expiré" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (quote.status === "signe" || quote.status === "refuse") {
      return new Response(JSON.stringify({ error: "Ce devis a déjà été traité", status: quote.status }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const now = new Date().toISOString();
    const dossier = quote.dossiers;
    const acceptedBy = dossier.client_email || dossier.client_phone || "client";

    if (action === "accept") {
      await supabase.from("quotes").update({
        status: "signe", signed_at: now, accepted_at: now, accepted_ip: ip, accepted_user_agent: userAgent,
      }).eq("id", quote.id);

      await supabase.from("dossiers").update({
        status: "clos_signe", status_changed_at: now, relance_active: false,
        appointment_status: "rdv_pending",
      }).eq("id", dossier.id);

      await supabase.from("historique").insert({
        dossier_id: dossier.id, user_id: dossier.user_id,
        action: "quote_validated_by_client",
        details: `Devis ${quote.quote_number} validé par ${acceptedBy} (IP: ${ip})`,
      });

      await supabase.from("historique").insert({
        dossier_id: dossier.id, user_id: dossier.user_id,
        action: "appointment_status_change",
        details: "Prise de rendez-vous en attente",
      });

      // Send APPOINTMENT_REQUESTED notification via the unified service
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const { data: profile } = await supabase
          .from("profiles").select("company_name, first_name, last_name, phone, email, sms_enabled")
          .eq("user_id", dossier.user_id).maybeSingle();

        const artisanName = profile?.company_name ||
          [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Votre artisan";

        // Send email notification
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (resendKey && dossier.client_email) {
          const { Resend: ResendClass } = await import("npm:resend@2.0.0");
          const resendClient = new ResendClass(resendKey);
          const clientName = dossier.client_first_name || "Bonjour";
          await resendClient.emails.send({
            from: `${artisanName} <onboarding@resend.dev>`,
            to: [dossier.client_email],
            subject: `${artisanName} souhaite convenir d'un rendez-vous`,
            html: `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <h2 style="color:#2563eb;">📅 Proposition de rendez-vous</h2>
              <p>Bonjour ${clientName},</p>
              <p>Suite à la validation de votre devis, <strong>${artisanName}</strong> souhaite convenir d'un rendez-vous pour l'intervention.</p>
              <p>Merci de le contacter${profile?.phone ? ` au ${profile.phone}` : ""}${profile?.email ? ` ou par email à ${profile.email}` : ""} pour fixer une date.</p>
              <br/>
              <p>Cordialement,<br/>${artisanName}</p>
            </div>`,
          });
          await supabase.from("notification_logs").insert({
            dossier_id: dossier.id, event_type: "APPOINTMENT_REQUESTED",
            channel: "email", recipient: dossier.client_email, status: "SENT",
          });
          await supabase.from("historique").insert({
            dossier_id: dossier.id, user_id: dossier.user_id,
            action: "notification_sent",
            details: `Email envoyé : proposition de rendez-vous → ${dossier.client_email}`,
          });
        }
      } catch (notifErr) {
        console.error("Failed to send appointment notification:", notifErr);
      }
    } else {
      await supabase.from("quotes").update({
        status: "refuse", refused_at: now, refused_reason: reason || null, accepted_ip: ip, accepted_user_agent: userAgent,
      }).eq("id", quote.id);

      await supabase.from("dossiers").update({
        status: "clos_perdu", status_changed_at: now, relance_active: false,
      }).eq("id", dossier.id);

      await supabase.from("historique").insert({
        dossier_id: dossier.id, user_id: dossier.user_id,
        action: "quote_refused_by_client",
        details: `Devis ${quote.quote_number} refusé par ${acceptedBy}${reason ? ` – Motif : ${reason}` : ""}`,
      });
    }

    // ── Notify artisan (email) ──
    try {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        const { data: profile } = await supabase
          .from("profiles").select("email, first_name, last_name, company_name, phone, sms_enabled")
          .eq("user_id", dossier.user_id).maybeSingle();

        if (profile?.email) {
          const resendClient = new Resend(resendKey);
          const clientName = [dossier.client_first_name, dossier.client_last_name].filter(Boolean).join(" ") || "Le client";
          const artisanName = profile.company_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Artisan";
          const isAccepted = action === "accept";
          const subject = isAccepted
            ? `✅ Devis ${quote.quote_number} validé par ${clientName}`
            : `❌ Devis ${quote.quote_number} refusé par ${clientName}`;

          const body = isAccepted
            ? `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                <h2 style="color:#16a34a;">✅ Bonne nouvelle !</h2>
                <p>Bonjour ${artisanName},</p>
                <p><strong>${clientName}</strong> a validé votre devis <strong>${quote.quote_number}</strong>.</p>
                <p>Le dossier a été automatiquement passé en <strong>Clos – Signé</strong>.</p>
              </div>`
            : `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                <h2 style="color:#dc2626;">❌ Devis refusé</h2>
                <p>Bonjour ${artisanName},</p>
                <p><strong>${clientName}</strong> a refusé votre devis <strong>${quote.quote_number}</strong>.</p>
                ${reason ? `<p>Motif : <em>${reason}</em></p>` : ""}
                <p>Le dossier a été passé en <strong>Clos – Perdu</strong>.</p>
              </div>`;

          await resendClient.emails.send({
            from: `Bulbiz <onboarding@resend.dev>`, to: [profile.email], subject, html: body,
          });
        }
      }
    } catch (emailErr) {
      console.error("Failed to send artisan notification email:", emailErr);
    }

    // ── Send confirmation SMS to client after validation ──
    if (action === "accept" && dossier.client_phone) {
      try {
        const { data: profile } = await supabase
          .from("profiles").select("company_name, first_name, last_name, phone, email, sms_enabled")
          .eq("user_id", dossier.user_id).maybeSingle();

        const smsEnabled = profile?.sms_enabled !== false;
        if (smsEnabled) {
          const cleaned = dossier.client_phone.replace(/[\s\-().]/g, "");
          if (/^\+?\d{10,15}$/.test(cleaned)) {
            let phone = cleaned;
            if (phone.startsWith("0") && phone.length === 10) phone = "+33" + phone.slice(1);
            if (!phone.startsWith("+")) phone = "+" + phone;

            const artisanName = profile?.company_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Votre artisan";
            const contactInfo = profile?.phone ? profile.phone : (profile?.email || "");
            const smsBody = `Merci, devis ${quote.quote_number} validé ✅ Pour fixer le RDV : ${contactInfo} — ${artisanName}`;
            await sendSms(phone, smsBody);
          }
        }
      } catch (smsErr) {
        console.error("Failed to send client confirmation SMS:", smsErr);
      }
    }

    return new Response(JSON.stringify({ success: true, action }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in validate-quote:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
