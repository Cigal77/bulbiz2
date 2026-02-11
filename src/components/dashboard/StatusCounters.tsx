import { STATUS_LABELS, STATUS_COLORS, DASHBOARD_STATUSES } from "@/lib/constants";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { FileText, ClipboardList, Send, CheckCircle, XCircle, Receipt, CreditCard } from "lucide-react";

type DossierStatus = Database["public"]["Enums"]["dossier_status"];

const STATUS_ICONS: Partial<Record<DossierStatus, React.ReactNode>> = {
  nouveau: <FileText className="h-4 w-4" />,
  devis_a_faire: <ClipboardList className="h-4 w-4" />,
  devis_envoye: <Send className="h-4 w-4" />,
  clos_signe: <CheckCircle className="h-4 w-4" />,
  clos_perdu: <XCircle className="h-4 w-4" />,
  invoice_pending: <Receipt className="h-4 w-4" />,
  invoice_paid: <CreditCard className="h-4 w-4" />,
};

interface StatusCountersProps {
  counts: Record<DossierStatus, number>;
  activeFilter: DossierStatus | null;
  onFilterChange: (status: DossierStatus | null) => void;
}

export function StatusCounters({ counts, activeFilter, onFilterChange }: StatusCountersProps) {
  // Merge a_qualifier count into nouveau
  const mergedCounts = { ...counts };
  if (mergedCounts.a_qualifier) {
    mergedCounts.nouveau = (mergedCounts.nouveau || 0) + mergedCounts.a_qualifier;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {DASHBOARD_STATUSES.map((status) => (
        <button
          key={status}
          onClick={() => onFilterChange(activeFilter === status ? null : status)}
          className={cn(
            "flex flex-col items-start gap-1 rounded-xl border p-4 transition-all hover:shadow-sm",
            activeFilter === status
              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
              : "border-border bg-card hover:border-primary/30"
          )}
        >
          <div className={cn("flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium", STATUS_COLORS[status])}>
            {STATUS_ICONS[status]}
            <span>{STATUS_LABELS[status]}</span>
          </div>
          <span className="text-2xl font-bold text-foreground tabular-nums">{mergedCounts[status] || 0}</span>
        </button>
      ))}
    </div>
  );
}
