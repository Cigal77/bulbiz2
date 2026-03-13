

## Plan: Système de tracking d'erreurs client

### Probleme
Les utilisateurs rencontrent des bugs (upload media, sélection de créneaux sur le formulaire public, etc.) mais il n'y a aucune visibilité centralisée. Les erreurs sont uniquement loguées dans la console du navigateur du client.

### Approche

Créer une table `error_logs` en base de données et un mécanisme de capture automatique des erreurs côté client + côté Edge Functions, avec un récapitulatif consultable dans une page admin.

### 1. Table `error_logs`

```sql
CREATE TABLE public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'client',        -- 'client' | 'edge_function'
  function_name text,                            -- nom de la page ou edge function
  error_message text NOT NULL,
  error_stack text,
  user_id uuid,                                  -- null pour les visiteurs publics
  metadata jsonb DEFAULT '{}'::jsonb,            -- URL, user agent, slug, dossier_id, etc.
  resolved boolean NOT NULL DEFAULT false
);
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
```

Policies :
- **INSERT** pour `anon` et `authenticated` (tout le monde peut logger une erreur)
- **SELECT** restreint aux admins via `has_role(auth.uid(), 'admin')`

### 2. Edge Function `log-client-error`

Une petite Edge Function (`verify_jwt = false`) qui reçoit les erreurs du client et les insère via service role. Payload : `{ error_message, error_stack, function_name, metadata }`.

### 3. Capture automatique côté client

- **ErrorBoundary** : dans `componentDidCatch`, envoyer l'erreur à `log-client-error` avec la page courante
- **Global handler** : ajouter un listener `window.addEventListener('error')` et `window.addEventListener('unhandledrejection')` dans `main.tsx` pour capturer les erreurs non attrapées
- **Formulaire public** : dans le `catch` de `handleSubmit` (PublicClientForm), logger l'erreur avec le slug et l'étape courante en metadata

### 4. Capture côté Edge Functions

Ajouter un `try/catch` amélioré dans les fonctions critiques (`submit-public-form`, `check-slot-availability`, `upload-client-media`) qui insère dans `error_logs` avant de retourner l'erreur 500.

### 5. Page admin `/admin/errors`

- Route protégée avec vérification du rôle `admin` via `has_role`
- Tableau listant les erreurs des dernières 24h par défaut, avec filtres (source, date, résolu)
- Colonnes : date, source, fonction, message, metadata (expandable), bouton "marquer résolu"
- Compteurs en haut : total erreurs, par source, non résolues

### 6. Résumé email quotidien (optionnel)

Un cron pg_cron qui appelle une Edge Function `send-error-digest` chaque soir pour envoyer un email récapitulatif aux admins si des erreurs ont été loguées dans la journée.

### Fichiers impactés

- **Nouveau** : `supabase/functions/log-client-error/index.ts`
- **Nouveau** : `src/pages/AdminErrors.tsx`
- **Nouveau** : `src/lib/error-logger.ts` (helper d'envoi)
- **Modifié** : `src/components/ErrorBoundary.tsx` (ajout envoi)
- **Modifié** : `src/main.tsx` (global handlers)
- **Modifié** : `src/pages/PublicClientForm.tsx` (catch amélioré)
- **Modifié** : `src/App.tsx` (nouvelle route admin)
- **Modifié** : `supabase/functions/submit-public-form/index.ts` (logging erreurs)
- **Migration** : création table `error_logs` + policies

