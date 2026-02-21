import { useNavigate, useSearchParams } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Zap, Crown } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

const FREE_FEATURES = [
  "5 dossiers actifs",
  "Devis PDF basique",
  "Lien client",
  "Historique 30 jours",
];

const PRO_FEATURES = [
  "Dossiers illimités",
  "Devis + Factures PDF personnalisés",
  "SMS automatiques (relances)",
  "Galerie médias illimitée",
  "Catalogue matériaux",
  "Export comptable",
  "Support prioritaire",
];

export default function Pricing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { subscription, isLoading, startCheckout, isStartingCheckout, openPortal, isOpeningPortal } =
    useSubscription();

  // Feedback après retour de Stripe
  useEffect(() => {
    const status = searchParams.get("payment");
    if (status === "success") {
      toast.success("Abonnement activé ! Bienvenue dans Bulbiz Pro.");
    } else if (status === "canceled") {
      toast.info("Paiement annulé. Tu peux reprendre quand tu veux.");
    }
  }, [searchParams]);

  const isPro = subscription?.isPro;

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-semibold text-lg">Offres Bulbiz</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-8 space-y-6">
        {/* Titre */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Choisissez votre plan</h2>
          <p className="text-gray-500 mt-1">Sans engagement · Résiliation en 1 clic</p>
        </div>

        {/* Plan Gratuit */}
        <Card className={`border-2 ${!isPro ? "border-gray-300" : "border-gray-200"}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Gratuit</CardTitle>
              {!isPro && <Badge variant="secondary">Plan actuel</Badge>}
            </div>
            <CardDescription>Pour démarrer et tester</CardDescription>
            <div className="text-3xl font-bold mt-1">
              0 €<span className="text-base font-normal text-gray-500">/mois</span>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                  <Check className="h-4 w-4 text-gray-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Plan Pro */}
        <Card className={`border-2 ${isPro ? "border-blue-500" : "border-blue-400"} shadow-md`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Crown className="h-5 w-5 text-yellow-500" />
                Pro
              </CardTitle>
              {isPro ? (
                <Badge className="bg-blue-100 text-blue-700">
                  {subscription?.isTrialing ? "Essai en cours" : "Plan actuel"}
                </Badge>
              ) : (
                <Badge className="bg-blue-600">Recommandé</Badge>
              )}
            </div>
            <CardDescription>Pour les artisans qui veulent aller vite</CardDescription>
            <div className="text-3xl font-bold mt-1">
              29 €<span className="text-base font-normal text-gray-500">/mois HT</span>
            </div>
            {!isPro && (
              <p className="text-sm text-blue-600 font-medium">14 jours d'essai gratuit</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="h-4 w-4 text-blue-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            {isPro ? (
              <div className="space-y-2">
                {subscription?.currentPeriodEnd && (
                  <p className="text-xs text-gray-500">
                    Prochain renouvellement :{" "}
                    {subscription.currentPeriodEnd.toLocaleDateString("fr-FR")}
                  </p>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => openPortal()}
                  disabled={isOpeningPortal}
                >
                  {isOpeningPortal ? "Ouverture..." : "Gérer mon abonnement"}
                </Button>
              </div>
            ) : (
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="lg"
                onClick={() => startCheckout()}
                disabled={isStartingCheckout || isLoading}
              >
                <Zap className="h-4 w-4 mr-2" />
                {isStartingCheckout ? "Redirection..." : "Commencer l'essai gratuit"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Crédits parrainage */}
        {(subscription?.referralCreditsMonths ?? 0) > 0 && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-4">
              <p className="text-sm text-green-700 font-medium">
                Vous avez <strong>{subscription?.referralCreditsMonths} mois offerts</strong> grâce
                à votre parrainage. Ils seront appliqués automatiquement lors du prochain renouvellement.
              </p>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-gray-400">
          Paiement sécurisé par Stripe · TVA non applicable — Art. 293 B du CGI
        </p>
      </div>
    </div>
  );
}
