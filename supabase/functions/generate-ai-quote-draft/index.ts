// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

interface AiLineRaw {
  label: string;
  description?: string;
  qty: number;
  unit: string;
  estimated_price: number;
  vat_rate?: number;
  type: "main_oeuvre" | "deplacement" | "materiel" | "fourniture" | "standard";
  rationale?: string;
}

interface AiPayload {
  title: string;
  summary: string;
  confidence: number;
  lines: AiLineRaw[];
  assumptions: string[];
  missing_questions: string[];
  variants?: { label: string; description?: string; lines: AiLineRaw[] }[];
}

function normLabel(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

Deno.Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const dossier_id = body?.dossier_id as string | undefined;
    const quote_id = (body?.quote_id as string | null) ?? null;
    if (!dossier_id) {
      return new Response(JSON.stringify({ error: "dossier_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Load dossier (own)
    const { data: dossier, error: dossierErr } = await admin
      .from("dossiers")
      .select(
        "id, user_id, category, urgency, description, address, client_first_name, client_last_name, problem_types, trade_types, housing_type, floor_number, has_elevator, occupant_type, access_code, availability",
      )
      .eq("id", dossier_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (dossierErr || !dossier) {
      return new Response(JSON.stringify({ error: "Dossier introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Load notes (historique notes) + medias counts
    const { data: notes } = await admin
      .from("historique")
      .select("action, details, created_at")
      .eq("dossier_id", dossier_id)
      .order("created_at", { ascending: false })
      .limit(40);

    const { data: medias } = await admin
      .from("medias")
      .select("media_category")
      .eq("dossier_id", dossier_id);

    // 3) Load 5 latest quotes for learning context
    const { data: pastQuotes } = await admin
      .from("quotes")
      .select("quote_number, total_ht, items, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    // 4) Load artisan catalog (top 60 most relevant by category if any)
    const { data: catalog } = await admin
      .from("catalog_material")
      .select("id, label, type, unit, unit_price, vat_rate, tags, synonyms, category_path")
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .limit(400);

    const mediaCount = (medias ?? []).length;
    const noteText = (notes ?? [])
      .filter((n) => n.action === "note_added" || n.details)
      .slice(0, 20)
      .map((n) => `- ${n.details ?? n.action}`)
      .join("\n");

    const pastSummaries = (pastQuotes ?? [])
      .map((q: any) => {
        const lines = Array.isArray(q.items) ? q.items.slice(0, 4).map((i: any) => i?.label).filter(Boolean).join(", ") : "";
        return `- ${q.quote_number} (${Number(q.total_ht ?? 0).toFixed(0)}€) : ${lines}`;
      })
      .join("\n");

    // 5) Call Lovable AI with structured tool calling
    const systemPrompt = `Tu es un expert artisan plombier/BTP français.
À partir d'un dossier client (texte, contexte, historique), tu proposes un PRÉ-DEVIS structuré et réaliste.
Règles strictes:
- Utilise des prix HT typiques du marché français pour la plomberie/BTP.
- Les lignes "main_oeuvre" sont en heures (h), prix horaire 55-75€.
- Les lignes "deplacement" sont en forfait, 30-50€.
- TVA: 10% pour rénovation logement >2 ans, 20% pour neuf/matériel, 5.5% pour économie d'énergie.
- Si le dossier manque d'infos critiques, mets-les dans missing_questions et baisse la confidence.
- Confidence 0.8+ si dossier riche, 0.4-0.7 si moyen, <0.4 si très pauvre.
- Propose 1-2 variantes uniquement si pertinent (ex: réparation vs remplacement).`;

    const userPrompt = `DOSSIER:
- Catégorie: ${dossier.category}
- Urgence: ${dossier.urgency}
- Métiers: ${(dossier.trade_types ?? []).join(", ") || "—"}
- Types de problème: ${(dossier.problem_types ?? []).join(", ") || "—"}
- Description: ${dossier.description ?? "—"}
- Logement: ${dossier.housing_type ?? "—"}, étage ${dossier.floor_number ?? "?"}, ascenseur: ${dossier.has_elevator ?? "?"}
- Occupant: ${dossier.occupant_type ?? "—"}
- Adresse: ${dossier.address ?? "—"}
- Médias joints: ${mediaCount}

NOTES & ÉCHANGES:
${noteText || "(aucune note)"}

HISTORIQUE DES 5 DERNIERS DEVIS DE L'ARTISAN (référence de prix/structure):
${pastSummaries || "(aucun)"}

Génère un pré-devis pour ce dossier.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "propose_quote",
              description: "Retourne un pré-devis structuré",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  summary: { type: "string" },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                  lines: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string" },
                        description: { type: "string" },
                        qty: { type: "number" },
                        unit: { type: "string" },
                        estimated_price: { type: "number" },
                        vat_rate: { type: "number" },
                        type: { type: "string", enum: ["main_oeuvre", "deplacement", "materiel", "fourniture", "standard"] },
                        rationale: { type: "string" },
                      },
                      required: ["label", "qty", "unit", "estimated_price", "type"],
                    },
                  },
                  assumptions: { type: "array", items: { type: "string" } },
                  missing_questions: { type: "array", items: { type: "string" } },
                  variants: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string" },
                        description: { type: "string" },
                        lines: { type: "array", items: { type: "object" } },
                      },
                    },
                  },
                },
                required: ["title", "summary", "confidence", "lines", "assumptions", "missing_questions"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "propose_quote" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "429 Trop de requêtes" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "402 Crédits IA épuisés" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: `AI ${aiResp.status}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Réponse IA invalide" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const payload: AiPayload = JSON.parse(toolCall.function.arguments);

    // 6) Hybrid pricing: match catalog
    const catalogList = catalog ?? [];
    function matchCatalog(line: AiLineRaw) {
      const target = normLabel(line.label);
      if (!target) return null;
      let best: any = null;
      let bestScore = 0;
      for (const c of catalogList) {
        const cl = normLabel(c.label);
        let score = 0;
        if (cl === target) score = 1;
        else if (cl.includes(target) || target.includes(cl)) score = 0.7;
        else {
          const tokens = target.split(/\s+/).filter(Boolean);
          const matches = tokens.filter((t) => cl.includes(t)).length;
          if (tokens.length) score = matches / tokens.length * 0.6;
        }
        // tags / synonyms boost
        const syns = [...(c.synonyms ?? []), ...(c.tags ?? [])].map(normLabel);
        if (syns.some((s) => s && (s === target || target.includes(s)))) score += 0.2;
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
      return bestScore >= 0.55 ? best : null;
    }

    let catalog_match_count = 0;
    let ai_fallback_count = 0;

    const enrichLines = (rawLines: AiLineRaw[]) =>
      rawLines.map((l, idx) => {
        const cat = matchCatalog(l);
        const useCatalog = !!cat && cat.unit_price != null && Number(cat.unit_price) > 0;
        if (useCatalog) catalog_match_count++; else ai_fallback_count++;
        return {
          ref: `ai-${Date.now()}-${idx}`,
          label: useCatalog ? cat.label : l.label,
          description: l.description ?? "",
          qty: l.qty,
          unit: useCatalog ? (cat.unit ?? l.unit) : l.unit,
          unit_price: useCatalog ? Number(cat.unit_price) : l.estimated_price,
          vat_rate: l.vat_rate ?? (useCatalog ? Number(cat.vat_rate ?? 10) : 10),
          type: l.type,
          source: useCatalog ? "catalog" : "ai_fallback",
          catalog_item_id: useCatalog ? cat.id : null,
          rationale: l.rationale ?? null,
        };
      });

    const lines = enrichLines(payload.lines ?? []);
    const variants = (payload.variants ?? []).map((v) => ({
      label: v.label,
      description: v.description,
      lines: enrichLines(v.lines as AiLineRaw[] ?? []),
    }));

    // 7) Insert log
    const { data: logRow, error: logErr } = await admin
      .from("ai_quote_suggestions_log")
      .insert({
        user_id: user.id,
        dossier_id,
        quote_id,
        status: "proposed",
        confidence: payload.confidence,
        catalog_match_count,
        ai_fallback_count,
        suggestion_payload: {
          title: payload.title,
          summary: payload.summary,
          lines,
          variants,
          assumptions: payload.assumptions ?? [],
          missing_questions: payload.missing_questions ?? [],
        },
      })
      .select("id")
      .single();

    if (logErr) {
      console.error("log insert failed", logErr);
    }

    const result = {
      log_id: logRow?.id ?? "",
      title: payload.title,
      summary: payload.summary,
      confidence: payload.confidence,
      lines,
      variants,
      assumptions: payload.assumptions ?? [],
      missing_questions: payload.missing_questions ?? [],
      catalog_match_count,
      ai_fallback_count,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-ai-quote-draft error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
