
# Plan d'audit QA A-Z -- Bulbiz

## Vue d'ensemble

Audit complet front/back/UX/responsive de Bulbiz couvrant les 5 parcours E2E critiques, la validation de tous les liens client (tokens), chaque bouton/automatisation, et la vérification responsive sur 3 formats.

---

## Phase 0 -- Pre-requis et instrumentation

### 0.1 Verification de l'environnement

- Confirmer que les secrets suivants sont configures : `RESEND_API_KEY`, `TWILIO_*` (si SMS actif), `GOOGLE_MAPS_API_KEY`
- Verifier que le catalogue plomberie est peuple (`catalog_material` : ~70 items, `bundle_templates` : 10 packs, `bundle_template_items` : lignes associees)
- Verifier qu'un profil artisan existe avec `company_name`, `siret`, `email`, `phone`, `address` renseignes

### 0.2 Jeu de donnees test a creer

| Dossier | Client | Etat cible |
|---------|--------|------------|
| D1 "Incomplet" | Nom seul, pas d'email ni tel | Statut `a_qualifier` |
| D2 "Complet" | Nom + email + tel + adresse + description | Statut `nouveau` |
| D3 "Full flow" | Nom + email valide + tel | Devis + RDV + Facture |
| D4 "Email seul" | Email uniquement | Test envoi email sans SMS |
| D5 "Tel seul" | Tel uniquement | Test envoi SMS sans email |

### 0.3 Logs manquants a implementer

**Actuellement presents :**
- `notification_logs` (email/SMS avec status, error_message, channel)
- `historique` (actions metier par dossier)

**A ajouter :**
- **PublicLinkLog** : Nouvelle table ou colonne de tracking pour comptabiliser les hits/acces sur chaque token (client_link, quote_link, invoice_link). Actuellement, aucun tracking d'acces n'est enregistre.
- **Idempotency keys** : Protection anti-doublon sur `send-client-link`, `send-quote`, `send-invoice`, `generate-quote-pdf`, `generate-invoice-pdf`. Actuellement, aucune protection n'existe (un double-clic peut generer 2 PDFs ou 2 emails).
- **ErrorLog front** : Ajouter un error boundary React global qui capture les erreurs non gerees et les affiche/log.

---

## Phase 1 -- Matrice responsive

### Resolutions a tester

| Device | Resolution | Navigateur |
|--------|-----------|------------|
| iPhone | 390x844 | Safari |
| Android | 390x844 | Chrome |
| iPad | 768x1024 | Safari |
| Desktop | 1440x900 | Chrome |
| Desktop | 1440x900 | Safari |
| Desktop | 1440x900 | Edge |

### Ecrans a verifier sur chaque resolution

| Ecran | Points critiques |
|-------|-----------------|
| Dashboard (`/`) | Tuiles RDV, compteurs statut, liste dossiers, scroll, CTA "Nouveau dossier" |
| Fiche dossier (`/dossier/:id`) | Bandeau RDV, blocs client/intervention/devis/facture, sidebar actions, scroll colonne droite |
| Creation dossier (`/nouveau`) | Formulaire, autocomplete adresse, boutons categorie/urgence, clavier mobile |
| Editeur devis (`/dossier/:id/devis`) | Header actions (PDF/Envoyer), sidebar assistant (packs/materiel), lignes de devis, totaux |
| Editeur facture (`/dossier/:id/facture/:id`) | Header actions, lignes, totaux, TVA/293B switch |
| Formulaire client (`/client?token=...`) | Steps 1-2-3, upload photos, RGPD, bouton submit |
| Validation devis (`/devis/validation?token=...`) | Infos devis, PDF, boutons Valider/Refuser |
| Vue facture (`/facture/view?token=...`) | Tableau lignes, totaux, mentions legales, PDF |
| Parametres (`/parametres`) | Formulaire profil, logo, signature email |

