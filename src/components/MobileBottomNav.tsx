import { useLocation, useNavigate } from "react-router-dom";
import { FolderOpen, Calendar, Plus, Receipt, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const NAV_ITEMS = [
  { path: "/", icon: FolderOpen, label: "Dossiers" },
  { path: "/?rdv=1", icon: Calendar, label: "RDV", matchFn: (loc: string, search: string) => search.includes("rdv=1") },
  { path: "/nouveau", icon: Plus, label: "Nouveau", isAction: true },
  { path: "/?invoices=1", icon: Receipt, label: "Factures", matchFn: (loc: string, search: string) => search.includes("invoices=1") },
  { path: "/parametres", icon: Settings, label: "Réglages" },
];

export function MobileBottomNav() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();

  if (!isMobile) return null;

  // Don't show on public pages
  const publicPaths = ["/auth", "/client", "/devis/validation", "/facture/view"];
  if (publicPaths.some(p => location.pathname.startsWith(p))) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.matchFn
            ? item.matchFn(location.pathname, location.search)
            : location.pathname === item.path && !location.search;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-lg transition-colors min-h-[44px]",
                item.isAction
                  ? "text-primary-foreground"
                  : isActive
                    ? "text-primary"
                    : "text-muted-foreground"
              )}
            >
              {item.isAction ? (
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary shadow-lg -mt-4">
                  <item.icon className="h-5 w-5 text-primary-foreground" />
                </div>
              ) : (
                <item.icon className="h-5 w-5" />
              )}
              <span className={cn(
                "text-[10px] font-medium leading-none",
                item.isAction ? "text-primary mt-0.5" : ""
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
