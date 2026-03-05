

## Ajouter une page "Bientôt disponible" pour `/devis/new` et `/facture/new`

Les boutons "Créer un devis" et "Créer une facture" dans le NextStepBanner naviguent vers `/devis/new` et `/facture/new` qui n'existent pas → 404. On garde les boutons tels quels et on ajoute une page d'accueil pour ces routes.

### Changements

**1. `src/pages/ComingSoon.tsx`** (nouveau) :
- Page avec emoji ⏳, titre "Cette fonctionnalité arrive bientôt"
- Message : "Si vous êtes intéressé, contactez-nous au +33 7 61 39 71 63"
- Bouton "Importer un devis/facture PDF" qui redirige vers le dossier avec `?import=devis` ou `?import=facture` (selon la route)
- Bouton retour

**2. `src/App.tsx`** :
- Ajouter deux routes protégées : `/devis/new` → `ComingSoon` et `/facture/new` → `ComingSoon`

