import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type SubscriptionPlan = "free" | "pro" | "enterprise";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete" | null;

export interface SubscriptionInfo {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  isPro: boolean;
  isTrialing: boolean;
  isCanceled: boolean;
  isPastDue: boolean;
  referralCode: string | null;
  referralCreditsMonths: number;
}

export function useSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async (): Promise<SubscriptionInfo> => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "subscription_plan, subscription_status, trial_ends_at, current_period_end, referral_code, referral_credits_months"
        )
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;

      const plan = (data?.subscription_plan ?? "free") as SubscriptionPlan;
      const status = (data?.subscription_status ?? null) as SubscriptionStatus;

      return {
        plan,
        status,
        trialEndsAt: data?.trial_ends_at ? new Date(data.trial_ends_at) : null,
        currentPeriodEnd: data?.current_period_end ? new Date(data.current_period_end) : null,
        isPro: (plan === "pro" || plan === "enterprise") && (status === "active" || status === "trialing"),
        isTrialing: status === "trialing",
        isCanceled: status === "canceled",
        isPastDue: status === "past_due",
        referralCode: data?.referral_code ?? null,
        referralCreditsMonths: data?.referral_credits_months ?? 0,
      };
    },
    enabled: !!user?.id,
    staleTime: 60_000, // 1 min
  });

  // Lance une session Stripe Checkout
  const startCheckout = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("create-checkout-session", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: {},
      });
      if (res.error) throw res.error;
      const { url } = res.data as { url: string };
      window.location.href = url;
    },
    onError: () => {
      toast.error("Impossible d'ouvrir la page de paiement. Réessayez.");
    },
  });

  // Ouvre le Stripe Customer Portal
  const openPortal = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke("create-portal-session", {});
      if (res.error) throw res.error;
      const { url } = res.data as { url: string };
      window.location.href = url;
    },
    onError: () => {
      toast.error("Impossible d'ouvrir le portail. Réessayez.");
    },
  });

  return {
    subscription: query.data,
    isLoading: query.isLoading,
    startCheckout: startCheckout.mutate,
    isStartingCheckout: startCheckout.isPending,
    openPortal: openPortal.mutate,
    isOpeningPortal: openPortal.isPending,
  };
}
