import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useComplianceProfile } from "@/hooks/useComplianceProfile";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageLoader } from "@/components/PageLoader";

interface ComplianceGuardProps {
  children: ReactNode;
}

/**
 * Garde de redirection vers l'onboarding conformité.
 * Comptes existants (au moins 1 devis/facture) : pas de redirection brutale.
 */
export function ComplianceGuard({ children }: ComplianceGuardProps) {
  const { profile, isLoading } = useComplianceProfile();
  const { user } = useAuth();
  const location = useLocation();

  const existingDocsQuery = useQuery({
    queryKey: ["compliance-guard-existing-docs", user?.id],
    queryFn: async () => {
      const [{ count: qCount }, { count: iCount }] = await Promise.all([
        supabase.from("quotes").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("invoices").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
      ]);
      return (qCount ?? 0) + (iCount ?? 0);
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  if (isLoading || existingDocsQuery.isLoading) return <PageLoader />;

  const hasExistingDocs = (existingDocsQuery.data ?? 0) > 0;

  if (!profile?.onboarding_compliance_completed_at && !hasExistingDocs) {
    return <Navigate to="/onboarding/conformite" state={{ from: location.pathname, reason: "compliance_required" }} replace />;
  }

  return <>{children}</>;
}
