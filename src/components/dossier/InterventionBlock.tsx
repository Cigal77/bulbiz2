import type { Dossier } from "@/hooks/useDossier";
import { CATEGORY_LABELS, URGENCY_LABELS, URGENCY_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { MapPin, Wrench, AlertTriangle, ExternalLink, CheckCircle2, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InterventionBlockProps {
  dossier: Dossier;
}

function buildMapsUrl(dossier: Dossier): string | null {
  const d = dossier as any;
  if (d.google_place_id) {
    return `https://www.google.com/maps/search/?api=1&query_place_id=${d.google_place_id}`;
  }
  if (d.lat && d.lng) {
    return `https://www.google.com/maps/@${d.lat},${d.lng},17z`;
  }
  if (dossier.address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dossier.address)}`;
  }
  return null;
}

function buildWazeUrl(dossier: Dossier): string | null {
  const d = dossier as any;
  if (d.lat && d.lng) {
    return `https://waze.com/ul?ll=${d.lat},${d.lng}&navigate=yes`;
  }
  if (dossier.address) {
    return `https://waze.com/ul?q=${encodeURIComponent(dossier.address)}&navigate=yes`;
  }
  return null;
}

export function InterventionBlock({ dossier }: InterventionBlockProps) {
  const mapsUrl = buildMapsUrl(dossier);
  const wazeUrl = buildWazeUrl(dossier);
  const isVerified = !!(dossier as any).google_place_id;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Intervention</h3>
      
      <div className="space-y-3">
        {dossier.address ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm font-medium text-foreground">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <span>{dossier.address}</span>
            </div>
            {isVerified ? (
              <span className="inline-flex items-center gap-1 text-xs text-success ml-6">
                <CheckCircle2 className="h-3 w-3" /> Adresse vérifiée
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-warning ml-6">
                <AlertTriangle className="h-3 w-3" /> Adresse non vérifiée
              </span>
            )}
            <div className="flex gap-2 ml-6">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" asChild>
                <a href={mapsUrl!} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                  Google Maps
                </a>
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" asChild>
                <a href={wazeUrl!} target="_blank" rel="noopener noreferrer">
                  <Navigation className="h-3 w-3" />
                  Waze
                </a>
              </Button>
            </div>
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
