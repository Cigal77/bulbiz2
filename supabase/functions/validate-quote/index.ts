import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
