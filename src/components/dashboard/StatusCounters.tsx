import { STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { FileText, HelpCircle, ClipboardList, Send, CheckCircle, XCircle } from "lucide-react";

type DossierStatus = Database["public"]["Enums"]["dossier_status"];

const STATUS_ICONS: Record<DossierStatus, React.ReactNode> = {
  nouveau: <FileText className="h-4 w-4" />,
  a_qualifier: <HelpCircle className="h-4 w-4" />,
  devis_a_faire: <ClipboardList className="h-4 w-4" />,
  devis_envoye: <Send className="h-4 w-4" />,
  clos_signe: <CheckCircle className="h-4 w-4" />,
  clos_perdu: <XCircle className="h-4 w-4" />,
};

interface StatusCountersProps {
  counts: Record<DossierStatus, number>;
  activeFilter: DossierStatus | null;
  onFilterChange: (status: DossierStatus | null) => void;
}

export function StatusCounters({ counts, activeFilter, onFilterChange }: StatusCountersProps) {
  const statuses: DossierStatus[] = ["nouveau", "a_qualifier", "devis_a_faire", "devis_envoye", "clos_signe", "clos_perdu"];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {statuses.map((status) => (
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
          <span className="text-2xl font-bold text-foreground tabular-nums">{counts[status]}</span>
        </button>
      ))}
    </div>
  );
}
