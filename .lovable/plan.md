

## Module "Devis & Facturation conforme" — Plan d'implémentation Bulbiz

### Constat important

L'app dispose déjà d'une base solide : `quotes`, `quote_lines`, `invoices`, `invoice_lines`, `profiles` avec SIRET/TVA/IBAN, génération PDF (`generate-quote-pdf`, `generate-invoice-pdf`), envoi (`send-quote`, `send-invoice`), numérotation RPC (`generate_quote_number`, `generate_invoice_number`), historique, signature client. **L'objectif n'est PAS de tout reconstruire** mais de combler les manques pour atteindre la conformité française complète.

### Manques identifiés vs cahier des charges

| Domaine | Existe | Manque |
|---|---|---|
| Identité légale | SIRET, TVA, adresse | `legal_form`, `capital_amount`, `rcs_city`, mention EI auto, séparation SIREN/SIRET |
| TVA | `vat_applicable`, `default_vat_rate` | Mention 293B auto, TVA sur les débits, taux favoris |
| Assurance | — | Table dédiée `insurance_profile` (assureur, police, couverture, validité) |
| Paiement | IBAN, `payment_terms_default` | BIC, modes acceptés, taux pénalités, indemnité 40 € auto B2B, acompte par défaut |
| Numérotation | RPC devis/facture | Séquences avoirs + acomptes, blocage écrasement, statut "annulé" |
| Versioning | — | `parent_quote_id`, `version_number`, snapshot JSON figé |
| Avoirs / acomptes | — | Type `credit_note` + `deposit_invoice` dans `invoice_type` |
| Client B2B | `client_company` | `customer_type` (particulier/pro), SIREN client, adresse chantier ≠ facturation |
| Checklist conformité | — | Moteur de règles + UI checklist bloquante |
| Onboarding | Settings basique | Wizard 8 étapes obligatoire avant 1er document |
| Score conformité | — | Calcul + affichage paramètres |
| E-facturation | — | Champs `operation_category`, `customer_siren`, prêts pour PDP |

### Périmètre de cette livraison (Phase 1 — fondations)

Pour rester livrable et testable, je propose de découper en **3 lots**. Ce plan couvre le **Lot 1 (fondations conformité)** ; les Lots 2 et 3 viendront ensuite.

---

### LOT 1 — Fondations conformité (cette livraison)

#### 1.1 Migrations base de données

**Étendre `profiles`** :
- `legal_form` (enum: ei, micro, eurl, sarl, sasu, sas, autre)
- `trade_name`, `owner_first_name`, `owner_last_name`
- `capital_amount`, `rcs_city`, `siren`
- `vat_exemption_293b` (bool, auto-calculé depuis `vat_applicable`)
- `vat_on_debits` (bool)
- `bic`, `accepted_payment_methods` (text[]), `default_deposit_type`, `default_deposit_value`
- `late_penalty_rate` (numeric, défaut 3× taux légal)
- `fixed_recovery_fee_b2b` (bool, défaut true)
- `early_payment_discount_text`
- `onboarding_compliance_completed_at` (timestamptz)
- `compliance_score` (int, 0-100, calculé)

**Nouvelle table `insurance_profile`** (1-1 avec user) :
- `decennial_required`, `insurer_name`, `policy_number`, `insurer_contact`, `geographic_coverage`, `validity_start`, `validity_end`, `default_legal_text`
- RLS : owner uniquement

**Nouvelle table `compliance_settings`** (1-1 avec user) :
- `waste_management_text`, `default_quote_validity_days`, `block_generation_if_incomplete` (défaut true), `auto_add_*` flags
- RLS : owner

**Étendre `quotes`** :
- `version_number` (int défaut 1), `parent_quote_id` (uuid), `legal_mentions_snapshot` (jsonb), `compliance_snapshot` (jsonb)
- `deposit_type`, `deposit_value`
- nouveaux statuts : `expire`, `annule` ajoutés à l'enum `quote_status`

