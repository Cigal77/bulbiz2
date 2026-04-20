import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useComplianceProfile } from "@/hooks/useComplianceProfile";
import { PageLoader } from "@/components/PageLoader";

interface ComplianceGuardProps {
  children: ReactNode;
}

/**
 * Garde de redirection vers l'onboarding conformité.
 * Bloque l'accès aux pages devis/facture tant que la configuration légale n'est pas terminée.
 */
export function ComplianceGuard({ children }: ComplianceGuardProps) {
  const { profile, isLoading } = useComplianceProfile();
  const location = useLocation();

  if (isLoading) return <PageLoader />;

  if (!profile?.onboarding_compliance_completed_at) {
    return <Navigate to="/onboarding/conformite" state={{ from: location.pathname, reason: "compliance_required" }} replace />;
  }

  return <>{children}</>;
}
