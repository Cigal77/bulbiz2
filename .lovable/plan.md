
# Connexion Gmail personnelle via Google Cloud Console

## Ce que tu veux
Ajouter dans les Parametres un bloc "Connexion Gmail" qui permet a chaque artisan de connecter **son propre compte Gmail** pour envoyer les emails (devis, factures, relances) depuis sa propre adresse Gmail au lieu de `noreply@bulbiz.fr`. Chaque connexion est privee et liee uniquement au compte de l'utilisateur.

## Comment ca marche

1. Tu crees un projet sur **Google Cloud Console** avec les identifiants OAuth 2.0 (Client ID + Client Secret)
2. Dans Bulbiz, tu cliques "Connecter Gmail" -- ca te redirige vers Google pour autoriser l'acces
3. Bulbiz stocke le token de facon securisee, lie a ton user_id
4. Les emails sont ensuite envoyes via l'API Gmail au lieu de Resend

## Plan technique

### Etape 1 -- Stocker les secrets Google OAuth (cote serveur)

Tu devras fournir ton **Google Client ID** et **Google Client Secret** (crees dans Google Cloud Console). Ils seront stockes comme secrets backend accessibles par les fonctions serveur.

### Etape 2 -- Nouvelle table `gmail_connections`

```text
gmail_connections
- id (uuid, PK)
- user_id (uuid, unique, FK vers auth.users)
- gmail_address (text)
- access_token (text, chiffre)
- refresh_token (text, chiffre)
- token_expires_at (timestamptz)
- created_at (timestamptz)
- updated_at (timestamptz)
```

Politiques RLS : chaque utilisateur ne voit/modifie que sa propre connexion.

### Etape 3 -- Edge Function `gmail-oauth`

Deux endpoints :
- **`action: authorize`** : Genere l'URL de redirection Google OAuth avec les scopes `gmail.send` + `userinfo.email`. Redirige vers `/parametres?gmail=callback`.
- **`action: callback`** : Recoit le code d'autorisation, l'echange contre des tokens (access + refresh), stocke dans `gmail_connections`.
- **`action: disconnect`** : Supprime la connexion Gmail.
- **`action: status`** : Verifie si une connexion active existe.

### Etape 4 -- Bloc UI dans Settings

Nouveau card "Connexion Gmail" dans la page Parametres :

- **Etat deconnecte** : Bouton "Connecter mon Gmail" avec icone Google
- **Etat connecte** : Affiche l'adresse Gmail connectee + bouton "Deconnecter"
- Explication claire : "Les emails seront envoyes depuis votre adresse Gmail personnelle"

### Etape 5 -- Modifier l'envoi d'emails

Dans chaque edge function d'envoi (send-quote, send-invoice, send-relance, etc.) :
1. Verifier si l'utilisateur a une `gmail_connection` active
2. Si oui : envoyer via l'API Gmail (`POST googleapis.com/gmail/v1/users/me/messages/send`) avec le token
3. Si non : continuer avec Resend (comportement actuel)
4. Si le token est expire : utiliser le refresh_token pour en obtenir un nouveau

### Securite

- Les tokens sont stockes cote serveur uniquement (jamais exposes au frontend)
- RLS strict : un utilisateur ne peut acceder qu'a sa propre connexion
- Le refresh_token permet de renouveler l'acces sans re-autorisation
- Scope minimal : uniquement `gmail.send` (pas de lecture de mails)
