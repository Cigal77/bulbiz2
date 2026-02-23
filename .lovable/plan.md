
# Lot 2 : Bugs critiques, UX et branding

## Vue d'ensemble

Ce lot couvre 4 axes principaux : correction du bug de statut RDV, amelioration UX mobile pour les creneaux, personnalisation du branding (remplacement de "Bulbiz"), et numerotation devis/factures avec nom client.

---

## 1. Bug appointment BDD : creneau valide ne change pas le statut

**Probleme** : Quand le client selectionne un creneau via le formulaire client (`submit-client-form` edge function), le statut du dossier reste inchange dans certains cas.

**Analyse** : Dans la fonction `select_slot`, quand il y a un seul creneau (`isSingleSlot`), le code met bien a jour `appointment_status` et `status` a `rdv_pris`. Quand il y a plusieurs creneaux, seul `appointment_status` passe a `client_selected` -- c'est normal, l'artisan doit confirmer.

**Correction** : Le vrai probleme est que `confirmSlot` dans `AppointmentBlock.tsx` met a jour le dossier cote client Supabase mais le `status` sur le dossier (`rdv_pris`) ne se propage pas correctement car le `dossier.status` n'est pas dans les bons etats de depart. On va s'assurer que :
- `confirmSlot` met aussi a jour `status: "rdv_pris"` + `status_changed_at` (deja fait)
- Ajouter un `invalidateQueries` supplementaire pour forcer le refresh cote dashboard
- Verifier que la mutation `setManualRdv` fait la meme chose (deja OK)

**Fichiers** : `src/components/dossier/AppointmentBlock.tsx` -- ajouter invalidation de `["dossiers"]` dans toutes les mutations (deja fait mais verifier `confirmSlot.onSuccess`)

---

## 2. UX mobile choix creneaux (ClientForm)

**Probleme** : Sur mobile, l'experience de selection de creneaux est peu ergonomique.

**Corrections** :
- Agrandir les zones cliquables des creneaux (padding + taille minimale 48px)
- Ajouter un retour haptique visuel (animation de selection)
- Ameliorer le bouton de confirmation (plus grand, sticky en bas)
- Afficher les creneaux avec un formatage plus lisible

**Fichier** : `src/pages/ClientForm.tsx` (section `isSlotMode`)

---

## 3. Numerotation devis/factures avec nom client

**Probleme** : Les numeros de devis (`DEV-YYYY-XXXX`) et factures (`FAC-YYYY-XXXX`) ne contiennent pas le nom du client, ce qui rend l'identification difficile.

**Correction** : Modifier les fonctions SQL `generate_quote_number` et `generate_invoice_number` pour inclure les 3 premieres lettres du nom client (ex: `DEV-2026-DUP-0001`).

**Approche** : Ajouter un parametre optionnel `p_client_name` aux fonctions SQL. Extraire les 3 premieres lettres en majuscules. Si pas de nom, garder le format actuel.

**Fichiers** :
- Migration SQL pour modifier les 2 fonctions
- `src/pages/QuoteEditor.tsx` : passer le nom du client a `generate_quote_number`
- `src/hooks/useInvoices.tsx` : passer le nom du client a `generate_invoice_number`
- `src/components/dossier/ImportDevisDialog.tsx` et `ImportFactureDialog.tsx` : idem

---

## 4. Remplacer "Bulbiz" par le nom de l'artisan dans les emails

**Probleme** : Les emails envoyes via Resend (fallback) utilisent `noreply@bulbiz.fr` comme adresse d'envoi avec "Bulbiz" visible. Le nom de l'artisan est deja utilise comme `artisanName` dans le `from`, mais le domaine `@bulbiz.fr` reste visible.

**Corrections** :
- Le `from` utilise deja `artisanName <noreply@bulbiz.fr>` donc le nom affiche est correct -- pas de changement necessaire sur le nom.
- Verifier que dans `submit-client-form` (auto-confirm), le from utilise bien `artisanName` (OK)
- Dans le composant `BulbizLogo`, rendre le texte "Bulbiz" configurable pour que le formulaire client puisse afficher le nom de l'artisan au lieu de "Bulbiz"
- Dans `ClientForm.tsx`, afficher le nom de l'artisan recupere depuis le profil au lieu du logo Bulbiz

**Fichiers** :
- `supabase/functions/submit-client-form/index.ts` : ajouter le nom de l'artisan dans la reponse `get`
- `src/pages/ClientForm.tsx` : afficher le nom artisan
- `src/components/BulbizLogo.tsx` : optionnel, pas de changement forcement necessaire

---

## Details techniques

### Migration SQL (numerotation)

```text
CREATE OR REPLACE FUNCTION public.generate_quote_number(p_user_id uuid, p_client_name text DEFAULT NULL)
  RETURNS text
  ...
  -- Extraire 3 premieres lettres du nom en majuscules
  -- Format: DEV-YYYY-DUP-0001 ou DEV-YYYY-0001 si pas de nom
```

Meme logique pour `generate_invoice_number`.

### Edge function submit-client-form

Ajouter dans la reponse `get` le champ `artisan_name` recupere depuis la table `profiles` :

```text
-- Fetch profile
const { data: profile } = await supabase.from("profiles")
  .select("company_name, first_name, last_name, phone, email, logo_url")
  .eq("user_id", dossier.user_id).maybeSingle();

// Return artisan_name in response
artisan_name: profile?.company_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Votre artisan"
```

### ClientForm.tsx

Afficher le nom artisan dans le header au lieu du logo Bulbiz pour le formulaire client.

### Fichiers modifies (recapitulatif)

1. `supabase/migrations/` -- nouvelle migration pour les fonctions SQL
2. `supabase/functions/submit-client-form/index.ts` -- artisan_name dans la reponse
3. `src/pages/ClientForm.tsx` -- UX creneaux mobile + nom artisan
4. `src/components/dossier/AppointmentBlock.tsx` -- verification invalidation
5. `src/pages/QuoteEditor.tsx` -- passer client_name au RPC
6. `src/hooks/useInvoices.tsx` -- passer client_name au RPC
7. `src/components/dossier/ImportDevisDialog.tsx` -- passer client_name
8. `src/components/dossier/ImportFactureDialog.tsx` -- passer client_name
