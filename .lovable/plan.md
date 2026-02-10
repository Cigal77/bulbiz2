
# Generation PDF Facture conforme France

## Objectif
Creer une edge function `generate-invoice-pdf` qui genere un PDF conforme aux mentions legales francaises, et ajouter un bouton "Telecharger PDF" dans l'editeur de facture.

## Architecture

La fonction reprend le meme pattern que `generate-quote-pdf` :
- Utilisation de `pdf-lib` pour la generation PDF cote serveur
- Upload dans le bucket `dossier-medias` de Supabase Storage
- Stockage de l'URL dans `invoices.pdf_url`
- Entree historique automatique

## Contenu du PDF (mentions legales France)

**Bloc vendeur (artisan) :**
- Nom / raison sociale
- Adresse
- Telephone, email
- SIRET
- N TVA intracommunautaire (si renseigne)
- Logo (si disponible dans profil)

**Bloc client :**
- Nom / prenom ou raison sociale
- Adresse
- Email, telephone

**Bloc facture :**
- Titre "FACTURE N FAC-YYYY-XXXX"
- Date d'emission
- Date de prestation/intervention

**Tableau des lignes :**
- Designation, Quantite, Unite, PU HT, TVA %, Total HT
- Lignes alternees (fond gris clair)

**Bloc totaux :**
- Total HT
- TVA (par taux si applicable)
- Total TTC
- Ou mention "TVA non applicable, art. 293 B du CGI"

**Mentions legales obligatoires :**
- Conditions de paiement (depuis settings ou facture)
- Penalites de retard (si client pro)
- Indemnite forfaitaire de recouvrement 40 euros (si client pro)
- Pas d'escompte pour paiement anticipe
- Date limite de paiement

**Pied de page :**
- Nom artisan, SIRET, tel, email sur chaque page
- Pagination

## Modifications techniques

### 1. Nouvelle edge function : `supabase/functions/generate-invoice-pdf/index.ts`
- Reprend la structure de `generate-quote-pdf`
- Charge invoice + invoice_lines + profile
- Genere le PDF avec toutes les mentions
- Upload dans Storage
- Met a jour `invoices.pdf_url`
- Ajoute entree historique

### 2. Mise a jour : `src/pages/InvoiceEditor.tsx`
- Ajout d'un bouton "Telecharger PDF" dans le header
- Appel de la fonction `generate-invoice-pdf`
- Ouverture du PDF dans un nouvel onglet

### 3. Mise a jour : `supabase/config.toml`
- Ajout de la configuration pour `generate-invoice-pdf` (verify_jwt = false)

### 4. Mise a jour : `supabase/functions/send-invoice/index.ts`
- Avant envoi email, generer le PDF si pas encore fait
- Attacher le lien PDF dans l'email

## Aucune migration DB necessaire
Le champ `pdf_url` existe deja dans la table `invoices`.
