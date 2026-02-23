import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Dossier } from "@/hooks/useDossier";
import { generateStructuredSummary } from "@/lib/summary";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, RefreshCw, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface SummaryBlockProps {
  dossier: Dossier;
}

interface AiSummary {
  headline: string;
  bullets: string[];
  next_action: string;
}

export function SummaryBlock({ dossier }: SummaryBlockProps) {
  const { toast } = useToast();
  const fallback = generateStructuredSummary(dossier);

  const {
    data: aiSummary,
    isLoading,
    isFetching,
    refetch,
    isError,
  } = useQuery<AiSummary>({
    queryKey: ["ai-summary", dossier.id, dossier.status, dossier.appointment_status],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("summarize-dossier", {
        body: { dossier_id: dossier.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as AiSummary;
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
    retry: 1,
  });

  const summary = aiSummary || fallback;
  const showNextAction = aiSummary?.next_action;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Résumé {aiSummary ? "IA" : ""}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-primary/60 hover:text-primary"
          onClick={() => refetch()}
          disabled={isFetching}
          title="Régénérer le résumé IA"
        >
          {isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyse en cours…
        </div>
      ) : (
        <>
          <p className="text-sm font-semibold text-foreground">{summary.headline}</p>
          <ul className="space-y-1">
            {summary.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
                {b}
              </li>
            ))}
          </ul>

          {showNextAction && (
            <div className="flex items-start gap-2 rounded-lg bg-primary/10 p-3 mt-2">
              <Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70 mb-0.5">
                  Action recommandée
                </p>
                <p className="text-sm font-medium text-foreground">{aiSummary.next_action}</p>
              </div>
            </div>
          )}

          {isError && !aiSummary && (
            <p className="text-[10px] text-muted-foreground italic">Résumé basique affiché (IA indisponible)</p>
          )}
        </>
      )}
    </div>
  );
}