### Checklist par ecran
- [ ] Layout correct (pas de debordement horizontal)
- [ ] CTA principal visible sans scroll
- [ ] Champs de formulaire accessibles au clavier mobile
- [ ] Texte lisible (pas de troncature qui masque des infos critiques)
- [ ] Sticky header fonctionnel

---

## Phase 2 -- Parcours E2E

### E2E 1 : Dossier --> lien auto --> client complete

```text
Etapes :
1. Artisan : Creer dossier (nom + email + tel + categorie)
2. Verifier : toast "Lien client genere + Email envoye"
3. Verifier : historique contient "Dossier cree" + "Lien client genere" + "Lien envoye par email"
4. Verifier : notification_logs contient une ligne event_type correspondante
5. Copier le lien client depuis la fiche dossier
6. Ouvrir le lien dans un navigateur prive
7. Verifier : formulaire client s'affiche avec champs pre-remplis (nom) et champs editables (adresse, description)
8. Client : completer adresse (autocomplete Google), description, ajouter 1 photo
9. Client : accepter RGPD, soumettre
10. Verifier : page "Merci"
11. Artisan : recharger fiche dossier
12. Verifier : adresse + description mis a jour, media visible dans galerie
13. Verifier : historique contient "Client a complete"
14. Verifier : pas de doublon de dossier
```

**Points de defaillance a surveiller :**
- Le lien client contient une URL en dur (`https://id-preview--2e27a371...`) dans l'edge function `send-client-link` (ligne 85). En production, cette URL sera incorrecte. **BUG P0** a corriger : utiliser `req.headers.get("origin")` ou une variable d'environnement.
- Double-clic sur "Generer et envoyer le lien" : pas de protection idempotente.

### E2E 2 : Email import --> dossier --> lien auto

```text
Etapes :
1. Artisan : onglet "Import email", coller un email type
2. Cliquer "Analyser et pre-remplir"
3. Verifier : champs pre-remplis (nom, tel, email, adresse si detectes)
4. Soumettre le formulaire
5. Verifier : auto-envoi lien client (si email/tel presents)
6. Verifier : historique + notification_logs
```

**Points de defaillance :**
- Le parser email (`src/lib/email-parser.ts`) peut ne pas extraire correctement les donnees. A tester avec 3 formats d'email differents.
- Verifier que le destinataire du lien = email CLIENT et jamais email ARTISAN.

### E2E 3 : Devis assiste --> PDF --> envoi

```text
Etapes :
1. Dossier D3 en statut "devis_a_faire"
2. Cliquer "Creer un devis" depuis la fiche dossier
3. Verifier : sidebar assistant visible, onglet "Packs" actif
4. Verifier : packs suggeres correspondent a la categorie du dossier
5. Cliquer "Ajouter le pack" sur un pack (ex: "Fuite sous evier")
6. Verifier : lignes ajoutees (deplacement + diagnostic + materiel + MO)
7. Modifier un prix, une quantite
8. Onglet "Materiel" : rechercher "siphon" -> verifier resultats < 2s
9. Ajouter un article depuis la recherche
10. Cliquer "PDF" -> verifier ouverture PDF correct (totaux HT/TVA/TTC)
11. Cliquer "Envoyer" -> verifier toast confirmation
12. Verifier : devis passe en "envoye", historique mis a jour
13. Verifier : email client contient lien de validation
```

**Points de defaillance :**
- Le bouton "Envoyer" est desactive si `!dossier.client_email` (correct)
- Le bouton "PDF" est desactive si `itemCount === 0` (correct)
- Verifier que la recherche catalogue fonctionne sur les `synonyms` (ex: "syphon" doit trouver "siphon")

### E2E 4 : Validation devis --> RDV --> creneaux --> confirmation

