import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Convert a file_type to a MIME type suitable for Gemini
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

    // Fetch dossier + historique + quotes + invoices + medias in parallel
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

    // Download audio files as base64 (limit to 3 most recent, max 5MB each)
    const audioMedias = mediasRes.data || [];
    const audioContentParts: Array<{ type: string; image_url?: { url: string }; text?: string }> = [];

    if (audioMedias.length > 0) {
      const downloads = audioMedias.slice(0, 3).map(async (media) => {
        try {
          const audioUrl = media.file_url.startsWith("http")
            ? media.file_url
            : `${supabaseUrl}/storage/v1/object/public/dossier-medias/${media.file_url}`;

          const resp = await fetch(audioUrl);
          if (!resp.ok) {
            console.error(`Failed to download audio ${media.file_name}: ${resp.status}`);
            return null;
          }

          const blob = await resp.arrayBuffer();
          // Skip files > 5MB to avoid timeouts
          if (blob.byteLength > 5 * 1024 * 1024) {
            console.log(`Skipping large audio file ${media.file_name} (${blob.byteLength} bytes)`);
            return null;
          }

          const base64 = btoa(String.fromCharCode(...new Uint8Array(blob)));
          const mimeType = toMimeType(media.file_type);

          return {
            name: media.file_name,
            date: media.created_at,
            base64,
            mimeType,
          };
        } catch (e) {
          console.error(`Error downloading audio ${media.file_name}:`, e);
          return null;
        }
      });

      const results = await Promise.all(downloads);

      for (const result of results) {
        if (result) {
          audioContentParts.push({
            type: "text",
            text: `[Note vocale "${result.name}" du ${result.date.slice(0, 16)}] :`,
          });
          audioContentParts.push({
            type: "image_url",
            image_url: {
              url: `data:${result.mimeType};base64,${result.base64}`,
            },
          });
        }
      }
    }

    // Build text context
    const context = `
DOSSIER #${d.id.slice(0, 8)}
Client: ${[d.client_first_name, d.client_last_name].filter(Boolean).join(" ") || "Non renseigné"}
Email: ${d.client_email || "Non renseigné"} | Tél: ${d.client_phone || "Non renseigné"}
Adresse: ${d.address || "Non renseignée"}
Catégorie problème: ${d.category} | Urgence: ${d.urgency}
Description client: ${d.description || "Aucune description"}
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
`.trim();

    const hasAudio = audioContentParts.length > 0;

    // Build user message content - multimodal if audio present
    const userContent: any = hasAudio
      ? [
          { type: "text", text: context },
          { type: "text", text: "\n\nNOTES VOCALES DE L'ARTISAN (écoute et intègre le contenu dans le résumé) :" },
          ...audioContentParts,
        ]
      : context;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Tu es l'assistant IA d'un plombier artisan. Tu dois générer un résumé intelligent et actionnable d'un dossier client.

Règles:
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
${hasAudio ? `- Des notes vocales de l'artisan sont jointes. ÉCOUTE-LES ATTENTIVEMENT et intègre les informations clés qu'elles contiennent dans les bullets du résumé (observations terrain, diagnostic, détails techniques, etc.)
- Si une note vocale contient des infos sur le problème, le diagnostic ou les travaux à faire, ajoute-les en priorité dans les bullets` : ""}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response (handle markdown code blocks)
    let parsed;
    try {
      const jsonStr = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = { headline: "Résumé indisponible", bullets: [rawContent.slice(0, 100)], next_action: "" };
    }

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
