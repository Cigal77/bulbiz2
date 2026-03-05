

## Ajouter un calendrier visuel sur la page RDV

### Approche

Ajouter un toggle **Liste / Calendrier** en haut de la page RDV. La vue calendrier utilise le composant `Calendar` (react-day-picker) déjà présent dans le projet, avec des points colorés sur les jours ayant des RDV. Quand l'artisan clique sur un jour, la liste des RDV de ce jour s'affiche en dessous.

### Changements

**`src/pages/RdvList.tsx`** :
- Ajouter un state `viewMode: "list" | "calendar"` avec deux boutons toggle (List / CalendarDays icons)
- En mode calendrier :
  - Afficher le composant `Calendar` avec `modifiers` pour marquer les jours ayant des RDV (points colorés : vert = confirmé, orange = à confirmer, rouge = à proposer)
  - Ajouter un state `selectedDate` pour le jour cliqué
  - Sous le calendrier, afficher la liste des RDV du jour sélectionné (réutilise le même rendu de carte existant)
  - Utiliser `modifiersStyles` / `modifiersClassNames` pour les points visuels
- En mode liste : garder la vue actuelle inchangée
- Les filtres recherche/période restent disponibles dans les deux modes

**`src/index.css`** : Ajouter les styles CSS pour les points indicateurs sur les jours du calendrier (petits dots sous le numéro du jour)

### Fichiers modifiés
- `src/pages/RdvList.tsx`
- `src/index.css`

