

# Guide pas à pas : Configurer Google OAuth avec ta marque Bulbiz

## Objectif
Remplacer les identifiants Google OAuth gérés par Lovable par tes propres identifiants, afin que l'écran de consentement Google affiche **"Bulbiz"** au lieu de **"Lovable"**.

---

## Etape 1 — Creer un projet Google Cloud

1. Va sur [console.cloud.google.com](https://console.cloud.google.com)
2. En haut a gauche, clique sur le selecteur de projet puis **"Nouveau projet"**
3. Nom du projet : **Bulbiz**
4. Clique **"Creer"**

---

## Etape 2 — Configurer l'ecran de consentement OAuth

1. Dans le menu a gauche, va dans **"API et services" > "Ecran de consentement OAuth"**
2. Choisis **"Externe"** puis clique **"Creer"**
3. Remplis les champs :
   - **Nom de l'application** : `Bulbiz`
   - **Adresse e-mail d'assistance** : ton email
   - **Logo de l'application** : uploade le logo Bulbiz
   - **Domaines autorises** : ajoute `bulbiz.io`
   - **Coordonnees du developpeur** : ton email
4. Clique **"Enregistrer et continuer"**
5. Sur la page **"Champs d'application"**, clique **"Ajouter ou supprimer des champs d'application"** et selectionne :
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
6. Clique **"Enregistrer et continuer"** jusqu'a la fin

---

## Etape 3 — Creer les identifiants OAuth

1. Va dans **"API et services" > "Identifiants"**
2. Clique **"Creer des identifiants" > "ID client OAuth"**
3. Type d'application : **Application Web**
4. Nom : `Bulbiz Web`
5. **Origines JavaScript autorisees** : ajoute `https://app.bulbiz.io`
6. **URI de redirection autorises** : il te faut l'URL de callback — pour la trouver :
   - Dans Lovable, ouvre le dashboard backend (Cloud > Users > Auth settings > Google)
   - Tu y trouveras l'URL de redirection a copier-coller ici
7. Clique **"Creer"**
8. **Note** le **Client ID** et le **Client Secret** qui s'affichent

---

## Etape 4 — Entrer les identifiants dans Lovable

1. Dans Lovable, va dans **Cloud > Users > Authentication Settings > Sign In Methods > Google**
2. Active l'option **"Use your own credentials"** (ou similaire)
3. Colle le **Client ID** et le **Client Secret** obtenus a l'etape 3
4. Sauvegarde

---

## Etape 5 — Publier l'application sur Google

Par defaut, ton projet Google Cloud est en mode **"Test"**, ce qui limite la connexion a 100 utilisateurs ajoutes manuellement.

1. Retourne sur **"Ecran de consentement OAuth"**
2. Clique **"Publier l'application"** pour passer en mode production
3. Google peut demander une verification (quelques jours) mais la connexion fonctionnera en attendant

---

## Etape 6 — Tester

1. Va sur `https://app.bulbiz.io`
2. Clique **"Se connecter avec Google"**
3. L'ecran de consentement doit maintenant afficher **"Bulbiz"** avec ton logo
4. La connexion doit te ramener sur `https://app.bulbiz.io`

---

## Remarque importante

Aucune modification de code n'est necessaire. Le code utilise deja `window.location.origin` pour les redirections, donc tout fonctionnera automatiquement avec `app.bulbiz.io`.

