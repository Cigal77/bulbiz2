import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { AiQuoteDraft } from "@/lib/ai-quote-types";

type DecisionStatus = "accepted" | "modified" | "rejected";

export function useAiQuoteDraft() {
  const { toast } = useToast();
  const [draft, setDraft] = useState<AiQuoteDraft | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (dossierId: string, quoteId?: string | null) => {
      setIsGenerating(true);
      setError(null);
      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "generate-ai-quote-draft",
          { body: { dossier_id: dossierId, quote_id: quoteId ?? null } },
        );
        if (fnError) {
          // Surface 402/429 from edge function
          const msg = fnError.message || "Erreur";
          if (msg.includes("402")) {
            toast({
              title: "Crédits IA épuisés",
              description: "Rechargez votre crédit pour continuer.",
              variant: "destructive",
            });
          } else if (msg.includes("429")) {
            toast({
              title: "Trop de requêtes",
              description: "Réessaye dans une minute.",
              variant: "destructive",
            });
          } else {
            toast({ title: "Erreur IA", description: msg, variant: "destructive" });
          }
          throw new Error(msg);
        }
        if (data?.error) throw new Error(data.error);
        setDraft(data as AiQuoteDraft);
        return data as AiQuoteDraft;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erreur inconnue";
        setError(msg);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [toast],
  );

  const logDecision = useCallback(
    async (logId: string, lineRef: string | null, status: DecisionStatus) => {
      try {
        // We append to a child log row to track per-line decisions.
        // To keep things simple, we update the parent row's status when global; otherwise insert a new row tied to the same dossier.
        const { data: parent } = await supabase
          .from("ai_quote_suggestions_log")
          .select("dossier_id, quote_id, user_id, suggestion_payload")
          .eq("id", logId)
          .maybeSingle();
        if (!parent) return;
        if (!lineRef) {
          await supabase
            .from("ai_quote_suggestions_log")
            .update({ status, resolved_at: new Date().toISOString() })
            .eq("id", logId);
          return;
        }
        await supabase.from("ai_quote_suggestions_log").insert({
          user_id: parent.user_id,
          dossier_id: parent.dossier_id,
          quote_id: parent.quote_id,
          line_ref: lineRef,
          status,
          suggestion_payload: { parent_log_id: logId, line_ref: lineRef },
          resolved_at: new Date().toISOString(),
        });
      } catch (e) {
        console.error("logDecision failed", e);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setDraft(null);
    setError(null);
  }, []);

  return { draft, isGenerating, error, generate, logDecision, reset };
}
