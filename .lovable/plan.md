

# Fix : Erreur "Unauthorized" dans send-client-link

## Probleme

La fonction backend `send-client-link` echoue avec "Unauthorized" car elle appelle `getUser()` pour verifier l'authentification. Cette methode fait un appel reseau au service d'authentification qui echoue dans le contexte Lovable Cloud.

D'autres fonctions du projet (comme `summarize-dossier`) fonctionnent correctement car elles n'appellent pas `getUser()` — elles passent simplement le header d'autorisation au client et laissent les politiques de securite (RLS) filtrer les donnees.

## Solution

Modifier `send-client-link` pour extraire le `user_id` directement depuis le token JWT (qui est deja verifie par l'infrastructure), au lieu d'appeler `getUser()`.

## Changement technique

**Fichier** : `supabase/functions/send-client-link/index.ts`

Remplacer le bloc d'authentification actuel :

```text
// Actuel (ne fonctionne pas)
const supabaseUser = createClient(url, anonKey, { headers: { Authorization } });
const { data: { user } } = await supabaseUser.auth.getUser();
if (!user) throw new Error("Unauthorized");
```

Par une extraction directe du JWT :

```text
// Nouveau (extraction du user_id depuis le JWT)
const token = authHeader.replace("Bearer ", "");
const payload = JSON.parse(atob(token.split(".")[1]));
const userId = payload.sub;
if (!userId) throw new Error("Unauthorized");
```

Puis remplacer toutes les references a `user.id` par `userId` dans le reste de la fonction.

Aucun autre fichier n'est impacte. Le comportement fonctionnel reste identique.

