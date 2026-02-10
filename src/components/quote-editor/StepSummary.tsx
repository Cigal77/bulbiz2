import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Send, Eye, Loader2 } from "lucide-react";
import type { QuoteItem } from "@/lib/quote-types";
import { calcLineTotal, calcTotals } from "@/lib/quote-types";
import type { Dossier } from "@/hooks/useDossier";

interface StepSummaryProps {
  dossier: Dossier;
  items: QuoteItem[];
  notes: string;
  validityDays: number;
  quoteNumber: string;
  isSaving: boolean;
  isSending: boolean;
  isGeneratingPdf: boolean;
  onGeneratePdf: () => void;
  onSend: () => void;
}

export function StepSummary({
  dossier, items, notes, validityDays, quoteNumber,
  isSaving, isSending, isGeneratingPdf, onGeneratePdf, onSend,
}: StepSummaryProps) {
  const { total_ht, total_tva, total_ttc } = calcTotals(items);
  const clientName = `${dossier.client_first_name ?? ""} ${dossier.client_last_name ?? ""}`.trim() || "Client";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Récapitulatif — {quoteNumber}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Client summary */}
          <div className="text-sm space-y-1">
            <p className="font-medium">{clientName}</p>
            {dossier.address && <p className="text-muted-foreground">{dossier.address}</p>}
            {dossier.client_email && <p className="text-muted-foreground">{dossier.client_email}</p>}
          </div>

          {/* Items table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Désignation</th>
                  <th className="text-right px-3 py-2 font-medium">Qté</th>
                  <th className="text-right px-3 py-2 font-medium">PU HT</th>
                  <th className="text-right px-3 py-2 font-medium">Total HT</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-3 py-2">
                      <div>{item.label || "—"}</div>
                      {item.description && <div className="text-xs text-muted-foreground">{item.description}</div>}
                    </td>
                    <td className="text-right px-3 py-2">{item.qty} {item.unit}</td>
                    <td className="text-right px-3 py-2">{item.unit_price.toFixed(2)} €</td>
                    <td className="text-right px-3 py-2 font-medium">{calcLineTotal(item).toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex flex-col items-end gap-1 text-sm">
            <div className="flex gap-8">
              <span className="text-muted-foreground">Total HT</span>
              <span className="font-medium">{total_ht.toFixed(2)} €</span>
            </div>
            <div className="flex gap-8">
              <span className="text-muted-foreground">TVA</span>
              <span className="font-medium">{total_tva.toFixed(2)} €</span>
            </div>
            <div className="flex gap-8 text-base border-t pt-1 mt-1">
              <span className="font-semibold">Total TTC</span>
              <span className="font-bold">{total_ttc.toFixed(2)} €</span>
            </div>
          </div>

          {/* Notes */}
          {notes && (
            <div className="text-xs text-muted-foreground border-t pt-3">
              <p className="font-medium text-foreground mb-1">Notes</p>
              <p className="whitespace-pre-line">{notes}</p>
            </div>
          )}

          <Badge variant="secondary" className="text-xs">
            Validité : {validityDays} jours
          </Badge>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          className="gap-2"
          onClick={onGeneratePdf}
          disabled={isGeneratingPdf || items.length === 0}
        >
          {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
          Générer & prévisualiser PDF
        </Button>
        <Button
          className="gap-2"
          onClick={onSend}
          disabled={isSending || !dossier.client_email || items.length === 0}
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Envoyer au client
        </Button>
        {isSaving && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Sauvegarde…
          </span>
        )}
      </div>
    </div>
  );
}
