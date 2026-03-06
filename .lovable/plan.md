

## Corriger l'authentification de la fonction summarize-dossier

### Problème racine

La méthode `authClient.auth.getClaims(token)` utilisée dans `summarize-dossier` **n'existe pas** dans le SDK Supabase JS v2. L'appel échoue systématiquement, retournant une erreur 401 à chaque fois.

Le frontend intercepte silencieusement cette 401 (fallback local ajouté précédemment), donc l'utilisateur voit les anciennes données de la note vocale au lieu d'un résumé IA actualisé avec le devis.

**En résumé** : le résumé IA ne se met plus jamais à jour depuis le correctif précédent — il retourne toujours le fallback local.

### Correction

**`supabase/functions/summarize-dossier/index.ts`** (lignes 76-87) : Remplacer `getClaims(token)` par `getUser()`, qui fonctionne correctement quand le token est passé via le header Authorization du client :

```typescript
const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
  global: { headers: { Authorization: authHeader } },
});
const { data: { user }, error: authError } = await authClient.auth.getUser();
if (authError || !user) {
  return new Response(JSON.stringify({ error: "Non authentifié" }), {
    status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
const userId = user.id;
```

Cela restaure l'authentification fonctionnelle et permet au résumé IA de se régénérer correctement après import d'un devis.

