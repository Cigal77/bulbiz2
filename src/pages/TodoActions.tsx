import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDossiers, type Dossier } from "@/hooks/useDossiers";
import { BulbizLogo } from "@/components/BulbizLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Calendar, FileText, Receipt, Phone, ChevronRight, CheckCircle2, FolderOpen, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isToday, parseISO } from "date-fns";

interface ActionItem {
  id: string;
  dossierId: string;
  clientName: string;
  clientPhone: string | null;
  type: "rdv_today" | "rdv_to_fix" | "nouveau" | "devis_to_make" | "devis_pending" | "invoice_to_send" | "invoice_unpaid" | "link_to_send";
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  iconBg: string;
  urgency: number;
}

function getClientName(d: Dossier) {
  return d.client_first_name || d.client_last_name
    ? `${d.client_first_name ?? ""} ${d.client_last_name ?? ""}`.trim()
    : "Client sans nom";
}

function buildActions(dossiers: Dossier[]): ActionItem[] {
  const items: ActionItem[] = [];

  for (const d of dossiers) {
    const name = getClientName(d);

    // RDV today
    if (d.appointment_date && d.appointment_status === "rdv_confirmed") {
      const date = parseISO(d.appointment_date);
      if (isToday(date)) {
        items.push({
          id: `rdv-today-${d.id}`, dossierId: d.id, clientName: name, clientPhone: d.client_phone,
          type: "rdv_today",
          label: `RDV aujourd'hui${d.appointment_time_start ? ` à ${d.appointment_time_start.slice(0, 5)}` : ""}`,
          sublabel: d.address ?? "Adresse non renseignée",
          icon: <Calendar className="h-4 w-4" />,
          iconBg: "bg-success/15 text-success",
          urgency: 10,
        });
      }
    }

    // Nouveaux dossiers à traiter
    if (d.status === "nouveau" || d.status === "a_qualifier") {
      items.push({
        id: `nouveau-${d.id}`, dossierId: d.id, clientName: name, clientPhone: d.client_phone,
        type: "nouveau",
        label: "Nouveau dossier",
        sublabel: d.description?.slice(0, 50) ?? "À qualifier",
        icon: <FolderOpen className="h-4 w-4" />,
        iconBg: "bg-primary/15 text-primary",
        urgency: 7,
      });
    }

    // Lien client à envoyer (pas d'email/téléphone et pas encore envoyé)
    if (d.status === "nouveau" && !d.client_email && !d.client_phone && !d.client_token) {
      // Already covered by "nouveau" above
    }

    // RDV to fix
    if (["devis_signe", "en_attente_rdv"].includes(d.status) && d.appointment_status === "none") {
      items.push({
        id: `rdv-fix-${d.id}`, dossierId: d.id, clientName: name, clientPhone: d.client_phone,
        type: "rdv_to_fix",
        label: "RDV à fixer",
        sublabel: "Devis signé",
        icon: <Calendar className="h-4 w-4" />,
        iconBg: "bg-warning/15 text-warning",
        urgency: 8,
      });
    }

    // Devis to make
    if (d.status === "devis_a_faire") {
      items.push({
        id: `devis-make-${d.id}`, dossierId: d.id, clientName: name, clientPhone: d.client_phone,
        type: "devis_to_make",
        label: "Devis à faire",
        sublabel: d.description?.slice(0, 50) ?? "Pas de description",
        icon: <FileText className="h-4 w-4" />,
        iconBg: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
        urgency: 6,
      });
    }

    // Devis envoyé (en attente signature > 3j = urgent)
    if (d.status === "devis_envoye") {
      const daysSince = Math.floor((Date.now() - new Date(d.status_changed_at).getTime()) / 86400000);
      items.push({
        id: `devis-wait-${d.id}`, dossierId: d.id, clientName: name, clientPhone: d.client_phone,
        type: "devis_pending",
        label: `Devis en attente${daysSince > 3 ? " ⚠️" : ""}`,
        sublabel: `Envoyé il y a ${daysSince}j`,
        icon: <FileText className="h-4 w-4" />,
        iconBg: daysSince > 3 ? "bg-warning/15 text-warning" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        urgency: daysSince > 3 ? 7 : 3,
      });
    }

    // Invoice to send
    if (d.status === "rdv_termine") {
      items.push({
        id: `invoice-send-${d.id}`, dossierId: d.id, clientName: name, clientPhone: d.client_phone,
        type: "invoice_to_send",
        label: "Facture à envoyer",
        sublabel: "Intervention terminée",
        icon: <Receipt className="h-4 w-4" />,
        iconBg: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
        urgency: 7,
      });
    }

    // Invoice unpaid
    if (d.status === "invoice_pending") {
      const daysSince = Math.floor((Date.now() - new Date(d.status_changed_at).getTime()) / 86400000);
      items.push({
        id: `invoice-unpaid-${d.id}`, dossierId: d.id, clientName: name, clientPhone: d.client_phone,
        type: "invoice_unpaid",
        label: "Facture impayée",
        sublabel: `Envoyée il y a ${daysSince}j`,
        icon: <Receipt className="h-4 w-4" />,
        iconBg: daysSince > 7 ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning",
        urgency: daysSince > 7 ? 9 : 5,
      });
    }
  }

  return items.sort((a, b) => b.urgency - a.urgency);
}

