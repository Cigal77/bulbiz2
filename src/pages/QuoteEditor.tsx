import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useDossier } from "@/hooks/useDossier";
import { useProfile } from "@/hooks/useProfile";
import { useQuotes } from "@/hooks/useQuotes";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { QuoteHeaderBar } from "@/components/quote-editor/QuoteHeaderBar";
import { QuoteSectionChecklist } from "@/components/quote-editor/QuoteSectionChecklist";
import { AssistantSidebar } from "@/components/quote-editor/AssistantSidebar";
import { QuoteSections } from "@/components/quote-editor/QuoteSections";
import type { QuoteItem } from "@/lib/quote-types";
import { calcTotals } from "@/lib/quote-types";
import { useIsMobile } from "@/hooks/use-mobile";

export default function QuoteEditor() {
  const { dossierId } = useParams<{ dossierId: string }>();
  const [searchParams] = useSearchParams();
  const quoteId = searchParams.get("quote");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: dossier, isLoading: dossierLoading } = useDossier(dossierId!);
  const { profile } = useProfile();
  const { data: quotes = [] } = useQuotes(dossierId!);
  const isMobile = useIsMobile();

  const [items, setItems] = useState<QuoteItem[]>([]);
  const [notes, setNotes] = useState("");
  const [labourSummary, setLabourSummary] = useState("");
  const [problemLabel, setProblemLabel] = useState<string | undefined>();
  const [validityDays, setValidityDays] = useState(30);
  const [currentQuoteId, setCurrentQuoteId] = useState<string | null>(quoteId);
  const [quoteNumber, setQuoteNumber] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load existing quote
  useEffect(() => {
    if (quoteId && quotes.length > 0) {
      const existing = quotes.find((q) => q.id === quoteId);
      if (existing) {
        setCurrentQuoteId(existing.id);
        setQuoteNumber(existing.quote_number);
        setNotes(existing.notes ?? "");
        setValidityDays(existing.validity_days ?? 30);
        const loadedItems = (existing.items as unknown as QuoteItem[]) ?? [];
        setItems(loadedItems);
      }
    }
  }, [quoteId, quotes]);

  useEffect(() => {
    if (!quoteId && profile?.default_validity_days) {
      setValidityDays(profile.default_validity_days);
    }
  }, [profile, quoteId]);

  // Auto-save
  const saveDraft = useCallback(async () => {
    if (!user || !dossierId) return;
    setIsSaving(true);
    try {
      const { total_ht, total_tva, total_ttc } = calcTotals(items);
      if (currentQuoteId) {
        await supabase.from("quotes").update({
          items: JSON.parse(JSON.stringify(items)),
          notes: notes || null,
          validity_days: validityDays,
          total_ht, total_tva, total_ttc,
        }).eq("id", currentQuoteId);
      } else {
        const { data: numData, error: numError } = await supabase.rpc("generate_quote_number", {
          p_user_id: user.id,
        });
        if (numError) throw numError;
        setQuoteNumber(numData as string);

        const { data: newQuote, error: insertError } = await supabase
          .from("quotes")
          .insert([{
            dossier_id: dossierId,
            user_id: user.id,
            quote_number: numData as string,
            is_imported: false,
            status: "brouillon" as const,
            items: JSON.parse(JSON.stringify(items)),
            notes: notes || null,
            validity_days: validityDays,
            total_ht, total_tva, total_ttc,
          }])
          .select().single();
        if (insertError) throw insertError;
        setCurrentQuoteId(newQuote.id);

        await supabase.from("historique").insert({
          dossier_id: dossierId, user_id: user.id,
          action: "quote_created", details: `Devis ${numData} créé`,
        });
      }
    } catch (err: unknown) {
      console.error("Auto-save failed:", err);
    } finally {
      setIsSaving(false);
    }
  }, [user, dossierId, currentQuoteId, items, notes, validityDays]);

  useEffect(() => {
    if (items.length === 0 && !currentQuoteId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveDraft, 2000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [items, notes, validityDays, saveDraft]);

  const handleGeneratePdf = async () => {
    await saveDraft();
    if (!currentQuoteId) {
      toast({ title: "Ajoutez au moins une ligne", variant: "destructive" });
      return;
    }
    setIsGeneratingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quote-pdf", {
        body: { quote_id: currentQuoteId },
      });
      if (error) throw error;
      if (data?.pdf_url) {
        window.open(data.pdf_url, "_blank");
        toast({ title: "PDF généré !" });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur";
      toast({ title: "Erreur PDF", description: message, variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSend = async () => {
    await saveDraft();
    if (!currentQuoteId) return;
    setIsSending(true);
    try {
      const { error: pdfError } = await supabase.functions.invoke("generate-quote-pdf", {
        body: { quote_id: currentQuoteId },
      });
      if (pdfError) throw pdfError;
      const { error } = await supabase.functions.invoke("send-quote", {
        body: { quote_id: currentQuoteId },
      });
      if (error) throw error;
      toast({ title: "Devis envoyé au client !" });
      navigate(`/dossier/${dossierId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur";
      toast({ title: "Erreur d'envoi", description: message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  // Assistant callbacks
  const addItemFromAssistant = (item: Omit<QuoteItem, "id">) => {
    setItems(prev => [...prev, { ...item, id: crypto.randomUUID() }]);
  };

  const addItemsFromAssistant = (newItems: Omit<QuoteItem, "id">[]) => {
    const withIds = newItems.map(i => ({ ...i, id: crypto.randomUUID() }));
    setItems(prev => [...prev, ...withIds]);
  };

  const handleSetLabourContext = (_tags: string[], label: string) => {
    setProblemLabel(label);
  };

  if (dossierLoading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <p className="text-lg font-medium text-foreground">Dossier introuvable</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <QuoteHeaderBar
        dossier={dossier}
        quoteNumber={quoteNumber}
        isSaving={isSaving}
        isSending={isSending}
        isGeneratingPdf={isGeneratingPdf}
        itemCount={items.length}
        onBack={() => navigate(`/dossier/${dossierId}`)}
        onGeneratePdf={handleGeneratePdf}
        onSend={handleSend}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop assistant sidebar — always visible */}
        {!isMobile && (
          <AssistantSidebar
            onAddItem={addItemFromAssistant}
            onAddItems={addItemsFromAssistant}
            onSetLabourContext={handleSetLabourContext}
          />
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
            <QuoteSectionChecklist items={items} />

            <QuoteSections
              items={items}
              setItems={setItems}
              labourSummary={labourSummary}
              onLabourSummaryChange={setLabourSummary}
              problemLabel={problemLabel}
              notes={notes}
              validityDays={validityDays}
              onNotesChange={setNotes}
              onValidityChange={setValidityDays}
            />
          </div>
        </main>
      </div>

      {/* Mobile assistant (floating button + drawer) */}
      {isMobile && (
        <AssistantSidebar
          onAddItem={addItemFromAssistant}
          onAddItems={addItemsFromAssistant}
          onSetLabourContext={handleSetLabourContext}
        />
      )}
    </div>
  );
}
