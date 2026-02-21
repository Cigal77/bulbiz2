-- Met à jour handle_new_user pour :
--   1. Copier le code de parrainage depuis les métadonnées d'inscription
--   2. Créer automatiquement un enregistrement dans referrals si referred_by_code est fourni

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_code TEXT;
  referrer_profile_id UUID;
BEGIN
  -- Récupérer le code de parrainage depuis les metadata d'inscription
  ref_code := NEW.raw_user_meta_data->>'referred_by_code';

  INSERT INTO public.profiles (user_id, email, first_name, last_name, phone, referred_by_code)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'phone',
    NULLIF(ref_code, '')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'artisan');

  -- Si un code parrain est fourni et valide, créer l'entrée referral
  IF ref_code IS NOT NULL AND ref_code != '' THEN
    SELECT user_id INTO referrer_profile_id
    FROM public.profiles
    WHERE referral_code = ref_code
    LIMIT 1;

    IF referrer_profile_id IS NOT NULL THEN
      INSERT INTO public.referrals (referrer_id, referred_id, referral_code, status)
      VALUES (referrer_profile_id, NEW.id, ref_code, 'converted');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
