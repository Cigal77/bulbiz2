

## Plan de correction — Débloquer l'onboarding conformité

### Problème principal
À chaque clic sur « Suivant », l'app appelle `updateProfile.mutateAsync(form)` → React Query invalide → refetch → le `useEffect [profile]` **écrase** le state local `form` avec les valeurs serveur. L'utilisateur perd ses saisies en cours et a l'impression que « rien ne se remplit ».

S'ajoute un mapping incomplet : `useComplianceProfile` ne retourne pas tous les champs du profil (manquent `footer_text`, `default_validity_days`, `default_vat_rate`...). Donc quand le useEffect se relance, il efface aussi des champs que l'utilisateur n'avait jamais touchés mais qui existaient en DB.

### Corrections à apporter

**1. `src/pages/ComplianceOnboarding.tsx`** — N'initialiser le form qu'UNE seule fois
- Remplacer `useEffect(() => { if (profile) setForm({...profile}) }, [profile])` par une initialisation conditionnelle qui ne se déclenche que si le form est encore vide (`Object.keys(form).length === 0`)
- Idem pour `insForm` et `setForm_`
- Ajouter un flag `initialized` pour figer l'initialisation

**2. `src/hooks/useComplianceProfile.tsx`** — Compléter le mapping
- Ajouter dans `complianceProfile` les champs manquants utilisés par l'onboarding : `footer_text`, `default_vat_rate`, `default_validity_days`, `default_deposit_type`, `default_deposit_value`, `early_payment_discount_text`, `compliance_score`
- Alternative plus simple : retourner le `profile` brut en plus du `complianceProfile` mappé, et utiliser le brut dans l'onboarding

**3. `src/pages/ComplianceOnboarding.tsx`** — Valider chaque étape avant `Suivant`
- Étape 1 : exiger `legal_form`, `company_name`, `siret` (14 chiffres), `address`, `email`
- Étape 3 : si `decennial_required` → exiger `insurer_name` + `policy_number`
- Étape 4 : exiger `iban`
- Afficher un toast clair si champ manquant (au lieu de juste sauvegarder du vide)

**4. `src/components/compliance/ComplianceGuard.tsx`** — Tolérance comptes existants
- Si l'utilisateur a déjà au moins un devis OU une facture envoyée → ne pas bloquer brutalement, afficher un avertissement non bloquant à la place
- Sinon comportement actuel (redirection)
- Cela évite de bloquer Alex qui a déjà des dossiers existants

**5. `src/pages/ComplianceOnboarding.tsx`** — Bouton « Passer » pendant migration
- Ajouter en haut un petit bouton discret « Configurer plus tard » qui marque `onboarding_compliance_completed_at = now()` même si le score est faible (stocke aussi un flag « partial »)
- Permet aux utilisateurs existants de retourner dans l'app et de compléter progressivement

### Fichiers modifiés (3)
- `src/pages/ComplianceOnboarding.tsx` — fix initialisation + validations + bouton skip
- `src/hooks/useComplianceProfile.tsx` — exposer le profil brut
- `src/components/compliance/ComplianceGuard.tsx` — tolérance comptes existants

### Aucune migration DB nécessaire
Toutes les colonnes existent déjà.

