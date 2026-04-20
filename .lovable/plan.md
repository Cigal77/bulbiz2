

L'utilisateur veut pouvoir créer un devis ou une facture directement depuis un dossier. Je dois identifier où placer ces CTAs et m'assurer qu'ils soient cohérents avec l'UX existante.

Exploration : j'ai vu dans `DossierActions.tsx` qu'il y a déjà "Importer devis (PDF)" et "Importer facture (PDF)" mais pas de "Créer devis" / "Créer facture". Il y a aussi `QuoteBlock.tsx` et probablement `InvoiceBlock.tsx` qui affichent les listes existantes. `NextStepBanner` propose contextuellement des actions selon le statut.

Routes existantes : `/dossier/:id/devis/nouveau` (QuoteEditor) et `/dossier/:id/facture/nouveau` (InvoiceEditor) — déjà en place vu les patches précédents.

## Plan — Boutons "Créer devis" et "Créer facture" dans les dossiers

### 1. `DossierActions.tsx` — Ajouter 2 boutons primaires en tête de "Actions rapides"

Ajouter en haut de la liste (avant "Appeler le client"), 2 boutons mis en avant :
- **"Créer un devis"** (icône `FileText`, variant `default` = primaire bleu) → `navigate('/dossier/${id}/devis/nouveau')`
- **"Créer une facture"** (icône `Receipt`, variant `default`) → `navigate('/dossier/${id}/facture/nouveau')`

Garder les boutons "Importer devis (PDF)" et "Importer facture (PDF)" plus bas en `outline` (action secondaire).

### 2. `QuoteBlock.tsx` — CTA "Créer un devis" dans l'état vide et en tête du bloc

- État vide actuel ("Aucun devis") : remplacer par un bouton primaire **"+ Créer un devis"** qui navigue vers l'éditeur (en plus du bouton "Importer PDF" déjà présent).
- Si déjà des devis : ajouter un bouton **"+ Nouveau devis"** discret en haut à droite du bloc, à côté du titre.

### 3. `InvoiceBlock.tsx` — Même traitement
- État vide : bouton primaire **"+ Créer une facture"**.
- Si factures existantes : bouton **"+ Nouvelle facture"** en haut à droite.

### 4. `NextStepBanner.tsx` — Vérifier les CTAs contextuels

Pour les statuts `nouveau`, `a_qualifier`, `devis_a_faire` : s'assurer qu'il y a bien une action "Créer un devis" qui navigue vers `/dossier/:id/devis/nouveau`.
Pour `rdv_termine` : ajouter une action "Créer une facture".
(Vérifier l'existant — si déjà présent, ne rien toucher.)

### 5. Cohérence mobile

Sur mobile (viewport actuel 390px), les boutons dans `DossierActions` sont en pleine largeur empilés — pattern conservé. Hauteur 44px (touch target Bulbiz).

### Fichiers modifiés
- `src/components/dossier/DossierActions.tsx` — 2 nouveaux boutons primaires en tête
- `src/components/dossier/QuoteBlock.tsx` — CTA état vide + bouton header
- `src/components/dossier/InvoiceBlock.tsx` — CTA état vide + bouton header
- `src/components/dossier/NextStepBanner.tsx` — vérification/ajout actions contextuelles si manquantes

### Hors scope
- Pas de changement de routes (déjà en place).
- Pas de modification du flux QuoteEditor/InvoiceEditor (préremplissage déjà fait au patch précédent).

