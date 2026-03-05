import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function toMimeType(fileType: string): string {
  if (fileType.includes("webm")) return "audio/webm";
  if (fileType.includes("mp4") || fileType.includes("m4a")) return "audio/mp4";
  if (fileType.includes("ogg")) return "audio/ogg";
  if (fileType.includes("wav")) return "audio/wav";
  if (fileType.includes("mp3") || fileType.includes("mpeg")) return "audio/mpeg";
  return fileType.startsWith("audio/") ? fileType : "audio/webm";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { dossier_id } = await req.json();
    if (!dossier_id) throw new Error("dossier_id requis");

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader ?? "" } } }
    );

    // Fetch all data in parallel
    const [dossierRes, histRes, quotesRes, invoicesRes, slotsRes, mediasRes] = await Promise.all([
      supabase.from("dossiers").select("*").eq("id", dossier_id).single(),
      supabase.from("historique").select("action, details, created_at").eq("dossier_id", dossier_id).order("created_at", { ascending: false }).limit(15),
      supabase.from("quotes").select("quote_number, status, total_ttc, sent_at, signed_at").eq("dossier_id", dossier_id),
      supabase.from("invoices").select("invoice_number, status, total_ttc, sent_at, paid_at").eq("dossier_id", dossier_id),
      supabase.from("appointment_slots").select("slot_date, time_start, time_end, selected_at").eq("dossier_id", dossier_id),
      supabase.from("medias").select("file_url, file_type, file_name, created_at, media_category")
        .eq("dossier_id", dossier_id)
        .like("file_type", "audio/%")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    if (dossierRes.error) throw dossierRes.error;
    const d = dossierRes.data;

    // Download audio files as base64
    const audioMedias = mediasRes.data || [];
    const audioContentParts: Array<{ type: string; image_url?: { url: string }; text?: string }> = [];

    if (audioMedias.length > 0) {
      const downloads = audioMedias.slice(0, 3).map(async (media) => {
        try {
          const audioUrl = media.file_url.startsWith("http")
            ? media.file_url
            : `${supabaseUrl}/storage/v1/object/public/dossier-medias/${media.file_url}`;

          const resp = await fetch(audioUrl);
          if (!resp.ok) return null;

          const blob = await resp.arrayBuffer();
          if (blob.byteLength > 5 * 1024 * 1024) return null;

          const base64 = base64Encode(new Uint8Array(blob));
          return { name: media.file_name, date: media.created_at, base64, mimeType: toMimeType(media.file_type) };
        } catch (e) {
          console.error(`Error downloading audio ${media.file_name}:`, e);
          return null;
        }
      });

      const results = await Promise.all(downloads);
      for (const result of results) {
        if (result) {
          audioContentParts.push({ type: "text", text: `[Note vocale "${result.name}" du ${result.date.slice(0, 16)}] :` });
          audioContentParts.push({ type: "image_url", image_url: { url: `data:${result.mimeType};base64,${result.base64}` } });
        }
      }
    }

    // Build empty fields list — only extract what's missing
    const emptyFields: string[] = [];
    if (!d.address) emptyFields.push("address");
    if (!d.address_line) emptyFields.push("address_line");
    if (!d.postal_code) emptyFields.push("postal_code");
    if (!d.city) emptyFields.push("city");
    if (!d.client_phone || d.client_phone === "00000") emptyFields.push("client_phone");
    if (!d.client_email) emptyFields.push("client_email");
    if (!d.client_first_name) emptyFields.push("client_first_name");
    if (!d.client_last_name) emptyFields.push("client_last_name");
    if (!d.description) emptyFields.push("description");
    if (!d.housing_type) emptyFields.push("housing_type");
    if (!d.floor_number && d.floor_number !== 0) emptyFields.push("floor_number");
    if (!d.access_code) emptyFields.push("access_code");
    if (!d.availability) emptyFields.push("availability");

    const hasAudio = audioContentParts.length > 0;
    const hasEmptyFields = emptyFields.length > 0 && hasAudio;

    // Build text context
    const context = `
DOSSIER #${d.id.slice(0, 8)}
Client: ${[d.client_first_name, d.client_last_name].filter(Boolean).join(" ") || "Non renseigné"}
Email: ${d.client_email || "Non renseigné"} | Tél: ${d.client_phone || "Non renseigné"}
Adresse: ${d.address || "Non renseignée"}
Adresse ligne: ${d.address_line || "Non renseignée"} | CP: ${d.postal_code || "?"} | Ville: ${d.city || "?"}
Catégorie problème: ${d.category} | Urgence: ${d.urgency}
Description client: ${d.description || "Aucune description"}
Type logement: ${d.housing_type || "Non renseigné"} | Étage: ${d.floor_number ?? "?"} | Code accès: ${d.access_code || "?"}
Source: ${d.source} | Statut: ${d.status}
Statut RDV: ${d.appointment_status}${d.appointment_date ? ` | Date RDV: ${d.appointment_date} ${(d.appointment_time_start || "").slice(0, 5)}-${(d.appointment_time_end || "").slice(0, 5)}` : ""}
Créé le: ${d.created_at} | Dernière mise à jour: ${d.updated_at}
Relances: ${d.relance_count} envoyée(s)

DEVIS (${quotesRes.data?.length || 0}):
${(quotesRes.data || []).map(q => `- ${q.quote_number}: ${q.status}, ${q.total_ttc ?? 0}€ TTC${q.sent_at ? ", envoyé" : ""}${q.signed_at ? ", signé" : ""}`).join("\n") || "Aucun devis"}

FACTURES (${invoicesRes.data?.length || 0}):
${(invoicesRes.data || []).map(f => `- ${f.invoice_number}: ${f.status}, ${f.total_ttc ?? 0}€ TTC${f.paid_at ? ", payée" : ""}`).join("\n") || "Aucune facture"}

CRÉNEAUX PROPOSÉS (${slotsRes.data?.length || 0}):
${(slotsRes.data || []).map(s => `- ${s.slot_date} ${s.time_start.slice(0, 5)}-${s.time_end.slice(0, 5)}${s.selected_at ? " ✅ sélectionné" : ""}`).join("\n") || "Aucun"}

HISTORIQUE RÉCENT:
${(histRes.data || []).map(h => `- ${h.action}: ${h.details || ""} (${h.created_at.slice(0, 16)})`).join("\n") || "Aucun"}

${hasEmptyFields ? `\nCHAMPS MANQUANTS À EXTRAIRE DES NOTES VOCALES: ${emptyFields.join(", ")}` : ""}
`.trim();

    const userContent: any = hasAudio
      ? [
          { type: "text", text: context },
          { type: "text", text: "\n\nNOTES VOCALES DE L'ARTISAN (écoute et intègre le contenu dans le résumé + extrais les informations manquantes) :" },
          ...audioContentParts,
        ]
      : context;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Build tools for structured extraction
    const tools = hasEmptyFields ? [
      {
        type: "function",
        function: {
          name: "update_dossier_fields",
          description: "Met à jour les champs manquants du dossier avec les informations extraites des notes vocales. N'appelle cette fonction QUE si tu as trouvé des informations concrètes dans les notes vocales. Ne devine pas, n'invente pas.",
          parameters: {
            type: "object",
            properties: {
              address: { type: "string", description: "Adresse complète (ex: 11 rue Brigadier Voituret, 69007 Lyon)" },
              address_line: { type: "string", description: "Numéro et rue uniquement (ex: 11 rue Brigadier Voituret)" },
              postal_code: { type: "string", description: "Code postal (ex: 69007)" },
              city: { type: "string", description: "Ville (ex: Lyon)" },
              client_phone: { type: "string", description: "Numéro de téléphone du client (format français)" },
              client_email: { type: "string", description: "Email du client" },
              client_first_name: { type: "string", description: "Prénom du client" },
              client_last_name: { type: "string", description: "Nom de famille du client" },
              description: { type: "string", description: "Description du problème / intervention (résumé structuré de ce qui a été dit dans les notes vocales)" },
              housing_type: { type: "string", description: "Type de logement (appartement, maison, commerce, etc.)" },
              floor_number: { type: "integer", description: "Numéro d'étage" },
              access_code: { type: "string", description: "Code d'accès / digicode" },
              availability: { type: "string", description: "Disponibilités du client" },
            },
            required: [],
            additionalProperties: false,
          },
        },
      },
    ] : undefined;

    const systemPrompt = `Tu es l'assistant IA d'un plombier artisan. Tu dois générer un résumé intelligent et actionnable d'un dossier client.

Règles pour le résumé:
- Réponds en JSON avec exactement ce format: {"headline": "...", "bullets": ["...", "...", ...], "next_action": "..."}
- headline: phrase courte (max 15 mots) résumant la situation actuelle du dossier
- bullets: 3 à 5 points clés sur le problème, le client, et l'avancement (max 20 mots chacun)
- next_action: la prochaine action recommandée pour l'artisan (max 20 mots)
- Sois concis, utile, orienté action
- Utilise un ton professionnel mais accessible
- Mentionne les infos manquantes si pertinent (tel, adresse, etc.)
- Adapte ton résumé au statut du dossier (nouveau → qualifier, devis envoyé → relancer, etc.)
- IGNORE les erreurs techniques dans l'historique (ex: "Impossible d'envoyer SMS", "erreur notification", etc.) — ne les mentionne jamais dans le résumé
- Ne répète pas les labels bruts, reformule intelligemment
- Ne suggère JAMAIS "écouter la note vocale" ou "réécouter les notes" comme action — tu les as déjà écoutées et intégrées dans le résumé
- Les next_action doivent être des actions concrètes de l'artisan envers le client ou le chantier (ex: "Appeler le client", "Planifier l'intervention", "Envoyer le devis")
${hasAudio ? `- Des notes vocales de l'artisan sont jointes. ÉCOUTE-LES ATTENTIVEMENT et intègre les informations clés dans les bullets du résumé
- Si une note vocale contient des infos sur le problème, le diagnostic ou les travaux à faire, ajoute-les en priorité dans les bullets` : ""}
${hasEmptyFields ? `
Règles pour l'extraction des champs:
- Si tu trouves dans les notes vocales des informations correspondant aux CHAMPS MANQUANTS listés, appelle la fonction update_dossier_fields avec UNIQUEMENT les champs que tu as trouvés
- Ne remplis QUE les champs pour lesquels tu as une information CLAIRE et EXPLICITE dans les notes vocales
- N'invente RIEN, ne devine RIEN
- Pour description: fais un résumé structuré et professionnel de ce que l'artisan a dit (problème, diagnostic, travaux à faire)
- Pour l'adresse: décompose-la en address (complète), address_line (rue), postal_code, city
- Pour le téléphone: format français avec indicatif si possible` : ""}`;

    const aiRequestBody: any = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
    };

    if (tools) {
      aiRequestBody.tools = tools;
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(aiRequestBody),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const choice = aiData.choices?.[0];
    const rawContent = choice?.message?.content || "";
    const toolCalls = choice?.message?.tool_calls || [];

    // Parse summary JSON
    let parsed;
    try {
      const jsonStr = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = { headline: "Résumé indisponible", bullets: [rawContent.slice(0, 100)], next_action: "" };
    }

    // Process tool calls — update dossier with extracted fields
    let updatedFields: string[] = [];
    for (const tc of toolCalls) {
      if (tc.function?.name === "update_dossier_fields") {
        try {
          const args = JSON.parse(tc.function.arguments);
          
          // Only update fields that are actually empty in the dossier
          const updatePayload: Record<string, any> = {};
          const fieldLabels: Record<string, string> = {
            address: "Adresse",
            address_line: "Rue",
            postal_code: "Code postal",
            city: "Ville",
            client_phone: "Téléphone",
            client_email: "Email",
            client_first_name: "Prénom",
            client_last_name: "Nom",
            description: "Description",
            housing_type: "Type logement",
            floor_number: "Étage",
            access_code: "Code accès",
            availability: "Disponibilités",
          };

          for (const [key, value] of Object.entries(args)) {
            if (value !== null && value !== undefined && value !== "" && emptyFields.includes(key)) {
              updatePayload[key] = value;
              updatedFields.push(fieldLabels[key] || key);
            }
          }

          if (Object.keys(updatePayload).length > 0) {
            console.log("Auto-updating dossier fields:", Object.keys(updatePayload));
            const { error: updateError } = await supabase
              .from("dossiers")
              .update(updatePayload)
              .eq("id", dossier_id);

            if (updateError) {
              console.error("Error updating dossier:", updateError);
            } else {
              // Log in historique
              await supabase.from("historique").insert({
                dossier_id,
                user_id: d.user_id,
                action: "ai_auto_fill",
                details: `IA : champs remplis automatiquement depuis notes vocales — ${updatedFields.join(", ")}`,
              });
            }
          }
        } catch (e) {
          console.error("Error processing tool call:", e);
        }
      }
    }

    // Add updated fields info to response
    parsed.auto_filled = updatedFields;

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("summarize-dossier error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
