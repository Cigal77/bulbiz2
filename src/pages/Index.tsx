import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useDossiers, type Dossier } from "@/hooks/useDossiers";
import { StatusCounters } from "@/components/dashboard/StatusCounters";
import { DossierList } from "@/components/dashboard/DossierList";
import { SearchBar } from "@/components/dashboard/SearchBar";
import { SourceFilter } from "@/components/dashboard/SourceFilter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, Plus, Zap, Settings } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { URGENCY_ORDER } from "@/lib/constants";

type DossierStatus = Database["public"]["Enums"]["dossier_status"];
type DossierSource = Database["public"]["Enums"]["dossier_source"];

const ALL_STATUSES: DossierStatus[] = ["nouveau", "a_qualifier", "devis_a_faire", "devis_envoye", "clos_signe", "clos_perdu"];

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { data: dossiers, isLoading } = useDossiers();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DossierStatus | null>(null);
  const [sourceFilter, setSourceFilter] = useState<DossierSource | null>(null);

  const counts = useMemo(() => {
    const c = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<DossierStatus, number>;
    dossiers?.forEach((d) => { c[d.status]++; });
    return c;
  }, [dossiers]);

  const filtered = useMemo(() => {
    if (!dossiers) return [];
    let list = [...dossiers];

    if (statusFilter) list = list.filter((d) => d.status === statusFilter);
    if (sourceFilter) list = list.filter((d) => d.source === sourceFilter);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.client_first_name.toLowerCase().includes(q) ||
          d.client_last_name.toLowerCase().includes(q) ||
          d.client_phone.includes(q) ||
          d.address.toLowerCase().includes(q)
      );
    }

    // Sort: nouveau first, then by urgency desc, then by date desc
    list.sort((a, b) => {
      if (a.status === "nouveau" && b.status !== "nouveau") return -1;
      if (b.status === "nouveau" && a.status !== "nouveau") return 1;
      const urgDiff = URGENCY_ORDER[b.urgency] - URGENCY_ORDER[a.urgency];
      if (urgDiff !== 0) return urgDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return list;
  }, [dossiers, statusFilter, sourceFilter, search]);

  const handleSelect = (dossier: Dossier) => {
    // Phase 3: navigate to dossier detail
    console.log("Selected dossier:", dossier.id);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 sm:px-6 py-3">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold text-foreground hidden sm:inline">Bulbiz</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Settings className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground hidden md:inline">{user?.email}</span>
          <Button variant="ghost" size="icon" onClick={signOut} className="text-muted-foreground">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Title + action */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dossiers</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {dossiers?.length ?? 0} dossier{(dossiers?.length ?? 0) !== 1 ? "s" : ""} au total
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nouveau dossier</span>
          </Button>
        </div>

        {/* Status counters */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] rounded-xl" />
            ))}
          </div>
        ) : (
          <StatusCounters counts={counts} activeFilter={statusFilter} onFilterChange={setStatusFilter} />
        )}

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex-1 w-full sm:max-w-sm">
            <SearchBar value={search} onChange={setSearch} />
          </div>
          <SourceFilter active={sourceFilter} onChange={setSourceFilter} />
        </div>

        {/* Dossier list */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <DossierList dossiers={filtered} onSelect={handleSelect} />
        )}
      </main>
    </div>
  );
}
