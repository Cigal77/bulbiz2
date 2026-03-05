

## Améliorer le tri chronologique, la recherche et ajouter les statuts RDV aux 3 vues

### Changements

**1. `src/pages/TodoActions.tsx`** -- Recherche + filtres par catégorie + statuts RDV détaillés
- Ajouter une barre de recherche (input) en haut pour filtrer par nom client
- Ajouter des boutons filtres rapides : Tous / RDV / Devis / Factures
- Séparer les items RDV en sous-statuts plus clairs dans `buildActions()` :
  - `rdv_pending` : "Créneaux à proposer" (l'artisan doit proposer des créneaux)
  - `slots_proposed` : "En attente client" (créneaux proposés, attente réponse)
  - `client_selected` : "Créneau à confirmer" (le client a choisi, l'artisan doit confirmer)
- Mettre à jour `SECTION_ORDER` et `SECTION_LABELS` avec ces 3 nouveaux statuts RDV (remplaçant `slots_pending`)
- Tri par date de création décroissante dans chaque section

**2. `src/pages/RdvList.tsx`** -- Recherche + filtres période + statuts RDV détaillés + passés
- Ajouter une barre de recherche par nom client
- Ajouter des filtres période (Aujourd'hui / Cette semaine / Ce mois / Tous) pour la section "À venir"
- Ajouter les sections RDV détaillées :
  - `rdv_pending` : "Créneaux à proposer"
  - `slots_proposed` : "Créneaux proposés"
  - `client_selected` : "Créneau à confirmer"
- Ajouter une section "Passés" pour les RDV confirmés dont la date est passée (avec `done` inclus)
- Mettre à jour `SECTION_CONFIG` et `buildRdvItems()`

**3. `src/pages/Index.tsx`** -- Recherche étendue + tri chronologique
- Ajouter la recherche par email client dans le filtre existant
- Ajouter une option de tri "Chronologique" (date de création pure, sans regroupement urgence)

**4. `src/hooks/useDossiers.tsx`** -- Ajouter `SortOption` "chronological"

**5. `src/components/dashboard/DossierFilters.tsx`** -- Nouvelle option de tri "Chronologique"

### Fichiers modifiés
- `src/pages/TodoActions.tsx`
- `src/pages/RdvList.tsx`
- `src/pages/Index.tsx`
- `src/hooks/useDossiers.tsx`
- `src/components/dashboard/DossierFilters.tsx`

