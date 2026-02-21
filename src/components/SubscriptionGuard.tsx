/**
 * SubscriptionGuard
 *
 * Enveloppe les fonctionnalités réservées aux abonnés Pro.
 * Affiche un overlay "Passer Pro" si l'utilisateur est en plan free.
 *
 * Usage :
 *   <SubscriptionGuard>
 *     <MonComposantPro />
 *   </SubscriptionGuard>
 *
 * Ou, pour bloquer seulement un bouton :
 *   <SubscriptionGuard inline>
 *     <Button>Exporter PDF</Button>
 *   </SubscriptionGuard>
 */

import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SubscriptionGuardProps {
  children: React.ReactNode;
  /** Mode inline : affiche juste le cadenas sur l'élément enfant */
  inline?: boolean;
}

export function SubscriptionGuard({ children, inline = false }: SubscriptionGuardProps) {
  const { subscription, isLoading } = useSubscription();
  const navigate = useNavigate();

  if (isLoading) return <>{children}</>;

  if (subscription?.isPro) return <>{children}</>;

  if (inline) {
    return (
      <div className="relative inline-flex">
        <div className="opacity-40 pointer-events-none select-none">{children}</div>
        <button
          className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-md"
          onClick={() => navigate("/pricing")}
        >
          <Lock className="h-4 w-4 text-gray-600" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6">
      <div className="opacity-30 pointer-events-none select-none">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-white/80 backdrop-blur-sm">
        <Lock className="h-8 w-8 text-gray-500" />
        <p className="text-sm font-medium text-gray-700">Fonctionnalité Pro</p>
        <Button size="sm" onClick={() => navigate("/pricing")}>
          Passer à Pro
        </Button>
      </div>
    </div>
  );
}
