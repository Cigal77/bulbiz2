

Plan concis pour le devis vocal. Le route actuelle `/dossier/.../devis?ai=auto` confirme que l'éditeur de devis est central.

## Plan — Devis Vocal IA (PATCH 4)

### 1. Edge Function `voice-quote-command`
Input : `{ audio_base64, mime_type, quote_id, current_lines[], mode: 'command' | 'dictation' }`

Logique :
1. **Transcription** : Lovable AI Gateway avec `google/gemini-3-flash-preview` (multimodal audio input — Gemini accepte l'audio inline base64). Fallback : si Gemini audio indisponible, utiliser ElevenLabs Scribe `scribe_v2` (batch).
2. **Interprétation NLU via tool calling** : prompt structuré qui retourne un JSON d'actions :
   ```json
   {
     "transcript": "Ajoute remplacement mécanisme WC...",
     "actions": [
       { "type": "add_line", "label": "...", "qty": 2, "unit": "h", "unit_price": 65, "vat_rate": 10, "line_type": "main_oeuvre", "confidence": 0.92 },
       { "type": "update_line", "line_ref": "L3", "field": "qty", "value": 2 },
       { "type": "delete_line", "line_ref": "L1" },
       { "type": "set_discount", "line_ref": "L2", "value": 30, "unit": "EUR" },
       { "type": "rename_quote", "value": "Remplacement mitigeur cuisine" }
     ],
     "needs_confirmation": false,
     "ambiguities": []
   }
   ```
3. Match prix dans `catalog_material` (réutilise logique PATCH 3).
4. Retourne payload sans rien appliquer (validation côté client).

### 2. Hook `useVoiceQuoteCommand.tsx`
- `startRecording()` / `stopRecording()` (MediaRecorder API, réutilise logique de `VoiceRecorderDialog`)
- `transcribeAndInterpret(blob)` → appelle l'edge function
- États : `idle` | `listening` | `transcribing` | `interpreting` | `ready_to_validate` | `error`

### 3. Composant `VoiceQuoteSheet.tsx` (Bottom sheet mobile / Dialog desktop)
4 écrans séquencés :

**A. État initial — Prêt à écouter**
- Gros bouton micro central (96px, animation subtle pulse)
- Toggle mode : "Commande" / "Dictée libre"
- Microcopie : *« Décris une intervention ou donne une commande »*
- Exemples cliquables : "Ajoute 2h de main-d'œuvre", "Supprime la dernière ligne"

**B. État écoute**
- Bouton micro en rouge avec waveform animée
- Timer
- Bouton "Stop" large
- Microcopie : *« J'écoute…* »

**C. État transcription/interprétation**
- Skeleton loader
- Texte transcrit qui apparaît progressivement
- Microcopie : *« Je comprends ce que tu dis… »*

**D. État validation** (CRITIQUE)
- Texte transcrit affiché en haut, **éditable** (Textarea)
- Bouton "Re-interpréter" si l'utilisateur corrige le texte
- Bloc **"Actions comprises"** :
  - Cards par action avec icône colorée :
    - 🟢 Ajout ligne (vert)
    - 🟡 Modification (orange)
    - 🔴 Suppression (rouge)
    - 🔵 Remise / TVA (bleu)
  - Chaque card affiche : description action + détails + **toggle accept/reject individuel**
  - Badge "Confiance: 92%" si <0.7 → warning visuel
- Boutons globaux : **"Appliquer toutes"** (primary) / **"Recommencer"** / **"Annuler"**
- Microcopie obligatoire : *« Vérifie avant d'appliquer. Tu peux décocher chaque action. »*

### 4. Application des actions côté client
Dans `QuoteEditor.tsx`, fonction `applyVoiceActions(actions[])` :
- `add_line` → push dans `items` state
- `update_line` → modifie ligne ciblée (matching par `line_ref` ou index ou label fuzzy)
- `delete_line` → filter
- `set_discount` / `set_vat` → patch ligne
- `rename_quote` → met à jour titre brouillon
- Toast récap : "✓ 3 actions appliquées"
- Log dans `historique` (action: `voice_quote_edit`, details: transcript + nb actions)

### 5. Bouton flottant micro dans `QuoteEditor.tsx`
- FAB rond 56px en bas à droite (mobile) / en haut de l'éditeur (desktop)
- Icône `Mic` Lucide, gradient primary
- Badge "Vocal" discret
- Au click → ouvre `VoiceQuoteSheet`
- Toujours visible dans l'éditeur de devis

### 6. Gestion ambiguïtés
Si `needs_confirmation: true` ou `ambiguities[]` non vide :
- L'IA renvoie une question : "Quelle ligne veux-tu modifier ? Il y en a deux qui correspondent."
- Affichage d'un sélecteur (cards des lignes candidates)
- L'utilisateur choisit → l'action est complétée

### 7. Modes
- **Commande structurée** : prompt strict, attend des verbes d'action explicites
- **Dictée libre** : prompt plus permissif, l'IA infère les lignes depuis une description naturelle ("Fuite sous évier, siphon à changer + raccords")
- Toggle dans la sheet, persisté localement

### 8. UX mobile (390px - viewport actuel)
- Bottom sheet pleine hauteur
- Bouton micro 96px tactile
- Cards actions empilées, swipe gauche = reject
- Boutons fixes en bas (sticky footer)
- Vibrations haptiques (`navigator.vibrate(50)`) au début/fin enregistrement

### 9. États gérés
- Permission micro refusée → message clair + lien paramètres navigateur
- Pas de réseau → toast retry
- 402/429 → toast crédits IA / rate limit
- Audio trop long (>2 min) → stop auto + message
- Aucune action détectée → "Je n'ai pas compris d'action. Reformule ?"

### Fichiers
**Créés :**
- `supabase/functions/voice-quote-command/index.ts`
- `src/hooks/useVoiceQuoteCommand.tsx`
- `src/components/quote-editor/VoiceQuoteSheet.tsx`
- `src/components/quote-editor/VoiceCommandActionCard.tsx`
- `src/lib/voice-quote-types.ts`

**Modifiés :**
- `src/pages/QuoteEditor.tsx` — FAB micro + handler `applyVoiceActions`

### Hors scope v1
- Streaming temps-réel (WebRTC ElevenLabs) → batch suffisant
- Multi-langue (FR uniquement v1)
- Création de devis depuis 0 à la voix (uniquement édition d'un brouillon existant)
- Confirmation vocale ("Oui, applique") — validation tactile uniquement

