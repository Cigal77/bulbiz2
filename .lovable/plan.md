

Je dois explorer l'existant avant de planifier. Le module devis/facturation a déjà été partiellement implémenté (Lot 1 conformité). Je dois identifier ce qui existe vraiment vs ce qui doit être restructuré.
<lov-tool-use id="toolu_vrtx_01W3c6ghZF5n5BMZXFVzEShM" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/QuoteEditor.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_014tFQLR8DbFE9SVt3MZq2aH" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/InvoiceEditor.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Ga6yH59xn5P5azwWMzDuVP" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"src/components/quote-editor\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01XfzzwGpHFcSxongrdE2bCz" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/QuoteEditor.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_011e6ZbgCyiaEU3nWiWpdtXo" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/InvoiceEditor.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01G8aPTV9VMUHHvFB7MTbKeV" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"src/components/quote-editor\"}">
</lov-tool-use>
<lov-plan>

Le module devis a déjà une bonne base (sections par type, assistant IA, checklist conformité, header sticky). La facture est plus brute. Je vais structurer les 2 éditeurs autour des **8 blocs cohérents** demandés, harmoniser l'UX mobile-first, et préparer la place pour l'IA — sans tout reconstruire.

## Plan PATCH 1 — Structure module Devis & Facturation

### A. QuoteEditor — réorganisation en 8 blocs

Restructurer `src/pages/QuoteEditor.tsx` autour de blocs en cartes pliables, ordre fixe :
1. **Infos client** (nouveau composant `QuoteClientBlock`) — prérempli depuis dossier, édition rapide nom/email/tél/société, switch particulier/pro
2. **Infos chantier** (nouveau `QuoteWorksiteBlock`) — adresse chantier, switch "même que client"
3. **Infos document** (nouveau `QuoteDocumentBlock`) — N°, date émission, validité, acompte (type + valeur)
4. **Lignes du devis** — réutiliser `QuoteSections` existant (déjà bon)
5. **Totaux** — réutiliser `QuoteTotalsFooter` existant
6. **Checklist conformité** — `ComplianceChecklist` existant + `QuoteSectionChecklist`
7. **Aperçu** (nouveau `QuotePreviewBlock`) — bouton "Aperçu PDF" + résumé compact
8. **Assistant IA** — `AssistantSidebar` existant (desktop) / FAB drawer (mobile), placeholder section "Suggestions IA — bientôt"

### B. InvoiceEditor — restructuration complète

Réécrire `src/pages/InvoiceEditor.tsx` en blocs cohérents :
1. **Origine** (nouveau `InvoiceOriginBlock`) — sélecteur visuel : Depuis devis / Libre / Acompte / Avoir (UI seule pour Lot 1, logique avoir/acompte = Lot 2)
2. **Infos client** — extraire `InvoiceClientBlock`
3. **Infos facture** — extraire `InvoiceDocumentBlock` (date, échéance, type opération)
4. **Lignes** — nouveau composant `InvoiceLineCard` mobile + table desktop, édition inline, dupliquer/supprimer/réordonner ↑↓, transformer ligne en type (matériel/MO/forfait/déplacement) via dropdown
5. **Paiement** (nouveau `InvoicePaymentBlock`) — IBAN, modes, échéance, pénalités B2B auto, acompte
6. **Checklist conformité** — `ComplianceChecklist` (déjà existant, réutilise `validateInvoiceForGeneration`)
7. **Aperçu** — bouton aperçu PDF + résumé totaux
8. **Assistant IA** — placeholder sidebar/FAB cohérent avec QuoteEditor

### C. Composant ligne unifié `EditableLineCard`

Nouveau `src/components/documents/EditableLineCard.tsx` partagé devis/facture :
- Mobile : carte (titre, description repliable, grid qté/unité/PU/TVA, total HT)
- Desktop : ligne compact + actions (dupliquer, supprimer, ↑/↓, dropdown "type de ligne")
- Édition inline (pas de modal)
- Bordure colorée par type (MO/matériel/forfait/déplacement)
- Action "Ajouter remise" (toggle champ discount)

### D. Mode "Devis rapide" (UX seulement, pas de nouvelle route)

Si `dossierId` fourni et aucun quote existant, ouvrir directement QuoteEditor avec :
- client prérempli (déjà fait)
- chantier prérempli (déjà fait)
- bandeau "Devis rapide" en haut avec CTA "+ Ligne main d'œuvre / + Matériel / + Déplacement" (raccourcis 1 clic)
- sticky bottom bar mobile : "Aperçu" + "Envoyer"

### E. États vides & microcopies

- Liste devis vide : illustration + CTA "Créer mon premier devis" + texte "Vos devis apparaîtront ici. Bulbiz les rend conformes automatiquement."
- Liste factures vide : idem
- Aucune ligne dans éditeur : "Ajoutez votre première ligne ou utilisez l'assistant IA →"
- Modal validation : déjà géré par `ComplianceBlockerDialog`

### F. Sticky actions mobile

Barre flottante en bas (mobile) sur les 2 éditeurs :
- Brouillon enregistré ✓ (auto)
- Bouton "Aperçu" (icône)
- Bouton primaire "Envoyer" (plein largeur)

### G. Bibliothèque matériel & Liste devis/factures

**Hors scope de ce patch** — déjà existants (`MaterialPickerPanel` dans assistant, listes dans `DossierDetail` via `QuoteBlock`/`InvoiceBlock`). Notés pour patch ultérieur si refonte demandée.

### Fichiers impactés

**Nouveaux** :
- `src/components/quote-editor/QuoteClientBlock.tsx`
- `src/components/quote-editor/QuoteWorksiteBlock.tsx`
- `src/components/quote-editor/QuoteDocumentBlock.tsx`
- `src/components/quote-editor/QuotePreviewBlock.tsx`
- `src/components/quote-editor/QuickActionsBar.tsx` (sticky mobile + raccourcis)
- `src/components/invoice-editor/InvoiceOriginBlock.tsx`
- `src/components/invoice-editor/InvoiceClientBlock.tsx`
- `src/components/invoice-editor/InvoiceDocumentBlock.tsx`
- `src/components/invoice-editor/InvoiceLinesBlock.tsx`
- `src/components/invoice-editor/InvoicePaymentBlock.tsx`
- `src/components/invoice-editor/InvoicePreviewBlock.tsx`
- `src/components/documents/EditableLineCard.tsx` (partagé)
- `src/components/documents/EmptyDocumentState.tsx`

**Modifiés** :
- `src/pages/QuoteEditor.tsx` (composition en 8 blocs + sticky mobile)
- `src/pages/InvoiceEditor.tsx` (réécriture composition)
- `src/components/quote-editor/QuoteSections.tsx` (intégrer EditableLineCard)

### Hors scope (lots suivants)
- Logique métier avoirs/acomptes (création réelle) → Lot 2
- E-facturation (champs déjà en DB, UI formulaire) → Lot 3
- IA suggestions actives → patch IA dédié
- Drag-and-drop desktop (gardé `↑/↓` simple)

