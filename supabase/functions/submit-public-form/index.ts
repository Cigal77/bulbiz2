import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Gmail helpers ──
async function refreshGmailToken(supabase: any, userId: string, connection: any): Promise<string | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret || !connection.refresh_token) return null;
  try {
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: connection.refresh_token, grant_type: "refresh_token" }),
    });
    const data = await resp.json();
    if (!resp.ok) return null;
    await supabase.from("gmail_connections").update({ access_token: data.access_token, token_expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString() }).eq("user_id", userId);
    return data.access_token;
  } catch { return null; }
}

async function sendViaGmail(accessToken: string, from: string, to: string, subject: string, html: string): Promise<boolean> {
  const message = [`From: ${from}`, `To: ${to}`, `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`, `MIME-Version: 1.0`, `Content-Type: text/html; charset=UTF-8`, ``, html].join("\r\n");
  const raw = btoa(unescape(encodeURIComponent(message))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw }) });
  if (!resp.ok) { console.error("Gmail API error:", await resp.text()); return false; }
  await resp.json();
  return true;
}

async function getGmailConnection(supabase: any, userId: string) {
  const { data: conn } = await supabase.from("gmail_connections").select("*").eq("user_id", userId).maybeSingle();
  if (!conn) return null;
  if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
    const newToken = await refreshGmailToken(supabase, userId, conn);
    if (newToken) { conn.access_token = newToken; } else { return null; }
  }
  return conn;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { slug, data, media_urls, rgpd_consent } = await req.json();

    if (!slug || !data) {
      return new Response(JSON.stringify({ error: "Missing slug or data" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!rgpd_consent) {
      return new Response(JSON.stringify({ error: "RGPD consent required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find artisan by slug
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("public_client_slug", slug)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Artisan not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = profile.user_id;

    // Check for existing dossier with same email or phone (duplicate detection)
    let existingDossier = null;
    if (data.client_email || data.client_phone) {
      const query = supabase
        .from("dossiers")
        .select("id, client_first_name, client_last_name, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (data.client_email) {
        const { data: emailMatch } = await query.eq("client_email", data.client_email);
        if (emailMatch?.length) existingDossier = emailMatch[0];
      }
      if (!existingDossier && data.client_phone) {
        const { data: phoneMatch } = await supabase
          .from("dossiers")
          .select("id, client_first_name, client_last_name, created_at")
          .eq("user_id", userId)
          .eq("client_phone", data.client_phone)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1);
        if (phoneMatch?.length) existingDossier = phoneMatch[0];
      }
    }

    // Create dossier
    const dossierData: Record<string, any> = {
      user_id: userId,
      client_first_name: data.client_first_name?.trim() || null,
      client_last_name: data.client_last_name?.trim() || null,
      client_phone: data.client_phone?.trim() || null,
      client_email: data.client_email?.trim() || null,
      address: data.address?.trim() || null,
      address_line: data.address_line?.trim() || null,
      postal_code: data.postal_code?.trim() || null,
      city: data.city?.trim() || null,
      country: data.country?.trim() || "France",
      google_place_id: data.google_place_id || null,
      lat: data.lat || null,
      lng: data.lng || null,
      description: data.description?.trim() || null,
      category: data.category || "autre",
      urgency: data.urgency || "semaine",
      source: "public_link",
      status: "nouveau",
      trade_types: data.trade_types || [],
      problem_types: data.problem_types || [],
      housing_type: data.housing_type || null,
      occupant_type: data.occupant_type || null,
      floor_number: data.floor_number || null,
      has_elevator: data.has_elevator ?? null,
      access_code: data.access_code || null,
      availability: data.availability || null,
    };

    const { data: newDossier, error: insertError } = await supabase
      .from("dossiers")
      .insert(dossierData)
      .select("id")
      .single();

    if (insertError) {
      console.error("Dossier insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to create dossier" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const dossierId = newDossier.id;

    // Insert medias if any
    if (media_urls?.length) {
      const mediaInserts = media_urls.map((url: string, i: number) => ({
        dossier_id: dossierId,
        user_id: userId,
        file_url: url,
        file_name: `public-upload-${i + 1}`,
        file_type: url.match(/\.(mp4|mov)/) ? "video/mp4" : "image/jpeg",
        media_category: url.match(/\.(mp4|mov)/) ? "video" : "image",
      }));
      await supabase.from("medias").insert(mediaInserts);
    }

    // Log historique
    await supabase.from("historique").insert({
      dossier_id: dossierId,
      action: "Dossier créé via lien public",
      details: `Client: ${data.client_first_name || ""} ${data.client_last_name || ""} - Source: lien public`,
    });

    // Auto-advance status if we have enough info
    const hasContact = data.client_email || data.client_phone;
    const hasDescription = data.description?.trim();
    if (hasContact && hasDescription) {
      await supabase.from("dossiers").update({ status: "devis_a_faire", status_changed_at: new Date().toISOString() }).eq("id", dossierId);
    }

    // ── Send emails ──
    const origin = req.headers.get("origin") || "https://app.bulbiz.io";
    const clientName = [data.client_first_name, data.client_last_name].filter(Boolean).join(" ") || "Client";
    const artisanName = profile.company_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Votre artisan";

    // Email to artisan
    const artisanEmailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#1a1a1a;">🔔 Nouvelle demande client</h2>
        <p>Un nouveau dossier a été créé via votre lien public.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Client</td><td style="padding:8px;border-bottom:1px solid #eee;">${clientName}</td></tr>
          ${data.client_phone ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Téléphone</td><td style="padding:8px;border-bottom:1px solid #eee;">${data.client_phone}</td></tr>` : ""}
          ${data.client_email ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;">${data.client_email}</td></tr>` : ""}
          ${data.address ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Adresse</td><td style="padding:8px;border-bottom:1px solid #eee;">${data.address}</td></tr>` : ""}
          ${data.description ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Description</td><td style="padding:8px;border-bottom:1px solid #eee;">${data.description}</td></tr>` : ""}
          ${media_urls?.length ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Médias</td><td style="padding:8px;border-bottom:1px solid #eee;">${media_urls.length} fichier(s)</td></tr>` : ""}
        </table>
        <a href="${origin}/dossier/${dossierId}" style="display:inline-block;background:#f59e0b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Voir le dossier</a>
      </div>
    `;

    // Send to artisan via Gmail or Resend
    if (profile.email) {
      const gmailConn = await getGmailConnection(supabase, userId);
      if (gmailConn) {
        await sendViaGmail(gmailConn.access_token, gmailConn.gmail_address, profile.email, `Nouvelle demande : ${clientName}`, artisanEmailHtml);
      } else {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (resendKey) {
          const resend = new Resend(resendKey);
          await resend.emails.send({
            from: "Bulbiz <notifications@bulbiz.io>",
            to: profile.email,
            subject: `Nouvelle demande : ${clientName}`,
            html: artisanEmailHtml,
          });
        }
      }
    }

    // Email to client
    if (data.client_email) {
      const clientEmailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2 style="color:#1a1a1a;">✅ Votre demande a bien été envoyée</h2>
          <p>Bonjour ${data.client_first_name || ""},</p>
          <p>Votre demande a été transmise à <strong>${artisanName}</strong>.</p>
          <p>Voici un résumé :</p>
          <ul style="padding-left:20px;">
            ${data.description ? `<li>${data.description}</li>` : ""}
            ${data.address ? `<li>Adresse : ${data.address}</li>` : ""}
            ${media_urls?.length ? `<li>${media_urls.length} photo(s)/vidéo(s) jointe(s)</li>` : ""}
          </ul>
          <p>${artisanName} reviendra vers vous rapidement.</p>
          <p style="color:#888;font-size:12px;margin-top:24px;">Ce message a été envoyé via Bulbiz.</p>
        </div>
      `;

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        const resend = new Resend(resendKey);
        await resend.emails.send({
          from: `${artisanName} via Bulbiz <notifications@bulbiz.io>`,
          to: data.client_email,
          subject: "Votre demande a bien été envoyée",
          html: clientEmailHtml,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dossier_id: dossierId,
        existing_dossier: existingDossier,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("submit-public-form error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
