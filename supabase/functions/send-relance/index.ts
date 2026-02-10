import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Verify the user
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    // Admin client for updates
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { dossier_id, type }: SendRelanceRequest = await req.json();
    if (!dossier_id || !type) throw new Error("Missing dossier_id or type");

    // Get the dossier
    const { data: dossier, error: dossierError } = await supabase
      .from("dossiers")
      .select("*")
      .eq("id", dossier_id)
      .eq("user_id", user.id)
      .single();
    if (dossierError || !dossier) throw new Error("Dossier not found");

    if (!dossier.client_email) {
      throw new Error("Le client n'a pas d'adresse email renseignée");
    }

    // Get artisan profile for signature
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const artisanName = profile?.company_name || 
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || 
      "Votre artisan";
    const signature = profile?.email_signature || `Cordialement,\n${artisanName}`;

    // Build email content based on type
    let subject: string;
    let htmlBody: string;

    if (type === "info_manquante") {
      subject = `${artisanName} – Informations complémentaires nécessaires`;
      htmlBody = `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p>Bonjour ${dossier.client_first_name},</p>
          <p>Nous avons bien reçu votre demande d'intervention mais il nous manque quelques informations pour pouvoir vous établir un devis.</p>
          <p>Pourriez-vous nous préciser :</p>
          <ul>
            <li>La nature exacte du problème</li>
            <li>Des photos si possible</li>
            <li>Vos disponibilités</li>
          </ul>
          <p>N'hésitez pas à répondre directement à cet email.</p>
          <br/>
          <p style="white-space: pre-line;">${signature}</p>
        </div>
      `;
    } else {
      subject = `${artisanName} – Suivi de votre devis`;
      htmlBody = `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p>Bonjour ${dossier.client_first_name},</p>
          <p>Nous vous avons récemment envoyé un devis pour votre demande d'intervention.</p>
          <p>Souhaitez-vous que nous en discutions ? Nous restons à votre disposition pour toute question.</p>
          <br/>
          <p style="white-space: pre-line;">${signature}</p>
        </div>
      `;
    }

    // Send email via Resend
    const resend = new Resend(resendKey);
    const emailResponse = await resend.emails.send({
      from: `${artisanName} <onboarding@resend.dev>`,
      to: [dossier.client_email],
      subject,
      html: htmlBody,
    });

    console.log("Email sent:", emailResponse);

    // Record the relance
    await supabase.from("relances").insert({
      dossier_id,
      user_id: user.id,
      type,
      email_to: dossier.client_email,
      status: "sent",
    });

    // Update dossier relance count
    await supabase
      .from("dossiers")
      .update({
        relance_count: (dossier.relance_count || 0) + 1,
        last_relance_at: new Date().toISOString(),
      })
      .eq("id", dossier_id);

    // Add historique entry
    await supabase.from("historique").insert({
      dossier_id,
      user_id: user.id,
      action: "relance_sent",
      details: `Relance "${type === "info_manquante" ? "Info manquante" : "Devis non signé"}" envoyée à ${dossier.client_email}`,
    });

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
