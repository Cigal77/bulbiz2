

## Plan: Artisan-configurable slot proposal toggle

### What exists today
- Step 4 (slot proposal) is **always shown** in `PublicClientForm.tsx` (5-step flow)
- `submit-public-form` already handles `proposed_slots` and inserts into `appointment_slots`
- Settings page has no toggle for this feature

### Changes needed

#### 1. Database: add column to `profiles`
```sql
ALTER TABLE public.profiles ADD COLUMN client_slots_enabled boolean NOT NULL DEFAULT true;
```

#### 2. Settings page (`src/pages/Settings.tsx`)
- Add `client_slots_enabled` to the form interface and `useEffect` reset
- Add a new Card section "Gestion des demandes clients" with a Switch toggle:
  - Label: "Autoriser le client à proposer des créneaux de rendez-vous"
  - Description: "Si activé, le client pourra proposer 3 créneaux à la fin du formulaire. Sinon, vous proposerez les créneaux depuis le dossier."
- Include in `onSubmit` payload

#### 3. Public client form (`src/pages/PublicClientForm.tsx`)
- Fetch `client_slots_enabled` alongside the artisan profile (add to select query)
- Store in state (e.g. `slotsEnabled`)
- If `false`: set `TOTAL_STEPS = 4`, skip step 4 (slots), go directly from step 3 (photos) to step 4 (validation, previously step 5)
- If `true`: keep current 5-step flow unchanged
- On submit when disabled: send empty `proposed_slots: []`

#### 4. No changes needed to:
- `submit-public-form` (already handles empty slots gracefully — just won't insert or update appointment_status)
- `AppointmentBlock` / artisan-side flow (already supports proposing slots from dossier)
- Existing automations, emails, invoices

### Technical detail
```text
Settings toggle ON (default):
  Form: Step1 → Step2 → Step3 → Step4(slots) → Step5(validate)
  
Settings toggle OFF:
  Form: Step1 → Step2 → Step3 → Step4(validate)
  Artisan proposes slots later from dossier view
```

