import { useMemo } from "react";
import type { Historique } from "@/hooks/useDossier";
import { formatDistanceToNow, format, differenceInMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import {
  FolderPlus, Send, FileText, Bell, ArrowRightLeft,
  FilePenLine, FileCheck, FileX, Download, Trash2, UserCheck, Link2
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Mapping tech → humain ──────────────────────────────────────────

interface DisplayEntry {
  id: string;
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  detail: string | null;
  timestamp: Date;
}

function mapEntry(entry: Historique): DisplayEntry {
  const ts = new Date(entry.created_at);
  const action = entry.action;
  const details = entry.details ?? "";

  // Devis
  if (action === "quote_created") {
    return {
      id: entry.id, timestamp: ts,
      icon: <FilePenLine className="h-3.5 w-3.5" />,
      iconColor: "bg-primary/15 text-primary",
      title: "Devis créé",
      detail: details || null,
    };
  }
  if (action === "quote_deleted") {
    return {
      id: entry.id, timestamp: ts,
      icon: <Trash2 className="h-3.5 w-3.5" />,
      iconColor: "bg-destructive/15 text-destructive",
      title: "Devis supprimé",
      detail: details || null,
    };
  }
  if (action === "quote_pdf_generated") {
    return {
      id: entry.id, timestamp: ts,
      icon: <FileText className="h-3.5 w-3.5" />,
      iconColor: "bg-primary/15 text-primary",
      title: "PDF du devis généré",
      detail: details || null,
    };
  }
  if (action === "quote_sent") {
    return {
      id: entry.id, timestamp: ts,
      icon: <Send className="h-3.5 w-3.5" />,
      iconColor: "bg-success/15 text-success",
      title: "Devis envoyé au client",
      detail: details || null,
    };
  }
  if (action === "quote_imported") {
    return {
      id: entry.id, timestamp: ts,
      icon: <Download className="h-3.5 w-3.5" />,
      iconColor: "bg-primary/15 text-primary",
      title: "Devis importé (PDF)",
      detail: details || null,
    };
  }
  if (action === "quote_status_change") {
    let statusLabel = details;
    if (details.includes("Envoyé")) statusLabel = "Statut du devis : Envoyé";
    else if (details.includes("Signé")) statusLabel = "Statut du devis : Signé";
    else if (details.includes("Refusé")) statusLabel = "Statut du devis : Refusé";
    else if (details.includes("Brouillon")) statusLabel = "Statut du devis : Brouillon";
    else statusLabel = "Statut du devis mis à jour";
    return {
      id: entry.id, timestamp: ts,
      icon: <FileCheck className="h-3.5 w-3.5" />,
      iconColor: details.includes("Signé") ? "bg-success/15 text-success"
        : details.includes("Refusé") ? "bg-destructive/15 text-destructive"
        : "bg-primary/15 text-primary",
      title: statusLabel,
      detail: null,
    };
  }

  // Relances
  if (action === "relance_sent" || action === "reminder_sent") {
    const isDevis = details.toLowerCase().includes("devis");
    const relanceType = isDevis ? "Devis non signé" : "Informations manquantes";
    // Try to extract email from details
    const emailMatch = details.match(/[\w.-]+@[\w.-]+/);
    return {
      id: entry.id, timestamp: ts,
      icon: <Bell className="h-3.5 w-3.5" />,
      iconColor: "bg-warning/15 text-warning",
      title: `Relance envoyée – ${relanceType}`,
      detail: emailMatch ? `Envoyée à ${emailMatch[0]}` : details || null,
    };
  }

  // Client / Dossier
  if (action === "dossier_created" || action === "created") {
    return {
      id: entry.id, timestamp: ts,
      icon: <FolderPlus className="h-3.5 w-3.5" />,
      iconColor: "bg-primary/15 text-primary",
      title: "Dossier créé",
      detail: details || "Création manuelle",
    };
  }
  if (action === "client_link_generated" || action === "link_sent") {
    return {
      id: entry.id, timestamp: ts,
      icon: <Link2 className="h-3.5 w-3.5" />,
      iconColor: "bg-primary/15 text-primary",
      title: "Lien client envoyé",
      detail: details || null,
    };
  }
  if (action === "client_form_submitted" || action === "form_completed") {
    return {
      id: entry.id, timestamp: ts,
      icon: <UserCheck className="h-3.5 w-3.5" />,
      iconColor: "bg-success/15 text-success",
      title: "Le client a complété sa demande",
      detail: details || null,
    };
  }

  // Statuts dossier
  if (action === "status_change") {
    let label = "Statut du dossier mis à jour";
    if (details.includes("a_qualifier") || details.includes("qualifier")) label = "Statut du dossier : À qualifier";
    else if (details.includes("devis_a_faire")) label = "Statut du dossier : Devis à faire";
    else if (details.includes("devis_envoye") || details.includes("envoyé")) label = "Statut du dossier : Devis envoyé";
    else if (details.includes("clos_signe") || details.includes("signé")) label = "Statut du dossier : Clos – Signé";
    else if (details.includes("clos_perdu") || details.includes("perdu")) label = "Statut du dossier : Clos – Perdu";
    else if (details.includes("nouveau")) label = "Statut du dossier : Nouveau";
    return {
      id: entry.id, timestamp: ts,
      icon: <ArrowRightLeft className="h-3.5 w-3.5" />,
      iconColor: "bg-muted text-muted-foreground",
      title: label,
      detail: null,
    };
  }

  // Médias
  if (action === "media_added") {
    return {
      id: entry.id, timestamp: ts,
      icon: <FileText className="h-3.5 w-3.5" />,
      iconColor: "bg-muted text-muted-foreground",
      title: "Média ajouté",
      detail: details || null,
    };
  }

  // Relance toggle
  if (action === "relance_toggle") {
    return {
      id: entry.id, timestamp: ts,
      icon: <Bell className="h-3.5 w-3.5" />,
      iconColor: "bg-muted text-muted-foreground",
      title: details.includes("désactivé") ? "Relances automatiques désactivées" : "Relances automatiques activées",
      detail: null,
    };
  }

  // Fallback: display action as-is but clean it up
  return {
    id: entry.id, timestamp: ts,
    icon: <FileText className="h-3.5 w-3.5" />,
    iconColor: "bg-muted text-muted-foreground",
    title: action.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase()),
    detail: details || null,
  };
}

// ── Deduplication: remove duplicate actions within 2 minutes ──

function deduplicateEntries(entries: DisplayEntry[]): DisplayEntry[] {
  const result: DisplayEntry[] = [];
  for (const entry of entries) {
    const isDuplicate = result.some(
      r => r.title === entry.title &&
        Math.abs(differenceInMinutes(r.timestamp, entry.timestamp)) < 2
    );
    if (!isDuplicate) {
      result.push(entry);
    }
  }
  return result;
}

// ── Component ──

interface HistoriqueTimelineProps {
  historique: Historique[];
  isLoading: boolean;
}

export function HistoriqueTimeline({ historique, isLoading }: HistoriqueTimelineProps) {
  const displayEntries = useMemo(() => {
    const mapped = historique.map(mapEntry);
    return deduplicateEntries(mapped);
  }, [historique]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Historique</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Historique</h3>
      {displayEntries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune activité enregistrée.</p>
      ) : (
        <div className="space-y-0">
          {displayEntries.map((entry, idx) => (
            <div key={entry.id} className="flex gap-3 relative">
              {/* Timeline connector */}
              {idx < displayEntries.length - 1 && (
                <div className="absolute left-[13px] top-7 bottom-0 w-px bg-border" />
              )}
              {/* Icon */}
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full shrink-0 z-10",
                entry.iconColor
              )}>
                {entry.icon}
              </div>
              {/* Content */}
              <div className="pb-5 min-w-0">
                <p className="text-sm font-medium text-foreground leading-tight">
                  {entry.title}
                </p>
                {entry.detail && (
                  <p className="text-[13px] text-muted-foreground mt-0.5 leading-snug">
                    {entry.detail}
                  </p>
                )}
                <p
                  className="text-[11px] text-muted-foreground/70 mt-1"
                  title={format(entry.timestamp, "PPPp", { locale: fr })}
                >
                  {formatDistanceToNow(entry.timestamp, { addSuffix: true, locale: fr })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
