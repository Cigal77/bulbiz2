import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface QuoteItem {
  label: string;
  description?: string;
  qty: number;
  unit: string;
  unit_price: number;
  vat_rate: number;
  discount: number;
}

function calcLineTotal(item: QuoteItem): number {
  const base = item.qty * item.unit_price;
  return base - (base * (item.discount || 0)) / 100;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildHtml(
  profile: Record<string, unknown>,
  dossier: Record<string, unknown>,
  quote: Record<string, unknown>,
  items: QuoteItem[]
): string {
  const artisanName = (profile.company_name as string) ||
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Artisan";
  const clientName = [dossier.client_first_name, dossier.client_last_name].filter(Boolean).join(" ") || "Client";

  let totalHt = 0;
  let totalTva = 0;
  const rows = items.map((item) => {
    const lt = calcLineTotal(item);
    const tva = (lt * item.vat_rate) / 100;
    totalHt += lt;
    totalTva += tva;
    return `<tr>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">
        <div style="font-weight:500;">${escapeHtml(item.label)}</div>
        ${item.description ? `<div style="font-size:11px;color:#6b7280;">${escapeHtml(item.description)}</div>` : ""}
      </td>
      <td style="padding:8px;text-align:right;border-bottom:1px solid #e5e7eb;">${item.qty} ${escapeHtml(item.unit)}</td>
      <td style="padding:8px;text-align:right;border-bottom:1px solid #e5e7eb;">${item.unit_price.toFixed(2)} €</td>
      <td style="padding:8px;text-align:right;border-bottom:1px solid #e5e7eb;">${item.vat_rate}%</td>
      <td style="padding:8px;text-align:right;border-bottom:1px solid #e5e7eb;font-weight:500;">${lt.toFixed(2)} €</td>
    </tr>`;
  }).join("");

  const totalTtc = totalHt + totalTva;
  const date = new Date().toLocaleDateString("fr-FR");
  const validityDays = (quote.validity_days as number) || 30;

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><style>
  body { font-family: -apple-system, 'Segoe UI', sans-serif; margin: 0; padding: 40px; color: #111827; font-size: 13px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .artisan { max-width: 50%; }
  .artisan h1 { font-size: 20px; margin: 0 0 8px; color: #1d4ed8; }
  .artisan p { margin: 2px 0; color: #6b7280; font-size: 12px; }
  .client-box { background: #f9fafb; border-radius: 8px; padding: 16px; max-width: 250px; }
  .client-box h3 { margin: 0 0 8px; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .client-box p { margin: 2px 0; }
  .quote-meta { margin-bottom: 24px; }
  .quote-meta h2 { font-size: 18px; margin: 0 0 4px; }
  .quote-meta p { color: #6b7280; margin: 2px 0; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 24px 0; }
  th { background: #f3f4f6; padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
  th:not(:first-child) { text-align: right; }
  .totals { display: flex; justify-content: flex-end; margin-top: 16px; }
  .totals table { width: 250px; }
  .totals td { padding: 6px 8px; }
  .totals tr:last-child { font-size: 16px; font-weight: 700; border-top: 2px solid #111827; }
  .notes { margin-top: 32px; padding: 16px; background: #f9fafb; border-radius: 8px; font-size: 12px; color: #6b7280; }
  .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 16px; }
</style></head>
<body>
  <div class="header">
    <div class="artisan">
      ${(profile.logo_url as string) ? `<img src="${profile.logo_url}" alt="Logo" style="max-height:60px;margin-bottom:12px;" />` : ""}
      <h1>${escapeHtml(artisanName)}</h1>
      ${(profile.address as string) ? `<p>${escapeHtml(profile.address as string)}</p>` : ""}
      ${(profile.phone as string) ? `<p>Tél : ${escapeHtml(profile.phone as string)}</p>` : ""}
      ${(profile.email as string) ? `<p>${escapeHtml(profile.email as string)}</p>` : ""}
      ${(profile.siret as string) ? `<p>SIRET : ${escapeHtml(profile.siret as string)}</p>` : ""}
    </div>
    <div class="client-box">
      <h3>Client</h3>
      <p style="font-weight:600;">${escapeHtml(clientName)}</p>
      ${(dossier.address as string) ? `<p>${escapeHtml(dossier.address as string)}</p>` : ""}
      ${(dossier.client_email as string) ? `<p>${escapeHtml(dossier.client_email as string)}</p>` : ""}
      ${(dossier.client_phone as string) ? `<p>${escapeHtml(dossier.client_phone as string)}</p>` : ""}
    </div>
  </div>

  <div class="quote-meta">
    <h2>Devis ${escapeHtml(quote.quote_number as string)}</h2>
    <p>Date : ${date}</p>
    <p>Validité : ${validityDays} jours</p>
    ${(dossier.address as string) ? `<p>Adresse d'intervention : ${escapeHtml(dossier.address as string)}</p>` : ""}
  </div>

  <table>
    <thead>
      <tr><th>Désignation</th><th>Quantité</th><th>PU HT</th><th>TVA</th><th>Total HT</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Total HT</td><td style="text-align:right;">${totalHt.toFixed(2)} €</td></tr>
      <tr><td>TVA</td><td style="text-align:right;">${totalTva.toFixed(2)} €</td></tr>
      <tr><td>Total TTC</td><td style="text-align:right;">${totalTtc.toFixed(2)} €</td></tr>
    </table>
  </div>

  ${(quote.notes as string) ? `<div class="notes"><strong>Conditions :</strong><br/>${escapeHtml(quote.notes as string).replace(/\n/g, "<br/>")}</div>` : ""}

  <div class="footer">
    ${escapeHtml(artisanName)}${(profile.siret as string) ? ` — SIRET ${escapeHtml(profile.siret as string)}` : ""}
  </div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { quote_id } = await req.json();
    if (!quote_id) throw new Error("Missing quote_id");

    // Get quote
    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quote_id)
      .eq("user_id", user.id)
      .single();
    if (qErr || !quote) throw new Error("Devis introuvable");

    // Get dossier & profile
    const [{ data: dossier }, { data: profile }] = await Promise.all([
      supabase.from("dossiers").select("*").eq("id", quote.dossier_id).single(),
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    ]);
    if (!dossier) throw new Error("Dossier introuvable");

    const items = (quote.items as QuoteItem[]) || [];
    const html = buildHtml(profile || {}, dossier, quote, items);

    // Use Lovable AI to convert HTML to PDF via a simple approach:
    // Store HTML as a file and return a link, or use a PDF service
    // For now, store the HTML and use it as a viewable document
    const htmlBlob = new Blob([html], { type: "text/html" });
    const filePath = `${quote.dossier_id}/devis_${quote.quote_number.replace(/[^a-zA-Z0-9-]/g, "_")}.html`;

    // Upload HTML
    const { error: uploadError } = await supabase.storage
      .from("dossier-medias")
      .upload(filePath, htmlBlob, { contentType: "text/html", upsert: true });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from("dossier-medias").getPublicUrl(filePath);

    // Update quote with PDF URL
    await supabase.from("quotes").update({ pdf_url: urlData.publicUrl }).eq("id", quote_id);

    // Log
    await supabase.from("historique").insert({
      dossier_id: quote.dossier_id,
      user_id: user.id,
      action: "quote_pdf_generated",
      details: `PDF généré pour devis ${quote.quote_number}`,
    });

    return new Response(JSON.stringify({ success: true, pdf_url: urlData.publicUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in generate-quote-pdf:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
