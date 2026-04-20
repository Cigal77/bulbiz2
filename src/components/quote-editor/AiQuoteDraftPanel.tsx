import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sparkles, Check, X, Pencil, AlertTriangle, Info, PackageCheck, Bot, RefreshCw,
} from "lucide-react";
import { useAiQuoteDraft } from "@/hooks/useAiQuoteDraft";
import { aiLineToQuoteItem, type AiQuoteLine, type AiQuoteDraft } from "@/lib/ai-quote-types";
import type { QuoteItem } from "@/lib/quote-types";
import { cn } from "@/lib/utils";

interface AiQuoteDraftPanelProps {
  dossierId: string;
  quoteId?: string | null;
  autoGenerate?: boolean;
  onAddItem: (item: Omit<QuoteItem, "id">) => void;
  onAddItems: (items: Omit<QuoteItem, "id">[]) => void;
}

export function AiQuoteDraftPanel({
  dossierId,
  quoteId,
  autoGenerate,
  onAddItem,
  onAddItems,
}: AiQuoteDraftPanelProps) {
  const { draft, isGenerating, generate, logDecision, reset } = useAiQuoteDraft();
  const [decided, setDecided] = useState<Record<string, "accepted" | "rejected">>({});
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);

  // Auto-trigger once on mount if requested
  useEffect(() => {
    if (autoGenerate && !hasAutoTriggered && !draft && !isGenerating) {
      setHasAutoTriggered(true);
      generate(dossierId, quoteId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate, hasAutoTriggered, draft, isGenerating, dossierId, quoteId]);

  const handleAcceptLine = (line: AiQuoteLine, log_id: string) => {
    onAddItem(aiLineToQuoteItem(line));
    setDecided((p) => ({ ...p, [line.ref]: "accepted" }));
    logDecision(log_id, line.ref, "accepted");
  };

  const handleRejectLine = (line: AiQuoteLine, log_id: string) => {
    setDecided((p) => ({ ...p, [line.ref]: "rejected" }));
    logDecision(log_id, line.ref, "rejected");
  };

  const handleAcceptAll = (d: AiQuoteDraft) => {
    const remaining = d.lines.filter((l) => !decided[l.ref]);
    onAddItems(remaining.map(aiLineToQuoteItem));
    const next: typeof decided = { ...decided };
    remaining.forEach((l) => {
      next[l.ref] = "accepted";
      logDecision(d.log_id, l.ref, "accepted");
    });
    setDecided(next);
  };

  const handleIgnoreAll = (d: AiQuoteDraft) => {
    logDecision(d.log_id, null, "rejected");
    reset();
    setDecided({});
  };

  // ===== Empty / Initial state =====
  if (!draft && !isGenerating) {
    return (
      <div className="flex flex-col h-full gap-3">
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Pré-devis IA</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
              L'IA analyse le dossier (notes, photos, échanges, historique) pour proposer un devis prêt à ajuster.
            </p>
          </div>
          <Button onClick={() => generate(dossierId, quoteId)} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Générer un pré-devis avec l'IA
          </Button>
          <p className="text-[10px] text-muted-foreground italic max-w-[260px]">
            Proposition générée à partir du dossier. Vérifie et ajuste avant envoi.
          </p>
        </div>
      </div>
    );
  }

  // ===== Loading =====
  if (isGenerating) {
    return (
      <div className="flex flex-col h-full gap-3 px-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Bot className="h-4 w-4 animate-pulse text-primary" />
          L'IA analyse le dossier…
        </div>
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
    );
  }

  if (!draft) return null;

  const confidencePct = Math.round(draft.confidence * 100);
  const confidenceColor =
    confidencePct >= 75 ? "bg-success/15 text-success" :
    confidencePct >= 50 ? "bg-warning/15 text-warning" :
    "bg-destructive/15 text-destructive";

  return (
    <ScrollArea className="h-full pr-2">
      <div className="space-y-3 pb-4">
        {/* Header */}
        <div className="rounded-lg border bg-primary/5 p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-foreground line-clamp-2">{draft.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{draft.summary}</p>
            </div>
            <Badge variant="secondary" className={cn("shrink-0 text-[10px]", confidenceColor)}>
              {confidencePct}%
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <PackageCheck className="h-3 w-3" />
            {draft.catalog_match_count} catalogue · {draft.ai_fallback_count} estimations IA
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground italic px-1">
          Proposition générée à partir du dossier. Vérifie et ajuste avant envoi.
        </p>

        {/* Missing questions */}
        {draft.missing_questions?.length > 0 && (
          <Alert className="border-warning/40 bg-warning/5">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-xs space-y-1">
              <strong className="block text-warning">Infos manquantes</strong>
              <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                {draft.missing_questions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Lines */}
        {draft.lines.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Lignes proposées ({draft.lines.length})
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleAcceptAll(draft)}>
                  <Check className="h-3 w-3" /> Tout
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => handleIgnoreAll(draft)}>
                  <X className="h-3 w-3" /> Ignorer
                </Button>
              </div>
            </div>

            {draft.lines.map((line) => {
              const state = decided[line.ref];
              return (
                <div
                  key={line.ref}
                  className={cn(
                    "rounded-lg border p-2.5 space-y-2 bg-background transition-all",
                    state === "accepted" && "border-success/40 bg-success/5 opacity-70",
                    state === "rejected" && "border-destructive/30 opacity-50",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="secondary" className="bg-primary/10 text-primary text-[9px] gap-1 h-4 px-1.5">
                          <Sparkles className="h-2.5 w-2.5" />
                          IA
                        </Badge>
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                          {line.source === "catalog" ? "Catalogue" : "Estimation"}
                        </Badge>
                      </div>
                      <p className="text-xs font-semibold text-foreground line-clamp-2">{line.label}</p>
                      {line.description && (
                        <p className="text-[10px] text-muted-foreground line-clamp-2">{line.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{line.qty} {line.unit}</span>
                        <span>×</span>
                        <span className="font-medium text-foreground">{line.unit_price.toFixed(2)} €</span>
                        <span className="text-muted-foreground">TVA {line.vat_rate}%</span>
                      </div>
                      {line.rationale && (
                        <p className="text-[9px] text-muted-foreground italic flex items-start gap-1">
                          <Info className="h-2.5 w-2.5 mt-px shrink-0" />
                          {line.rationale}
                        </p>
                      )}
                    </div>
                  </div>

                  {!state && (
                    <div className="flex gap-1 pt-1 border-t border-border/50">
                      <Button
                        size="sm"
                        variant="default"
                        className="flex-1 h-8 text-xs gap-1"
                        onClick={() => handleAcceptLine(line, draft.log_id)}
                      >
                        <Check className="h-3 w-3" />
                        Accepter
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1 px-2"
                        onClick={() => {
                          handleAcceptLine(line, draft.log_id);
                          logDecision(draft.log_id, line.ref, "modified");
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs gap-1 px-2 text-destructive hover:text-destructive"
                        onClick={() => handleRejectLine(line, draft.log_id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {state === "accepted" && (
                    <p className="text-[10px] text-success font-medium flex items-center gap-1">
                      <Check className="h-3 w-3" /> Ajoutée au devis
                    </p>
                  )}
                  {state === "rejected" && (
                    <p className="text-[10px] text-muted-foreground font-medium">Refusée</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Variants */}
        {draft.variants?.length > 0 && (
          <div className="space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
              Variantes ({draft.variants.length})
            </span>
            {draft.variants.map((v, i) => (
              <div key={i} className="rounded-lg border border-dashed p-2.5 space-y-2 bg-muted/30">
                <div>
                  <p className="text-xs font-semibold text-foreground">{v.label}</p>
                  {v.description && <p className="text-[10px] text-muted-foreground">{v.description}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">{v.lines.length} ligne(s)</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs gap-1"
                  onClick={() => onAddItems(v.lines.map(aiLineToQuoteItem))}
                >
                  <Check className="h-3 w-3" />
                  Appliquer cette variante
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Assumptions */}
        {draft.assumptions?.length > 0 && (
          <div className="rounded-lg border bg-muted/30 p-2.5 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Hypothèses
            </span>
            <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-muted-foreground">
              {draft.assumptions.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}

        <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1" onClick={() => generate(dossierId, quoteId)}>
          <RefreshCw className="h-3 w-3" />
          Régénérer
        </Button>
      </div>
    </ScrollArea>
  );
}
