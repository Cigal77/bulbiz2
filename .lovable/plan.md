

Let me explore the existing catalog infrastructure first to design this properly.
<lov-tool-use id="toolu_vrtx_0167iHG8ix7iXZcptU6iaPDe" name="code--exec" integration-id="code" data="{\"command\": \"psql -c \\\"SELECT type, COUNT(*) FROM catalog_material GROUP BY type\\\" && psql -c \\\"SELECT category_path, COUNT(*) FROM catalog_material GROUP BY category_path ORDER BY category_path LIMIT 30\\\" && psql -c \\\"SELECT COUNT(*) as total, COUNT(user_id) as user_owned, COUNT(*) - COUNT(user_id) as global FROM catalog_material\\\"\", \"user_facing_description\": \"Inspecting current material catalog data\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01DjQqhbdzPXYLofrRFZAd7m" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/quote-editor/QuoteItemRow.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01WFpAJYo1ua9cnw8h91X9YN" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/import-catalog/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01NwF6kY2uVvRfGBdCMKyHwL" name="code--exec" integration-id="code" data="{\"command\": \"psql -c \\\"SELECT type, COUNT(*) FROM catalog_material GROUP BY type\\\" && psql -c \\\"SELECT COUNT(*) as total, COUNT(user_id) as user_owned FROM catalog_material\\\"\", \"user_facing_description\": \"Inspecting current material catalog\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Mtq2TYPr7XPdAmbNypwazA" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/import-catalog/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_0196jUsB2Ze5nigJJwyJ5vaS" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/quote-editor/QuoteItemRow.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_0196oWiWwjXHwqWqThLeiw14" name="code--view" integration-id="code" data="{\"file_path\": \"src/App.tsx\", \"lines\": \"1-100\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01LF9WARoG4NrQStfEJTCJru" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/DesktopSidebar.tsx\", \"lines\": \"38-50\"}">
</lov-tool-use>
I have enough context. Let me present the plan.

<lov-plan>

## Plan — Bibliothèque Matériel Intelligente (PATCH 5)

### 1. Migrations DB

