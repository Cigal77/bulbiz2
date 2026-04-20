

L'utilisateur veut que je termine **tout** ce qui reste pour PATCH 6 + PATCH 7. Récap de l'état actuel :

**Déjà fait :**
- Schéma : 9 tables nouvelles (product_sectors/categories, data_sources, ingestion_jobs, intervention_types, intervention_product_packs, product_associations, user_product_usage, user_intervention_kits, user_suggestion_preference)
- Seed : 9 secteurs, 32 catégories, 12 interventions standard
- Hooks : useSmartSuggestions, useInterventionDetection, useSuggestionPreferences, useDataSources, useProductTaxonomy, useInterventionTypes
- UI : SmartSuggestionsPanel, InterventionSuggestionsPanel, AdminCatalogSources

**Restant (le "tout"):**

### Lot A — Wiring & accès
1. Route `/admin/catalogue/sources` dans `App.tsx` (ProtectedRoute + admin check)
2. Lien "Catalogue" dans `DesktopSidebar` visible uniquement pour admin
3. Intégrer `InterventionSuggestionsPanel` dans `AssistantSidebar` (nouvel onglet "Pack" prioritaire)

### Lot B — Lot 3 PATCH 6 (kits perso + arbre intervention + badge)
4. `InterventionDetectedBadge.tsx` — badge en haut de QuoteEditor "Intervention détectée : X" + bouton "Charger le pack"
5. `SaveAsKitDialog.tsx` — bouton "Sauvegarder comme pack" dans QuoteSections, insère dans bundle_templates user
6. `InterventionTreeView.tsx` — arbre visuel des étapes (intégré comme onglet AssistantSidebar)

### Lot C — Worker d'ingestion (PATCH 7 backend)
7. Edge function `ingest-catalog-source` : worker qui lit `data_sources`, crée un `ingestion_jobs`, scrape via Firecrawl OU parse CSV URL, normalise vers `catalog_material` avec `confidence_score`. Bouton "Lancer ingestion" dans `AdminCatalogSources`.
8. Fix erreur runtime 401 "Non authentifié" sur la fonction concernée (probable `summarize-dossier` côté logged-out)

### Lot D — Apprentissage usage
9. Trigger automatique : quand un item est ajouté à un devis, logger dans `user_product_usage` (déjà partiellement via `catalog_usage_log` — étendre avec `intervention_type_id` détecté + `behavior_type`)
10. Hook `useUserPatterns` qui agrège `user_product_usage` par intervention pour reranker les suggestions

### Périmètre v1 (raisonnable pour cette itération)
Je propose de livrer **Lots A + B + C** dans un seul gros patch. Lot D (apprentissage avancé) reste partiellement géré par `useSmartSuggestions` qui exploite déjà `catalog_usage_log` — un raffinement futur plus sophistiqué peut suivre.

### Fichiers

**Créés :**
- `src/components/quote-editor/InterventionDetectedBadge.tsx`
- `src/components/quote-editor/SaveAsKitDialog.tsx`
- `src/components/quote-editor/InterventionTreeView.tsx`
- `supabase/functions/ingest-catalog-source/index.ts`

**Modifiés :**
- `src/App.tsx` — route admin catalogue
- `src/components/DesktopSidebar.tsx` — lien admin (conditionnel `has_role admin`)
- `src/components/quote-editor/AssistantSidebar.tsx` — onglet Pack intervention + onglet Arbre
- `src/pages/QuoteEditor.tsx` — affichage badge + handler save-as-kit
- `src/components/quote-editor/QuoteSections.tsx` — bouton "Sauvegarder comme pack"
- `src/pages/AdminCatalogSources.tsx` — bouton "Lancer ingestion" qui appelle l'edge function
- `supabase/functions/summarize-dossier/index.ts` — fix 401 (probablement appel sans auth header)

**Hooks créés :**
- `src/hooks/useIngestSource.tsx` — mutation pour déclencher l'edge function

### Hors scope (vraiment futur)
- IA de catégorisation auto fine pendant l'ingestion (regex basique en v1)
- Multi-métier hors plomberie/sanitaire/chauffage (extensible mais non seedé)
- UI admin pour éditer manuellement les correspondances produits
- Fusion de doublons inter-source semi-automatique

