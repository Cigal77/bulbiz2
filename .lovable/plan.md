

## Plan — Fix IA dans toute l'app

### Diagnostic

J'ai testé toutes les fonctions IA backend et **elles fonctionnent toutes** (200 OK) :
- `summarize-dossier` ✅ (résumé dossier)
- `generate-ai-quote-draft` ✅ (pré-devis IA)
- `generate-labour-summary` ✅ (résumé main-d'œuvre)

Le problème n'est donc **pas** côté serveur ni côté clé API.

### Bugs identifiés côté client

**Bug 1 (critique) — `src/components/quote-editor/AiQuoteDraftPanel.tsx` ligne 35-38**
Side effect `generate()` + `setHasAutoTriggered()` appelés **pendant le render** (pas dans un `useEffect`). React peut entrer en boucle ou planter silencieusement → **le pré-devis IA ne s'affiche jamais** quand on arrive via `?ai=auto`.

**Bug 2 — Warnings refs `MaterialCard` & `SuggestionsPanel`**
Ces composants reçoivent un `ref` (probablement via `TabsContent` ou `Card`) sans utiliser `forwardRef`. Pas critique mais pollue la console.

**Bug 3 (probable) — Cache navigateur**
Les `error_logs` montrent encore des erreurs anciennes (`NewQuoteRedirect`, `handleSkip`) déjà corrigées dans le code. Un hard refresh du navigateur peut être nécessaire.

### Corrections

1. **`AiQuoteDraftPanel.tsx`** : remplacer le side effect inline par un `useEffect`
   ```tsx
   useEffect(() => {
     if (autoGenerate && !hasAutoTriggered && !draft && !isGenerating) {
       setHasAutoTriggered(true);
       generate(dossierId, quoteId);
     }
   }, [autoGenerate, hasAutoTriggered, draft, isGenerating, dossierId, quoteId, generate]);
   ```

2. **`MaterialCard.tsx`** + **`SuggestionsPanel.tsx`** : envelopper d'un `React.forwardRef` pour absorber le ref de leur parent.

3. **Améliorer la robustesse de `summarize-dossier`** :
   - Renvoyer un message d'erreur explicite au lieu de "Unknown error" (utiliser `e.message ?? String(e)`)
   - Ne pas faire échouer toute la fonction si le dossier est introuvable → renvoyer 404 propre

4. **Améliorer le feedback UX** dans `useAiQuoteDraft.tsx` et `SummaryBlock.tsx` :
   - Ajouter un `console.error` détaillé sur les erreurs pour faciliter debug futur
   - Afficher un toast quand l'IA échoue (au lieu de silencieusement retomber sur le fallback)

### Fichiers modifiés
- `src/components/quote-editor/AiQuoteDraftPanel.tsx` (fix critique)
- `src/components/material-library/MaterialCard.tsx` (forwardRef)
- `src/components/material-library/SuggestionsPanel.tsx` (forwardRef)
- `supabase/functions/summarize-dossier/index.ts` (meilleurs messages d'erreur)
- `src/components/dossier/SummaryBlock.tsx` (toast sur erreur réelle)
- `src/hooks/useAiQuoteDraft.tsx` (log + toast amélioré)

### Hors scope
- Refonte du module IA (la logique reste identique)
- Migration vers un autre modèle (gemini-3-flash-preview reste OK)

Après ces fixes, je te demanderai de **vider le cache navigateur** (Cmd+Shift+R) pour purger l'ancien bundle qui causait les `NewQuoteRedirect` errors.

