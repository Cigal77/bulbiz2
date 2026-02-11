import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useInvoices, useInvoiceActions, INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from "@/hooks/useInvoices";
import { useToast } from "@/hooks/use-toast";
import type { Dossier } from "@/hooks/useDossier";
import type { AppointmentStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  FileText, Plus, Eye, Send, CheckCircle2, Loader2,
} from "lucide-react";

interface InvoiceBlockProps {
  dossier: Dossier;
}

export function InvoiceBlock({ dossier }: InvoiceBlockProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const appointmentStatus = ((dossier as any).appointment_status || "none") as AppointmentStatus;
  const { data: invoices = [], isLoading } = useInvoices(dossier.id);
  const { generateFromQuote } = useInvoiceActions(dossier.id);

  // Show if RDV terminé, or invoice statuses, or invoices exist
  const showStatuses = ["rdv_termine", "invoice_pending", "invoice_paid"];
  if (appointmentStatus !== "done" && !showStatuses.includes(dossier.status) && invoices.length === 0) return null;

  const handleGenerate = () => {
    generateFromQuote.mutate(undefined, {
      onSuccess: (invoice: any) => {
        toast({ title: "Facture générée ✅", description: `N° ${invoice.invoice_number}` });
        navigate(`/dossier/${dossier.id}/facture/${invoice.id}`);
      },
      onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          Facture
        </h3>
        {invoices.length > 0 && (
          <Badge className={cn("text-[10px]", INVOICE_STATUS_COLORS[invoices[0].status])}>
            {INVOICE_STATUS_LABELS[invoices[0].status]}
          </Badge>
        )}
        {invoices.length === 0 && (
          <Badge variant="secondary" className="text-[10px]">À créer</Badge>
        )}
      </div>

      {/* Invoice list */}
      {invoices.map((inv) => (
        <div key={inv.id} className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{inv.invoice_number}</span>
            <Badge className={cn("text-[10px]", INVOICE_STATUS_COLORS[inv.status])}>
              {INVOICE_STATUS_LABELS[inv.status]}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Émise le {format(new Date(inv.issue_date), "d MMMM yyyy", { locale: fr })}
            {inv.total_ttc ? ` — ${Number(inv.total_ttc).toFixed(2)} € TTC` : ""}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => navigate(`/dossier/${dossier.id}/facture/${inv.id}`)}
            >
              <Eye className="h-3 w-3" />
              Modifier
            </Button>
          </div>
        </div>
      ))}

      {/* Generate button */}
      {invoices.length === 0 && (
        <Button
          variant="default"
          size="sm"
          className="w-full gap-1.5"
          onClick={handleGenerate}
          disabled={generateFromQuote.isPending}
        >
          {generateFromQuote.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Générer la facture
        </Button>
      )}
    </div>
  );
}
