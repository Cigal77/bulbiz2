

Le user demande PATCH 6 — un système ambitieux de catalogue intelligent par intervention. Une grande partie de l'infrastructure existe déjà :

**Déjà en place :**
- `catalog_material` avec usage_count, last_used_*, favoris, tags, synonyms, slug, category_path
- `catalog_usage_log` + trigger automatique `log_quote_line_usage`
- `problem_taxonomy` + `problem_to_manoeuvre` (arbre intervention → gestes)
- `material_correspondence` (associations entre matériels)
- `bundle_templates` + `bundle_template_items` (packs)
- `ProblemTreePanel`, `BundleSuggestionPanel`, `MaterialPickerPanel`, `RecommendationTabs`
- `useProblemTaxonomy`, `useMaterialSuggestions`, `useBundles`, `useMaterialCatalog`, `useMaterialCorrespondence`
- AssistantSidebar avec onglets IA / Packs / Gestes / Matériel

**Manquant pour PATCH 6 :**
1. Données : taxonomy + manoeuvres + correspondences + bundles couvrant les 20+ interventions clés (la base existante est minimale)
2. Apprentissage utilisateur : table `user_intervention_pattern` (déduite via vues SQL)
3. UX unifiée "Suggestions intelligentes" qui combine indispensables / souvent ajoutés / habitudes / consommables / main-d'œuvre+déplacement, reranké par historique perso
4. Possibilité de masquer une suggestion (`user_suggestion_preference`)
5. Création de kits perso depuis une sélection (sauvegarder en `bundle_templates user_id=auth.uid()`)
6. Détection auto de l'intervention depuis la catégorie/description du dossier

Vu le volume, je propose un découpage en 3 lots livrables.

Plan concis ci-dessous.

## Plan — Devis intelligent par intervention (PATCH 6)

### Lot 1 — Données métier (le cœur du moteur)

**Seed massif** dans les tables existantes (via outil insert) :

a. `problem_taxonomy` : créer ~25 interventions canoniques avec keywords riches FR
- Plomberie : remplacement WC, fuite WC, mécanisme chasse, robinet d'arrêt, mitigeur lavabo/évier/douche, siphon, débouchage évier, débouchage WC, recherche fuite, remplacement flexible, vanne 1/4 tour, manchette WC
- Chauffage : remplacement chauffe-eau, panne chauffe-eau, groupe sécurité, vidange CE, fuite radiateur, purge radiateur, robinet thermostatique, circulateur
- Sanitaire : remplacement lavabo, vasque, receveur douche, paroi
- Forfaits : urgence, déplacement, diagnostic

b. `problem_to_manoeuvre` : pour chaque intervention, ~6-10 lignes (article principal, raccords, consommables, main-d'œuvre, déplacement, dépose/repose) avec `weight` (100=indispensable, 60=fréquent, <60=optionnel) et `type` correctement typé

c. `material_correspondence` : associer entre eux les ~90 articles déjà seedés (ex : mitigeur évier → flexibles + raccords + joints + téflon + main-d'œuvre)

d. `bundle_templates` globaux : packs "Remplacement WC complet", "Remplacement mitigeur évier", "Vidange chauffe-eau", "Débouchage canalisation" avec items requis + optionnels

### Lot 2 — Moteur de suggestions unifié

**Nouvelle vue/hook `useSmartSuggestions(dossierId, currentItems[])`** qui combine :
- Détection intervention auto : match `dossier.category` + `description` vs `problem_taxonomy.keywords`
- Charge le pack lié (manoeuvres + correspondences + bundle items)
- Fusionne avec `catalog_usage_log` agrégé par user (lignes fréquentes après cette intervention)
- Reranke : favori user > usage_count user > weight global
- Filtre les items déjà dans le devis et ceux masqués par l'user

**Nouvelle table `user_suggestion_preference`** :
- `user_id`, `item_signature` (label normalisé ou material_id), `intervention_id` nullable, `is_hidden` bool
- Permet "ne plus me proposer ça"

**Nouveau composant `SmartSuggestionsPanel.tsx`** dans l'AssistantSidebar (remplace ou complète les onglets actuels Packs/Gestes/Matériel par une vue unifiée plus claire) :
- Sections collapsibles : 🔧 Indispensables • ✨ Souvent ajoutés • 💡 Tes habitudes • 🛠️ Consommables • 👷 Main-d'œuvre & déplacement • ⚙️ Options
- Chaque carte : libellé + prix + qty + boutons [+ Ajouter] [👁️‍🗨️ Masquer] [⭐ Favori]
- Bouton "Tout ajouter (indispensables)" en haut

### Lot 3 — Kits personnels & arbre d'intervention

a. **Bouton "Sauvegarder cette sélection comme pack"** dans `QuoteSections.tsx` → ouvre dialog → insère dans `bundle_templates` (user_id) + items courants en `bundle_template_items`

b. **Composant `InterventionTreeView.tsx`** (nouvelle vue dans AssistantSidebar) : arbre visuel
```
🚽 Remplacement WC
├─ Éléments principaux (WC, mécanisme, abattant)
├─ Raccords / évacuation (pipe, manchon)
├─ Alimentation (robinet d'arrêt, flexible)
├─ Consommables (joints, silicone)
├─ Pose / dépose
└─ Déplacement
```
Chaque branche permet "+ tout ajouter" ou pick individuel.

c. **Détection intervention dans le dossier** : afficher en haut du devis un badge "Intervention détectée : Remplacement WC" cliquable pour pré-charger le pack.

### Fichiers

**Migrations (schéma) :**
- `user_suggestion_preference` (nouvelle table + RLS)

**Insert (données) :**
- Seed `problem_taxonomy` (~25 interventions)
- Seed `problem_to_manoeuvre` (~200 lignes)
- Seed `material_correspondence` (~150 associations)
- Seed `bundle_templates` + items (~10 packs globaux)

**Créés :**
- `src/hooks/useSmartSuggestions.tsx`
- `src/hooks/useInterventionDetection.tsx`
- `src/hooks/useSuggestionPreferences.tsx`
- `src/components/quote-editor/SmartSuggestionsPanel.tsx`
- `src/components/quote-editor/InterventionTreeView.tsx`
- `src/components/quote-editor/SaveAsKitDialog.tsx`
- `src/components/quote-editor/InterventionDetectedBadge.tsx`

**Modifiés :**
- `src/components/quote-editor/AssistantSidebar.tsx` — onglet "Suggestions" prioritaire qui regroupe l'expérience
- `src/components/quote-editor/RecommendationTabs.tsx` — ajout boutons masquer/favori
- `src/pages/QuoteEditor.tsx` — affichage badge intervention détectée + handler save-as-kit

### Hors scope v1 (à itérer)
- `UserInterventionPattern` matérialisé : version 1 calculée à la volée via SQL agrégation (pas de table dédiée encore)
- IA générative pour créer dynamiquement des packs depuis la description dossier (le pré-devis IA existant fait déjà cela)
- Compatibilités produits cross-marque (Geberit ↔ Grohe)
- Multi-métiers hors plomberie/chauffage/sanitaire (extension prévue mais non seedée)
- Questions de qualification interactives (prévues structure, UI v1.1)

### Stratégie de livraison
Je propose de livrer **Lot 1 (données) + Lot 2 (moteur unifié)** dans cette première itération — c'est le cœur de valeur. Le Lot 3 (kits perso + arbre visuel) suivra dans une 2e itération si tu valides.