**Étendre `catalog_material`** (colonnes manquantes) :
- `subcategory` text, `supplier` text, `supplier_ref` text, `internal_code` text, `brand` text, `notes` text
- `is_favorite` boolean default false
- `usage_count` int default 0
- `last_used_at` timestamptz
- `last_used_price` numeric
- `import_batch_id` uuid (lien vers job d'import)

**Nouvelle table `catalog_import_jobs`** : trace les imports CSV
- `id`, `user_id`, `filename`, `total_rows`, `created_count`, `updated_count`, `skipped_count`, `error_count`, `errors` jsonb, `mapping` jsonb, `status` ('pending'|'processing'|'done'|'failed'), `created_at`
- RLS : user_id = auth.uid()

**Nouvelle table `catalog_usage_log`** (historique intelligent passif) :
- `id`, `user_id`, `material_id` (nullable, si match catalogue), `label`, `unit_price`, `vat_rate`, `unit`, `quote_id`, `created_at`
- RLS : user_id = auth.uid()
- Trigger automatique : à chaque `INSERT` dans `quote_lines`, log la ligne + incrémente `usage_count` / `last_used_at` / `last_used_price` si match catalogue

### 2. Page `/bibliotheque-materiel` (route protégée, ajoutée à App.tsx + sidebar)

**Layout** : header + onglets + grille/liste
**7 onglets** :
1. **Mon matériel** — articles `user_id = auth.uid()`
2. **Récent** — triés par `last_used_at desc`
3. **Favoris** — `is_favorite = true`
4. **Souvent utilisé** — top 50 par `usage_count`
5. **Base Bulbiz BTP** — articles `user_id IS NULL` (139 existants)
6. **Importé CSV** — filtré par `import_batch_id IS NOT NULL`
7. **Suggestions IA** — édition v1 : items détectés dans devis passés mais absents du catalogue (groupés par label normalisé)

**Chaque carte article** :
- Nom + badge type (matériel/main-d'œuvre/déplacement/forfait/consommable)
- Catégorie > sous-catégorie
- Prix HT + TVA + unité
- Compteur usage + dernière utilisation
- Boutons : ⭐ favori, ✏️ éditer, 🗑️ supprimer (si custom), ➕ ajouter au devis (si vient d'un éditeur)

**Recherche** : input avec filtre temps réel (label, tags, supplier, internal_code)
**Filtres** : type, catégorie, fournisseur

### 3. Flow d'import CSV (Dialog multi-étapes)

Bouton "Importer CSV" en haut de la page bibliothèque + onglet "Importé CSV".

**Étapes** :
1. **Upload** — dropzone + sélection fichier (.csv, .xlsx via Papaparse)
2. **Détection auto** — parse première ligne, fuzzy-match les colonnes vs schéma cible (nom→label, prix→unit_price, etc.)
3. **Mapping guidé** — table : "Colonne CSV → Champ Bulbiz" avec selects (option "Ignorer")
4. **Prévisualisation** — 10 premières lignes formatées + warnings (doublons détectés par `slug`/`internal_code`, valeurs invalides)
5. **Stratégie doublons** — radio : "Créer en double" / "Mettre à jour" / "Ignorer"
6. **Validation & Import** — appel edge function `import-catalog-csv` qui crée un `catalog_import_jobs` et insère en batch
7. **Rapport** — résumé créés/mis à jour/ignorés/erreurs + lien vers articles importés

### 4. Edge Function `import-catalog-csv` (nouvelle)
Input : `{ rows: [], mapping: {}, dedup_strategy }`
Logique : valide chaque ligne avec Zod, génère `slug` si absent, match par `slug`/`internal_code` pour dédup, batch insert/update, retourne `{ job_id, summary }`.

### 5. Suggestions intelligentes dans l'éditeur devis

**Modifier `QuoteItemRow.tsx`** : remplacer l'`Input` "Désignation" par un combobox autocomplete (Command + Popover) qui :
- À la frappe (≥2 chars), query unifiée :
  - `catalog_material` (Mon matériel + favoris en tête, puis Bulbiz)
  - `catalog_usage_log` agrégé par label (lignes fréquentes hors catalogue)
- Affiche groupes : ⭐ Favoris → 🕐 Récent → 🔥 Souvent utilisé → 📚 Bulbiz BTP
- Au choix → préremplit label, unit, unit_price (dernier prix utilisé), vat_rate, type
- Footer : "+ Créer nouveau" → ajout rapide au catalogue

**Hook `useMaterialSuggestions(query)`** :
- Combine `catalog_material` + `catalog_usage_log`
- Tri intelligent : favori > usage_count > recency
- Cache React Query

### 6. Fiche article éditable (Sheet/Dialog)
Tous les champs : name, category, subcategory, description, unit, prix HT, TVA, type de ligne, supplier, supplier_ref, internal_code, brand, tags (chips), notes, ⭐ favori. Sauvegarde dans `catalog_material`.

### 7. Navigation
- Ajouter dans `DesktopSidebar.NAV_ITEMS` : `{ id: "biblio", icon: Library, label: "Matériel", path: "/bibliotheque-materiel" }`
- Ajouter dans `MobileBottomNav` (5e onglet ou remplacer Paramètres avec menu)
- Route lazy dans `App.tsx`

### 8. États vides & microcopies
- Mon matériel vide → CTA "Importer mon premier CSV" + "Parcourir la base Bulbiz"
- Recherche sans résultat → "Aucun article trouvé. Créer ?"
- Import en cours → progress bar + "Ne ferme pas cette fenêtre"
- Import terminé → "✓ 42 articles ajoutés, 3 mis à jour, 2 ignorés"

### Fichiers
**Créés** :
- `src/pages/MaterialLibrary.tsx`
- `src/components/material-library/MaterialCard.tsx`
- `src/components/material-library/MaterialEditDialog.tsx`
- `src/components/material-library/CsvImportDialog.tsx` (multi-step)
- `src/components/material-library/SuggestionsPanel.tsx`
- `src/components/quote-editor/MaterialAutocomplete.tsx` (combobox réutilisable)
- `src/hooks/useMaterialLibrary.tsx` (CRUD + tabs)
- `src/hooks/useMaterialSuggestions.tsx` (autocomplete devis)
- `src/hooks/useCatalogImport.tsx`
- `supabase/functions/import-catalog-csv/index.ts`

**Modifiés** :
- `src/components/quote-editor/QuoteItemRow.tsx` — combobox autocomplete au lieu de l'input label
- `src/components/DesktopSidebar.tsx` — nouvel item "Matériel"
- `src/components/MobileBottomNav.tsx` — nouvel item
- `src/App.tsx` — route `/bibliotheque-materiel`

### Hors scope v1
- Synchronisation fournisseurs externes (API SoCoDa, Cedeo…)
- Variations de prix par client / segment
- Édition en masse (bulk) au-delà de l'import
- IA proactive qui suggère catégorisation auto pour les imports — basique regex en v1

