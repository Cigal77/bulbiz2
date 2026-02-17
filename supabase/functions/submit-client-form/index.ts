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

    // ACTION: get dossier info
    if (!action || action === "get") {
      const { data: slots } = await supabase
        .from("appointment_slots")
        .select("id, slot_date, time_start, time_end, selected_at")
        .eq("dossier_id", dossier.id)
        .order("slot_date", { ascending: true });

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
        appointment_status: dossier.appointment_status,
        appointment_slots: slots || [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      
    }

    // ACTION: submit client data (update ALL provided fields, track changes)
    if (action === "submit") {
      const { data: clientData, rgpd_consent, media_urls } = body;

      if (!rgpd_consent) {
        return new Response(JSON.stringify({ error: "Le consentement RGPD est requis" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Build update object and track what changed
      const updates: Record<string, unknown> = {};
      const changedFields: string[] = [];

      const textFields = [
        { key: "client_first_name", label: "Prénom" },
        { key: "client_last_name", label: "Nom" },
        { key: "client_phone", label: "Téléphone" },
        { key: "client_email", label: "Email" },
        { key: "address", label: "Adresse" },
        { key: "description", label: "Description" },
      ] as const;

      for (const { key, label } of textFields) {
        const newVal = clientData?.[key]?.trim?.();
        if (newVal !== undefined && newVal !== "") {
          const currentVal = (dossier as Record<string, unknown>)[key] as string | null;
          if (newVal !== (currentVal || "")) {
            updates[key] = newVal;
            if (currentVal) {
              changedFields.push(`${label} modifié`);
            } else {
              changedFields.push(`${label} ajouté`);
            }
          }
        }
      }

      // Category & urgency
      if (clientData?.category && clientData.category !== dossier.category) {
        updates.category = clientData.category;
        changedFields.push("Catégorie modifiée");
      }
      if (clientData?.urgency && clientData.urgency !== dossier.urgency) {
        updates.urgency = clientData.urgency;
        changedFields.push("Urgence modifiée");
      }

      // Address structured data
      if (clientData?.google_place_id) {
        updates.google_place_id = clientData.google_place_id;
        if (clientData.lat) updates.lat = parseFloat(clientData.lat);
        if (clientData.lng) updates.lng = parseFloat(clientData.lng);
        if (clientData.postal_code) updates.postal_code = clientData.postal_code;
        if (clientData.city) updates.city = clientData.city;
        if (clientData.address_line) updates.address_line = clientData.address_line;
      }

      // Update source
      updates.source = "lien_client";

      // Auto-transition status
      const mergedFirstName = updates.client_first_name || dossier.client_first_name;
      const mergedPhone = updates.client_phone || dossier.client_phone;
      const mergedAddress = updates.address || dossier.address;
      const mergedDescription = updates.description || dossier.description;

      const hasMinInfo = mergedFirstName && mergedPhone && mergedAddress && mergedDescription;
      if ((dossier.status === "nouveau" || dossier.status === "a_qualifier") && hasMinInfo) {
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

      // Insert media records
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

      // Log in historique with detailed changes
      const details = changedFields.length > 0
        ? `Le client a mis à jour : ${changedFields.join(", ")}${media_urls?.length ? ` + ${media_urls.length} média(s)` : ""}`
        : `Le client a soumis le formulaire${media_urls?.length ? ` avec ${media_urls.length} média(s)` : ""}`;

      await supabase.from("historique").insert({
        dossier_id: dossier.id,
        user_id: null,
        action: "client_form_submitted",
        details,
      });

      if (updates.status === "devis_a_faire") {
        await supabase.from("historique").insert({
          dossier_id: dossier.id,
          user_id: null,
          action: "status_change",
          details: 'Statut passé automatiquement à "Devis à faire" (informations complètes)',
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: select appointment slot
    if (action === "select_slot") {
      const { slot_id } = body;
      if (!slot_id) {
        return new Response(JSON.stringify({ error: "slot_id requis" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: slot, error: slotErr } = await supabase
        .from("appointment_slots")
        .select("*")
        .eq("id", slot_id)
        .eq("dossier_id", dossier.id)
        .single();
      if (slotErr || !slot) {
        return new Response(JSON.stringify({ error: "Créneau introuvable" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("appointment_slots")
        .update({ selected_at: new Date().toISOString() })
        .eq("id", slot_id);

      await supabase
        .from("appointment_slots")
        .update({ selected_at: null })
        .eq("dossier_id", dossier.id)
        .neq("id", slot_id);

      await supabase
        .from("dossiers")
        .update({ appointment_status: "client_selected" })
        .eq("id", dossier.id);

      const slotDate = new Date(slot.slot_date).toLocaleDateString("fr-FR");
      await supabase.from("historique").insert({
        dossier_id: dossier.id,
        user_id: null,
        action: "client_slot_selected",
        details: `Le client a choisi le créneau du ${slotDate} ${slot.time_start.slice(0,5)}–${slot.time_end.slice(0,5)}`,
      });

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
