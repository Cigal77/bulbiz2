import type { Dossier } from "@/hooks/useDossiers";
import { STATUS_LABELS, STATUS_COLORS, CATEGORY_LABELS, URGENCY_LABELS, URGENCY_COLORS, SOURCE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Phone, MapPin, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface DossierListProps {
  dossiers: Dossier[];
  onSelect: (dossier: Dossier) => void;
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
            <div className="flex-1 min-w-0 space-y-2">
              {/* Client name + urgency */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground truncate">
                  {dossier.client_first_name} {dossier.client_last_name}
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
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{dossier.address}</span>
                </span>
              </div>

              {/* Phone + source + date */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {dossier.client_phone}
                </span>
                <span>·</span>
                <span>{SOURCE_LABELS[dossier.source]}</span>
                <span>·</span>
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
