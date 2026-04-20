

L'utilisateur est sur `/bibliotheque-materiel` onglet "Base Bulbiz BTP" et veut des filtres + catégories pour faciliter la recherche.

Contexte trouvé :
- `MaterialLibrary.tsx` a juste un `Input` de recherche global
- `useMaterialLibrary("bulbiz", search)` retourne tous les matériels globaux (`user_id IS NULL`)
- On dispose maintenant de `product_sectors` (9 secteurs) + `product_categories` (32 catégories) avec hooks `useProductSectors` / `useProductCategories`
- `catalog_material` a déjà `sector_id`, `category_id`, `category_path`, `subcategory`, `brand`, `supplier`
- Vue actuelle : grille de cartes sans groupement

## Plan — Filtres & catégories pour la base Bulbiz BTP

### 1. Nouveau composant `MaterialFilters.tsx`
Barre de filtres horizontale (sticky sous la recherche) avec :
- **Sélecteur Secteur** (chips horizontaux scrollables avec icône emoji) : Tous / Plomberie / Sanitaire / Chauffage / Électricité / etc.
- **Sélecteur Catégorie** (Select dropdown) — alimenté dynamiquement selon le secteur choisi
- **Filtre Type** (Select) : Tous / Matériel / Fourniture / Main-d'œuvre / Forfait
- **Filtre Marque** (Select recherchable) — extraction distincte depuis les résultats
- **Tri** (Select) : Plus utilisés / A→Z / Prix croissant / Prix décroissant
- Bouton **"Réinitialiser"** quand au moins 1 filtre actif

### 2. Étendre `useMaterialLibrary` 
Ajouter un paramètre `filters` :
```ts
interface MaterialFilters {
  sectorId?: string | null;
  categoryId?: string | null;
  type?: string | null;
  brand?: string | null;
  sort?: "popular" | "alpha" | "price_asc" | "price_desc";
}
useMaterialLibrary(tab, search, filters)
```
La requête Supabase applique `.eq("sector_id", …)`, `.eq("category_id", …)`, `.eq("type", …)`, `.ilike("brand", …)` + ordre dynamique.

### 3. Affichage groupé par catégorie (onglet Bulbiz uniquement)
Quand aucun filtre catégorie actif, regrouper visuellement les cartes par `category_path` avec un header sticky par groupe + compteur. Quand filtre actif → grille plate normale.

### 4. Compteurs
- Badge sur chaque chip secteur : nombre de matériels disponibles dans ce secteur (calculé via une query `count`)
- Compteur de résultats global au-dessus de la grille : "32 articles trouvés"

### 5. État vide enrichi
"Aucun article ne correspond à ces filtres" + bouton "Effacer les filtres".

### 6. Persistance légère
Mémoriser le dernier secteur/tri sélectionné via `localStorage` (clé `bulbiz_material_filters`) pour retrouver l'état au prochain accès.

### Périmètre
Filtres actifs uniquement sur les onglets `bulbiz`, `mine`, `imported` et `frequent`. Les autres onglets (favoris, recent, suggestions) restent simples.

### Fichiers
**Créés :**
- `src/components/material-library/MaterialFilters.tsx`
- `src/components/material-library/MaterialGroupedGrid.tsx` (regroupement par catégorie)

**Modifiés :**
- `src/hooks/useMaterialLibrary.tsx` (signature + logique requête)
- `src/pages/MaterialLibrary.tsx` (intégration UI)

### Hors scope
- Filtre par fourchette de prix (slider) — reportable v2
- Recherche full-text PG / synonymes avancés (déjà partielle via `or` ilike)
- Filtre TVA (peu utile à la recherche)

