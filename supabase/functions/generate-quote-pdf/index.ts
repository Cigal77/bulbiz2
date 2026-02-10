import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

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

function fmt(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

async function buildPdf(
  profile: Record<string, unknown>,
  dossier: Record<string, unknown>,
  quote: Record<string, unknown>,
  items: QuoteItem[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595; // A4
  const pageHeight = 842;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const blue = rgb(0.11, 0.31, 0.85);
  const gray = rgb(0.42, 0.45, 0.49);
  const lightGray = rgb(0.93, 0.94, 0.95);
  const black = rgb(0, 0, 0);
  const white = rgb(1, 1, 1);

  const drawText = (text: string, x: number, yPos: number, size: number, f = font, color = black) => {
    page.drawText(text, { x, y: yPos, size, font: f, color });
  };

  const addNewPageIfNeeded = (needed: number) => {
    if (y - needed < margin + 40) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  // === HEADER ===
  const artisanName = (profile.company_name as string) ||
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Artisan";

  drawText(artisanName, margin, y, 16, fontBold, blue);
  y -= 16;

  if (profile.address) { drawText(String(profile.address), margin, y, 9, font, gray); y -= 12; }
  if (profile.phone) { drawText("Tél : " + String(profile.phone), margin, y, 9, font, gray); y -= 12; }
  if (profile.email) { drawText(String(profile.email), margin, y, 9, font, gray); y -= 12; }
  if (profile.siret) { drawText("SIRET : " + String(profile.siret), margin, y, 9, font, gray); y -= 12; }

  // Client box (right side)
  const clientName = [dossier.client_first_name, dossier.client_last_name].filter(Boolean).join(" ") || "Client";
  const clientBoxX = pageWidth - margin - 200;
  const clientBoxY = pageHeight - margin - 5;

  page.drawRectangle({ x: clientBoxX - 10, y: clientBoxY - 65, width: 210, height: 80, color: lightGray, borderWidth: 0 });
  drawText("CLIENT", clientBoxX, clientBoxY, 8, fontBold, gray);
  drawText(clientName, clientBoxX, clientBoxY - 14, 10, fontBold, black);
  let cY = clientBoxY - 28;
  if (dossier.address) { drawText(truncate(String(dossier.address), 35), clientBoxX, cY, 9, font, gray); cY -= 12; }
  if (dossier.client_email) { drawText(String(dossier.client_email), clientBoxX, cY, 9, font, gray); cY -= 12; }
  if (dossier.client_phone) { drawText(String(dossier.client_phone), clientBoxX, cY, 9, font, gray); cY -= 12; }

  // === QUOTE META ===
  y -= 24;
  drawText("Devis " + String(quote.quote_number), margin, y, 14, fontBold, black);
  y -= 16;
  const dateStr = new Date().toLocaleDateString("fr-FR");
  drawText("Date : " + dateStr, margin, y, 9, font, gray);
  y -= 12;
  drawText("Validité : " + String(quote.validity_days || 30) + " jours", margin, y, 9, font, gray);
  y -= 12;
  if (dossier.address) {
    drawText("Adresse d'intervention : " + truncate(String(dossier.address), 60), margin, y, 9, font, gray);
    y -= 12;
  }

  // === TABLE ===
  y -= 16;
  const colWidths = [contentWidth * 0.40, contentWidth * 0.12, contentWidth * 0.15, contentWidth * 0.13, contentWidth * 0.20];
  const colX = [margin];
  for (let i = 1; i < 5; i++) colX.push(colX[i - 1] + colWidths[i - 1]);

  // Header row
  const headerH = 22;
  page.drawRectangle({ x: margin, y: y - headerH + 4, width: contentWidth, height: headerH, color: lightGray });
  const headers = ["Désignation", "Quantité", "PU HT", "TVA", "Total HT"];
  headers.forEach((h, i) => {
    const xOff = i === 0 ? 4 : colWidths[i] - font.widthOfTextAtSize(h, 8) - 4;
    drawText(h, colX[i] + xOff, y - 12, 8, fontBold, gray);
  });
  y -= headerH + 2;

  let totalHt = 0;
  let totalTva = 0;

  for (const item of items) {
    const lt = calcLineTotal(item);
    const tva = (lt * item.vat_rate) / 100;
    totalHt += lt;
    totalTva += tva;

    const rowH = item.description ? 28 : 18;
    addNewPageIfNeeded(rowH + 4);

    // Label
    drawText(truncate(item.label, 40), colX[0] + 4, y - 4, 9, fontBold, black);
    if (item.description) {
      drawText(truncate(item.description, 50), colX[0] + 4, y - 15, 8, font, gray);
    }

    // Qty
    const qtyStr = item.qty + " " + item.unit;
    drawText(qtyStr, colX[1] + colWidths[1] - font.widthOfTextAtSize(qtyStr, 9) - 4, y - 4, 9, font, black);

    // PU
    const puStr = fmt(item.unit_price);
    drawText(puStr, colX[2] + colWidths[2] - font.widthOfTextAtSize(puStr, 9) - 4, y - 4, 9, font, black);

    // TVA
    const tvaStr = item.vat_rate + "%";
    drawText(tvaStr, colX[3] + colWidths[3] - font.widthOfTextAtSize(tvaStr, 9) - 4, y - 4, 9, font, black);

    // Total
    const totalStr = fmt(lt);
    drawText(totalStr, colX[4] + colWidths[4] - fontBold.widthOfTextAtSize(totalStr, 9) - 4, y - 4, 9, fontBold, black);

    y -= rowH;

    // Row separator
    page.drawLine({ start: { x: margin, y }, end: { x: margin + contentWidth, y }, thickness: 0.5, color: lightGray });
    y -= 2;
  }

  // === TOTALS ===
  y -= 16;
  addNewPageIfNeeded(60);
  const totalTtc = totalHt + totalTva;
  const totalsX = pageWidth - margin - 180;
  const totalsW = 180;

  const drawTotalRow = (label: string, value: string, bold = false, topBorder = false) => {
    if (topBorder) {
      page.drawLine({ start: { x: totalsX, y: y + 4 }, end: { x: totalsX + totalsW, y: y + 4 }, thickness: 1.5, color: black });
    }
    const f = bold ? fontBold : font;
    const size = bold ? 12 : 10;
    drawText(label, totalsX, y - 6, size, f, black);
    const valStr = value;
    drawText(valStr, totalsX + totalsW - f.widthOfTextAtSize(valStr, size), y - 6, size, f, black);
    y -= 20;
  };

  drawTotalRow("Total HT", fmt(totalHt));
  drawTotalRow("TVA", fmt(totalTva));
  drawTotalRow("Total TTC", fmt(totalTtc), true, true);

  // === NOTES ===
  if (quote.notes) {
    y -= 12;
    addNewPageIfNeeded(60);
    page.drawRectangle({ x: margin, y: y - 50, width: contentWidth, height: 56, color: lightGray });
    drawText("Conditions :", margin + 8, y - 4, 9, fontBold, gray);
    const noteLines = String(quote.notes).split("\n").slice(0, 4);
    let nY = y - 16;
    for (const line of noteLines) {
      drawText(truncate(line, 80), margin + 8, nY, 8, font, gray);
      nY -= 11;
    }
  }

  // === FOOTER ===
  const footerText = artisanName + (profile.siret ? " — SIRET " + String(profile.siret) : "");
  const footerWidth = font.widthOfTextAtSize(footerText, 8);
  // Draw on all pages
  for (const p of doc.getPages()) {
    p.drawLine({ start: { x: margin, y: 40 }, end: { x: pageWidth - margin, y: 40 }, thickness: 0.5, color: lightGray });
    p.drawText(footerText, { x: (pageWidth - footerWidth) / 2, y: 28, size: 8, font, color: gray });
  }

  return await doc.save();
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
    const pdfBytes = await buildPdf(profile || {}, dossier, quote, items);

    const filePath = `${quote.dossier_id}/devis_${quote.quote_number.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;

    // Upload PDF
    const { error: uploadError } = await supabase.storage
      .from("dossier-medias")
      .upload(filePath, pdfBytes, { contentType: "application/pdf", upsert: true });
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
