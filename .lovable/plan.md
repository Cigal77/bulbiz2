

# Fix : Connexion Google Calendar

## Probleme identifie

La connexion Google Calendar echoue car l'URL de redirection (`https://bulbiz2.lovable.app/settings`) n'est probablement pas configuree dans la console Google Cloud comme URI de redirection autorisee. C'est la meme raison pour laquelle Gmail OAuth montre aussi des erreurs "invalid_grant".

## Ce que tu dois faire (cote Google Cloud Console)

1. Va sur [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
2. Ouvre le client OAuth correspondant (ID: `1016933936014-...`)
3. Dans **"URIs de redirection autorises"**, ajoute :
   - `https://bulbiz2.lovable.app/settings`
   - (optionnel pour les tests) `https://id-preview--2e27a371-0c34-4075-96a4-b8ddd74908dd.lovable.app/settings`
4. Active les APIs suivantes si ce n'est pas deja fait :
   - **Google Calendar API**
   - **People API** (ou **Google+ API** pour userinfo)
5. Si l'app est en mode "Test", ajoute les emails des artisans comme utilisateurs test

## Ameliorations techniques (cote code)

### 1. Meilleure gestion des erreurs dans l'edge function

Ajouter du logging detaille lors de l'echange de token pour faciliter le debug :

**Fichier** : `supabase/functions/google-calendar/index.ts`
- Ajouter `console.error` avec le detail de la reponse Google en cas d'echec du token exchange
- Retourner un message d'erreur plus explicite au frontend (ex: "L'URI de redirection n'est pas autorisee dans Google Cloud")

### 2. Meilleur feedback utilisateur

**Fichier** : `src/components/settings/GoogleCalendarCard.tsx`
- Afficher un message d'erreur clair si le callback echoue (ex: "La configuration Google Cloud n'est pas complete")
- Ajouter un lien vers la documentation si l'erreur est liee a la configuration

### 3. Verification de la redirect_uri dans le callback

**Fichier** : `supabase/functions/google-calendar/index.ts`
- S'assurer que la `redirect_uri` envoyee lors du callback correspond exactement a celle utilisee lors de l'autorisation (meme domaine, meme chemin)

## Resume des actions

| Action | Responsable |
|--------|------------|
| Ajouter l'URI de redirection dans Google Cloud Console | Toi (manuel) |
| Activer Google Calendar API | Toi (manuel) |
| Ameliorer le logging dans l'edge function | Code |
| Ameliorer les messages d'erreur dans le frontend | Code |

