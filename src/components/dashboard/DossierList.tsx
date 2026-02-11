import type { Dossier } from "@/hooks/useDossiers";
import { STATUS_LABELS, STATUS_COLORS, CATEGORY_LABELS, URGENCY_LABELS, URGENCY_COLORS, APPOINTMENT_STATUS_LABELS } from "@/lib/constants";
import type { AppointmentStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Phone, MapPin, Clock, Calendar, AlertTriangle, Send, Check, Receipt } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface DossierListProps {
  dossiers: Dossier[];
  onSelect: (dossier: Dossier) => void;
}

const RDV_BADGE_CONFIG: Partial<Record<AppointmentStatus, { label: string; className: string; icon: React.ReactNode }>> = {
  rdv_pending: {
    label: "RDV : créneaux à proposer",
    className: "bg-warning/15 text-warning border-warning/30",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  slots_proposed: {
    label: "RDV : en attente client",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/30",
    icon: <Send className="h-3 w-3" />,
  },
  client_selected: {
    label: "RDV : en attente client",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800/30",
    icon: <Clock className="h-3 w-3" />,
  },
};

function AppointmentBadge({ dossier }: { dossier: Dossier }) {
  const status = (dossier.appointment_status || "none") as AppointmentStatus;

  if (status === "none" || status === "cancelled") return null;

  // Done
  if (status === "done") {
    return (
      <Badge className="bg-primary/15 text-primary border-primary/30 text-[11px] gap-1 font-medium">
        <Check className="h-3 w-3" />
        RDV terminé
      </Badge>
    );
  }

  // Confirmed RDV: show date + time prominently
  if (status === "rdv_confirmed") {
    const date = dossier.appointment_date as string | null;
    const timeStart = dossier.appointment_time_start as string | null;
    const timeEnd = dossier.appointment_time_end as string | null;

    if (!date) return null;

    const dateStr = format(new Date(date), "EEE d/MM", { locale: fr });
    const timeStr = timeStart && timeEnd ? `${timeStart.slice(0, 5)}–${timeEnd.slice(0, 5)}` : "";

    return (
      <Badge className="bg-success/15 text-success border-success/30 text-[11px] gap-1 font-medium">
        <Calendar className="h-3 w-3" />
        RDV : {dateStr}{timeStr ? ` — ${timeStr}` : ""}
      </Badge>
    );
  }

  // Other statuses
  const config = RDV_BADGE_CONFIG[status];
  if (!config) return null;

  return (
    <Badge className={cn("text-[11px] gap-1 font-medium border", config.className)}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

function InvoiceBadge({ dossier }: { dossier: Dossier }) {
  if (dossier.status === "invoice_pending") {
    return (
      <Badge className="bg-warning/15 text-warning border-warning/30 text-[11px] gap-1 font-medium">
        <Receipt className="h-3 w-3" />
        Facture : en attente
      </Badge>
    );
  }
  if (dossier.status === "invoice_paid") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30 text-[11px] gap-1 font-medium">
        <Receipt className="h-3 w-3" />
        Facture : payée
      </Badge>
    );
  }
  return null;
}

export function DossierList({ dossiers, onSelect }: DossierListProps) {
  if (dossiers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <Clock className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-lg font-medium text-foreground">Aucun dossier</p>
        <p className="text-sm text-muted-foreground mt-1">
          Créez votre premier dossier pour commencer.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {dossiers.map((dossier) => (
        <button
          key={dossier.id}
          onClick={() => onSelect(dossier)}
          className="w-full text-left rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm group"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-1.5">
              {/* Client name + urgency */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground truncate">
                  {dossier.client_first_name || dossier.client_last_name
                    ? `${dossier.client_first_name ?? ""} ${dossier.client_last_name ?? ""}`.trim()
                    : "Client sans nom"}
                </span>
                <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", URGENCY_COLORS[dossier.urgency])}>
                  {URGENCY_LABELS[dossier.urgency]}
                </span>
              </div>

              {/* Category + address */}
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground/80">
                  {CATEGORY_LABELS[dossier.category]}
                </span>
                {dossier.address && (
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{dossier.address}</span>
                  </span>
                )}
              </div>

              {/* RDV + Invoice badges */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <AppointmentBadge dossier={dossier} />
                <InvoiceBadge dossier={dossier} />
              </div>

              {/* Phone + date */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {dossier.client_phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {dossier.client_phone}
                  </span>
                )}
                {dossier.client_phone && <span>·</span>}
                <span>
                  {formatDistanceToNow(new Date(dossier.created_at), { addSuffix: true, locale: fr })}
                </span>
              </div>
            </div>

            {/* Status badge */}
            <div className={cn("shrink-0 rounded-md px-2.5 py-1 text-xs font-medium", STATUS_COLORS[dossier.status])}>
              {STATUS_LABELS[dossier.status]}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
