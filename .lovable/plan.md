

## Plan : Analyse des devis PDF et items dans le résumé IA

### Objectif
Enrichir le résumé IA en analysant le contenu des devis : PDF importés (envoyés en base64 à Gemini qui supporte nativement `application/pdf`) et lignes d'articles JSONB (devis créés dans l'app).

### Changements

**1. `supabase/functions/summarize-dossier/index.ts`**

- Modifier la requête `quotes` pour récupérer `pdf_url`, `is_imported`, `items`, `notes` en plus des champs actuels
- Pour les devis avec `items` JSONB non vide : formater les lignes en texte lisible (label, quantité, prix unitaire, TVA)
- Pour les devis importés avec `pdf_url` : télécharger le PDF en base64 (max 2 PDFs, 5 Mo chacun) et l'envoyer comme pièce multimodale via `application/pdf`
- Ajouter au prompt système une instruction dédiée :
  - Extraire la liste du matériel (marques, références, quantités)
  - Identifier les prestations et durées estimées
  - Repérer les informations techniques (dimensions, puissance, normes)
- Ajouter `quotes_analyzed` au retour JSON (`media_analyzed`)

**2. `src/components/dossier/SummaryBlock.tsx`**

- Ajouter un badge "📄 X devis" dans la ligne des médias analysés (à côté de photos/vidéos/audio)

### Flux

```text
quotes table
  ├── items JSONB → texte formaté dans le contexte
  └── pdf_url → download base64 → multimodal Gemini (application/pdf)
         ↓
Prompt enrichi → Résumé avec détails matériel + techniques
```

