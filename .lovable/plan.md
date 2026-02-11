

# Mot de passe oublie / Reinitialisation

## Approche

Supabase Auth fournit nativement `resetPasswordForEmail()` et `updateUser()`. Pas besoin de creer des tokens manuels, des tables supplementaires ou des edge functions. Le flux est entierement gere par le backend d'authentification integre.

## Modifications

### 1. Page Auth (`src/pages/Auth.tsx`)

- Ajouter un mode `"reset"` au type `AuthMode` existant (`"login" | "signup" | "magic" | "reset"`)
- Ajouter un lien "Mot de passe oublie ?" sous le champ mot de passe (mode login)
- En mode `reset` : afficher un formulaire email seul + bouton "Envoyer le lien"
- Appeler `supabase.auth.resetPasswordForEmail({ email, options: { redirectTo: window.location.origin + "/auth?mode=update-password" } })`
- Toujours afficher le meme message de confirmation quel que soit l'email (securite : ne pas reveler si le compte existe)

### 2. Page de mise a jour du mot de passe (`src/pages/ResetPassword.tsx`)

- Nouvelle page avec route `/reset-password`
- Supabase redirige l'utilisateur avec un token dans le hash de l'URL. Le client Supabase detecte automatiquement ce token via `onAuthStateChange` (evenement `PASSWORD_RECOVERY`)
- Formulaire : nouveau mot de passe + confirmation
- Validation : minimum 10 caracteres, au moins 1 lettre et 1 chiffre
- Indicateur visuel de force du mot de passe (barre coloree)
- Appeler `supabase.auth.updateUser({ password })` pour mettre a jour
- En cas de succes : afficher un message et rediriger vers `/auth`
- En cas d'erreur (lien expire/invalide) : message clair + bouton "Renvoyer un lien"

### 3. Routing (`src/App.tsx`)

- Ajouter la route `/reset-password` pointant vers `ResetPassword`

### 4. Detection du token de recovery (`src/hooks/useAuth.tsx`)

- Ecouter l'evenement `PASSWORD_RECOVERY` dans `onAuthStateChange` pour detecter automatiquement quand l'utilisateur arrive via le lien de reset et le rediriger vers `/reset-password`

## Details techniques

### Flux complet

```text
1. Utilisateur clique "Mot de passe oublie ?" sur /auth
2. Saisit son email, clique "Envoyer"
3. Supabase envoie un email avec lien vers {origin}/reset-password#access_token=...
4. Utilisateur clique le lien dans l'email
5. Le client Supabase detecte le token, emet PASSWORD_RECOVERY
6. useAuth redirige vers /reset-password
7. Utilisateur saisit nouveau mot de passe
8. supabase.auth.updateUser({ password }) applique le changement
9. Redirection vers /auth avec message de succes
```

### Validation mot de passe
- Minimum 10 caracteres
- Au moins 1 lettre (`/[a-zA-Z]/`)
- Au moins 1 chiffre (`/[0-9]/`)
- Barre de force : rouge (faible) / orange (moyen) / vert (fort)

### Securite
- Message generique apres demande de reset (pas de fuite d'information)
- Le token est a usage unique et expire (gere par Supabase)
- Pas de table custom necessaire (Supabase gere les tokens de recovery en interne)

## Fichiers concernes

| Fichier | Action |
|---------|--------|
| `src/pages/Auth.tsx` | Ajouter mode "reset" + lien "Mot de passe oublie" |
| `src/pages/ResetPassword.tsx` | Creer (formulaire nouveau mot de passe) |
| `src/App.tsx` | Ajouter route `/reset-password` |
| `src/hooks/useAuth.tsx` | Detecter evenement `PASSWORD_RECOVERY` |

