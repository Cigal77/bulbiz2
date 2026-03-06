

## Plan : Cache en base pour le résumé IA

### Problème
Chaque ouverture de dossier déclenche un appel IA (~656 lignes de traitement multimodal), même si rien n'a changé. Cela consomme des crédits inutilement.

### Solution
Ajouter une table `ai_summary_cache` qui stocke le résumé IA et un "fingerprint" des données du dossier. La fonction `summarize-dossier` compare le fingerprint avant d'appeler l'IA.

### 1. Migration : table `ai_summary_cache`

```sql
CREATE TABLE public.ai_summary_cache (
  dossier_id uuid PRIMARY KEY REFERENCES public.dossiers(id) ON DELETE CASCADE,
  summary_json jsonb NOT NULL,
  data_fingerprint text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_summary_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cache"
  ON public.ai_summary_cache FOR SELECT
  USING (dossier_id IN (SELECT id FROM public.dossiers WHERE user_id = auth.uid()));

CREATE POLICY "Users can upsert own cache"
  ON public.ai_summary_cache FOR INSERT
  WITH CHECK (dossier_id IN (SELECT id FROM public.dossiers WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own cache"
  ON public.ai_summary_cache FOR UPDATE
  USING (dossier_id IN (SELECT id FROM public.dossiers WHERE user_id = auth.uid()));
```

### 2. Edge Function `summarize-dossier` : ajout du cache

Avant l'appel IA (après le fetch des données, ~ligne 110), calculer un fingerprint basé sur :
- `dossier.updated_at`
- nombre de médias (audio + images + notes)
- nombre d'entrées historique
- nombre de devis + statuts
- nombre de factures + statuts

```text
fingerprint = md5(JSON.stringify({
  updated_at, media_count, hist_count, 
  quotes: [{id, status, total_ttc}...],
  invoices: [{id, status, total_ttc}...]
}))
```

Logique :
1. Fetch le cache existant depuis `ai_summary_cache` WHERE `dossier_id`
2. Si le fingerprint correspond → retourner `summary_json` directement (0 appel IA)
3. Sinon → continuer le flow actuel, puis UPSERT le résultat dans `ai_summary_cache`

Le paramètre `force: true` dans le body permettra de forcer la régénération (bouton refresh).

### 3. Frontend `SummaryBlock.tsx`

- Passer `force: true` dans le body uniquement quand l'utilisateur clique sur le bouton refresh
- Le comportement par défaut (chargement auto) utilisera le cache

### Résultat attendu

- Ouverture d'un dossier inchangé : 0 crédit IA consommé
- Ajout d'un média/note/devis → `updated_at` change → régénération automatique
- Bouton refresh → force la régénération

