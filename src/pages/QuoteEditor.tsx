import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useDossier } from "@/hooks/useDossier";
import { useProfile } from "@/hooks/useProfile";
import { useQuotes, useQuoteActions } from "@/hooks/useQuotes";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, User, ListOrdered, FileCheck } from "lucide-react";
import { BulbizLogo } from "@/components/BulbizLogo";
import { useToast } from "@/hooks/use-toast";
import { StepClientInfo } from "@/components/quote-editor/StepClientInfo";
import { StepItems } from "@/components/quote-editor/StepItems";
import { StepSummary } from "@/components/quote-editor/StepSummary";
import { QuoteTotalsFooter } from "@/components/quote-editor/QuoteTotalsFooter";
import type { QuoteItem } from "@/lib/quote-types";
import { calcTotals } from "@/lib/quote-types";

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
  const { importPdf } = useQuoteActions(dossierId!);

  const [tab, setTab] = useState("client");
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [notes, setNotes] = useState("");
  const [validityDays, setValidityDays] = useState(30);
  const [currentQuoteId, setCurrentQuoteId] = useState<string | null>(quoteId);
  const [quoteNumber, setQuoteNumber] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load existing quote if editing
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

  // Set default validity from profile
  useEffect(() => {
    if (!quoteId && profile?.default_validity_days) {
      setValidityDays(profile.default_validity_days);
    }
  }, [profile, quoteId]);

  // Auto-save draft
  const saveDraft = useCallback(async () => {
    if (!user || !dossierId) return;
    setIsSaving(true);
    try {
      const { total_ht, total_tva, total_ttc } = calcTotals(items);

      if (currentQuoteId) {
        // Update existing
        await supabase.from("quotes").update({
          items: JSON.parse(JSON.stringify(items)),
          notes: notes || null,
          validity_days: validityDays,
          total_ht,
          total_tva,
          total_ttc,
        }).eq("id", currentQuoteId);
      } else {
        // Create new quote
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
            total_ht,
            total_tva,
            total_ttc,
          }])
          .select()
          .single();
        if (insertError) throw insertError;
        setCurrentQuoteId(newQuote.id);

        // Log
        await supabase.from("historique").insert({
          dossier_id: dossierId,
          user_id: user.id,
          action: "quote_created",
          details: `Devis ${numData} créé`,
        });
      }
    } catch (err: unknown) {
      console.error("Auto-save failed:", err);
    } finally {
      setIsSaving(false);
    }
  }, [user, dossierId, currentQuoteId, items, notes, validityDays]);

  // Debounced auto-save
  useEffect(() => {
    if (items.length === 0 && !currentQuoteId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveDraft, 2000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [items, notes, validityDays, saveDraft]);

  const handleGeneratePdf = async () => {
    // Save first
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

    // Generate PDF first if needed
    setIsSending(true);
    try {
      // Generate PDF
      const { data: pdfData, error: pdfError } = await supabase.functions.invoke("generate-quote-pdf", {
        body: { quote_id: currentQuoteId },
      });
      if (pdfError) throw pdfError;

      // Send email
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
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/95 backdrop-blur px-4 sm:px-6 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/dossier/${dossierId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <BulbizLogo size={20} />
        <span className="font-semibold text-foreground truncate ml-2">
          {quoteNumber || "Nouveau devis"}
        </span>
        {isSaving && (
          <span className="text-xs text-muted-foreground ml-auto">Sauvegarde…</span>
        )}
      </header>

      {/* Tabs */}
      <main className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3 mb-6">
            <TabsTrigger value="client" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Client</span>
            </TabsTrigger>
            <TabsTrigger value="lignes" className="gap-2">
              <ListOrdered className="h-4 w-4" />
              <span className="hidden sm:inline">Lignes</span>
            </TabsTrigger>
            <TabsTrigger value="resume" className="gap-2">
              <FileCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Résumé</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="client">
            <StepClientInfo
              dossier={dossier}
              notes={notes}
              validityDays={validityDays}
              onNotesChange={setNotes}
              onValidityChange={setValidityDays}
            />
          </TabsContent>

          <TabsContent value="lignes">
            <StepItems items={items} setItems={setItems} />
          </TabsContent>

          <TabsContent value="resume">
            <StepSummary
              dossier={dossier}
              items={items}
              notes={notes}
              validityDays={validityDays}
              quoteNumber={quoteNumber || "—"}
              isSaving={isSaving}
              isSending={isSending}
              isGeneratingPdf={isGeneratingPdf}
              onGeneratePdf={handleGeneratePdf}
              onSend={handleSend}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Sticky totals footer when on items tab */}
      {tab === "lignes" && <QuoteTotalsFooter items={items} />}
    </div>
  );
}
