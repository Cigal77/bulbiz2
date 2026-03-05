

## Renommer "Résumé IA" → "Résumé de la demande" et remonter le bloc

### Changements

**1. `src/components/dossier/SummaryBlock.tsx`**
- Remplacer le titre `Résumé {aiSummary ? "IA" : ""}` par `Résumé de la demande`

**2. `src/pages/DossierDetail.tsx`** — Remonter le SummaryBlock dans les deux layouts :

- **Mobile** (lignes 233-240) : Sortir `SummaryBlock` de la `CollapsibleSection "📋 Résumé & Client"` et le placer juste après `NextStepBanner` (avant la section Actions), toujours visible sans collapsible.

- **Desktop** (ligne 280) : Déplacer `SummaryBlock` de sa position actuelle (après InvoiceBlock) vers juste après `NextStepBanner` (ligne 269), avant le bloc AppointmentBlock.

Le bloc sera ainsi visible immédiatement à l'ouverture de chaque dossier, sans avoir à déplier une section.

