import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const body = await req.json();
    const { token, action } = body;

    if (!token) {
      return new Response(JSON.stringify({ error: "Token requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate token
    const { data: dossier, error: dossierError } = await supabase
      .from("dossiers")
      .select("*")
      .eq("client_token", token)
      .single();

    if (dossierError || !dossier) {
      return new Response(JSON.stringify({ error: "Lien invalide ou expiré" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (dossier.client_token_expires_at && new Date(dossier.client_token_expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Ce lien a expiré" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: get dossier info (initial load)
    if (!action || action === "get") {
      return new Response(JSON.stringify({
        dossier_id: dossier.id,
        client_first_name: dossier.client_first_name,
        client_last_name: dossier.client_last_name,
        client_phone: dossier.client_phone,
        client_email: dossier.client_email,
        address: dossier.address,
        category: dossier.category,
        urgency: dossier.urgency,
        description: dossier.description,
        status: dossier.status,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ACTION: submit client data (merge only empty fields)
    if (action === "submit") {
      const { data: clientData, rgpd_consent, media_urls } = body;

      if (!rgpd_consent) {
        return new Response(JSON.stringify({ error: "Le consentement RGPD est requis" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Build update object: only fill fields that are currently empty/null
      const updates: Record<string, unknown> = {};
      const fieldsToMerge = [
        "client_first_name", "client_last_name", "client_phone",
        "client_email", "address", "description",
      ] as const;

      for (const field of fieldsToMerge) {
        const currentVal = dossier[field];
        const newVal = clientData?.[field]?.trim?.();
        if ((!currentVal || currentVal === "") && newVal) {
          updates[field] = newVal;
        }
      }

      // Category/urgency: only update if still default
      if (clientData?.category && dossier.category === "autre") {
        updates.category = clientData.category;
      }
      if (clientData?.urgency && dossier.urgency === "semaine") {
        updates.urgency = clientData.urgency;
      }

      // Update source to lien_client
      updates.source = "lien_client";

      // Auto-transition: if we now have minimum info, upgrade status
      const mergedFirstName = updates.client_first_name || dossier.client_first_name;
      const mergedPhone = updates.client_phone || dossier.client_phone;
      const mergedAddress = updates.address || dossier.address;
      const mergedDescription = updates.description || dossier.description;

      if (dossier.status === "a_qualifier" && mergedFirstName && mergedPhone && mergedAddress && mergedDescription) {
        updates.status = "devis_a_faire";
        updates.status_changed_at = new Date().toISOString();
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from("dossiers")
          .update(updates)
          .eq("id", dossier.id);
        if (updateError) throw updateError;
      }

      // Insert media records if provided
      if (media_urls && Array.isArray(media_urls)) {
        for (const media of media_urls) {
          await supabase.from("medias").insert({
            dossier_id: dossier.id,
            user_id: dossier.user_id,
            file_url: media.url,
            file_name: media.name,
            file_type: media.type,
            file_size: media.size || null,
          });
        }
      }

      // Log in historique
      const filledFields = Object.keys(updates).filter(k => k !== "source" && k !== "status" && k !== "status_changed_at");
      await supabase.from("historique").insert({
        dossier_id: dossier.id,
        user_id: null,
        action: "client_form_submitted",
        details: filledFields.length > 0
          ? `Le client a complété : ${filledFields.join(", ")}${media_urls?.length ? ` + ${media_urls.length} média(s)` : ""}`
          : `Le client a soumis le formulaire${media_urls?.length ? ` avec ${media_urls.length} média(s)` : ""}`,
      });

      if (updates.status === "devis_a_faire") {
        await supabase.from("historique").insert({
          dossier_id: dossier.id,
          user_id: null,
          action: "status_change",
          details: "Statut passé automatiquement à \"Devis à faire\" (informations complètes)",
        });
      }

      // Don't invalidate token — allow multiple visits
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
