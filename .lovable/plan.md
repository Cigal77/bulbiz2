

## Plan: Fix duplicate invoice number error

### Problem
When a dossier has no client name, the pre-fill sets `invoiceNumber` to just `"FAC"`. Since this is not empty, `handleSubmit` uses it directly instead of calling `generate_invoice_number` RPC, causing a unique constraint violation (`invoices_invoice_number_user_id_key`) on the second import.

### Fix

**File: `src/components/dossier/ImportFactureDialog.tsx`**

In the `useEffect` pre-fill (lines 49-55): after building the parts array, only set the invoice number if there's at least one name part (i.e., more than just "FAC"). If only "FAC" remains, leave the field empty so the RPC auto-generates a unique number on submit.

Change:
```ts
setInvoiceNumber(parts.join("-"));
```
To:
```ts
if (parts.length > 1) {
  setInvoiceNumber(parts.join("-"));
}
```

This ensures that when no client name exists, `invoiceNumber` stays empty → `handleSubmit` falls through to `generate_invoice_number` RPC → unique number like `FAC-2026-0002` is generated.

