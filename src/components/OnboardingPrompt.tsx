import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";

const DISMISS_KEY = "onboarding_popup_dismissed";
const MAX_ACCOUNT_AGE_DAYS = 30;

function isProfileIncomplete(profile: { company_name?: string | null; phone?: string | null; siret?: string | null } | null) {
  if (!profile) return false;
  return !profile.company_name || !profile.phone || !profile.siret;
}

export function OnboardingPrompt() {
  const { user } = useAuth();
  const { profile, isLoading } = useProfile();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isLoading || !user || !profile) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const createdAt = new Date(user.created_at);
    const ageDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > MAX_ACCOUNT_AGE_DAYS) return;

    if (isProfileIncomplete(profile)) {
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, user, profile]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-20 inset-x-3 z-50 md:bottom-6 md:inset-x-auto md:right-6 md:left-auto md:max-w-sm"
        >
          <div className="relative rounded-2xl border bg-card text-card-foreground shadow-lg p-5">
            <button
              onClick={dismiss}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2 shrink-0">
                <UserCog className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1 min-w-0">
                <p className="font-semibold text-sm">Bienvenue sur Bulbiz ! 👋</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Complétez vos informations pour profiter pleinement de l'outil. Vos retours nous aident à améliorer la solution.
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button size="sm" className="flex-1" onClick={() => { dismiss(); navigate("/parametres"); }}>
                Compléter mon profil
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>
                Plus tard
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
