import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

function formatDateFr(dateStr: string): string {
  const date = new Date(dateStr);
  const days = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function normalizePhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-().]/g, "");
  if (!/^\+?\d{10,15}$/.test(cleaned)) return null;
  let p = cleaned;
  if (p.startsWith("0") && p.length === 10) p = "+33" + p.slice(1);
  if (!p.startsWith("+")) p = "+" + p;
  return p;
}

async function sendSms(to: string, body: string): Promise<boolean> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromPhone = Deno.env.get("TWILIO_PHONE_NUMBER");
  if (!accountSid || !authToken || !fromPhone) return false;
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
    return resp.ok;
  } catch { return false; }
}

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

    // ── GET ──
    if (!action || action === "get") {
      const { data: slots } = await supabase
        .from("appointment_slots")
        .select("id, slot_date, time_start, time_end, selected_at")
        .eq("dossier_id", dossier.id)
        .order("slot_date", { ascending: true });

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_name, first_name, last_name, phone, email, logo_url")
        .eq("user_id", dossier.user_id)
        .maybeSingle();

      const artisan_name = profile?.company_name
        || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ")
        || "Votre artisan";

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
        artisan_name,
        artisan_logo_url: profile?.logo_url || null,
        // New fields
        trade_types: dossier.trade_types || [],
        problem_types: dossier.problem_types || [],
        housing_type: dossier.housing_type,
        occupant_type: dossier.occupant_type,
        floor_number: dossier.floor_number,
        has_elevator: dossier.has_elevator,
        access_code: dossier.access_code,
        availability: dossier.availability,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── SUBMIT ──
    if (action === "submit") {
      const { data: clientData, rgpd_consent, media_urls } = body;

      if (!rgpd_consent) {
        return new Response(JSON.stringify({ error: "Le consentement RGPD est requis" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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

      // ── New multi-trade fields ──
      if (clientData?.trade_types && Array.isArray(clientData.trade_types)) {
        const current = dossier.trade_types || [];
        const incoming = clientData.trade_types as string[];
        if (JSON.stringify(current.sort()) !== JSON.stringify([...incoming].sort())) {
          updates.trade_types = incoming;
          changedFields.push("Types d'intervention sélectionnés");
        }
      }

      if (clientData?.problem_types && Array.isArray(clientData.problem_types)) {
        const current = dossier.problem_types || [];
        const incoming = clientData.problem_types as string[];
        if (JSON.stringify(current.sort()) !== JSON.stringify([...incoming].sort())) {
          updates.problem_types = incoming;
          changedFields.push("Types de problème sélectionnés");
        }
      }

      // Append other_trade / other_problem to description if provided
      const extras: string[] = [];
      if (clientData?.other_trade) extras.push(`Autre métier : ${clientData.other_trade}`);
      if (clientData?.other_problem) extras.push(`Autre problème : ${clientData.other_problem}`);
      if (extras.length > 0) {
        const currentDesc = (updates.description as string) || dossier.description || "";
        const separator = currentDesc ? "\n\n" : "";
        updates.description = currentDesc + separator + extras.join("\n");
        if (!changedFields.includes("Description modifié") && !changedFields.includes("Description ajouté")) {
          changedFields.push("Description complétée");
        }
      }

      // Practical info fields
      const practicalFields = [
        { key: "housing_type", label: "Type de logement" },
        { key: "occupant_type", label: "Statut occupant" },
        { key: "access_code", label: "Code d'accès" },
        { key: "availability", label: "Disponibilités" },
      ] as const;

      let practicalChanged = false;
      for (const { key, label } of practicalFields) {
        const newVal = clientData?.[key];
        if (newVal !== undefined && newVal !== null && newVal !== "") {
          const currentVal = (dossier as Record<string, unknown>)[key];
          if (newVal !== currentVal) {
            updates[key] = typeof newVal === "string" ? newVal.trim() : newVal;
            practicalChanged = true;
          }
        }
      }

      if (clientData?.floor_number !== undefined && clientData.floor_number !== null) {
        const floorNum = typeof clientData.floor_number === "string" ? parseInt(clientData.floor_number, 10) : clientData.floor_number;
        if (!isNaN(floorNum) && floorNum !== dossier.floor_number) {
          updates.floor_number = floorNum;
          practicalChanged = true;
        }
      }

      if (clientData?.has_elevator !== undefined && clientData.has_elevator !== null) {
        if (clientData.has_elevator !== dossier.has_elevator) {
          updates.has_elevator = clientData.has_elevator;
          practicalChanged = true;
        }
      }

      if (practicalChanged) {
        changedFields.push("Informations pratiques complétées");
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

      // Log in historique
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

      // Notify artisan
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, first_name, last_name, company_name")
          .eq("user_id", dossier.user_id)
          .maybeSingle();

        const artisanEmail = profile?.email;
        if (artisanEmail) {
          const resendKey = Deno.env.get("RESEND_API_KEY");
          if (resendKey) {
            const { Resend } = await import("npm:resend@2.0.0");
            const resend = new Resend(resendKey);
            const clientName = [
              updates.client_first_name || dossier.client_first_name,
              updates.client_last_name || dossier.client_last_name,
            ].filter(Boolean).join(" ") || "Un client";

            await resend.emails.send({
              from: "Bulbiz <noreply@bulbiz.fr>",
              to: [artisanEmail],
              subject: `📋 ${clientName} a rempli son formulaire`,
              html: `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                <h2 style="color:#2563eb;">📋 Formulaire client rempli</h2>
                <p><strong>${clientName}</strong> vient de remplir le formulaire de son dossier.</p>
                ${changedFields.length > 0 ? `<p>Informations mises à jour : ${changedFields.join(", ")}</p>` : ""}
                ${media_urls?.length ? `<p>${media_urls.length} média(s) ajouté(s).</p>` : ""}
                ${updates.status === "devis_a_faire" ? '<p style="color:#16a34a;font-weight:bold;">✅ Le dossier est prêt pour établir un devis.</p>' : ""}
                <p style="margin-top:24px;"><a href="https://bulbiz2.lovable.app/dossier/${dossier.id}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Voir le dossier</a></p>
                <p style="font-size:13px;color:#6b7280;margin-top:24px;">Email envoyé automatiquement par Bulbiz.</p>
              </div>`,
            });
          }
        }
      } catch (e) {
        console.error("Error notifying artisan:", e);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SELECT SLOT ──
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

      await supabase.from("appointment_slots").update({ selected_at: new Date().toISOString() }).eq("id", slot_id);
      await supabase.from("appointment_slots").update({ selected_at: null }).eq("dossier_id", dossier.id).neq("id", slot_id);

      const { count: totalSlots } = await supabase
        .from("appointment_slots")
        .select("id", { count: "exact", head: true })
        .eq("dossier_id", dossier.id);

      const isSingleSlot = (totalSlots ?? 0) <= 1;
      const slotDateFr = formatDateFr(slot.slot_date);
      const slotDateShort = new Date(slot.slot_date).toLocaleDateString("fr-FR");
      const timeRange = `${slot.time_start.slice(0,5)}–${slot.time_end.slice(0,5)}`;

      if (isSingleSlot) {
        await supabase.from("dossiers").update({
          appointment_status: "rdv_confirmed",
          status: "rdv_pris",
          status_changed_at: new Date().toISOString(),
          appointment_date: slot.slot_date,
          appointment_time_start: slot.time_start,
          appointment_time_end: slot.time_end,
          appointment_source: "client_selected",
          appointment_confirmed_at: new Date().toISOString(),
        }).eq("id", dossier.id);

        await supabase.from("historique").insert({
          dossier_id: dossier.id, user_id: null,
          action: "client_slot_selected",
          details: `Le client a confirmé le créneau du ${slotDateShort} ${timeRange}`,
        });

        await supabase.from("historique").insert({
          dossier_id: dossier.id, user_id: null,
          action: "rdv_confirmed",
          details: `Rendez-vous auto-confirmé : ${slotDateFr} ${timeRange}`,
        });

        // Send confirmation email + SMS
        const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", dossier.user_id).maybeSingle();
        const artisanName = profile?.company_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Votre artisan";
        const clientName = dossier.client_first_name || "Bonjour";

        const clientEmail = dossier.client_email;
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (clientEmail && resendKey) {
          try {
            const resend = new Resend(resendKey);
            await resend.emails.send({
              from: `${artisanName} <noreply@bulbiz.fr>`,
              to: [clientEmail],
              subject: `Rendez-vous confirmé avec ${artisanName}`,
              html: `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                <h2 style="color:#16a34a;">✅ Rendez-vous confirmé</h2>
                <p>Bonjour ${clientName},</p>
                <p>Votre rendez-vous avec <strong>${artisanName}</strong> est confirmé :</p>
                <p style="font-size:18px;font-weight:bold;margin:16px 0;">📅 ${slotDateFr} — 🕐 ${timeRange}</p>
                <p>En cas d'empêchement, merci de nous prévenir${profile?.phone ? ` au ${profile.phone}` : ""}.</p>
                ${profile?.email ? `<p style="font-size:13px;color:#374151;">Email : ${profile.email}</p>` : ""}
                ${profile?.phone ? `<p style="font-size:13px;color:#374151;">Tél : ${profile.phone}</p>` : ""}
                <br/><p>Cordialement,<br/>${artisanName}</p>
              </div>`,
            });
            await supabase.from("notification_logs").insert({
              dossier_id: dossier.id, event_type: "APPOINTMENT_CONFIRMED",
              channel: "email", recipient: clientEmail, status: "SENT",
            });
          } catch (e) { console.error("Email error on auto-confirm:", e); }
        }

        const clientPhone = dossier.client_phone;
        if (clientPhone) {
          const normalized = normalizePhone(clientPhone);
          if (normalized) {
            const sent = await sendSms(normalized,
              `✅ RDV confirmé avec ${artisanName} : ${slotDateFr} à ${timeRange}.${profile?.phone ? ` Contact : ${profile.phone}` : ""}`
            );
            if (sent) {
              await supabase.from("notification_logs").insert({
                dossier_id: dossier.id, event_type: "APPOINTMENT_CONFIRMED",
                channel: "sms", recipient: normalized, status: "SENT",
              });
            }
          }
        }

        return new Response(JSON.stringify({ success: true, auto_confirmed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        await supabase.from("dossiers").update({ appointment_status: "client_selected" }).eq("id", dossier.id);

        await supabase.from("historique").insert({
          dossier_id: dossier.id, user_id: null,
          action: "client_slot_selected",
          details: `Le client a choisi le créneau du ${slotDateShort} ${timeRange}`,
        });

        return new Response(JSON.stringify({ success: true, auto_confirmed: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("submit-client-form error:", err);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
