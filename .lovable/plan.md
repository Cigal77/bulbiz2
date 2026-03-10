

## Diagnostic

L'infrastructure existe déjà pour stocker le code postal et la ville (colonnes `postal_code`, `city` sur la table `dossiers`). Les deux edge functions (`submit-public-form` et `submit-client-form`) sauvent correctement ces champs quand ils sont fournis.

**Le problème** : dans les deux formulaires clients, il n'y a **pas de champs séparés** pour le code postal et la ville. Ces données ne sont remplies que si le client sélectionne une suggestion Google Places. Si le client tape manuellement son adresse sans cliquer sur une suggestion, `postal_code` et `city` restent vides.

## Plan de correction

### 1. Ajouter des champs CP / Ville dans les deux formulaires clients

**PublicClientForm.tsx** (étape 2, après l'AddressAutocomplete) :
- Ajouter deux champs `Input` (code postal + ville) sous l'adresse
- État local : `postalCode` et `city`, pré-remplis automatiquement quand Google Places est sélectionné
- Inclure ces valeurs dans `submitData` envoyé au backend (déjà géré côté edge function)

**ClientForm.tsx** (étape 2, après l'AddressAutocomplete) :
- Même ajout : deux champs `Input` (code postal + ville)
- État local pré-rempli depuis `addressData` ou depuis les données `dossier` existantes
- Inclure `postal_code` et `city` dans `clientData` même sans `google_place_id` (actuellement ces champs ne sont envoyés que si `google_place_id` est présent — c'est le bug principal)

### 2. Fix critique dans ClientForm : envoyer CP/Ville même sans Google Places

Actuellement lignes 323-330 de `ClientForm.tsx` :
```typescript
if (addressData.google_place_id) {
  // postal_code et city ne sont envoyés QUE ici
}
```
Modifier pour toujours inclure `postal_code` et `city` dans `clientData`, qu'ils viennent de Google Places ou de la saisie manuelle.

### 3. Aucune modification backend nécessaire

Les edge functions et la base de données gèrent déjà ces champs correctement.

### Résumé des fichiers modifiés
- `src/pages/PublicClientForm.tsx` — ajout champs CP/Ville
- `src/pages/ClientForm.tsx` — ajout champs CP/Ville + fix envoi données

