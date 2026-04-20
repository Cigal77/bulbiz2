

The user approved the AI pre-quote generator plan. Let me finalize a concise plan before switching to default mode.

## Plan — Générateur de pré-devis IA (PATCH 3)

### 1. Base de données (migration)
Nouvelle table `ai_quote_suggestions_log` :
- `id`, `user_id`, `dossier_id`, `quote_id` (nullable)
- `suggestion_payload` jsonb (lignes proposées par l'IA)
- `status` text ('proposed' | 'accepted' | 'modified' | 'rejected')
- `confidence` numeric (0-1)
- `catalog_match_count` int, `ai_fallback_count` int
- `created_at`, `resolved_at`
- RLS : user_id = auth.uid()

### 2. Edge Function `generate-ai-quote-draft`
Input : `{ dossier_id, quote_id? }`
Logique :
1. Charge dossier + medias + historique + 5 derniers devis de l'artisan (apprentissage léger)
2. Appel Lovable AI (`google/gemini-3-flash-preview`) avec **tool calling** structuré : titre, description, lignes (label, qty, unit, type, estimated_price), hypothèses, questions manquantes, niveau de confiance, variantes
3. **Hybride prix** : pour chaque ligne, match dans `catalog_material` (ilike + tags) → prix catalogue ; sinon prix IA + flag `source: 'ai_fallback'`
4. Insère un log `ai_quote_suggestions_log` (status='proposed')
5. Retourne le payload structuré

### 3. Frontend — Hook & types
- `src/lib/ai-quote-types.ts` — interfaces `AiQuoteDraft`, `AiQuoteLine`
- `src/hooks/useAiQuoteDraft.tsx` — `generate()`, `logDecision(lineId, status)`

### 4. Composant `AiQuoteDraftPanel.tsx`
4ème onglet de `AssistantSidebar` (icône Sparkles ✨ "IA"). Affiche :
- Bouton "Générer un pré-devis avec l'IA" (état initial)
- Loading skeleton pendant l'appel
- Résumé + niveau de confiance (badge)
- Liste des lignes proposées (chacune : badge "✨ Proposition IA", source catalogue/IA, boutons Accepter / Modifier / Refuser)
- Section "Questions manquantes" (alertes orange)
- Section "Variantes" (collapsibles si présentes)
- Boutons globaux : "Tout appliquer" / "Ignorer tout"
- Microcopie obligatoire : *« Proposition générée à partir du dossier. Vérifie et ajuste avant envoi. »*

### 5. Bouton "Pré-devis IA" dans `DossierActions.tsx`
Nouveau bouton primaire (sous "Créer un devis") :
- Crée un brouillon devis vide → navigue vers `/dossier/:id/devis?ai=auto`
- L'éditeur détecte `?ai=auto` et déclenche automatiquement la génération IA + ouvre l'onglet Assistant IA

### 6. Intégration `QuoteEditor.tsx`
- Détecte `?ai=auto` au mount → `useAiQuoteDraft.generate()` automatique
- `AssistantSidebar` reçoit nouvelle prop `defaultTab="ai"` quand auto-déclenché
- Lignes acceptées via `onAddItem` / `onAddItems` existants (réutilise l'infra)
- Chaque ligne ajoutée porte un flag visuel "Proposition IA" (badge dans `QuoteItemRow` si `source: 'ai'`)
- Au click "Accepter" → log `status='accepted'` / "Refuser" → `status='rejected'` / édition après ajout → `status='modified'`

### 7. UX mobile
- Sur mobile, l'onglet IA est dans le `Sheet` existant (bottom drawer)
- Cards lignes IA : swipe-friendly, boutons larges (44px)

### 8. Apprentissage (passif v1)
- Toutes les décisions journalisées dans `ai_quote_suggestions_log`
- Pas d'effet immédiat sur les futures suggestions (v1) — données prêtes pour analyse / fine-tuning ultérieur

### États gérés
- Loading (skeleton)
- Erreur 402 (crédits IA épuisés) → toast "Crédits IA épuisés, recharger"
- Erreur 429 (rate limit) → toast "Trop de requêtes, réessayer dans 1 min"
- Dossier vide / pas assez d'infos → IA renvoie `questions[]` plutôt que des lignes

### Fichiers
**Créés :**
- `supabase/functions/generate-ai-quote-draft/index.ts`
- `src/lib/ai-quote-types.ts`
- `src/hooks/useAiQuoteDraft.tsx`
- `src/components/quote-editor/AiQuoteDraftPanel.tsx`

**Modifiés :**
- `src/components/quote-editor/AssistantSidebar.tsx` — 4ème onglet "IA"
- `src/components/quote-editor/QuoteItemRow.tsx` — badge "✨ Proposition IA"
- `src/components/dossier/DossierActions.tsx` — bouton "Pré-devis IA"
- `src/pages/QuoteEditor.tsx` — détection `?ai=auto`

### Hors scope v1
- Apprentissage actif (le log existe mais ne nourrit pas encore les prompts)
- Édition swipe complète mobile (cartes + boutons suffisent)
- Analyse images via Gemini multimodal — basculé en v1.1 si volume token ok

