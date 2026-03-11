

## Diagnostic

L'email "SLOTS_PROPOSED" contient bien un bouton conditionnel (ligne 131 du template), mais il ne s'affiche que si `appointment_link` est non vide. Or, cette valeur dépend de `dossier.client_token` côté frontend — si le lien client n'a jamais été généré, le token est `null` et **le bouton disparaît de l'email**.

C'est exactement ce qu'on voit dans la capture : les créneaux sont listés en texte, mais aucun bouton "Choisir mon créneau" n'apparaît.

## Cause racine

Dans `AppointmentBlock.tsx` (lignes 226-228 et 284-285) et `SmartSlotSheet.tsx` (ligne 206) :
```typescript
if (dossier.client_token) appointmentLink = `...`;
```
Si `client_token` est `null`, aucun lien n'est inclus dans le payload → le template ne rend pas le bouton.

## Correction

### 1. Générer le lien côté serveur (edge function `send-appointment-notification`)

Déplacer la logique de construction du lien dans la edge function elle-même. Quand `event_type === "SLOTS_PROPOSED"` :
- Si `dossier.client_token` existe et n'est pas expiré → construire le lien avec
- Si `dossier.client_token` n'existe pas ou est expiré → **générer automatiquement un nouveau token**, le sauvegarder sur le dossier, et construire le lien

Cela garantit que **chaque email SLOTS_PROPOSED contient toujours un bouton cliquable**, indépendamment de l'état du token côté frontend.

Le lien sera construit avec l'URL de production : `https://app.bulbiz.io/client?token={token}`

### 2. Conserver le lien frontend en fallback

Ne pas supprimer le code existant côté `AppointmentBlock.tsx` et `SmartSlotSheet.tsx`, mais le rendre secondaire : la edge function utilisera `payload.appointment_link` s'il est fourni, sinon le construira elle-même.

### Fichiers modifiés
- `supabase/functions/send-appointment-notification/index.ts` — ajout génération automatique du token + construction du lien côté serveur

