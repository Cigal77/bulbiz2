import { Resend } from "npm:resend@2.0.0";
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendKey);

    const now = new Date();
    let totalSent = 0;

    // 1. Info manquante: status = a_qualifier, relance_active, no relance yet, created > 1 day ago
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: infoManquante } = await supabase
      .from("dossiers")
      .select("*, profiles!inner(company_name, first_name, last_name, email_signature, auto_relance_enabled, relance_delay_info)")
      .eq("status", "a_qualifier")
      .eq("relance_active", true)
      .eq("relance_count", 0)
      .not("client_email", "is", null)
      .lt("created_at", oneDayAgo);

    // Note: The join above won't work with standard RLS approach. 
    // We use service role so RLS is bypassed.
    // We need to manually join profiles
    const { data: infoMDossiers } = await supabase
      .from("dossiers")
      .select("*")
      .eq("status", "a_qualifier")
      .eq("relance_active", true)
      .eq("relance_count", 0)
      .not("client_email", "is", null)
      .lt("created_at", oneDayAgo);

    if (infoMDossiers && infoMDossiers.length > 0) {
      for (const dossier of infoMDossiers) {
        // Check profile settings
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", dossier.user_id)
          .single();

        if (!profile?.auto_relance_enabled) continue;

        const artisanName = profile?.company_name ||
          [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
          "Votre artisan";
        const signature = profile?.email_signature || `Cordialement,\n${artisanName}`;

        try {
          await resend.emails.send({
            from: `${artisanName} <onboarding@resend.dev>`,
            to: [dossier.client_email!],
            subject: `${artisanName} – Informations complémentaires nécessaires`,
            html: `
              <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <p>Bonjour ${dossier.client_first_name},</p>
                <p>Nous avons bien reçu votre demande mais il nous manque quelques informations pour établir un devis.</p>
                <p>Pourriez-vous nous préciser la nature exacte du problème et joindre des photos si possible ?</p>
                <br/><p style="white-space: pre-line;">${signature}</p>
              </div>
            `,
          });

          await supabase.from("relances").insert({
            dossier_id: dossier.id,
            user_id: dossier.user_id,
            type: "info_manquante",
            email_to: dossier.client_email!,
            status: "sent",
          });

          await supabase.from("dossiers").update({
            relance_count: 1,
            last_relance_at: now.toISOString(),
          }).eq("id", dossier.id);

          await supabase.from("historique").insert({
            dossier_id: dossier.id,
            user_id: dossier.user_id,
            action: "relance_sent",
            details: `Relance auto "Info manquante" envoyée à ${dossier.client_email}`,
          });

          totalSent++;
        } catch (e) {
          console.error(`Failed to send relance for dossier ${dossier.id}:`, e);
        }
      }
    }

    // 2. Devis non signé: status = devis_envoye, relance_active, relance_count < 2
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();

    const { data: devisDossiers } = await supabase
      .from("dossiers")
      .select("*")
      .eq("status", "devis_envoye")
      .eq("relance_active", true)
      .lt("relance_count", 2)
      .not("client_email", "is", null);

    if (devisDossiers && devisDossiers.length > 0) {
      for (const dossier of devisDossiers) {
        // Check timing: relance 1 at J+2 from status change, relance 2 at J+5
        const statusChanged = new Date(dossier.status_changed_at);
        const daysSinceStatus = (now.getTime() - statusChanged.getTime()) / (24 * 60 * 60 * 1000);

        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", dossier.user_id)
          .single();

        if (!profile?.auto_relance_enabled) continue;

        const delay1 = profile?.relance_delay_devis_1 ?? 2;
        const delay2 = profile?.relance_delay_devis_2 ?? 5;

        const shouldSend =
          (dossier.relance_count === 0 && daysSinceStatus >= delay1) ||
          (dossier.relance_count === 1 && daysSinceStatus >= delay2);

        if (!shouldSend) continue;

        // Check last relance wasn't today
        if (dossier.last_relance_at) {
          const lastRelance = new Date(dossier.last_relance_at);
          const hoursSinceLastRelance = (now.getTime() - lastRelance.getTime()) / (60 * 60 * 1000);
          if (hoursSinceLastRelance < 20) continue;
        }

        const artisanName = profile?.company_name ||
          [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
          "Votre artisan";
        const signature = profile?.email_signature || `Cordialement,\n${artisanName}`;

        try {
          await resend.emails.send({
            from: `${artisanName} <onboarding@resend.dev>`,
            to: [dossier.client_email!],
            subject: `${artisanName} – Suivi de votre devis`,
            html: `
              <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <p>Bonjour ${dossier.client_first_name},</p>
                <p>Nous vous avons récemment envoyé un devis. Souhaitez-vous que nous en discutions ?</p>
                <p>Nous restons à votre disposition pour toute question.</p>
                <br/><p style="white-space: pre-line;">${signature}</p>
              </div>
            `,
          });

          await supabase.from("relances").insert({
            dossier_id: dossier.id,
            user_id: dossier.user_id,
            type: "devis_non_signe",
            email_to: dossier.client_email!,
            status: "sent",
          });

          await supabase.from("dossiers").update({
            relance_count: dossier.relance_count + 1,
            last_relance_at: now.toISOString(),
          }).eq("id", dossier.id);

          await supabase.from("historique").insert({
            dossier_id: dossier.id,
            user_id: dossier.user_id,
            action: "relance_sent",
            details: `Relance auto "Devis non signé" (${dossier.relance_count + 1}/2) envoyée à ${dossier.client_email}`,
          });

          totalSent++;
        } catch (e) {
          console.error(`Failed to send devis relance for dossier ${dossier.id}:`, e);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, relances_sent: totalSent }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in check-relances:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
