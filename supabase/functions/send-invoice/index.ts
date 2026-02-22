import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Gmail helpers ──
async function refreshGmailToken(supabase: any, userId: string, connection: any): Promise<string | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret || !connection.refresh_token) return null;
  try {
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: connection.refresh_token, grant_type: "refresh_token" }),
    });
    const data = await resp.json();
    if (!resp.ok) return null;
    await supabase.from("gmail_connections").update({ access_token: data.access_token, token_expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString() }).eq("user_id", userId);
    return data.access_token;
  } catch { return null; }
}

async function sendViaGmail(accessToken: string, from: string, to: string, subject: string, html: string): Promise<boolean> {
  const message = [`From: ${from}`, `To: ${to}`, `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`, `MIME-Version: 1.0`, `Content-Type: text/html; charset=UTF-8`, ``, html].join("\r\n");
  const raw = btoa(unescape(encodeURIComponent(message))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw }) });
  if (!resp.ok) { const err = await resp.text(); console.error("Gmail API error:", err); return false; }
  await resp.json();
  return true;
}

async function getGmailConnection(supabase: any, userId: string) {
  const { data: conn } = await supabase.from("gmail_connections").select("*").eq("user_id", userId).maybeSingle();
  if (!conn) return null;
  if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
    const newToken = await refreshGmailToken(supabase, userId, conn);
    if (newToken) { conn.access_token = newToken; } else { return null; }
  }
  return conn;
}

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

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { invoice_id } = await req.json();
    if (!invoice_id) throw new Error("Missing invoice_id");

    // Get invoice
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoice_id)
      .eq("user_id", user.id)
      .single();
    if (invErr || !invoice) throw new Error("Facture introuvable");

    // Auto-generate PDF if not yet done
    let pdfUrl = invoice.pdf_url;
    if (!pdfUrl) {
      try {
        const pdfRes = await fetch(`${supabaseUrl}/functions/v1/generate-invoice-pdf`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify({ invoice_id }),
        });
        const pdfData = await pdfRes.json();
        if (pdfData?.pdf_url) pdfUrl = pdfData.pdf_url;
      } catch (e) {
        console.error("PDF generation before send failed:", e);
      }
    }

    // Generate client token if not already present
    let clientToken = invoice.client_token;
    if (!clientToken) {
      clientToken = crypto.randomUUID() + "-" + crypto.randomUUID();
      const tokenExpires = new Date();
      tokenExpires.setDate(tokenExpires.getDate() + 90);
      await supabase
        .from("invoices")
        .update({
          client_token: clientToken,
          client_token_expires_at: tokenExpires.toISOString(),
        })
        .eq("id", invoice_id);
    }

    // Update status to sent
    await supabase.from("invoices").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", invoice_id);

    let emailSent = false;
    let emailError: string | null = null;

    // Send email
    if (invoice.client_email) {
      // Try Gmail first
      const gmailConn = await getGmailConnection(supabase, user.id);

      if (gmailConn) {
        const artisanName = invoice.artisan_company || invoice.artisan_name || "Votre artisan";
        const htmlContent = `<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <p>Bonjour ${invoice.client_first_name || ""},</p>
              <p>Suite à notre intervention, veuillez trouver ci-joint votre facture.</p>
              ${pdfUrl ? `<p style="margin: 16px 0;"><a href="${pdfUrl}" style="color: #2563eb; text-decoration: underline;">Télécharger le PDF de votre facture</a></p>` : ""}
              <p>N'hésitez pas à nous contacter pour toute question.</p>
              ${invoice.artisan_email ? `<p style="font-size: 13px; color: #374151;">Email : ${invoice.artisan_email}</p>` : ""}
              ${invoice.artisan_phone ? `<p style="font-size: 13px; color: #374151;">Tél : ${invoice.artisan_phone}</p>` : ""}
              <br/>
              <p>Cordialement,<br/>${artisanName}</p>
            </div>`;
        emailSent = await sendViaGmail(gmailConn.access_token, `${artisanName} <${gmailConn.gmail_address}>`, invoice.client_email, `Votre facture`, htmlContent);
      }

      if (!emailSent) {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (resendKey) {
          try {
            const resend = new Resend(resendKey);
            const artisanName = invoice.artisan_company || invoice.artisan_name || "Votre artisan";
            await resend.emails.send({
              from: `${artisanName} <noreply@bulbiz.fr>`,
              to: [invoice.client_email],
              subject: `Votre facture`,
              html: `<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <p>Bonjour ${invoice.client_first_name || ""},</p>
                <p>Suite à notre intervention, veuillez trouver ci-joint votre facture.</p>
                ${pdfUrl ? `<p style="margin: 16px 0;"><a href="${pdfUrl}" style="color: #2563eb; text-decoration: underline;">Télécharger le PDF de votre facture</a></p>` : ""}
                <p>N'hésitez pas à nous contacter pour toute question.</p>
                ${invoice.artisan_email ? `<p style="font-size: 13px; color: #374151;">Email : ${invoice.artisan_email}</p>` : ""}
                ${invoice.artisan_phone ? `<p style="font-size: 13px; color: #374151;">Tél : ${invoice.artisan_phone}</p>` : ""}
                <br/>
                <p>Cordialement,<br/>${artisanName}</p>
              </div>`,
            });
            emailSent = true;
          } catch (err: any) {
            emailError = err.message;
            console.error("Email send error:", err);
          }
        }
      }
    }

    // Send SMS
    let smsSent = false;
    if (invoice.client_phone && isValidPhone(invoice.client_phone)) {
      const phone = normalizePhone(invoice.client_phone);
      const smsBody = `Votre facture est disponible. N'hésitez pas à nous contacter. — ${artisanName}${invoice.artisan_phone ? ` (${invoice.artisan_phone})` : ""}`;
      const smsResult = await sendSms(phone, smsBody);
      if (smsResult.success) {
        smsSent = true;
        await supabase.from("historique").insert({
          dossier_id: invoice.dossier_id,
          user_id: user.id,
          action: "invoice_sent_sms",
          details: `Facture ${invoice.invoice_number} envoyée par SMS au ${invoice.client_phone}`,
        });
      }
    }

    // Historique
    await supabase.from("historique").insert({
      dossier_id: invoice.dossier_id,
      user_id: user.id,
      action: "invoice_sent",
      details: emailSent
        ? `Facture ${invoice.invoice_number} envoyée par email à ${invoice.client_email}`
        : `Facture ${invoice.invoice_number} marquée comme envoyée`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        email_sent: emailSent,
        email_error: emailError,
        sms_sent: smsSent,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("Error in send-invoice:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
