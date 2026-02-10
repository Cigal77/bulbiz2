import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type InvoiceStatus = "draft" | "sent" | "paid";

export interface Invoice {
  id: string;
  dossier_id: string;
  user_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  service_date: string | null;
  client_first_name: string | null;
  client_last_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  client_company: string | null;
  artisan_name: string | null;
  artisan_company: string | null;
  artisan_address: string | null;
  artisan_phone: string | null;
  artisan_email: string | null;
  artisan_siret: string | null;
  artisan_tva_intracom: string | null;
  vat_mode: "normal" | "no_vat_293b";
  client_type: "individual" | "business";
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  payment_terms: string | null;
  late_fees_text: string | null;
  notes: string | null;
  pdf_url: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  label: string;
  description: string | null;
  qty: number;
  unit: string;
  unit_price: number;
  tva_rate: number;
  discount: number;
  sort_order: number;
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  paid: "Payée",
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  paid: "bg-success/15 text-success",
};

export function useInvoices(dossierId: string) {
  return useQuery({
    queryKey: ["invoices", dossierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("dossier_id", dossierId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Invoice[];
    },
    enabled: !!dossierId,
  });
}

export function useInvoice(invoiceId: string) {
  return useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Invoice | null;
    },
    enabled: !!invoiceId,
  });
}

export function useInvoiceLines(invoiceId: string) {
  return useQuery({
    queryKey: ["invoice_lines", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_lines")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as unknown as InvoiceLine[];
    },
    enabled: !!invoiceId,
  });
}

export function useInvoiceActions(dossierId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["invoices", dossierId] });
    queryClient.invalidateQueries({ queryKey: ["historique", dossierId] });
  };

  const generateFromQuote = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non authentifié");

      // Get signed/sent quote
      const { data: quotes } = await supabase
        .from("quotes")
        .select("*")
        .eq("dossier_id", dossierId)
        .in("status", ["signe", "envoye"])
        .order("created_at", { ascending: false })
        .limit(1);

      const quote = quotes?.[0];

      // Get dossier
      const { data: dossier } = await supabase
        .from("dossiers")
        .select("*")
        .eq("id", dossierId)
        .single();

      // Get profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // Generate invoice number
      const { data: invoiceNumber, error: numErr } = await supabase.rpc("generate_invoice_number", {
        p_user_id: user.id,
      });
      if (numErr) throw numErr;

      // Get quote lines if quote exists
      let quoteLines: any[] = [];
      if (quote) {
        const { data: ql } = await supabase
          .from("quote_lines")
          .select("*")
          .eq("quote_id", quote.id)
          .order("sort_order");
        quoteLines = ql || [];
      }

      // Create invoice
      const { data: invoice, error: invErr } = await supabase
        .from("invoices")
        .insert({
          dossier_id: dossierId,
          user_id: user.id,
          invoice_number: invoiceNumber as string,
          issue_date: new Date().toISOString().split("T")[0],
          service_date: (dossier as any)?.appointment_date || null,
          client_first_name: dossier?.client_first_name || null,
          client_last_name: dossier?.client_last_name || null,
          client_email: dossier?.client_email || null,
          client_phone: dossier?.client_phone || null,
          client_address: [dossier?.address_line, dossier?.postal_code, dossier?.city].filter(Boolean).join(", ") || dossier?.address || null,
          artisan_name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || null,
          artisan_company: profile?.company_name || null,
          artisan_address: profile?.address || null,
          artisan_phone: profile?.phone || null,
          artisan_email: profile?.email || null,
          artisan_siret: profile?.siret || null,
          artisan_tva_intracom: (profile as any)?.tva_intracom || null,
          vat_mode: (profile as any)?.vat_applicable === false ? "no_vat_293b" : "normal",
          payment_terms: (profile as any)?.payment_terms_default || null,
          total_ht: quote?.total_ht || 0,
          total_tva: quote?.total_tva || 0,
          total_ttc: quote?.total_ttc || 0,
        } as any)
        .select()
        .single();
      if (invErr) throw invErr;

      // Copy quote lines to invoice lines
      if (quoteLines.length > 0 && invoice) {
        const invoiceLines = quoteLines.map((ql: any) => ({
          invoice_id: invoice.id,
          label: ql.label,
          description: ql.description,
          qty: ql.qty,
          unit: ql.unit,
          unit_price: ql.unit_price,
          tva_rate: ql.tva_rate,
          discount: ql.discount || 0,
          sort_order: ql.sort_order,
        }));
        await supabase.from("invoice_lines").insert(invoiceLines);
      }

      // Historique
      await supabase.from("historique").insert({
        dossier_id: dossierId,
        user_id: user.id,
        action: "invoice_created",
        details: `Facture ${invoiceNumber} générée (brouillon)`,
      });

      return invoice;
    },
    onSuccess: invalidate,
  });

  return { generateFromQuote };
}
