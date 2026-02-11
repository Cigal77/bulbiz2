import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type DossierStatus = Database["public"]["Enums"]["dossier_status"];

export interface DossierUpdatePayload {
  client_first_name?: string | null;
  client_last_name?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  address?: string | null;
  address_line?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  google_place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  category?: Database["public"]["Enums"]["problem_category"];
  urgency?: Database["public"]["Enums"]["urgency_level"];
  description?: string | null;
}

export function useDossierActions(dossierId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["dossier", dossierId] });
    queryClient.invalidateQueries({ queryKey: ["historique", dossierId] });
    queryClient.invalidateQueries({ queryKey: ["dossiers"] });
  };

  const addHistorique = async (action: string, details?: string) => {
    await supabase.from("historique").insert({
      dossier_id: dossierId,
      user_id: user?.id ?? null,
      action,
      details,
    });
  };

  const changeStatus = useMutation({
    mutationFn: async (newStatus: DossierStatus) => {
      const { error } = await supabase
        .from("dossiers")
        .update({ status: newStatus, status_changed_at: new Date().toISOString() })
        .eq("id", dossierId);
      if (error) throw error;
      await addHistorique("status_change", `Statut changé en "${newStatus}"`);
    },
    onSuccess: invalidate,
  });

  const addNote = useMutation({
    mutationFn: async (note: string) => {
      await addHistorique("note", note);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["historique", dossierId] });
    },
  });

  const toggleRelance = useMutation({
    mutationFn: async (active: boolean) => {
      const { error } = await supabase
        .from("dossiers")
        .update({ relance_active: active })
        .eq("id", dossierId);
      if (error) throw error;
      await addHistorique("relance_toggle", active ? "Relances activées" : "Relances désactivées");
    },
    onSuccess: invalidate,
  });

  const sendRelance = useMutation({
    mutationFn: async (type: "info_manquante" | "devis_non_signe") => {
      const { data, error } = await supabase.functions.invoke("send-relance", {
        body: { dossier_id: dossierId, type },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: invalidate,
  });

  const updateDossier = useMutation({
    mutationFn: async ({ updates, changedFields }: { updates: DossierUpdatePayload; changedFields: string[] }) => {
      const { error } = await supabase
        .from("dossiers")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", dossierId);
      if (error) throw error;

      const details = changedFields.length > 0
        ? changedFields.join(", ")
        : "Informations mises à jour";
      await addHistorique("dossier_updated", details);
    },
    onSuccess: invalidate,
  });

  return { changeStatus, addNote, toggleRelance, sendRelance, updateDossier };
}
