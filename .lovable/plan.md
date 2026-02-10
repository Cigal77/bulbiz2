

# Editeur de devis avance -- Tout-en-un

Ce plan couvre les 3 modules demandes : Resume main d'oeuvre assiste par IA, Arbre Probleme vers Gestes, et Catalogue materiel avec suggestions automatiques. C'est un chantier consequent qui sera implemente en une seule iteration.

---

## Vue d'ensemble

L'editeur de devis actuel (3 onglets : Client / Lignes / Resume) sera enrichi avec :
- Un **panneau lateral droit** (drawer sur mobile) contenant l'arbre des problemes et le catalogue materiel
- Un **bloc "Resume main d'oeuvre"** integre dans l'onglet Lignes, au-dessus des lignes de type main d'oeuvre
- Une **edge function IA** pour generer les 3 variantes de resume

---

## Phase 1 -- Base de donnees (5 nouvelles tables + seed)

### Tables a creer

**problem_taxonomy** -- Arbre des problemes plomberie
- id, parent_id (auto-reference), label, keywords (text[]), default_context (jsonb), sort_order, user_id (null = global)

**problem_to_manoeuvre** -- Mapping probleme vers lignes de devis
- id, problem_id (FK), label, description, unit, default_qty, unit_price, vat_rate, weight (100/60/30), type (standard/main_oeuvre/deplacement), conditions_json

**labour_templates** -- Templates de resume main d'oeuvre
- id, context_tags (text[]), text_short, text_standard, text_reassuring, duration_default_min

**catalog_material** -- Catalogue de fournitures
- id, category_path, label, type (GROSSE_FOURNITURE/PETITE_FOURNITURE/CONSOMMABLE), unit, default_qty, unit_price, vat_rate, tags (text[]), user_id (null = global)

**material_correspondence** -- Correspondances materiel
- id, source_material_id (FK), target_material_id (FK), weight (100/60/30), conditions_json, default_qty, group_label

Toutes ces tables auront RLS active avec des policies permettant la lecture pour les utilisateurs authentifies (donnees globales + donnees perso).

### Donnees initiales (seed)

Insertion de l'arbre complet des problemes plomberie (10 categories, ~80 noeuds) tel que specifie dans la demande.

Insertion des templates de resume main d'oeuvre (4 templates : Depannage, Remplacement, Recherche de fuite, Debouchage) avec les 3 variantes chacun.

Insertion du catalogue materiel initial (~50 articles de base couvrant sanitaire, alimentation, evacuation, consommables universels).

Insertion des correspondances materiel pour les cas courants (WC pose, WC suspendu, mitigeur douche, chauffe-eau, evier).

---

## Phase 2 -- Edge function IA "generate-labour-summary"

Nouvelle edge function qui utilise Lovable AI (google/gemini-3-flash-preview) pour generer des resumes main d'oeuvre personnalises.

**Entree** : context_tags (chips selectionnees), toggles (deplacement, diagnostic, tests, acces difficile, urgence), problem_label (optionnel)

**Sortie** : 3 variantes (courte, standard, rassurante)

L'IA recoit un prompt systeme avec les templates de base et les adapte selon le contexte. Si aucun contexte specifique, elle utilise les templates pre-enregistres directement (sans appel IA).

---

## Phase 3 -- Composants UI

### A. Bloc "Resume main d'oeuvre assiste"

Nouveau composant `LabourSummaryBlock` integre dans l'onglet "Lignes" (StepItems), au-dessus des lignes :

- **Chips de selection** : Depannage, Remplacement, Installation, Renovation, Recherche de fuite, Debouchage, Urgence (selection multiple)
- **Toggles** : Inclure deplacement, Inclure diagnostic, Inclure tests/remise en service, Acces difficile, Intervention urgence
- **Bouton "Proposer un resume"** : appelle l'edge function ou les templates statiques
- **3 onglets de variantes** : Courte / Standard pro / Rassurante
- **Textarea editable** : le resume choisi s'insere dans le champ, modifiable par l'artisan
- Le resume est sauvegarde dans le champ `notes` du devis (ou un nouveau champ `labour_summary`)

