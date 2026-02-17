import { useLocation, useNavigate } from "react-router-dom";
import { ClipboardList, FolderOpen, Plus, Calendar, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDossiers } from "@/hooks/useDossiers";
import { useMemo } from "react";
import { isToday, parseISO } from "date-fns";

function useActionBadges() {
  const { data: dossiers } = useDossiers();
  return useMemo(() => {
    if (!dossiers) return { todo: 0, rdvToday: 0 };
    let todo = 0;
    let rdvToday = 0;
    for (const d of dossiers) {
      if (d.status === "devis_a_faire" || d.status === "devis_envoye") todo++;
      if (d.status === "rdv_termine") todo++;
      if (d.status === "invoice_pending") todo++;
      if (d.appointment_date && d.appointment_status === "rdv_confirmed" && isToday(parseISO(d.appointment_date))) {
        rdvToday++;
        todo++;
      }
      if (["devis_signe", "en_attente_rdv"].includes(d.status) && d.appointment_status === "none") {
        todo++;
      }
    }
    return { todo, rdvToday };
  }, [dossiers]);
}

export function MobileBottomNav() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const badges = useActionBadges();
  if (!isMobile) return null;

  const publicPaths = ["/auth", "/client", "/devis/validation", "/facture/view"];
  if (publicPaths.some(p => location.pathname.startsWith(p))) return null;

  const NAV_ITEMS = [
    {
      id: "todo", icon: ClipboardList, label: "À faire",
      path: "/a-faire",
      badge: badges.todo > 0 ? badges.todo : undefined,
      isActive: location.pathname === "/a-faire",
    },
    {
      id: "dossiers", icon: FolderOpen, label: "Dossiers",
      path: "/",
      isActive: location.pathname === "/" && !location.search,
    },
    {
      id: "plus", icon: Plus, label: "Nouveau",
      path: "", isAction: true, isActive: false,
    },
    {
      id: "rdv", icon: Calendar, label: "RDV",
      path: "/rdv",
      badge: badges.rdvToday > 0 ? badges.rdvToday : undefined,
      isActive: location.pathname === "/rdv",
    },
    {
      id: "settings", icon: Settings, label: "Réglages",
      path: "/parametres",
      isActive: location.pathname === "/parametres",
    },
  ];

  const handleNav = (item: typeof NAV_ITEMS[number]) => {
    if (item.isAction) {
      navigate("/nouveau");
    } else {
      navigate(item.path);
    }
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNav(item)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-lg transition-colors min-h-[44px] relative",
                item.isAction
                  ? "text-primary-foreground"
                  : item.isActive
                    ? "text-primary"
                    : "text-muted-foreground"
              )}
            >
              {item.isAction ? (
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary shadow-lg -mt-4">
                  <item.icon className="h-5 w-5 text-primary-foreground" />
                </div>
              ) : (
                <div className="relative">
                  <item.icon className="h-5 w-5" />
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </div>
              )}
              <span className={cn(
                "text-[10px] font-medium leading-none",
                item.isAction ? "text-primary mt-0.5" : ""
              )}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}