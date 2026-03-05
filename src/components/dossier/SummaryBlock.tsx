import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Dossier } from "@/hooks/useDossier";
import { generateStructuredSummary } from "@/lib/summary";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, RefreshCw, Loader2, Zap, Mic, Camera, Video, FileText, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface SummaryBlockProps {
  dossier: Dossier;
}

interface AiSummary {
  headline: string;
  bullets: string[];
  next_action: string;
  auto_filled?: string[];
  media_analyzed?: { images: number; videos: number; audio: number; quotes?: number; invoices?: number };
}

export function SummaryBlock({ dossier }: SummaryBlockProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

      // If AI auto-filled fields, show toast and refresh dossier data
      if (data?.auto_filled?.length > 0) {
        toast({
          title: "🤖 Dossier mis à jour automatiquement",
          description: `Champs remplis depuis les notes vocales : ${data.auto_filled.join(", ")}`,
        });
        // Refresh dossier data to show updated fields
        queryClient.invalidateQueries({ queryKey: ["dossier", dossier.id] });
        queryClient.invalidateQueries({ queryKey: ["historique", dossier.id] });
      }

      return data as AiSummary;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const summary = aiSummary || fallback;
  const showNextAction = aiSummary?.next_action;
  const hasAutoFilled = aiSummary?.auto_filled && aiSummary.auto_filled.length > 0;
  const mediaInfo = aiSummary?.media_analyzed;
  const hasMediaAnalyzed = mediaInfo && (mediaInfo.images > 0 || mediaInfo.videos > 0 || mediaInfo.audio > 0 || (mediaInfo.quotes ?? 0) > 0 || (mediaInfo.invoices ?? 0) > 0);

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Résumé de la demande
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
                <p className="text-sm font-medium text-foreground">{aiSummary!.next_action}</p>
              </div>
            </div>
          )}

          {hasAutoFilled && (
            <div className="flex items-start gap-2 rounded-lg bg-green-500/10 border border-green-500/20 p-3 mt-2">
              <Mic className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-green-700 mb-0.5">
                  Rempli automatiquement
                </p>
                <p className="text-sm text-foreground/80">{aiSummary!.auto_filled!.join(", ")}</p>
              </div>
            </div>
          )}

          {hasMediaAnalyzed && (
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <span className="text-[10px] text-muted-foreground">Médias analysés :</span>
              {mediaInfo!.images > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                  <Camera className="h-3 w-3" /> {mediaInfo!.images} photo{mediaInfo!.images > 1 ? "s" : ""}
                </span>
              )}
              {mediaInfo!.videos > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                  <Video className="h-3 w-3" /> {mediaInfo!.videos} vidéo{mediaInfo!.videos > 1 ? "s" : ""}
                </span>
              )}
              {mediaInfo!.audio > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                  <Mic className="h-3 w-3" /> {mediaInfo!.audio} vocal{mediaInfo!.audio > 1 ? "es" : "e"}
                </span>
              )}
              {(mediaInfo!.quotes ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                  <FileText className="h-3 w-3" /> {mediaInfo!.quotes} devis
                </span>
              )}
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
