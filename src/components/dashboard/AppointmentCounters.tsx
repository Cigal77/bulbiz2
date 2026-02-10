import { useMemo } from "react";
import type { Dossier } from "@/hooks/useDossiers";
import type { AppointmentStatus } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Calendar, Clock, AlertTriangle, Send, CheckCircle2 } from "lucide-react";
import { format, isToday, isTomorrow, isThisWeek } from "date-fns";
import { fr } from "date-fns/locale";

interface AppointmentCountersProps {
  dossiers: Dossier[];
  activeFilter: AppointmentStatus | null;
  onFilterChange: (filter: AppointmentStatus | null) => void;
}

const TILES: { key: AppointmentStatus; label: string; icon: React.ReactNode; color: string; activeColor: string }[] = [
  {
    key: "rdv_pending",
    label: "Créneaux à proposer",
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "text-warning",
    activeColor: "border-warning bg-warning/5 ring-1 ring-warning/20",
  },
  {
    key: "slots_proposed",
    label: "En attente client",
    icon: <Send className="h-4 w-4" />,
    color: "text-blue-600 dark:text-blue-400",
    activeColor: "border-blue-500 bg-blue-50 dark:bg-blue-900/10 ring-1 ring-blue-200 dark:ring-blue-800/30",
  },
  {
    key: "client_selected",
    label: "À confirmer",
    icon: <Clock className="h-4 w-4" />,
    color: "text-orange-600 dark:text-orange-400",
    activeColor: "border-orange-500 bg-orange-50 dark:bg-orange-900/10 ring-1 ring-orange-200 dark:ring-orange-800/30",
  },
  {
    key: "rdv_confirmed",
    label: "RDV pris",
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: "text-success",
    activeColor: "border-success bg-success/5 ring-1 ring-success/20",
  },
];

export function AppointmentCounters({ dossiers, activeFilter, onFilterChange }: AppointmentCountersProps) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    TILES.forEach((t) => { c[t.key] = 0; });
    dossiers.forEach((d) => {
      const status = (d as any).appointment_status as string;
      if (status && c[status] !== undefined) c[status]++;
    });
    return c;
  }, [dossiers]);

  const totalActive = TILES.reduce((sum, t) => sum + counts[t.key], 0);
  if (totalActive === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">Rendez-vous</h2>
        <Badge variant="secondary" className="text-xs">{totalActive}</Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {TILES.map((tile) => {
          const isActive = activeFilter === tile.key;
          const count = counts[tile.key];
          return (
            <button
              key={tile.key}
              onClick={() => onFilterChange(isActive ? null : tile.key)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border p-3 transition-all hover:shadow-sm",
                isActive
                  ? tile.activeColor
                  : "border-border bg-card hover:border-primary/30"
              )}
            >
              <div className={cn("flex items-center gap-1.5 text-xs font-medium", tile.color)}>
                {tile.icon}
                <span>{tile.label}</span>
              </div>
              <span className="text-xl font-bold text-foreground tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Quick date filters for confirmed RDVs
export type RdvDateFilter = "all" | "today" | "tomorrow" | "week";

interface RdvDateFiltersProps {
  active: RdvDateFilter;
  onChange: (f: RdvDateFilter) => void;
}

export function RdvDateFilters({ active, onChange }: RdvDateFiltersProps) {
  const filters: { key: RdvDateFilter; label: string }[] = [
    { key: "all", label: "Tous" },
    { key: "today", label: "Aujourd'hui" },
    { key: "tomorrow", label: "Demain" },
    { key: "week", label: "Cette semaine" },
  ];

  return (
    <div className="flex gap-1.5">
      {filters.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={cn(
            "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
            active === f.key
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

/** Filter dossiers by RDV date range */
export function filterByRdvDate(dossiers: Dossier[], filter: RdvDateFilter): Dossier[] {
  if (filter === "all") return dossiers;
  return dossiers.filter((d) => {
    const date = (d as any).appointment_date;
    if (!date) return false;
    const dt = new Date(date);
    if (filter === "today") return isToday(dt);
    if (filter === "tomorrow") return isTomorrow(dt);
    if (filter === "week") return isThisWeek(dt, { weekStartsOn: 1 });
    return true;
  });
}

/** Sort dossiers by appointment date/time */
export function sortByAppointmentDate(dossiers: Dossier[]): Dossier[] {
  return [...dossiers].sort((a, b) => {
    const dateA = (a as any).appointment_date || "";
    const dateB = (b as any).appointment_date || "";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const timeA = (a as any).appointment_time_start || "";
    const timeB = (b as any).appointment_time_start || "";
    return timeA.localeCompare(timeB);
  });
}
