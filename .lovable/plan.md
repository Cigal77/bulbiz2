

## Ajouter l'unité au matériel à emporter

Le champ `unit` manque dans le schéma `material_list`. Actuellement seuls `label`, `qty` et `ref` sont demandés à l'IA. Du coup "5 m² de placo" devient "5× placo" — l'unité est perdue.

### Changements

**1. `supabase/functions/summarize-dossier/index.ts`**
- Ajouter `"unit"` au schéma JSON de `material_list` dans le prompt :
  ```json
  { "label": "Nom exact", "qty": 1, "unit": "u", "ref": "référence" }
  ```
- Ajouter une instruction : `unit` = unité de mesure (u, m, m², m³, kg, L, lot, forfait). Par défaut "u" si non précisé.

**2. `src/components/dossier/SummaryBlock.tsx`**
- Ajouter `unit?: string` à l'interface `MaterialItem`
- Modifier l'affichage : au lieu de `{item.qty}×`, afficher `{item.qty} {item.unit}` quand l'unité n'est pas "u", sinon garder `{item.qty}×`

| Fichier | Modification |
|---|---|
| `supabase/functions/summarize-dossier/index.ts` | Ajouter `unit` au schéma material_list dans le prompt AI |
| `src/components/dossier/SummaryBlock.tsx` | Ajouter `unit` à l'interface + affichage conditionnel |

