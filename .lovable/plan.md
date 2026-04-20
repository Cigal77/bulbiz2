

L'utilisateur dit "oui" en réponse à ma question : *"Souhaites-tu que je continue avec : ajout d'un raccourci dans la barre mobile, seed d'une base Bulbiz BTP plus complète, ou test fonctionnel de l'import CSV end-to-end ?"*

Je vais proposer les 3 actions complémentaires PATCH 5.

## Plan — Finalisation PATCH 5

### 1. Raccourci mobile « Matériel »
Dans `MobileBottomNav.tsx`, ajouter ou réorganiser pour exposer la bibliothèque matériel. Vu que la barre a déjà 5 onglets pleins, intégrer "Matériel" dans le menu de l'onglet "Nouveau" (drawer d'actions) avec une entrée rapide → `/bibliotheque-materiel`. Évite de surcharger la nav principale.

### 2. Seed de la base Bulbiz BTP
Insérer ~80-120 articles globaux (`user_id IS NULL`) couvrant :
- **Plomberie** : mécanisme WC, flotteur, joint silicone, raccord laiton, tube cuivre Ø14/16/22, PER, PVC évacuation Ø32/40/100, siphon évier/lavabo, mitigeur évier/lavabo/douche, robinet d'arrêt, vanne 1/4 tour, kit WC suspendu, manchette WC
- **Chauffage** : chauffe-eau électrique 50/100/200L, groupe sécurité, anode magnésium, vase d'expansion, circulateur, robinet thermostatique, purgeur
- **Sanitaire** : lavabo, WC à poser, vasque, douche, paroi, receveur
- **Électricité base** : prise 16A, interrupteur, disjoncteur 16A/20A/32A, câble 1.5/2.5/6mm², gaine ICTA
- **Consommables** : téflon, filasse, pâte à joint, colle PVC, décapant cuivre, soudure étain
- **Quincaillerie** : vis, chevilles, colliers Atlas, raccords rapides
- **Prestations** : déplacement (forfait), main-d'œuvre plombier (h), diagnostic, urgence soir/week-end
- **Forfaits courants** : débouchage canalisation, recherche de fuite, remplacement mitigeur, dépose/repose WC

Via `INSERT` (insert tool) avec `user_id = NULL`, catégories cohérentes (`category_path`), unités, prix moyens marché, TVA 10/20%, type approprié.

### 3. Test fonctionnel import CSV
- Vérifier l'edge function `import-catalog-csv` est bien déployée (la précédente exécution était dans `supabase/functions/import-catalog-csv/`).
- Créer un CSV exemple téléchargeable (`/public/exemple-catalogue.csv`) avec 10 articles plomberie.
- Ajouter un bouton "Télécharger un exemple CSV" dans `CsvImportDialog.tsx` étape upload.
- Logs edge function check après simulation.

### Fichiers
**Modifiés :**
- `src/components/MobileBottomNav.tsx` — entrée "Matériel" dans drawer actions
- `src/components/material-library/CsvImportDialog.tsx` — bouton template CSV

**Créés :**
- `public/exemple-catalogue.csv` — template téléchargeable

**Migrations / data :**
- `INSERT` batch dans `catalog_material` (~100 lignes globales)

### Hors scope
- Catégorisation IA automatique des imports (regex basique conservée)
- Page d'admin pour éditer la base Bulbiz globale

