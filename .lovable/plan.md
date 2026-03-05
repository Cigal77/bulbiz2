

## Diagnostic

Le problème est un **cache React Query non invalidé** après l'import d'un devis PDF.

La clé de cache du résumé IA est :
```
["ai-summary", dossier.id, dossier.status, dossier.appointment_status, mediaCount, historiqueCount]
```

Quand un devis PDF est importé via `ImportDevisDialog`, le nombre de **quotes** ne fait pas partie de cette clé. De plus, `ImportDevisDialog` n'invalide pas le cache `ai-summary`. Résultat : l'IA n'est pas re-sollicitée et le matériel du PDF n'apparait pas.

Sur ton compte, tu as probablement rafraîchi manuellement ou le cache a expiré (staleTime = 5min). Chez Alexandre, le cache est resté en place.

## Plan de correction

### 1. Invalider le cache `ai-summary` après import de devis

**`src/components/dossier/ImportDevisDialog.tsx`** : Ajouter `queryClient.invalidateQueries({ queryKey: ["ai-summary"] })` dans le bloc de succès du `handleSubmit`, à côté des autres invalidations existantes.

### 2. Invalider le cache `ai-summary` dans QuoteBlock

**`src/components/dossier/QuoteBlock.tsx`** : Ajouter la même invalidation après chaque action sur un devis (import, suppression, changement de statut).

### 3. Ajouter le nombre de devis au query key du SummaryBlock

**`src/components/dossier/SummaryBlock.tsx`** :
- Ajouter une prop `quotesCount?: number`
- L'inclure dans le `queryKey` : `["ai-summary", dossier.id, ..., quotesCount]`

**`src/pages/DossierDetail.tsx`** :
- Importer `useQuotes` et passer `quotes?.length ?? 0` comme `quotesCount` au `SummaryBlock`.

Ces 4 fichiers couvrent la totalité du fix. Le résumé IA se régénèrera automatiquement dès qu'un devis est ajouté ou modifié.

