import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function toAudioMime(fileType: string): string {
  if (fileType.includes("webm")) return "audio/webm";
  if (fileType.includes("mp4") || fileType.includes("m4a")) return "audio/mp4";
  if (fileType.includes("ogg")) return "audio/ogg";
  if (fileType.includes("wav")) return "audio/wav";
  if (fileType.includes("mp3") || fileType.includes("mpeg")) return "audio/mpeg";
  return fileType.startsWith("audio/") ? fileType : "audio/webm";
}

function toImageMime(fileType: string): string {
  if (fileType.includes("jpeg") || fileType.includes("jpg")) return "image/jpeg";
  if (fileType.includes("png")) return "image/png";
  if (fileType.includes("webp")) return "image/webp";
  if (fileType.includes("gif")) return "image/gif";
  if (fileType.includes("heic")) return "image/heic";
  return fileType.startsWith("image/") ? fileType : "image/jpeg";
}

function toVideoMime(fileType: string): string {
  if (fileType.includes("mp4")) return "video/mp4";
  if (fileType.includes("webm")) return "video/webm";
  if (fileType.includes("3gp")) return "video/3gpp";
  return fileType.startsWith("video/") ? fileType : "video/mp4";
}

interface MediaRecord {
  file_url: string;
  file_type: string;
  file_name: string;
  created_at: string;
  media_category: string;
}

async function downloadMediaAsBase64(
  media: MediaRecord,
  supabaseUrl: string,
  maxSizeMB: number
): Promise<{ base64: string; mimeType: string; name: string; date: string } | null> {
  try {
    const url = media.file_url.startsWith("http")
      ? media.file_url
      : `${supabaseUrl}/storage/v1/object/public/dossier-medias/${media.file_url}`;

    const resp = await fetch(url);
    if (!resp.ok) return null;

    const blob = await resp.arrayBuffer();
    if (blob.byteLength > maxSizeMB * 1024 * 1024) return null;

    const base64 = base64Encode(new Uint8Array(blob));
    return { base64, mimeType: media.file_type, name: media.file_name, date: media.created_at };
  } catch (e) {
    console.error(`Error downloading ${media.file_name}:`, e);
    return null;
  }
}

