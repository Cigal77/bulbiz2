import { useState, useRef } from "react";
import { useQuotes, useQuoteActions, QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS } from "@/hooks/useQuotes";
import type { Quote, QuoteStatus } from "@/hooks/useQuotes";
import type { Dossier } from "@/hooks/useDossier";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Upload, Loader2, ExternalLink, Send, Trash2, FilePlus,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface QuoteBlockProps {
  dossier: Dossier;
}

export function QuoteBlock({ dossier }: QuoteBlockProps) {
  const { data: quotes = [], isLoading } = useQuotes(dossier.id);
  const { importPdf, updateStatus, deleteQuote } = useQuoteActions(dossier.id);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "Format invalide", description: "Seuls les fichiers PDF sont acceptés.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      await importPdf.mutateAsync(file);
      toast({ title: "Devis importé !" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleStatusChange = async (quoteId: string, status: QuoteStatus) => {
    try {
      await updateStatus.mutateAsync({ quoteId, status });
      toast({ title: `Devis ${QUOTE_STATUS_LABELS[status].toLowerCase()}` });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const handleSendQuote = async (quote: Quote) => {
    if (!dossier.client_email) {
      toast({ title: "Pas d'email client", description: "Ajoutez un email au dossier pour envoyer le devis.", variant: "destructive" });
      return;
    }
    setSendingId(quote.id);
    try {
      const { error } = await supabase.functions.invoke("send-quote", {
        body: { quote_id: quote.id },
      });
      if (error) throw error;
      toast({ title: "Devis envoyé au client !" });
    } catch (err: any) {
      toast({ title: "Erreur d'envoi", description: err.message, variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  const handleDelete = async (quoteId: string) => {
    try {
      await deleteQuote.mutateAsync(quoteId);
      toast({ title: "Devis supprimé" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  // Only show for relevant statuses
  const showStatuses = ["devis_a_faire", "devis_envoye", "clos_signe", "clos_perdu"];
  if (!showStatuses.includes(dossier.status)) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Devis
        </CardTitle>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleImport}
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Importer PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : quotes.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <FilePlus className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <div>
              <p className="text-sm font-medium text-foreground">Aucun devis</p>
              <p className="text-xs text-muted-foreground mt-1">
                Importez un PDF ou créez un devis directement.
              </p>
            </div>
          </div>
        ) : (
          quotes.map((quote) => (
            <QuoteRow
              key={quote.id}
              quote={quote}
              dossier={dossier}
              onStatusChange={handleStatusChange}
              onSend={handleSendQuote}
              onDelete={handleDelete}
              isSending={sendingId === quote.id}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function QuoteRow({
  quote,
  dossier,
  onStatusChange,
  onSend,
  onDelete,
  isSending,
}: {
  quote: Quote;
  dossier: Dossier;
  onStatusChange: (id: string, status: QuoteStatus) => void;
  onSend: (q: Quote) => void;
  onDelete: (id: string) => void;
  isSending: boolean;
}) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{quote.quote_number}</span>
          <Badge variant="secondary" className={cn("text-[10px] shrink-0", QUOTE_STATUS_COLORS[quote.status])}>
            {QUOTE_STATUS_LABELS[quote.status]}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {format(new Date(quote.created_at), "d MMM yyyy", { locale: fr })}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {quote.pdf_url && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
            <a href={quote.pdf_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" />
              Voir PDF
            </a>
          </Button>
        )}

        {quote.status === "brouillon" && (
          <>
            <Button
              variant="default"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => onSend(quote)}
              disabled={isSending || !dossier.client_email}
            >
              {isSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Envoyer au client
            </Button>
          </>
        )}

        <Select
          value={quote.status}
          onValueChange={(v) => onStatusChange(quote.id, v as QuoteStatus)}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["brouillon", "envoye", "signe", "refuse"] as QuoteStatus[]).map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {QUOTE_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {quote.status === "brouillon" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer ce devis ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Le devis {quote.quote_number} sera définitivement supprimé.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(quote.id)}>Supprimer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