### B. Panneau "Arbre Probleme vers Solutions"

Nouveau composant `ProblemTreePanel` affiche dans un Sheet (drawer) accessible depuis l'onglet Lignes :

- **Barre de recherche** avec autocomplete sur les keywords de problem_taxonomy
- **Navigation par categories** : arbre cliquable avec les 10 familles
- **Quand un probleme est selectionne** :
  - Affichage des gestes recommandes tries par weight (3 onglets : Indispensable / Frequent / Options)
  - Bouton "Ajouter au devis" en un clic par ligne
  - Resume main d'oeuvre pre-rempli automatiquement

### C. Panneau "Catalogue Materiel"

Nouveau composant `MaterialPickerPanel` dans le meme Sheet ou un second onglet :

- **Recherche** dans catalog_material avec filtres par categorie
- **Quand un materiel "grosse fourniture" est ajoute** :
  - Fetch des correspondances depuis material_correspondence
  - Affichage en 3 onglets : Indispensable / Frequent / Options
  - Groupe par : Raccords, Fixations, Joints, Consommables, Finition, Securite
  - Ajout au devis en un clic avec quantites par defaut

### D. Modifications de l'editeur existant

- Ajout d'un bouton "Aide" ou icone dans la barre du haut de l'onglet Lignes pour ouvrir le panneau lateral
- Le panneau lateral contient 2 onglets : "Problemes" et "Materiel"
- Sur mobile : Sheet en mode bottom-drawer
- Sur desktop : panneau lateral droit (resizable ou fixe 400px)

---

## Phase 4 -- Hooks et logique

### Nouveaux hooks

- `useProblemTaxonomy()` : fetch de l'arbre des problemes avec cache React Query
- `useProblemManoeuvres(problemId)` : fetch des gestes mappes a un probleme
- `useMaterialCatalog(search, category)` : recherche dans le catalogue
- `useMaterialCorrespondence(materialId)` : fetch des correspondances

### Modifications existantes

- `QuoteEditor.tsx` : ajout du state pour le panneau lateral et le resume main d'oeuvre
- `StepItems.tsx` : integration du LabourSummaryBlock et du bouton d'ouverture du panneau
- Ajout d'un champ `labour_summary` dans les donnees du devis (sauvegarde dans le JSONB `items` ou dans `notes`)

---

## Arborescence des fichiers

```text
src/
  components/
    quote-editor/
      LabourSummaryBlock.tsx      -- Bloc resume main d'oeuvre
      ProblemTreePanel.tsx         -- Panneau arbre problemes
      MaterialPickerPanel.tsx      -- Panneau catalogue materiel
      AssistantDrawer.tsx          -- Drawer/Sheet conteneur
      RecommendationTabs.tsx       -- Composant onglets Indispensable/Frequent/Options
  hooks/
    useProblemTaxonomy.tsx
    useMaterialCatalog.tsx
  lib/
    quote-types.ts                -- Mise a jour avec labour_summary
supabase/
  functions/
    generate-labour-summary/
      index.ts                    -- Edge function IA
  migrations/
    xxx_problem_taxonomy.sql      -- Tables + seed
```

---

## Details techniques importants

- Les tables globales (seed) auront `user_id IS NULL` pour les donnees de base. Les artisans pourront ajouter leurs propres entrees avec leur `user_id`. Les policies RLS permettront de lire les donnees globales ET ses propres donnees.
- L'edge function IA utilise `LOVABLE_API_KEY` deja configure, pas besoin de cle supplementaire.
- Le seed des ~80 problemes et ~50 materiels sera fait via des migrations SQL (INSERT statements).
- La recherche autocomplete utilise un simple `ilike` sur les keywords et labels (pas besoin de full-text search pour le MVP).
- Les correspondances materiel sont bidirectionnelles : on peut partir d'un probleme (qui recommande des gestes + materiel) ou d'un materiel (qui recommande ses accessoires).