// For large files (videos), generate a signed URL instead of downloading
async function getSignedUrl(
  media: MediaRecord,
  supabase: any,
): Promise<{ signedUrl: string; mimeType: string; name: string; date: string } | null> {
  try {
    if (media.file_url.startsWith("http")) {
      return { signedUrl: media.file_url, mimeType: media.file_type, name: media.file_name, date: media.created_at };
    }
    const { data, error } = await supabase.storage
      .from("dossier-medias")
      .createSignedUrl(media.file_url, 600); // 10 min
    if (error || !data?.signedUrl) return null;
    return { signedUrl: data.signedUrl, mimeType: media.file_type, name: media.file_name, date: media.created_at };
  } catch (e) {
    console.error(`Error signing URL for ${media.file_name}:`, e);
    return null;
  }
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
    const [dossierRes, histRes, quotesRes, invoicesRes, slotsRes, audioMediasRes, imageMediasRes, videoMediasRes] = await Promise.all([
      supabase.from("dossiers").select("*").eq("id", dossier_id).single(),
      supabase.from("historique").select("action, details, created_at").eq("dossier_id", dossier_id).order("created_at", { ascending: false }).limit(15),
      supabase.from("quotes").select("quote_number, status, total_ttc, sent_at, signed_at, pdf_url, is_imported, items, notes").eq("dossier_id", dossier_id),
      supabase.from("invoices").select("invoice_number, status, total_ht, total_tva, total_ttc, sent_at, paid_at, pdf_url, notes").eq("dossier_id", dossier_id),
      supabase.from("appointment_slots").select("slot_date, time_start, time_end, selected_at").eq("dossier_id", dossier_id),
      supabase.from("medias").select("file_url, file_type, file_name, created_at, media_category")
        .eq("dossier_id", dossier_id).like("file_type", "audio/%").order("created_at", { ascending: false }).limit(3),
      supabase.from("medias").select("file_url, file_type, file_name, created_at, media_category")
        .eq("dossier_id", dossier_id).like("file_type", "image/%").order("created_at", { ascending: false }).limit(3),
      supabase.from("medias").select("file_url, file_type, file_name, file_size, created_at, media_category")
        .eq("dossier_id", dossier_id).like("file_type", "video/%").order("created_at", { ascending: false }).limit(2),
    ]);

    if (dossierRes.error) throw dossierRes.error;
    const d = dossierRes.data;

    const audioMedias = audioMediasRes.data || [];
    const imageMedias = imageMediasRes.data || [];
    const videoMedias = videoMediasRes.data || [];

    // Download images (max 2MB each) and audio (max 3MB each) — NO video downloads to avoid OOM
    const [audioResults, imageResults] = await Promise.all([
      Promise.all(audioMedias.map(m => downloadMediaAsBase64(m, supabaseUrl, 3))),
      Promise.all(imageMedias.map(m => downloadMediaAsBase64(m, supabaseUrl, 2))),
    ]);

    // Build multimodal content parts
    const mediaParts: Array<{ type: string; image_url?: { url: string }; text?: string }> = [];

    // Images
    const validImages = imageResults.filter(Boolean);
    if (validImages.length > 0) {
      mediaParts.push({ type: "text", text: `\n\n📷 PHOTOS DU DOSSIER (${validImages.length}) — Analyse visuellement chaque photo pour identifier le problème, l'état des installations, les dégâts visibles, le type d'équipement :` });
      for (const img of validImages) {
        if (!img) continue;
        const mime = toImageMime(img.mimeType);
        mediaParts.push({ type: "text", text: `[Photo "${img.name}" du ${img.date.slice(0, 16)}] :` });
        mediaParts.push({ type: "image_url", image_url: { url: `data:${mime};base64,${img.base64}` } });
      }
    }

    // Videos — metadata only (no download to avoid memory limit)
    const validVideos: any[] = []; // no actual video content
    if (videoMedias.length > 0) {
      const videoInfo = videoMedias.map((v: any) => `"${v.file_name}" (${v.file_size ? Math.round(v.file_size / 1024 / 1024) + ' MB' : 'taille inconnue'}, ${v.created_at.slice(0, 16)})`).join(", ");
      mediaParts.push({ type: "text", text: `\n\n🎥 VIDÉOS DISPONIBLES (${videoMedias.length}, non analysables automatiquement) : ${videoInfo}. Mentionne dans le résumé que des vidéos du chantier sont disponibles dans le dossier.` });
    }

    // Audio
    const validAudios = audioResults.filter(Boolean);
    if (validAudios.length > 0) {
      mediaParts.push({ type: "text", text: `\n\n🎙️ NOTES VOCALES (${validAudios.length}) — Écoute et intègre le contenu dans le résumé :` });
      for (const audio of validAudios) {
        if (!audio) continue;
        const mime = toAudioMime(audio.mimeType);
        mediaParts.push({ type: "text", text: `[Note vocale "${audio.name}" du ${audio.date.slice(0, 16)}] :` });
        mediaParts.push({ type: "image_url", image_url: { url: `data:${mime};base64,${audio.base64}` } });
      }
    }

    // Process quotes: items JSONB + PDF downloads
    const quotes = quotesRes.data || [];
    let quotesTextContext = "";
    let quotePdfCount = 0;

    // Format quote_lines items as readable text
    for (const q of quotes) {
      const items = q.items as any[] | null;
      if (items && Array.isArray(items) && items.length > 0) {
        quotesTextContext += `\nDÉTAIL DEVIS ${q.quote_number} :\n`;
        for (const item of items) {
          const label = item.label || item.designation || "?";
          const qty = item.qty ?? item.quantity ?? 1;
          const unit = item.unit || "u";
          const price = item.unit_price ?? item.unitPrice ?? 0;
          quotesTextContext += `  - ${label} × ${qty} ${unit} à ${price}€ HT\n`;
        }
        if (q.notes) quotesTextContext += `  Notes: ${q.notes}\n`;
      }
    }

    // Download imported quote PDFs (max 2, 5MB each)
    const importedWithPdf = quotes.filter(q => q.pdf_url).slice(0, 2);
    const pdfResults = await Promise.all(
      importedWithPdf.map(async (q) => {
        try {
          const url = q.pdf_url!.startsWith("http")
            ? q.pdf_url!
            : `${supabaseUrl}/storage/v1/object/public/dossier-medias/${q.pdf_url}`;
          const resp = await fetch(url);
          if (!resp.ok) return null;
          const blob = await resp.arrayBuffer();
          if (blob.byteLength > 5 * 1024 * 1024) return null;
          const b64 = base64Encode(new Uint8Array(blob));
          return { base64: b64, quoteNumber: q.quote_number };
        } catch (e) {
          console.error(`Error downloading PDF for ${q.quote_number}:`, e);
          return null;
        }
      })
    );

    const validPdfs = pdfResults.filter(Boolean);
    quotePdfCount = validPdfs.length;

    // Add PDF parts to multimodal content
    if (validPdfs.length > 0) {
      mediaParts.push({ type: "text", text: `\n\n📄 DEVIS PDF IMPORTÉS (${validPdfs.length}) — Analyse le contenu pour extraire matériel, prestations et infos techniques :` });
      for (const pdf of validPdfs) {
        if (!pdf) continue;
        mediaParts.push({ type: "text", text: `[Devis "${pdf.quoteNumber}"] :` });
        mediaParts.push({ type: "image_url", image_url: { url: `data:application/pdf;base64,${pdf.base64}` } });
      }
    }

    // Process invoices: fetch lines + PDF downloads
    const invoices = invoicesRes.data || [];
    let invoicesTextContext = "";
    let invoicePdfCount = 0;

    // Fetch invoice lines for all invoices
    const invoiceIds = invoices.map(i => i.invoice_number).length > 0 ? invoices.map(i => (i as any).id || "").filter(Boolean) : [];
    // We don't have invoice IDs directly, so fetch lines via a separate query if invoices exist
    if (invoices.length > 0) {
      // Get invoice IDs by querying again
      const { data: invoicesFull } = await supabase
        .from("invoices").select("id, invoice_number").eq("dossier_id", dossier_id);
      
      if (invoicesFull && invoicesFull.length > 0) {
        const ids = invoicesFull.map(i => i.id);
        const { data: lines } = await supabase
          .from("invoice_lines").select("label, qty, unit, unit_price, tva_rate, invoice_id")
          .in("invoice_id", ids).order("sort_order");
        
        if (lines && lines.length > 0) {
          const linesByInvoice = new Map<string, typeof lines>();
          for (const line of lines) {
            const arr = linesByInvoice.get(line.invoice_id) || [];
            arr.push(line);
            linesByInvoice.set(line.invoice_id, arr);
          }
          
          for (const inv of invoicesFull) {
            const invLines = linesByInvoice.get(inv.id);
            if (invLines && invLines.length > 0) {
              invoicesTextContext += `\nDÉTAIL FACTURE ${inv.invoice_number} :\n`;
              for (const l of invLines) {
                invoicesTextContext += `  - ${l.label} × ${l.qty} ${l.unit} à ${l.unit_price}€ HT (TVA ${l.tva_rate}%)\n`;
              }
            }
          }
        }
      }
    }

    // Add invoice notes
    for (const inv of invoices) {
      if (inv.notes) {
        invoicesTextContext += `  Notes ${inv.invoice_number}: ${inv.notes}\n`;
      }
    }

    // Download invoice PDFs (max 2, 5MB each)
    const invoicesWithPdf = invoices.filter(i => i.pdf_url).slice(0, 2);
    const invoicePdfResults = await Promise.all(
      invoicesWithPdf.map(async (inv) => {
        try {
          const url = inv.pdf_url!.startsWith("http")
            ? inv.pdf_url!
            : `${supabaseUrl}/storage/v1/object/public/dossier-medias/${inv.pdf_url}`;
          const resp = await fetch(url);
          if (!resp.ok) return null;
          const blob = await resp.arrayBuffer();
          if (blob.byteLength > 5 * 1024 * 1024) return null;
          const b64 = base64Encode(new Uint8Array(blob));
          return { base64: b64, invoiceNumber: inv.invoice_number };
        } catch (e) {
          console.error(`Error downloading PDF for ${inv.invoice_number}:`, e);
          return null;
        }
      })
    );

    const validInvoicePdfs = invoicePdfResults.filter(Boolean);
    invoicePdfCount = validInvoicePdfs.length;

    if (validInvoicePdfs.length > 0) {
      mediaParts.push({ type: "text", text: `\n\n🧾 FACTURES PDF (${validInvoicePdfs.length}) — Analyse le contenu pour extraire les détails de facturation :` });
      for (const pdf of validInvoicePdfs) {
        if (!pdf) continue;
        mediaParts.push({ type: "text", text: `[Facture "${pdf.invoiceNumber}"] :` });
        mediaParts.push({ type: "image_url", image_url: { url: `data:application/pdf;base64,${pdf.base64}` } });
      }
    }

    const hasInvoiceContent = invoicesTextContext.length > 0 || invoicePdfCount > 0;

    const hasMedia = mediaParts.length > 0;
    const hasAudio = validAudios.length > 0;
    const hasImages = validImages.length > 0;
    const hasVideoFiles = videoMedias.length > 0; // metadata only, no content
    const hasQuoteContent = quotesTextContext.length > 0 || quotePdfCount > 0;

    // Build empty fields list
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

    // Only allow extraction from media that is actually analyzed (images/audio)
    const hasEmptyFields = emptyFields.length > 0 && (hasAudio || hasImages);

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
${quotesTextContext}
FACTURES (${invoicesRes.data?.length || 0}):
${(invoicesRes.data || []).map(f => `- ${f.invoice_number}: ${f.status}, ${f.total_ht ?? 0}€ HT, TVA ${f.total_tva ?? 0}€, ${f.total_ttc ?? 0}€ TTC${f.paid_at ? ", payée" : ""}`).join("\n") || "Aucune facture"}
${invoicesTextContext}

CRÉNEAUX PROPOSÉS (${slotsRes.data?.length || 0}):
${(slotsRes.data || []).map(s => `- ${s.slot_date} ${s.time_start.slice(0, 5)}-${s.time_end.slice(0, 5)}${s.selected_at ? " ✅ sélectionné" : ""}`).join("\n") || "Aucun"}

HISTORIQUE RÉCENT:
${(histRes.data || []).map(h => `- ${h.action}: ${h.details || ""} (${h.created_at.slice(0, 16)})`).join("\n") || "Aucun"}

${hasEmptyFields ? `\nCHAMPS MANQUANTS À EXTRAIRE DES MÉDIAS: ${emptyFields.join(", ")}` : ""}
`.trim();

    const userContent: any = hasMedia
      ? [{ type: "text", text: context }, ...mediaParts]
      : context;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Build extraction schema
    const extractionSchema = hasEmptyFields ? `
  "extracted_fields": {
    // Uniquement les champs trouvés dans les médias parmi: ${emptyFields.join(", ")}
    // Ne remplis QUE les champs pour lesquels tu as une info CLAIRE et EXPLICITE
    // Clés possibles: address, address_line, postal_code, city, client_phone, client_email, client_first_name, client_last_name, description, housing_type, floor_number (integer), access_code, availability
  }` : "";

    // Build media analysis instructions
    const mediaInstructions: string[] = [];
    if (hasImages) {
      mediaInstructions.push(`- Des PHOTOS sont jointes. ANALYSE-LES visuellement pour identifier :
  * Le type de problème visible (fuite, casse, usure, corrosion, moisissure...)
  * Le type et la marque d'équipement si visible (robinet, chauffe-eau, WC, tuyauterie...)
  * L'état général de l'installation
  * Les dégâts visibles et leur gravité estimée
  * Tout détail utile pour préparer l'intervention (accès, espace de travail...)`);
    }
    if (hasVideoFiles) {
      mediaInstructions.push(`- Des VIDÉOS existent dans le dossier mais ne sont PAS analysées automatiquement.
  * N'invente AUCUN détail visuel/sonore issu des vidéos
  * Mentionne simplement que des vidéos sont disponibles dans le dossier`);
    }
    if (hasAudio) {
      mediaInstructions.push(`- Des NOTES VOCALES sont jointes. ÉCOUTE-LES et intègre les infos clés dans les bullets`);
    }
    if (hasQuoteContent) {
      mediaInstructions.push(`- Des DEVIS sont joints (PDF et/ou lignes détaillées). ANALYSE-LES pour identifier :
  * La liste complète du matériel avec marques, références et quantités
  * Les prestations prévues et leur durée estimée
  * Les informations techniques importantes (dimensions, puissance, normes...)
  * Le budget matériel vs main d'œuvre
  * Intègre ces infos dans les bullets pour aider l'artisan à préparer l'intervention`);
    }

    const systemPrompt = `Tu es l'assistant IA d'un plombier artisan. Tu dois générer un résumé intelligent et actionnable d'un dossier client.

Réponds UNIQUEMENT en JSON valide (pas de markdown, pas de backticks) avec ce format:
{
  "headline": "phrase courte max 15 mots résumant la situation",
  "bullets": ["point 1", "point 2", "point 3"],
  "next_action": "prochaine action recommandée max 20 mots"${hasEmptyFields ? ',' + extractionSchema : ''}
}

Règles:
- headline: max 15 mots, situation actuelle
- bullets: 3 à 6 points clés (max 20 mots chacun)
- next_action: action concrète pour l'artisan (jamais "écouter la note vocale" ou "regarder la photo")
- Sois concis, utile, orienté action
- IGNORE les erreurs techniques dans l'historique
- Ne répète pas les labels bruts, reformule intelligemment
- Les next_action doivent être des actions concrètes (ex: "Appeler le client", "Planifier l'intervention")
${mediaInstructions.join("\n")}
${hasMedia ? `- Intègre les observations des médias dans les bullets (ex: "Fuite visible sous l'évier — corrosion avancée du siphon")` : ""}
${hasEmptyFields ? `- Pour extracted_fields: n'invente RIEN, ne devine RIEN, uniquement ce qui est EXPLICITEMENT visible ou dit dans les médias
- Pour description: résumé structuré du problème/diagnostic/travaux basé sur TOUS les médias
- Pour l'adresse: décompose en address (complète), address_line (rue), postal_code, city
- Pour le téléphone: format français
- Pour housing_type: déduis du contexte visuel si possible (appartement, maison, etc.)` : ""}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON response
    let parsed;
    try {
      const jsonStr = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = { headline: rawContent.slice(0, 80) || "Résumé en cours de traitement", bullets: [], next_action: "" };
    }

    // Process extracted fields if present
    let updatedFields: string[] = [];
    if (parsed.extracted_fields && typeof parsed.extracted_fields === "object") {
      const args = parsed.extracted_fields;
      const updatePayload: Record<string, any> = {};
      const fieldLabels: Record<string, string> = {
        address: "Adresse", address_line: "Rue", postal_code: "Code postal", city: "Ville",
        client_phone: "Téléphone", client_email: "Email", client_first_name: "Prénom",
        client_last_name: "Nom", description: "Description", housing_type: "Type logement",
        floor_number: "Étage", access_code: "Code accès", availability: "Disponibilités",
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
          .from("dossiers").update(updatePayload).eq("id", dossier_id);

        if (updateError) {
          console.error("Error updating dossier:", updateError);
        } else {
          const sourceLabel = [hasImages && "photos", hasVideos && "vidéos", hasAudio && "notes vocales", hasQuoteContent && "devis", hasInvoiceContent && "factures"].filter(Boolean).join(", ");
          await supabase.from("historique").insert({
            dossier_id, user_id: d.user_id, action: "ai_auto_fill",
            details: `IA : champs remplis automatiquement depuis ${sourceLabel} — ${updatedFields.join(", ")}`,
          });
        }
      }
      delete parsed.extracted_fields;
    }

    parsed.auto_filled = updatedFields;
    parsed.media_analyzed = {
      images: validImages.length,
      videos: videoMedias.length, // metadata only, not analyzed
      audio: validAudios.length,
      quotes: quotePdfCount + (quotesTextContext.length > 0 ? quotes.filter(q => q.items && Array.isArray(q.items) && (q.items as any[]).length > 0).length : 0),
      invoices: invoicePdfCount + (invoicesTextContext.length > 0 ? 1 : 0),
    };

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
