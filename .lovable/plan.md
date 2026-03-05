

## Plan: Auto-refresh du Résumé de la demande

### Problème
Le `queryKey` du résumé IA est `["ai-summary", dossier.id, dossier.status, dossier.appointment_status]`. Il ne change que quand le statut du dossier change, pas quand de nouveaux médias ou notes sont ajoutés. L'artisan doit cliquer manuellement sur le bouton refresh.

### Solution
Passer les compteurs de médias et d'historique au `SummaryBlock` pour que React Query détecte automatiquement les changements et relance l'analyse IA.

### Fichiers modifiés

**1. `src/components/dossier/SummaryBlock.tsx`**
- Ajouter les props `mediaCount` et `historiqueCount` (optionnels, number)
- Inclure ces compteurs dans le `queryKey` : `["ai-summary", dossier.id, dossier.status, dossier.appointment_status, mediaCount, historiqueCount]`
- React Query relancera automatiquement l'appel à `summarize-dossier` dès qu'un media ou une entrée historique est ajouté

**2. `src/pages/DossierDetail.tsx`**
- Passer `mediaCount={medias?.length ?? 0}` et `historiqueCount={historique?.length ?? 0}` aux deux instances de `<SummaryBlock>` (mobile et desktop)
- Les données `medias` et `historique` sont déjà chargées dans la page via `useDossierMedias` et `useDossierHistorique`

### Résultat
Dès qu'une photo, note vocale, note écrite ou tout autre média est ajouté, le compteur change → le queryKey change → React Query refait l'appel → le résumé et la liste de matériel se mettent à jour automatiquement.

