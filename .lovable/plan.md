

## Diagnostic

The `summarize-dossier` edge function has several issues:

1. **Runtime crash**: `videoMedias` is referenced (lines 280, 358, 484) but never defined — the variable was deleted in a previous cleanup but references remain. This causes a **500 error**.

2. **Text notes not analyzed**: The function fetches audio and images but **ignores text notes** (`media_category = 'note'`), which artisans use frequently to jot down observations.

3. **Prompt not optimized for artisan workflow**: The current prompt is generic. It needs to be restructured to prioritize:
   - Material list with references, quantities, and brands (from quotes/invoices)
   - Practical field info (access, parking, floor, equipment to bring)
   - Administrative status (quote sent? signed? invoice pending?)
   - Client availability and contact readiness

## Plan

### 1. Fix the `videoMedias` crash
- Remove all references to `videoMedias` / `hasVideoFiles` since video analysis was intentionally removed.
- Set `videos: 0` in `media_analyzed`.

### 2. Add text notes fetching
- Add a query for `medias` where `media_category = 'note'` to fetch written notes.
- Include note content in the text context sent to the AI.

### 3. Rewrite the system prompt for artisan optimization
Structure the AI output into artisan-centric sections:

```
{
  "headline": "Situation en 1 phrase",
  "bullets": [
    "🔧 Problème identifié + détails techniques",
    "📦 Matériel nécessaire (marques, réf, quantités)",
    "📍 Accès chantier (étage, code, parking...)",
    "📋 Statut administratif (devis/facture)",
    "📞 Client (dispo, contact)"
  ],
  "next_action": "Action concrète prioritaire",
  "material_list": [
    { "label": "...", "qty": 1, "ref": "..." }
  ]
}
```

The new prompt will instruct the AI to:
- **Extract a detailed material list** from quotes/invoices/PDFs with brands, references, quantities
- **Prioritize practical chantier info**: what to bring, access details, equipment visible in photos
- **Summarize admin status clearly**: quote signed/pending, invoice sent/paid
- **Use bullet prefixes** (emoji) for quick scanning on mobile
- **Never hallucinate** details not present in the data

### 4. Update `SummaryBlock.tsx` to display material list
- Add a new `material_list` section in the UI when the AI returns material details.
- Display as a compact checklist the artisan can reference on-site.

### Files modified
- `supabase/functions/summarize-dossier/index.ts` — fix crash, add notes, rewrite prompt, add material_list output
- `src/components/dossier/SummaryBlock.tsx` — display material_list section

