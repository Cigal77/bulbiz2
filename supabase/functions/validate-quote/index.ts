import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["accept", "refuse"].includes(action)) {
      return new Response(JSON.stringify({ error: "Action invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find quote by token
    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select("*, dossiers!inner(id, client_email, client_phone, client_first_name, client_last_name, user_id)")
      .eq("signature_token", token)
      .maybeSingle();

    if (qErr || !quote) {
      return new Response(JSON.stringify({ error: "Lien invalide ou expiré" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiration
    if (quote.signature_token_expires_at && new Date(quote.signature_token_expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Ce lien a expiré" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already acted upon
    if (quote.status === "signe" || quote.status === "refuse") {
      return new Response(JSON.stringify({ error: "Ce devis a déjà été traité", status: quote.status }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const now = new Date().toISOString();
    const dossier = quote.dossiers;
    const acceptedBy = dossier.client_email || dossier.client_phone || "client";

    if (action === "accept") {
      // Update quote
      await supabase.from("quotes").update({
        status: "signe",
        signed_at: now,
        accepted_at: now,
        accepted_ip: ip,
        accepted_user_agent: userAgent,
      }).eq("id", quote.id);

      // Update dossier → clos_signe
      await supabase.from("dossiers").update({
        status: "clos_signe",
        status_changed_at: now,
        relance_active: false,
      }).eq("id", dossier.id);

      // Historique
      await supabase.from("historique").insert({
        dossier_id: dossier.id,
        user_id: dossier.user_id,
        action: "quote_validated_by_client",
        details: `Devis ${quote.quote_number} validé par ${acceptedBy} (IP: ${ip})`,
      });
    } else {
      // Refuse
      await supabase.from("quotes").update({
        status: "refuse",
        refused_at: now,
        refused_reason: reason || null,
        accepted_ip: ip,
        accepted_user_agent: userAgent,
      }).eq("id", quote.id);

      // Update dossier → clos_perdu
      await supabase.from("dossiers").update({
        status: "clos_perdu",
        status_changed_at: now,
        relance_active: false,
      }).eq("id", dossier.id);

      // Historique
      await supabase.from("historique").insert({
        dossier_id: dossier.id,
        user_id: dossier.user_id,
        action: "quote_refused_by_client",
        details: `Devis ${quote.quote_number} refusé par ${acceptedBy}${reason ? ` – Motif : ${reason}` : ""}`,
      });
    }

    // Send email notification to artisan
    try {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        // Get artisan profile for email
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, first_name, last_name, company_name")
          .eq("user_id", dossier.user_id)
          .maybeSingle();

        if (profile?.email) {
          const resend = new Resend(resendKey);
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
                <p>Le dossier a été automatiquement passé en <strong>Clos – Signé</strong> et les relances ont été désactivées.</p>
                <p style="margin-top:24px;"><a href="https://id-preview--2e27a371-0c34-4075-96a4-b8ddd74908dd.lovable.app/dossier/${dossier.id}" style="background-color:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Voir le dossier</a></p>
              </div>`
            : `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                <h2 style="color:#dc2626;">❌ Devis refusé</h2>
                <p>Bonjour ${artisanName},</p>
                <p><strong>${clientName}</strong> a refusé votre devis <strong>${quote.quote_number}</strong>.</p>
                ${reason ? `<p>Motif indiqué : <em>${reason}</em></p>` : ""}
                <p>Le dossier a été passé en <strong>Clos – Perdu</strong>.</p>
                <p style="margin-top:24px;"><a href="https://id-preview--2e27a371-0c34-4075-96a4-b8ddd74908dd.lovable.app/dossier/${dossier.id}" style="background-color:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Voir le dossier</a></p>
              </div>`;

          await resend.emails.send({
            from: `Bulbiz <onboarding@resend.dev>`,
            to: [profile.email],
            subject,
            html: body,
          });
          console.log("Notification email sent to artisan:", profile.email);
        }
      }
    } catch (emailErr) {
      // Don't fail the whole request if email fails
      console.error("Failed to send artisan notification email:", emailErr);
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
