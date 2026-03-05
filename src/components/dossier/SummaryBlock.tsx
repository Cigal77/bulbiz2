import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Dossier } from "@/hooks/useDossier";
import { generateStructuredSummary } from "@/lib/summary";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, RefreshCw, Loader2, Zap, Mic, Camera, FileText, Receipt, Package, StickyNote, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";

interface SummaryBlockProps {
  dossier: Dossier;
  mediaCount?: number;
  historiqueCount?: number;
}

interface MaterialItem {
  label: string;
  qty: number;
  ref?: string;
}

interface AiSummary {
  headline: string;
  bullets: string[];
  next_action: string;
  auto_filled?: string[];
  material_list?: MaterialItem[];
  media_analyzed?: { images: number; videos: number; audio: number; notes?: number; quotes?: number; invoices?: number };
}

export function SummaryBlock({ dossier, mediaCount, historiqueCount }: SummaryBlockProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fallback = generateStructuredSummary(dossier);
  const [localItems, setLocalItems] = useState<MaterialItem[]>([]);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [showAddInput, setShowAddInput] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  const {
    data: aiSummary,
    isLoading,
    isFetching,
    refetch,
    isError,
  } = useQuery<AiSummary>({
    queryKey: ["ai-summary", dossier.id, dossier.status, dossier.appointment_status, mediaCount, historiqueCount],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("summarize-dossier", {
        body: { dossier_id: dossier.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.auto_filled?.length > 0) {
        toast({
          title: "🤖 Dossier mis à jour automatiquement",
          description: `Champs remplis depuis les notes vocales : ${data.auto_filled.join(", ")}`,
        });
        queryClient.invalidateQueries({ queryKey: ["dossier", dossier.id] });
        queryClient.invalidateQueries({ queryKey: ["historique", dossier.id] });
      }

      return data as AiSummary;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Sync local items when AI data arrives
  useEffect(() => {
    if (aiSummary?.material_list) {
      setLocalItems(aiSummary.material_list);
      setCheckedItems(new Set());
    }
  }, [aiSummary?.material_list]);

  // Focus input when add mode is toggled
  useEffect(() => {
    if (showAddInput && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [showAddInput]);

  const summary = aiSummary || fallback;
  const showNextAction = aiSummary?.next_action;
  const hasAutoFilled = aiSummary?.auto_filled && aiSummary.auto_filled.length > 0;
  const mediaInfo = aiSummary?.media_analyzed;
  const hasMediaAnalyzed = mediaInfo && (mediaInfo.images > 0 || mediaInfo.audio > 0 || (mediaInfo.notes ?? 0) > 0 || (mediaInfo.quotes ?? 0) > 0 || (mediaInfo.invoices ?? 0) > 0);
  const hasMaterial = localItems.length > 0 || showAddInput;

  const toggleItem = (idx: number) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const removeItem = (idx: number) => {
    setLocalItems(prev => prev.filter((_, i) => i !== idx));
    setCheckedItems(prev => {
      const next = new Set<number>();
      for (const v of prev) {
        if (v < idx) next.add(v);
        else if (v > idx) next.add(v - 1);
      }
      return next;
    });
  };

  const addItem = () => {
    const label = newItemLabel.trim();
    if (!label) return;
    setLocalItems(prev => [...prev, { label, qty: 1 }]);
    setNewItemLabel("");
    setShowAddInput(false);
  };

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

          {hasMaterial && (
            <div className="rounded-lg bg-accent/30 border border-accent/50 p-3 mt-2 space-y-2">
              <div className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-primary" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">
                  Matériel à emporter ({localItems.length})
                </p>
                {checkedItems.size > 0 && localItems.length > 0 && (
                  <span className="text-[10px] text-muted-foreground ml-auto mr-1">
                    {checkedItems.size}/{localItems.length} ✓
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-primary/60 hover:text-primary ml-auto"
                  onClick={() => setShowAddInput(true)}
                  title="Ajouter du matériel"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <ul className="space-y-1.5">
                {localItems.map((item, i) => (
                  <li
                    key={i}
                    className={`flex items-center gap-2 text-sm group transition-opacity ${checkedItems.has(i) ? "opacity-50" : ""}`}
                  >
                    <Checkbox
                      checked={checkedItems.has(i)}
                      className="mt-0 h-3.5 w-3.5 shrink-0"
                      onCheckedChange={() => toggleItem(i)}
                    />
                    <div
                      className={`flex-1 min-w-0 cursor-pointer ${checkedItems.has(i) ? "line-through" : ""}`}
                      onClick={() => toggleItem(i)}
                    >
                      <span className="text-foreground/90">
                        {item.qty > 1 && <span className="font-medium text-primary">{item.qty}× </span>}
                        {item.label}
                      </span>
                      {item.ref && item.ref !== "n/a" && (
                        <span className="text-[10px] text-muted-foreground ml-1">({item.ref})</span>
                      )}
                    </div>
                    <button
                      onClick={() => removeItem(i)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                      title="Supprimer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              {showAddInput && (
                <form
                  className="flex items-center gap-2 mt-1"
                  onSubmit={(e) => { e.preventDefault(); addItem(); }}
                >
                  <Input
                    ref={addInputRef}
                    value={newItemLabel}
                    onChange={(e) => setNewItemLabel(e.target.value)}
                    placeholder="Ajouter du matériel…"
                    className="h-7 text-sm flex-1"
                  />
                  <Button type="submit" size="sm" variant="secondary" className="h-7 px-2 text-xs" disabled={!newItemLabel.trim()}>
                    OK
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setShowAddInput(false); setNewItemLabel(""); }}>
                    ✕
                  </Button>
                </form>
              )}
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
              <span className="text-[10px] text-muted-foreground">Analysé :</span>
              {mediaInfo!.images > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                  <Camera className="h-3 w-3" /> {mediaInfo!.images} photo{mediaInfo!.images > 1 ? "s" : ""}
                </span>
              )}
              {mediaInfo!.audio > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                  <Mic className="h-3 w-3" /> {mediaInfo!.audio} vocal{mediaInfo!.audio > 1 ? "es" : "e"}
                </span>
              )}
              {(mediaInfo!.notes ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                  <StickyNote className="h-3 w-3" /> {mediaInfo!.notes} note{mediaInfo!.notes! > 1 ? "s" : ""}
                </span>
              )}
              {(mediaInfo!.quotes ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                  <FileText className="h-3 w-3" /> {mediaInfo!.quotes} devis
                </span>
              )}
              {(mediaInfo!.invoices ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                  <Receipt className="h-3 w-3" /> {mediaInfo!.invoices} facture{mediaInfo!.invoices! > 1 ? "s" : ""}
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