**Étendre `invoices`** :
- `invoice_type` (enum: final, deposit, credit_note, standalone) — défaut `standalone`
- `related_quote_id`, `parent_invoice_id` (pour avoirs)
- `version_number`, `legal_mentions_snapshot`, `compliance_snapshot`
- `customer_type` (individual/business), `customer_siren`
- `operation_category` (sale/service/mixed)
- `worksite_address`, `delivery_address`
- `late_penalty_rate`, `recovery_fee_applied`
- nouveau statut `canceled` dans `invoice_status`

**Nouvelles RPC** :
- `generate_credit_note_number(p_user_id)` → format `AV-YYYY-XXXX`
- `generate_deposit_invoice_number(p_user_id)` → format `ACO-YYYY-XXXX`

**Trigger immutabilité** :
- BEFORE UPDATE sur `quotes` : si `status IN ('envoye','signe')` et `version_number` inchangé → bloquer modif des champs financiers (forcer création nouvelle version côté app)
- BEFORE UPDATE sur `invoices` : si `status != 'draft'` → bloquer modif (sauf transition statut/paiement)
- BEFORE DELETE sur `quotes`/`invoices` : si déjà numéroté et envoyé → interdire (passer par `canceled`)

#### 1.2 Onboarding conformité (8 étapes)

**Nouveau composant** `src/pages/ComplianceOnboarding.tsx` accessible via `/onboarding/conformite`.

Wizard avec barre de progression, sticky CTA mobile, autosave à chaque étape :
1. Type entreprise (legal_form, raison sociale, dirigeant, SIREN/SIRET, capital, RCS)
2. Régime TVA (assujetti, taux favoris, TVA sur débits, mention 293B auto)
3. Assurance & mentions bâtiment (décennale, assureur, déchets)
4. Paiement (IBAN/BIC, modes, délai, acompte défaut, pénalités, indemnité 40 €)
5. Numérotation (préfixes, compteurs, format)
6. Identité visuelle (logo, couleur, pied de page)
7. Paramètres clients (B2B vs B2C, adresses)
8. Récap + badge "Conforme : prêt à générer"

**Garde d'accès** : ajouter dans `App.tsx` une vérification — si `onboarding_compliance_completed_at IS NULL` et l'utilisateur tente d'accéder à `/dossier/:id/devis` ou `/dossier/:id/facture/:invoiceId` → redirect vers wizard avec message pédagogique.

#### 1.3 Page "Paramètres > Documents & conformité"

Refondre/créer `src/pages/ComplianceSettings.tsx` (lien depuis `/parametres`) :
- Score de conformité visuel (anneau de progression + %)
- 10 sections en cartes avec badge ✅/⚠️ : identité légale, TVA, assurance, règlement, numérotation, modèle PDF, mentions par défaut, clients pro, e-facturation, archivage
- Chaque carte → `Edit` → modal/sheet avec sous-formulaire
- Microcopy pédagogique par section

#### 1.4 Moteur de conformité (lib partagée)

Nouveau fichier `src/lib/compliance-engine.ts` :
- `computeComplianceScore(profile, insurance, settings)` → 0-100
- `getMissingMandatoryFields(profile, insurance, settings)` → string[]
- `buildLegalMentions(profile, insurance, customer)` → objet structuré (mention EI, 293B, décennale, pénalités B2B, déchets, IBAN)
- `validateQuoteForGeneration(quote, profile, customer)` → `{ ok: boolean, blockers: string[], warnings: string[] }`
- `validateInvoiceForGeneration(invoice, profile, customer)` → idem

Mêmes règles dupliquées côté Edge Functions (validation backend bloquante avant génération PDF).

#### 1.5 Composant ComplianceChecklist

`src/components/compliance/ComplianceChecklist.tsx` :
- Liste pliable des items (✅ vert / ⚠️ ambre / ❌ rouge)
- Affichée dans `QuoteEditor` et `InvoiceEditor` (sidebar desktop, drawer mobile)
- Boutons "Corriger" qui deep-link vers la section paramètres concernée
- Bloque les boutons "Générer PDF" et "Envoyer" si blockers présents

#### 1.6 Modal de blocage

