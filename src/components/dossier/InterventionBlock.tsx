import type { Dossier } from "@/hooks/useDossier";
import { CATEGORY_LABELS, URGENCY_LABELS, URGENCY_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { MapPin, Wrench, AlertTriangle, ExternalLink, CheckCircle2 } from "lucide-react";

interface InterventionBlockProps {
  dossier: Dossier;
}

function buildMapsUrl(dossier: Dossier): string | null {
  if ((dossier as any).google_place_id) {
    return `https://www.google.com/maps/place/?q=place_id:${(dossier as any).google_place_id}`;
  }
  if ((dossier as any).lat && (dossier as any).lng) {
    return `https://www.google.com/maps/@${(dossier as any).lat},${(dossier as any).lng},17z`;
  }
  if (dossier.address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dossier.address)}`;
  }
  return null;
}

export function InterventionBlock({ dossier }: InterventionBlockProps) {
  const mapsUrl = buildMapsUrl(dossier);
  const isVerified = !!(dossier as any).google_place_id;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Intervention</h3>
      
      <div className="space-y-3">
        {dossier.address ? (
          <div className="space-y-1">
            <a
              href={mapsUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 text-sm text-primary hover:underline font-medium"
            >
              <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{dossier.address}</span>
              <ExternalLink className="h-3 w-3 mt-0.5 shrink-0 opacity-50" />
            </a>
            {isVerified ? (
              <span className="inline-flex items-center gap-1 text-xs text-success ml-6">
                <CheckCircle2 className="h-3 w-3" /> Adresse vérifiée
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-warning ml-6">
                <AlertTriangle className="h-3 w-3" /> Adresse non vérifiée
              </span>
            )}
          </div>
        ) : (
          <p className="flex items-start gap-2 text-sm text-muted-foreground italic">
            <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
            Adresse non renseignée
          </p>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
            <Wrench className="h-3 w-3" />
            {CATEGORY_LABELS[dossier.category]}
          </span>
          <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium", URGENCY_COLORS[dossier.urgency])}>
            <AlertTriangle className="h-3 w-3" />
            {URGENCY_LABELS[dossier.urgency]}
          </span>
        </div>

        {dossier.description && (
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
            {dossier.description}
          </p>
        )}
      </div>
    </div>
  );
}
