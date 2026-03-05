
# Audit et corrections des automatisations email/notifications

## Problemes identifies

### 1. Bug `send-invoice` : variable `artisanName` non definie dans le SMS
**Fichier** : `supabase/functions/send-invoice/index.ts` (ligne 218)
- La variable `artisanName` est utilisee dans le body SMS mais elle est declaree dans un bloc `if` plus haut (ligne 170/189) et n'est pas accessible dans le scope du SMS.
- **Impact** : Le SMS de facture plante avec une erreur `ReferenceError`.

### 2. Bug `send-invoice` : authentification inconsistante
**Fichier** : `supabase/functions/send-invoice/index.ts` (lignes 101-108)
- Utilise `supabaseUser.auth.getUser()` au lieu du decodage JWT direct comme les autres fonctions. Selon la memoire technique, cette methode cause des erreurs 401 en environnement Lovable Cloud.

### 3. Bug `send-appointment-notification` : authentification inconsistante
**Fichier** : `supabase/functions/send-appointment-notification/index.ts` (lignes 210-217)
- Meme probleme : utilise `supabaseUser.auth.getUser()` au lieu du decodage JWT.

### 4. Notification artisan manquante sur confirmation RDV
**Fichier** : `supabase/functions/submit-client-form/index.ts`
- Quand un client selectionne un creneau (action `select_slot`), l'artisan n'est **pas notifie par email**. Seul le client recoit un email de confirmation.
- L'artisan devrait recevoir un email du type "Le client a confirme le RDV du..."

### 5. Notification artisan manquante sur selection de creneau (multi-slots)
- Quand le client choisit un creneau parmi plusieurs (non auto-confirme), l'artisan n'est pas notifie que le client a fait son choix.

### 6. Lien dossier hardcode dans `submit-client-form`
**Fichier** : `supabase/functions/submit-client-form/index.ts` (ligne 337)
- Le lien vers le dossier pointe vers `bulbiz2.lovable.app` au lieu de `app.bulbiz.io` (domaine de production).

### 7. Email facture sans signature personnalisee
**Fichier** : `supabase/functions/send-invoice/index.ts`
- L'email de facture utilise une signature generique "Cordialement, artisanName" au lieu de la signature personnalisee du profil (`email_signature`).

### 8. Email facture sans numero de facture dans le sujet
- Le sujet est simplement "Votre facture" sans le numero, contrairement aux emails de devis qui incluent le nom de l'artisan.

---

## Plan de corrections

### Correction 1 : `send-invoice/index.ts` - Fix artisanName scope + auth JWT + signature + sujet
- Extraire `artisanName` et `signature` du profil au bon scope (avant le bloc email/SMS)
- Remplacer `supabaseUser.auth.getUser()` par le decodage JWT direct
- Ajouter la signature personnalisee
- Ameliorer le sujet : `"${artisanName} - Facture ${invoice.invoice_number}"`

### Correction 2 : `send-appointment-notification/index.ts` - Fix auth JWT
- Remplacer `supabaseUser.auth.getUser()` par le decodage JWT direct

### Correction 3 : `submit-client-form/index.ts` - Notifier l'artisan sur RDV + fix lien
- Ajouter un email a l'artisan quand un client selectionne/confirme un creneau
- Remplacer le lien hardcode par `app.bulbiz.io`
- Ajouter notification artisan aussi pour le cas multi-slots (client_selected)

---

## Details techniques

### `send-invoice/index.ts` - Changements
```text
Lignes 96-110 : Remplacer l'auth getUser() par decodage JWT
Ligne 170-218 : Remonter artisanName + signature au bon scope
Ligne 181      : Ajouter signature personnalisee dans l'email
Ligne 218      : Fixer la reference artisanName dans le SMS
Sujet email    : Ajouter numero facture
```

### `send-appointment-notification/index.ts` - Changements
```text
Lignes 210-217 : Remplacer auth getUser() par decodage JWT
```

### `submit-client-form/index.ts` - Changements
```text
Ligne 337       : Remplacer bulbiz2.lovable.app par app.bulbiz.io
Apres ligne 456 : Ajouter email artisan pour confirmation RDV (auto-confirm)
Apres ligne 468 : Ajouter email artisan pour selection creneau (multi-slots)
```