`src/components/compliance/ComplianceBlockerDialog.tsx` :
- Affiché au clic sur Générer PDF/Envoyer si non conforme
- Liste des éléments manquants avec explication courte
- CTA "Corriger maintenant" → navigation directe

#### 1.7 Snapshot & versioning

Au moment de l'envoi (`send-quote`, `send-invoice`) :
- Calculer `legal_mentions_snapshot` (mentions effectives appliquées)
- Calculer `compliance_snapshot` (état des champs profile au moment T)
- Stocker dans la ligne du document
- PDF généré → URL conservée définitivement

Sur action "modifier après envoi" :
- Bouton renommé "Créer une nouvelle version"
- Crée nouveau `quote` avec `parent_quote_id` = ancien, `version_number` = N+1
- Ancien reste consultable (statut `obsolete` ou conservé tel quel)

#### 1.8 Mise à jour PDF

Étendre `generate-quote-pdf` et `generate-invoice-pdf` :
- Mention "EI" / "Entrepreneur individuel" auto si `legal_form ∈ {ei, micro}`
- Mention "TVA non applicable, art. 293 B du CGI" si non assujetti
- Bloc assurance décennale si requis
- Bloc déchets si activé
- Pénalités de retard + indemnité 40 € si client B2B
- Affichage capital social + RCS si société
- Numéro de version si > 1
- Bloc adresse chantier ≠ facturation si applicable

---

### Lots suivants (NON inclus dans cette livraison, à valider après)

**Lot 2 — Avoirs, acomptes & transformations**
- UI création avoir depuis facture
- UI création facture d'acompte depuis devis accepté
- Transformation devis accepté → facture finale avec snapshot lignes
- Suivi paiements partiels, échéances, retards
- Relances factures impayées

**Lot 3 — E-facturation & finitions**
- Section "Préparation e-facturation" complète
- Export Factur-X / placeholder PDP
- Journal d'événements UI dédié
- Page liste devis enrichie (filtres, badges conformité par ligne)
- Audit interne final

---

### Architecture technique

```text
src/
├── pages/
│   ├── ComplianceOnboarding.tsx         (nouveau)
│   └── ComplianceSettings.tsx           (nouveau, remplace section dans Settings)
├── components/
│   └── compliance/
│       ├── ComplianceChecklist.tsx
│       ├── ComplianceBlockerDialog.tsx
│       ├── ComplianceScoreRing.tsx
│       └── steps/                        (8 étapes onboarding)
├── lib/
│   └── compliance-engine.ts
└── hooks/
    ├── useComplianceProfile.tsx          (profile + insurance + settings)
    └── useComplianceScore.tsx

supabase/
├── migrations/                            (1 migration)
└── functions/
    ├── generate-quote-pdf/                (étendu mentions auto)
    ├── generate-invoice-pdf/              (étendu mentions auto)
    └── compliance-validate/               (nouveau, validation backend)
```

### Validation bloquante (frontend + backend)

- Frontend : `validateQuoteForGeneration` désactive les CTAs
- Backend : Edge Functions `generate-*-pdf` et `send-*` re-vérifient et renvoient 422 si blockers → impossible de contourner via API directe

### Sécurité

- RLS strictes sur nouvelles tables (owner only)
- Trigger SQL pour immutabilité numéros + documents envoyés
- Snapshots JSONB figés (jamais updatés)
- Conservation 10 ans (pas de DELETE physique sur factures envoyées)

### Périmètre exact à approuver

**Cette livraison (Lot 1)** = ~25 fichiers créés/modifiés, 1 migration importante, 2 Edge Functions étendues + 1 nouvelle. Estimation : module testable en bout de chaîne (onboarding → settings → checklist → génération PDF avec mentions auto + versioning + blocage).

**À confirmer avant de démarrer** :
1. Démarrer par le **Lot 1 seul** ou attaquer plus large ?
2. Forcer la redirection onboarding pour les utilisateurs **existants** (qui ont déjà des dossiers) ou seulement les nouveaux ?
3. Pour les comptes existants ayant déjà créé devis/factures : garder l'historique tel quel (sans snapshot rétroactif) ou tenter une migration des données ?

