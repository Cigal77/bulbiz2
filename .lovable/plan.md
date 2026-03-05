

## Supprimer toute l'intégration SMS/Twilio

### Fichiers edge functions à modifier (supprimer les blocs SMS)

**6 edge functions** contiennent du code SMS Twilio à retirer :

1. **`supabase/functions/validate-quote/index.ts`** — Supprimer la fonction `sendSms()`, supprimer le bloc "SMS notification to artisan" (~lignes 206-222)

2. **`supabase/functions/send-client-link/index.ts`** — Supprimer `sendSms()`, `normalizePhone()`, `isValidPhone()`, et le bloc d'envoi SMS

3. **`supabase/functions/send-relance/index.ts`** — Supprimer `sendSms()`, la variable `smsBody`, le bloc "Send SMS" (~lignes 230-248)

4. **`supabase/functions/send-quote/index.ts`** — Supprimer `sendSms()` et le bloc SMS

5. **`supabase/functions/send-invoice/index.ts`** — Supprimer `sendSms()` et le bloc SMS

6. **`supabase/functions/send-appointment-notification/index.ts`** — Supprimer `sendSms()`, `getSmsTemplate()`, le bloc SMS, simplifier `NotifResult` (retirer `sms_status`)

7. **`supabase/functions/check-relances/index.ts`** — Supprimer `sendSms()` et les blocs SMS

8. **`supabase/functions/submit-client-form/index.ts`** — Supprimer `sendSms()`, `normalizePhone()` et les appels SMS

### Edge function à supprimer

9. **`supabase/functions/test-sms/index.ts`** — Supprimer entièrement + retirer `[functions.test-sms]` de `supabase/config.toml`

### Frontend

10. **`src/pages/Settings.tsx`** — Supprimer la carte SMS (lignes 255-273), retirer `sms_enabled` du formulaire et du submit

### Pas de migration DB nécessaire
La colonne `sms_enabled` sur `profiles` peut rester sans impact — elle sera simplement ignorée.