```text
Etapes :
1. Ouvrir le lien de validation devis (depuis email ou copie)
2. Verifier : page affiche infos devis, totaux, PDF
3. Cliquer "Valider le devis"
4. Verifier : page "Devis valide", artisan notifie (realtime toast)
5. Artisan : dashboard -> verifier devis passe en "signe"
6. Fiche dossier : bloc RDV -> "Proposer des creneaux"
7. Ajouter 3 creneaux, cliquer "Envoyer"
8. Verifier : status RDV = "slots_proposed", notification envoyee
9. Client : ouvrir lien creneaux, choisir un creneau
10. Verifier : status RDV = "client_selected"
11. Artisan : voir creneau choisi, cliquer "Confirmer"
12. Verifier : status RDV = "rdv_confirmed", date/heure affiches
13. Verifier : dashboard tuile "RDV pris" incremente, badge vert sur le dossier
14. Verifier : notification de confirmation envoyee au client
```

**Points de defaillance :**
- La page de choix de creneaux utilise le meme formulaire client (`/client?token=...`). Verifier que le formulaire client gere aussi le cas "choix de creneau" quand des slots existent. **Risque : le formulaire actuel (`ClientForm.tsx`) ne semble pas gerer les appointment_slots.**
- Verifier que la validation du devis arrete automatiquement les relances "devis non signe".

### E2E 5 : Intervention realisee --> facture --> PDF --> envoi

```text
Etapes :
1. Dossier avec RDV confirme
2. Cliquer "Marquer intervention realisee"
3. Verifier : appointment_status = "done"
4. Bloc facture : "Generer la facture"
5. Verifier : facture creee avec lignes pre-remplies depuis le devis
6. Modifier une ligne si necessaire
7. Cliquer "Sauvegarder"
8. Cliquer "Telecharger PDF" -> verifier mentions legales France :
   - SIRET artisan
   - TVA ou mention "art. 293 B"
   - Numero de facture sequentiel
   - Dates emission + intervention
   - Conditions de paiement
   - Penalites de retard (si client pro)
   - Indemnite forfaitaire 40 euros (si client pro)
9. Cliquer "Envoyer" -> verifier email envoye
10. Verifier : facture passe en "sent"
11. Cliquer "Lien client" -> copier URL
12. Ouvrir URL en prive -> verifier affichage facture
13. Cliquer "Marquer payee" -> verifier statut "paid"
14. Verifier : facture envoyee = verrouilee (champs disabled)
```

---

## Phase 3 -- Audit liens client (tokens)

### Matrice de test tokens

| Type de lien | Route | Token field | Expiration |
|-------------|-------|-------------|------------|
| Lien client (completer dossier) | `/client?token=` | `dossiers.client_token` | `client_token_expires_at` (7j) |
| Lien validation devis | `/devis/validation?token=` | `quotes.signature_token` | `signature_token_expires_at` |
| Lien facture | `/facture/view?token=` | `invoices.client_token` | `client_token_expires_at` (90j) |

### Tests par lien

Pour chaque type de lien, tester :
- [ ] **Token valide** : affiche la bonne page avec les bonnes donnees
- [ ] **Token invalide** (random string) : affiche "Lien invalide" proprement
- [ ] **Token expire** : affiche "Lien expire" + message "contactez votre artisan"
- [ ] **Pas de token** (`?token=` vide) : affiche "Lien invalide"
- [ ] **Isolation** : impossible d'acceder aux donnees d'un autre dossier/devis/facture
- [ ] **Anti-doublon** : regenerer un lien quand un actif existe = comportement attendu (reutilisation ou invalidation ancien)

### Bugs potentiels detectes

1. **URL en dur dans `send-client-link`** : Le lien client est construit avec `https://id-preview--2e27a371-...` au lieu d'utiliser l'origin dynamique. L'email enverra un lien qui ne marchera pas en production. **Severite : P0**.

2. **Fonction `generate-client-token` en doublon** : Il existe DEUX edge functions qui generent des tokens client : `generate-client-token` et `send-client-link`. La premiere ne semble plus utilisee dans le code front (le `ClientLinkBlock` appelle `send-client-link`). Risque de confusion et de tokens orphelins. **Severite : P1** -- supprimer `generate-client-token` si inutilisee.

