

# Bulbiz – Plan d'implémentation PMF

## Vision
Application SaaS B2B pour artisans du BTP : centraliser toutes les demandes clients en un point unique, clair et actionnable. Inspiration design : Linear / Notion / Stripe.

---

## Phase 1 – Fondations & Authentification

### Backend Supabase (Lovable Cloud)
- Base de données avec tables : `profiles` (artisans), `dossiers`, `clients`, `medias`, `historique`, `relances`, `user_roles`
- Row-Level Security : chaque artisan ne voit que ses propres dossiers (multi-tenant)
- Storage bucket pour les médias (photos, vidéos, fichiers)

### Authentification artisan
- Inscription / Connexion par email + mot de passe
- Option Magic Link (connexion sans mot de passe)
- Création automatique du profil artisan à l'inscription

---

## Phase 2 – Écran central : Dashboard

### Dashboard minimaliste (écran d'entrée)
- Compteurs visuels par statut (Nouveau, À qualifier, Devis à faire, Devis envoyé, Clos)
- Liste des dossiers priorisée (nouveaux en premier, puis par urgence)
- Recherche instantanée par nom, téléphone ou adresse
- Filtres par statut et par source
- Design épuré, espaces respirants, hiérarchie visuelle forte

---

## Phase 3 – Fiche Dossier (écran le plus important)

### Vue dossier complète en 1 écran
- **Bloc client** : prénom, nom, téléphone cliquable (appel direct), email
- **Intervention** : adresse avec lien Google Maps, catégorie (WC, fuite, chauffe-eau, évier, douche, autre), urgence (Aujourd'hui / 48h / Semaine), description libre
- **Médias** : galerie photos/vidéos visible immédiatement
- **Résumé structuré auto** : 1 ligne de synthèse + 3 à 5 bullet points, généré automatiquement à partir des champs du dossier
- **Historique chronologique** : log automatique de chaque action (création, modification statut, relance envoyée, média ajouté, etc.)
- **Métadonnées** : source, date de création, statut actuel

### Actions 1 clic
- Appeler le client
- Changer le statut
- Envoyer le lien client
- Relancer
- Ajouter une note
- Créer un devis (marquage uniquement, pas de module devis)

---

## Phase 4 – Création de dossier (3 sources)

### Création manuelle
- Formulaire rapide (objectif < 45 secondes)
- Champs pré-remplis intelligemment, catégories en sélection rapide

### Import email manuel
- Zone de copier-coller du contenu d'un email
- Glisser-déposer de fichier .eml / .msg avec extraction automatique des infos
- Aucune synchronisation Gmail/Outlook

### Lien client (formulaire public)
- Génération d'un lien unique avec token sécurisé + expiration
- Interface publique mobile-first, 3 étapes max avec barre de progression
- Champs simples : identité, adresse, problème, urgence, upload photos/vidéos
- Message rassurant + confirmation finale claire
- Sans création de compte côté client
- Consentement RGPD intégré

---

## Phase 5 – Relances automatiques par email

### Configuration Resend
- Mise en place du service d'envoi d'emails (Resend.com)
- Edge function Supabase pour l'envoi

### Relances "Info manquante"
- Déclenchement auto quand statut = "À qualifier" depuis J+1
- Message simple avec lien vers le formulaire client
- Arrêt si le client complète le formulaire ou si statut change

### Relances "Devis non signé"
- Statut = "Devis envoyé"
- Relance 1 à J+2, Relance 2 à J+5
- Arrêt automatique après 2 relances ou changement de statut

### Interface de gestion
- Templates email simples et éditables
- Boutons "Relancer maintenant" et "Stop relances" sur chaque dossier

---

## Phase 6 – Paramètres artisan

- Activer / désactiver les relances automatiques
- Modifier les délais par défaut (J+1, J+2, J+5)
- Signature email personnalisable
- Informations du profil artisan

---

## Design & UX transversal

- **Mobile-first** sur tous les écrans
- **Design ultra moderne et minimaliste** inspiré Linear/Notion/Stripe
- Typographie lisible, espaces généreux, icônes claires
- Couleurs sobres avec accent couleur pour les actions
- Aucun écran surchargé : 1 écran = 1 objectif clair

