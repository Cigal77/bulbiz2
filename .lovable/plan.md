

## Plan: Ajouter le bloc "Message prêt à envoyer" dans PublicLinkCard

### Modification unique: `src/components/settings/PublicLinkCard.tsx`

Le composant existe déjà avec le lien, les boutons copier/partager. Il suffit d'ajouter un bloc "Message prêt à envoyer" après les boutons existants.

### Changements

1. **Enrichir le texte explicatif** du `CardDescription` avec le texte pédagogique demandé (quand un client appelle → copier → envoyer → dossier créé automatiquement).

2. **Ajouter un nouveau bloc "Message prêt à envoyer"** (visible uniquement quand le slug est sauvegardé) :
   - Un encadré affichant le message complet :
     ```
     Bonjour,
     Afin d'intervenir rapidement, merci de cliquer sur ce lien et de remplir les informations nécessaires.
     Si possible, vous pouvez également ajouter des photos ou une vidéo du problème (facultatif).
     Je regarderai votre demande et je vous recontacterai rapidement.
     {lien}
     ```
   - Un bouton **"Copier le message"** avec icône `MessageSquare` ou `Copy`, feedback "Message copié !" via toast + icône `Check` temporaire.

3. **Ajouter un état `copiedMessage`** séparé de `copied` (lien) pour gérer le feedback indépendamment.

4. **Réorganiser les boutons** : 3 boutons — Copier le lien, Copier le message, Partager.

### Pas d'autres fichiers modifiés. Aucune modification backend, base de données ou routes.