3. **Page creneaux RDV** : Le choix de creneau par le client devrait etre accessible via le lien client, mais `ClientForm.tsx` ne gere pas les `appointment_slots`. Il n'existe pas de route/page dediee pour le choix de creneaux. **Severite : P0** si les notifications contiennent un lien de choix.

---

## Phase 4 -- Audit boutons et automatisations

### Table d'actions (inventaire complet)

#### Dashboard (`/`)
| Bouton | Action backend | Effet | Notification |
|--------|---------------|-------|-------------|
| Nouveau dossier | INSERT dossier + invoke send-client-link | Dossier cree, lien envoye | Email + SMS |
| Clic sur dossier | Navigation | Ouvre fiche | -- |
| Tuiles RDV | Filtre local | Filtre la liste | -- |
| Tuiles statut | Filtre local | Filtre la liste | -- |

#### Fiche dossier (`/dossier/:id`)
| Bouton | Action backend | Effet | Notification | Idempotent |
|--------|---------------|-------|-------------|------------|
| Changer statut | UPDATE dossier + INSERT historique | Statut change | -- | Oui |
| Ajouter note | INSERT historique | Note ajoutee | -- | Non (OK) |
| Generer/envoyer lien client | invoke send-client-link | Token cree + email | Email | **Non -- risque doublon** |
| Copier lien client | Clipboard | -- | -- | Oui |
| Renvoyer lien client | invoke send-client-link | Email renvoye | Email | **Non** |
| Proposer creneaux | INSERT appointment_slots + UPDATE dossier | Slots crees | Email + SMS | **Non** |
| Definir RDV manuellement | UPDATE dossier | RDV confirme | Email + SMS | **Non** |
| Confirmer le RDV | UPDATE dossier | RDV confirme | Email + SMS | **Non** |
| Marquer intervention realisee | UPDATE dossier | Status "done" | -- | Oui |
| Annuler le RDV | UPDATE dossier | Status "cancelled" | -- | Oui |
| Activer/desactiver relances | UPDATE dossier + INSERT historique | relance_active toggle | -- | Oui |
| Envoyer relance manuelle | invoke send-relance | Relance envoyee | Email | **Non** |

#### Editeur devis (`/dossier/:id/devis`)
| Bouton | Action backend | Effet | Notification | Idempotent |
|--------|---------------|-------|-------------|------------|
| Ajouter pack | INSERT quote_lines (local) | Lignes ajoutees | -- | Oui |
| Ajouter ligne | INSERT quote_lines (local) | Ligne ajoutee | -- | Oui |
| Generer PDF | invoke generate-quote-pdf | PDF genere | -- | **Non** |
| Envoyer devis | invoke send-quote | Devis envoye | Email | **Non** |

#### Editeur facture (`/dossier/:id/facture/:id`)
| Bouton | Action backend | Effet | Notification | Idempotent |
|--------|---------------|-------|-------------|------------|
| Sauvegarder | UPDATE invoice + DELETE/INSERT lines | Facture sauvegardee | -- | Oui |
| Telecharger PDF | invoke generate-invoice-pdf | PDF genere | -- | **Non** |
| Envoyer facture | invoke send-invoice | Facture envoyee | Email | **Non** |
| Lien client | invoke generate-invoice-token | Token cree, URL copiee | -- | **Non** |
| Marquer payee | UPDATE invoice | Statut "paid" | -- | Oui |

#### Validation devis (client)
| Bouton | Action backend | Effet |
|--------|---------------|-------|
| Valider le devis | invoke validate-quote | Devis signe, artisan notifie |
| Refuser le devis | invoke validate-quote | Devis refuse, artisan notifie |

---

## Phase 5 -- Audit backend (robustesse)

### Bugs P0 identifies

