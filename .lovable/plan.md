

## Supprimer la notification "Dossier mis à jour automatiquement"

La notification toast qui s'affiche après l'auto-remplissage de champs par l'IA (screenshot fourni) est trompeuse. Elle sera supprimée.

### Changement

**`src/components/dossier/SummaryBlock.tsx`** : Retirer le bloc `toast()` dans le callback `queryFn` du `useQuery` (lignes ~53-58) qui affiche "🤖 Dossier mis à jour automatiquement". Les invalidations de queries (`dossier`, `historique`) restent en place pour que les données se mettent à jour silencieusement.

