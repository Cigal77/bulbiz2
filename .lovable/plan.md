

## Problem

When a client proposes time slots via the public link, the artisan currently sees them listed but has **no way to select one directly**. The only options are "Ajouter des créneaux" or "Fixer manuellement". The artisan should be able to simply check one of the client's proposed slots and confirm it with one click, automatically sending a confirmation email.

## Plan

### 1. Add selectable slot list in AppointmentBlock (slots_proposed status)

**File: `src/components/dossier/AppointmentBlock.tsx`**

Replace the static slot list (lines 700-711) with interactive checkable slots when status is `slots_proposed`:
- Each slot gets a radio button the artisan can select
- Add state `selectedSlotId` to track which slot the artisan picked
- Show a "Confirmer ce créneau" button when a slot is selected
- Keep existing "Fixer manuellement" as fallback for proposing a different time

### 2. Add `confirmProposedSlot` mutation

**File: `src/components/dossier/AppointmentBlock.tsx`**

New mutation similar to `confirmSlot` but works with any slot (not just client-selected ones):
- Takes the selected slot ID
- Checks for conflicts with existing RDVs
- Updates dossier: `status: "rdv_pris"`, `appointment_status: "rdv_confirmed"`, appointment date/time from the selected slot
- Adds historique entry
- Sends `APPOINTMENT_CONFIRMED` notification (email + SMS) automatically
- Syncs to Google Calendar

### 3. Update slot list UI for both statuses

For `slots_proposed`: Radio buttons to select + confirm button + "Proposer d'autres créneaux" button
For `client_selected`: Keep current behavior (client's choice highlighted, confirm button)

### Technical details

- Reuse existing `sendNotification("APPOINTMENT_CONFIRMED", ...)` and `syncToGoogleCalendar()` helpers already in the component
- The confirmation mutation mirrors the existing `confirmSlot` mutation but selects the slot by ID rather than requiring `selected_at`
- No backend changes needed — all existing edge functions and DB schema support this flow