1. **URL en dur dans `send-client-link/index.ts`** (ligne 85) :
   ```
   const clientLink = `https://id-preview--2e27a371-...`
   ```
   Doit utiliser `req.headers.get("origin")` ou une env var `PUBLIC_URL`.

2. **Page choix creneaux manquante** : Les notifications de creneaux envoient un lien (`/client?token=...`) mais le formulaire client ne gere pas le choix de creneaux. Le client recoit un lien mais tombe sur le formulaire de completion au lieu de la page de selection de creneau.

3. **Absence de protection anti-doublon** sur les actions d'envoi (email/SMS/PDF). Un double-clic rapide peut declencher 2 envois.

### Bugs P1 identifies

4. **Edge function `generate-client-token` en doublon** avec `send-client-link`. A nettoyer.

5. **Machine a etats non stricte** : les transitions de statut dossier et RDV ne sont pas validees cote backend. Un appel API direct pourrait forcer un statut incoherent (ex: passer de "clos_signe" a "nouveau").

6. **Facture "sent" non strictement verrouilee** : Cote frontend, `isLocked = invoice.status !== "draft"` empeche l'edition. Mais il n'y a pas de protection cote backend (RLS/trigger) empechant la modification d'une facture envoyee.

### Recommandations d'amelioration

- Ajouter un `disabled` + debounce sur tous les boutons d'envoi pour eviter les doubles clics
- Ajouter une validation de transition de statut cote backend (trigger PostgreSQL)
- Centraliser la construction des URLs publiques (client link, quote link, invoice link) dans une fonction utilitaire

---

## Phase 6 -- Audit UX

### Checklist heuristique

- [ ] Chaque ecran a 1 CTA principal visible (sans scroll)
- [ ] Mobile : CTA dans un sticky footer si ecran long
- [ ] Confirmation apres chaque action ("Envoye", "Sauvegarde", "Erreur + raison")
- [ ] Historique lisible (pas de cles techniques comme "client_link_generated" -- utiliser des libelles humains)
- [ ] Pas de spinner sans message contextuel pendant plus de 2 secondes

### Mesures PMF (chronometrees)

| Action | Objectif | Comment mesurer |
|--------|----------|----------------|
| Creer dossier | < 45 sec | Timer depuis clic "Nouveau" jusqu'au toast "Cree" |
| Comprendre fiche dossier | < 10 sec | L'artisan peut dire le statut, le client, le prochain pas en < 10s |
| Retrouver un dossier | < 5 sec | Recherche par nom ou tel |
| Devis simple (avec packs) | < 5 min | Depuis "Creer devis" jusqu'a "Envoyer" |
| Proposer creneaux | < 1 min | Depuis clic "Proposer" jusqu'a envoi |
| Facture | < 3 min | Depuis "Generer facture" jusqu'a "Envoyer" |

---

## Phase 7 -- Livrables

1. **Ce plan** comme reference de test
2. **Bug tracker** avec chaque bug classe P0/P1/P2 :
   - P0 : bloquant (URL en dur, page creneaux manquante, anti-doublon)
   - P1 : degradant (edge function doublon, machine a etats laxiste)
   - P2 : amelioration (PublicLinkLog, ErrorBoundary, debounce boutons)
3. **Correctifs** implementes dans cet ordre :
   - P0 d'abord : URL dynamique dans send-client-link, page choix creneaux, debounce/disable boutons
   - P1 ensuite : nettoyage generate-client-token, validation transitions statut
   - P2 enfin : logs supplementaires, ameliorations UX
4. **Changelog** de chaque correction

---

## Ordre d'execution recommande

1. Corriger les 3 bugs P0 identifies (prerequis avant tout test)
2. Creer le jeu de donnees test
3. Executer les 5 E2E sur desktop Chrome
4. Executer la matrice tokens (Phase 3)
5. Verifier la table d'actions (Phase 4) -- bouton par bouton
6. Repasser les E2E sur mobile (390x844) et tablette (768x1024)
7. Documenter tous les bugs trouves dans le tracker
8. Corriger par priorite P0 > P1 > P2
9. Re-tester les parcours corriges
