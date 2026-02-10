import type { Historique } from "@/hooks/useDossier";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  FolderPlus, RefreshCw, MessageSquare, Send, Image, ArrowRightLeft, Bell, FileText
} from "lucide-react";

const ACTION_ICONS: Record<string, React.ReactNode> = {
  created: <FolderPlus className="h-3.5 w-3.5" />,
  status_change: <ArrowRightLeft className="h-3.5 w-3.5" />,
  note: <MessageSquare className="h-3.5 w-3.5" />,
  relance_sent: <Send className="h-3.5 w-3.5" />,
  media_added: <Image className="h-3.5 w-3.5" />,
  relance_toggle: <Bell className="h-3.5 w-3.5" />,
  link_sent: <Send className="h-3.5 w-3.5" />,
  form_completed: <FileText className="h-3.5 w-3.5" />,
};

const ACTION_LABELS: Record<string, string> = {
  created: "Dossier créé",
  status_change: "Statut modifié",
  note: "Note ajoutée",
  relance_sent: "Relance envoyée",
  media_added: "Média ajouté",
  relance_toggle: "Relances",
  link_sent: "Lien envoyé",
  form_completed: "Formulaire rempli",
};

interface HistoriqueTimelineProps {
  historique: Historique[];
  isLoading: boolean;
}

export function HistoriqueTimeline({ historique, isLoading }: HistoriqueTimelineProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Historique</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Historique</h3>
      {historique.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune activité enregistrée.</p>
      ) : (
        <div className="space-y-0">
          {historique.map((entry, idx) => (
            <div key={entry.id} className="flex gap-3 relative">
              {/* Timeline line */}
              {idx < historique.length - 1 && (
                <div className="absolute left-[13px] top-7 bottom-0 w-px bg-border" />
              )}
              {/* Icon */}
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground shrink-0 z-10">
                {ACTION_ICONS[entry.action] ?? <RefreshCw className="h-3.5 w-3.5" />}
              </div>
              {/* Content */}
              <div className="pb-4 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </p>
                {entry.details && (
                  <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">
                    {entry.details}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1" title={format(new Date(entry.created_at), "PPPp", { locale: fr })}>
                  {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: fr })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
