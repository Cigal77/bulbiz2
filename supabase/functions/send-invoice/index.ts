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
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        try {
          const resend = new Resend(resendKey);
          const artisanName = invoice.artisan_company || invoice.artisan_name || "Votre artisan";

          await resend.emails.send({
            from: `${artisanName} <noreply@bulbiz.fr>`,
            to: [invoice.client_email],
            subject: `Votre facture ${invoice.invoice_number}`,
            html: `
              <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <p>Bonjour ${invoice.client_first_name || ""},</p>
                <p>Suite à notre intervention, veuillez trouver votre facture <strong>${invoice.invoice_number}</strong>.</p>
                <p style="margin: 24px 0;">
                  <strong>Montant total : ${Number(invoice.total_ttc || 0).toFixed(2)} € TTC</strong>
                </p>
                ${invoice.payment_terms ? `<p style="font-size: 13px; color: #6b7280;">${invoice.payment_terms}</p>` : ""}
                ${pdfUrl ? `<p style="margin: 16px 0;"><a href="${pdfUrl}" style="color: #2563eb; text-decoration: underline;">Télécharger le PDF de votre facture</a></p>` : ""}
                <p>N'hésitez pas à nous contacter pour toute question.</p>
                ${invoice.artisan_email ? `<p style="font-size: 13px; color: #374151;">Email : ${invoice.artisan_email}</p>` : ""}
                ${invoice.artisan_phone ? `<p style="font-size: 13px; color: #374151;">Tél : ${invoice.artisan_phone}</p>` : ""}
                <br/>
                <p>Cordialement,<br/>${artisanName}</p>
              </div>
            `,
          });
          emailSent = true;
        } catch (err: any) {
          emailError = err.message;
          console.error("Email send error:", err);
        }
      }
    }

    // Send SMS
    let smsSent = false;
    if (invoice.client_phone && isValidPhone(invoice.client_phone)) {
      const phone = normalizePhone(invoice.client_phone);
      const smsBody = `Votre facture ${invoice.invoice_number} — ${Number(invoice.total_ttc || 0).toFixed(2)} € TTC. N'hésitez pas à nous contacter. — ${artisanName}${invoice.artisan_phone ? ` (${invoice.artisan_phone})` : ""}`;
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
