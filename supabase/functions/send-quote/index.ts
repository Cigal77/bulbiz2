import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Verify user
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { quote_id } = await req.json();
    if (!quote_id) throw new Error("Missing quote_id");

    // Get quote
    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quote_id)
      .eq("user_id", user.id)
      .single();
    if (qErr || !quote) throw new Error("Devis introuvable");

    // Get dossier
    const { data: dossier, error: dErr } = await supabase
      .from("dossiers")
      .select("*")
      .eq("id", quote.dossier_id)
      .eq("user_id", user.id)
      .single();
    if (dErr || !dossier) throw new Error("Dossier introuvable");

    if (!dossier.client_email) throw new Error("Le client n'a pas d'email");

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const artisanName = profile?.company_name ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      "Votre artisan";
    const signature = profile?.email_signature || `Cordialement,\n${artisanName}`;

    // Generate signature token
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const signatureToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    // Build validation link
    const appUrl = Deno.env.get("SUPABASE_URL")!.replace(".supabase.co", "").replace("https://", "");
    // Use the app's frontend URL for the validation page
    const validationUrl = `https://id-preview--2e27a371-0c34-4075-96a4-b8ddd74908dd.lovable.app/devis/validation?token=${signatureToken}`;

    const pdfLink = quote.pdf_url
      ? `<p style="margin: 16px 0;"><a href="${quote.pdf_url}" style="color: #2563eb; text-decoration: underline; font-weight: 500;">📄 Télécharger le devis (PDF)</a></p>`
      : "";

    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: `${artisanName} <onboarding@resend.dev>`,
      to: [dossier.client_email],
      subject: `${artisanName} – Votre devis ${quote.quote_number}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p>Bonjour ${dossier.client_first_name || ""},</p>
          <p>Veuillez trouver votre devis <strong>${quote.quote_number}</strong>.</p>
          ${pdfLink}
          <p style="margin: 24px 0;">
            <a href="${validationUrl}" style="background-color: #16a34a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              ✅ Voir et valider le devis
            </a>
          </p>
          <p style="font-size: 13px; color: #6b7280;">Ce lien est valable 30 jours.</p>
          <p>N'hésitez pas à nous contacter pour toute question.</p>
          <br/>
          <p style="white-space: pre-line;">${signature}</p>
        </div>
      `,
    });

    // Update quote status to sent + save signature token
    await supabase.from("quotes").update({
      status: "envoye",
      sent_at: new Date().toISOString(),
      signature_token: signatureToken,
      signature_token_expires_at: expiresAt,
    }).eq("id", quote_id);

    // Update dossier status
    await supabase.from("dossiers").update({
      status: "devis_envoye",
      status_changed_at: new Date().toISOString(),
    }).eq("id", dossier.id);

    // Log historique
    await supabase.from("historique").insert({
      dossier_id: dossier.id,
      user_id: user.id,
      action: "quote_sent",
      details: `Devis ${quote.quote_number} envoyé à ${dossier.client_email}`,
    });

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
