import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type QuoteStatus = "brouillon" | "envoye" | "signe" | "refuse";

export interface Quote {
  id: string;
  dossier_id: string;
  user_id: string;
  quote_number: string;
  status: QuoteStatus;
  pdf_url: string | null;
  is_imported: boolean;
  items: unknown[];
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  notes: string | null;
  validity_days: number;
  sent_at: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  signe: "Signé",
  refuse: "Refusé",
};

const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoye: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  signe: "bg-success/15 text-success",
  refuse: "bg-destructive/15 text-destructive",
};

export { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS };

export function useQuotes(dossierId: string) {
  return useQuery({
    queryKey: ["quotes", dossierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("dossier_id", dossierId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Quote[];
    },
    enabled: !!dossierId,
  });
}

export function useQuoteActions(dossierId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["quotes", dossierId] });
    queryClient.invalidateQueries({ queryKey: ["dossier-historique", dossierId] });
  };

  const importPdf = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Non authentifié");

      // Generate quote number
      const { data: numData, error: numError } = await supabase.rpc("generate_quote_number", {
        p_user_id: user.id,
      });
      if (numError) throw numError;

      // Upload PDF
      const filePath = `${dossierId}/devis_${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("dossier-medias")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("dossier-medias").getPublicUrl(filePath);

      // Create quote record
      const { data: quote, error: insertError } = await supabase
        .from("quotes")
        .insert({
          dossier_id: dossierId,
          user_id: user.id,
          quote_number: numData as string,
          is_imported: true,
          pdf_url: urlData.publicUrl,
          status: "brouillon" as QuoteStatus,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      // Log historique
      await supabase.from("historique").insert({
        dossier_id: dossierId,
        user_id: user.id,
        action: "quote_imported",
        details: `Devis ${numData} importé (PDF)`,
      });

      return quote;
    },
    onSuccess: invalidate,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ quoteId, status }: { quoteId: string; status: QuoteStatus }) => {
      if (!user) throw new Error("Non authentifié");

      const updates: Record<string, unknown> = { status };
      if (status === "envoye") updates.sent_at = new Date().toISOString();
      if (status === "signe") updates.signed_at = new Date().toISOString();

      const { error } = await supabase
        .from("quotes")
        .update(updates)
        .eq("id", quoteId);
      if (error) throw error;

      // Update dossier status if quote is sent
      if (status === "envoye") {
        await supabase
          .from("dossiers")
          .update({ status: "devis_envoye", status_changed_at: new Date().toISOString() })
          .eq("id", dossierId);
      }
      if (status === "signe") {
        await supabase
          .from("dossiers")
          .update({
            status: "clos_signe",
            status_changed_at: new Date().toISOString(),
            appointment_status: "rdv_pending" as const,
          })
          .eq("id", dossierId);

        await supabase.from("historique").insert({
          dossier_id: dossierId,
          user_id: user!.id,
          action: "appointment_status_change",
          details: "Prise de rendez-vous en attente",
        });

        // Trigger APPOINTMENT_REQUESTED notification
        try {
          await supabase.functions.invoke("send-appointment-notification", {
            body: { event_type: "APPOINTMENT_REQUESTED", dossier_id: dossierId, payload: {} },
          });
        } catch (e) {
          console.error("Notification error after quote signed:", e);
        }
      }
      if (status === "refuse") {
        await supabase
          .from("dossiers")
          .update({ status: "clos_perdu", status_changed_at: new Date().toISOString() })
          .eq("id", dossierId);
      }

      await supabase.from("historique").insert({
        dossier_id: dossierId,
        user_id: user.id,
        action: "quote_status_change",
        details: `Devis passé à "${QUOTE_STATUS_LABELS[status]}"`,
      });
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["dossier"] });
    },
  });

  const deleteQuote = useMutation({
    mutationFn: async (quoteId: string) => {
      if (!user) throw new Error("Non authentifié");
      const { error } = await supabase.from("quotes").delete().eq("id", quoteId);
      if (error) throw error;

      await supabase.from("historique").insert({
        dossier_id: dossierId,
        user_id: user.id,
        action: "quote_deleted",
        details: "Devis supprimé",
      });
    },
    onSuccess: invalidate,
  });

  return { importPdf, updateStatus, deleteQuote };
}
