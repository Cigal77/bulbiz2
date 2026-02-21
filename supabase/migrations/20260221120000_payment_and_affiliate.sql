-- ============================================================
-- PAIEMENT + AFFILIATION - Bulbiz
-- ============================================================

-- ============================================================
-- 1. Enum plan
-- ============================================================
CREATE TYPE public.subscription_plan AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'incomplete');

-- ============================================================
-- 2. Colonnes abonnement sur profiles
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id         TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS subscription_plan          subscription_plan NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status        subscription_status,
  ADD COLUMN IF NOT EXISTS trial_ends_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end         TIMESTAMPTZ,
  -- Affiliation
  ADD COLUMN IF NOT EXISTS referral_code              TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by_code           TEXT,
  ADD COLUMN IF NOT EXISTS referral_credits_months    INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- 3. Table subscriptions (historique Stripe)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id    TEXT NOT NULL,
  plan                  subscription_plan NOT NULL DEFAULT 'pro',
  status                subscription_status NOT NULL,
  current_period_start  TIMESTAMPTZ NOT NULL,
  current_period_end    TIMESTAMPTZ NOT NULL,
  cancel_at_period_end  BOOLEAN NOT NULL DEFAULT false,
  canceled_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================
-- 4. Table referrals (suivi des parrainages)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.referrals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  referred_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referral_code   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'converted', 'rewarded')),
  -- Récompense accordée quand l'utilisateur parrainé passe pro
  reward_given_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referrers can view their own referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id);

-- ============================================================
-- 5. Génération automatique du code de parrainage à l'inscription
--    Format : 6 caractères alphanumériques uppercase
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  code TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    -- Génère un code de 6 caractères : lettres + chiffres
    code := upper(substring(md5(gen_random_uuid()::text) FROM 1 FOR 6));
    -- Vérifie l'unicité
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = code) THEN
      NEW.referral_code := code;
      EXIT;
    END IF;
    attempts := attempts + 1;
    IF attempts > 10 THEN
      -- Fallback : 8 caractères
      NEW.referral_code := upper(substring(md5(gen_random_uuid()::text) FROM 1 FOR 8));
      EXIT;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL)
  EXECUTE FUNCTION public.generate_referral_code();

-- Backfill pour les profils existants
UPDATE public.profiles
SET referral_code = upper(substring(md5(gen_random_uuid()::text) FROM 1 FOR 6))
WHERE referral_code IS NULL;

-- ============================================================
-- 6. Fonction utilitaire : est-ce que l'user a un accès pro ?
--    Utilisée dans les RLS ou checks côté serveur
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_pro(uid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = uid
      AND (
        subscription_plan IN ('pro', 'enterprise')
        AND subscription_status IN ('active', 'trialing')
      )
  );
$$;

-- Index utiles
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON public.profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code   ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer       ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user       ON public.subscriptions(user_id);
