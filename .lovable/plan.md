

## Ajout de keys uniques sur les Cards d'étapes

Ajouter un attribut `key` sur chaque `<Card>` d'étape dans les deux formulaires pour forcer le démontage/remontage React au changement d'étape.

### ClientForm.tsx (5 modifications)

| Étape | Ligne | Changement |
|-------|-------|------------|
| Step 1 | 589 | `<Card>` → `<Card key="step-1">` |
| Step 2 | 690 | `<Card>` → `<Card key="step-2">` |
| Step 3 | 848 | `<Card>` → `<Card key="step-3">` |
| Step 4 | 1007 | `<Card>` → `<Card key="step-4">` |
| Step 5 | 1100 | `<Card>` → `<Card key="step-5">` |

Note : Steps 2 et 3 sont wrappés dans `<>...</>` avec du contenu avant la Card. La key sera mise sur la Card directement (pas sur le fragment).

### PublicClientForm.tsx (5 modifications)

| Étape | Ligne | Changement |
|-------|-------|------------|
| Step 1 | 442 | `<Card>` → `<Card key="step-1">` |
| Step 2 | 476 | `<Card>` → `<Card key="step-2">` |
| Step 3 | 569 | `<Card>` → `<Card key="step-3">` |
| Step slots | 662 | `<Card>` → `<Card key="step-slots">` |
| Validation | 748 | `<Card>` → `<Card key="step-validation">` |

### Impact
Modification purement technique, aucun changement visuel. Corrige les bugs potentiels de state React qui "persiste" entre étapes (inputs pas réinitialisés, composants pas correctement remontés).

