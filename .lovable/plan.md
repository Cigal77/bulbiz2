

## Problem analysis

Dossiers created via the public slug link get status `devis_a_faire` or `en_attente_rdv` (with `appointment_status = "slots_proposed"`). Looking at `buildActions()`:

- `devis_a_faire` IS handled (line 84) — these should appear
- `en_attente_rdv` with `appointment_status = "slots_proposed"` is **NOT** handled — the only check for `en_attente_rdv` requires `appointment_status === "none"` (line 71), so dossiers with proposed slots fall through completely

This is the root cause: slug-created dossiers with slots proposed are invisible in "À faire".

## Plan

### 1. Add missing status handling in `buildActions()` (TodoActions.tsx)

Add a new action type `"slots_pending"` for dossiers where the client has proposed slots but the artisan hasn't confirmed yet:
- Match: `appointment_status` in `["slots_proposed", "rdv_pending", "client_selected"]` regardless of dossier status
- Label: "Créneaux à traiter"
- High urgency (8)

Add to `ActionItem["type"]` union, `SECTION_ORDER`, and `SECTION_LABELS`.

### 2. Fix sort order — most recent unfinished first

Add `createdAt` field to `ActionItem`. Within each urgency tier and section, sort by `created_at` descending (newest first). This ensures freshly created dossiers from the slug appear at the top of their section.

### 3. Update badge count in DesktopSidebar + MobileBottomNav

Add the new `slots_proposed`/`rdv_pending`/`client_selected` appointment statuses to the todo badge counter so they're counted in the sidebar badge.

### Files to modify
- `src/pages/TodoActions.tsx` — add `slots_pending` type + sort by date within sections
- `src/components/DesktopSidebar.tsx` — include new statuses in badge count
- `src/components/MobileBottomNav.tsx` — same badge fix

