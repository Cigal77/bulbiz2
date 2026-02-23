import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDossiers, type Dossier } from "@/hooks/useDossiers";
import { BulbizLogo } from "@/components/BulbizLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Calendar, Phone, ChevronRight, MapPin, Clock, AlertTriangle, Send, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, isThisWeek, parseISO, isBefore, startOfToday } from "date-fns";
import { fr } from "date-fns/locale";
import type { AppointmentStatus } from "@/lib/constants";

interface RdvItem {
  dossier: Dossier;
  clientName: string;
  section: "today" | "upcoming" | "to_fix" | "waiting_client";
  sortKey: string;
}

function getClientName(d: Dossier) {
  return d.client_first_name || d.client_last_name
    ? `${d.client_first_name ?? ""} ${d.client_last_name ?? ""}`.trim()
    : "Client sans nom";
}

function buildRdvItems(dossiers: Dossier[]): RdvItem[] {
  const items: RdvItem[] = [];

  for (const d of dossiers) {
    const name = getClientName(d);
    const status = d.appointment_status as AppointmentStatus;

    // RDV confirmé
    if (status === "rdv_confirmed" && d.appointment_date) {
      const date = parseISO(d.appointment_date);
      const section = isToday(date) ? "today" : "upcoming";
      items.push({
        dossier: d, clientName: name, section,
        sortKey: `${d.appointment_date}${d.appointment_time_start ?? "00:00"}`,
      });
    }

    // En attente client (slots proposés ou client a choisi)
    if (status === "slots_proposed" || status === "client_selected") {
      items.push({
        dossier: d, clientName: name, section: "waiting_client",
        sortKey: d.created_at,
      });
    }

    // RDV à fixer (rdv_pending ou statut dossier en_attente_rdv/devis_signe sans RDV)
    if (status === "rdv_pending" || (status === "none" && ["devis_signe", "en_attente_rdv"].includes(d.status))) {
      items.push({
        dossier: d, clientName: name, section: "to_fix",
        sortKey: d.created_at,
      });
    }
  }

  return items;
}

const SECTION_CONFIG = [
  { key: "today" as const, label: "📅 Aujourd'hui", icon: Calendar, color: "text-success" },
  { key: "upcoming" as const, label: "📅 À venir", icon: Calendar, color: "text-primary" },
  { key: "waiting_client" as const, label: "⏳ En attente client", icon: Send, color: "text-blue-600 dark:text-blue-400" },
  { key: "to_fix" as const, label: "⚠️ RDV à fixer", icon: AlertTriangle, color: "text-warning" },
];

export default function RdvList() {
  const navigate = useNavigate();
  const { data: dossiers, isLoading } = useDossiers();

  const rdvItems = useMemo(() => {
    if (!dossiers) return [];
    return buildRdvItems(dossiers);
  }, [dossiers]);

  const grouped = useMemo(() => {
    const map = new Map<RdvItem["section"], RdvItem[]>();
    for (const sec of SECTION_CONFIG) {
      const items = rdvItems
        .filter(r => r.section === sec.key)
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
      if (items.length > 0) map.set(sec.key, items);
    }
    return map;
  }, [rdvItems]);

  return (
    <div className="flex flex-1 flex-col bg-background min-h-0">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 backdrop-blur px-3 py-2.5 md:hidden">
        <BulbizLogo />
        <ThemeToggle />
      </header>

      <main className="flex-1 p-3 sm:p-6 max-w-4xl mx-auto w-full space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Rendez-vous</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {rdvItems.length} rendez-vous
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : rdvItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Calendar className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Aucun rendez-vous</p>
            <p className="text-xs text-muted-foreground mt-1">Les RDV apparaîtront ici.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {SECTION_CONFIG.map(sec => {
              const items = grouped.get(sec.key);
              if (!items) return null;
              return (
                <section key={sec.key}>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    {sec.label}
                    <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                      {items.length}
                    </span>
                  </h2>
                  <div className="space-y-1.5">
                    {items.map(item => {
                      const d = item.dossier;
                      const hasDate = !!d.appointment_date;
                      return (
                        <button
                          key={d.id}
                          onClick={() => navigate(`/dossier/${d.id}`)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors text-left min-h-[56px]"
                        >
                          <div className={cn("flex h-8 w-8 items-center justify-center rounded-full shrink-0",
                            sec.key === "today" ? "bg-success/15 text-success" :
                            sec.key === "upcoming" ? "bg-primary/15 text-primary" :
                            sec.key === "waiting_client" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                            "bg-warning/15 text-warning"
                          )}>
                            <sec.icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground leading-tight truncate">
                              {item.clientName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {hasDate ? (
                                <>
                                  {format(parseISO(d.appointment_date!), "EEE d MMM", { locale: fr })}
                                  {d.appointment_time_start && ` · ${d.appointment_time_start.slice(0, 5)}`}
                                  {d.appointment_time_end && `–${d.appointment_time_end.slice(0, 5)}`}
                                </>
                              ) : sec.key === "waiting_client" ? (
                                "Créneaux proposés – en attente de réponse"
                              ) : (
                                "RDV à planifier"
                              )}
                            </p>
                          </div>
                          {d.client_phone && (
                            <a
                              href={`tel:${d.client_phone}`}
                              onClick={e => e.stopPropagation()}
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-success/15 text-success shrink-0"
                            >
                              <Phone className="h-4 w-4" />
                            </a>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}