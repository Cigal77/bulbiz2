import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type DossierStatus = Database["public"]["Enums"]["dossier_status"];

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

  return { changeStatus, addNote, toggleRelance };
}