const SECTION_ORDER: ActionItem["type"][] = [
  "rdv_today", "nouveau", "rdv_to_fix", "devis_to_make", "devis_pending", "invoice_to_send", "invoice_unpaid",
];
const SECTION_LABELS: Record<ActionItem["type"], string> = {
  rdv_today: "📅 RDV aujourd'hui",
  nouveau: "🆕 Nouveaux dossiers",
  rdv_to_fix: "📅 RDV à fixer",
  devis_to_make: "📄 Devis à faire",
  devis_pending: "📄 Devis en attente",
  invoice_to_send: "💰 Factures à envoyer",
  invoice_unpaid: "💰 Factures impayées",
  link_to_send: "🔗 Liens client",
};

export default function TodoActions() {
  const navigate = useNavigate();
  const { data: dossiers, isLoading } = useDossiers();

  const actions = useMemo(() => {
    if (!dossiers) return [];
    return buildActions(dossiers);
  }, [dossiers]);

  const grouped = useMemo(() => {
    const map = new Map<ActionItem["type"], ActionItem[]>();
    for (const type of SECTION_ORDER) {
      const items = actions.filter(a => a.type === type);
      if (items.length > 0) map.set(type, items);
    }
    return map;
  }, [actions]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 backdrop-blur px-3 py-2.5">
        <BulbizLogo />
        <ThemeToggle />
      </header>

      <main className="flex-1 p-3 sm:p-6 max-w-2xl mx-auto w-full space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">À faire</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {actions.length} action{actions.length !== 1 ? "s" : ""} en attente
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : actions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-success/15 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <p className="text-sm font-medium text-foreground">Tout est à jour !</p>
            <p className="text-xs text-muted-foreground mt-1">Aucune action en attente.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {Array.from(grouped.entries()).map(([type, items]) => (
              <section key={type}>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {SECTION_LABELS[type]}
                  <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                    {items.length}
                  </span>
                </h2>
                <div className="space-y-1.5">
                  {items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => navigate(`/dossier/${item.dossierId}`)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors text-left min-h-[56px]"
                    >
                      <div className={cn("flex h-8 w-8 items-center justify-center rounded-full shrink-0", item.iconBg)}>
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-tight truncate">
                          {item.clientName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{item.label} · {item.sublabel}</p>
                      </div>
                      {item.clientPhone && (
                        <a
                          href={`tel:${item.clientPhone}`}
                          onClick={e => e.stopPropagation()}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-success/15 text-success shrink-0"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}