import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { token, description, rgpd_consent } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Token requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate token
    const { data: dossier, error: dossierError } = await supabase
      .from("dossiers")
      .select("id, user_id, client_token_expires_at, status, client_first_name")
      .eq("client_token", token)
      .single();

    if (dossierError || !dossier) {
      return new Response(JSON.stringify({ error: "Lien invalide ou expiré" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiry
    if (dossier.client_token_expires_at && new Date(dossier.client_token_expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Ce lien a expiré" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If GET-like (no description), return dossier info for the form
    if (!description && !rgpd_consent) {
      return new Response(
        JSON.stringify({
          dossier_id: dossier.id,
          client_first_name: dossier.client_first_name,
          status: dossier.status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate inputs
    if (!description || typeof description !== "string" || description.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Description requise" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (description.length > 5000) {
      return new Response(JSON.stringify({ error: "Description trop longue (max 5000 caractères)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!rgpd_consent) {
      return new Response(JSON.stringify({ error: "Le consentement RGPD est requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update dossier with client description
    const { error: updateError } = await supabase
      .from("dossiers")
      .update({
        description: description.trim(),
        source: "lien_client",
        status: dossier.status === "nouveau" ? "a_qualifier" : dossier.status,
      })
      .eq("id", dossier.id);

    if (updateError) throw updateError;

    // Log
    await supabase.from("historique").insert({
      dossier_id: dossier.id,
      user_id: null,
      action: "client_form_submitted",
      details: "Le client a soumis le formulaire avec sa description du problème",
    });

    // Invalidate token after use
    await supabase
      .from("dossiers")
      .update({ client_token: null, client_token_expires_at: null })
      .eq("id", dossier.id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
