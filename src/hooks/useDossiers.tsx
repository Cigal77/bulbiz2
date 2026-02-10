import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Dossier = Tables<"dossiers">;

export function useDossiers() {
  return useQuery({
    queryKey: ["dossiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dossiers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Dossier[];
    },
  });
}
