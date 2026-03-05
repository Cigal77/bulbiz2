

## Plan: Fix public client link file uploads + test readiness

### Problem identified
The public form (`PublicClientForm.tsx`) sends `slug` to the `upload-client-media` edge function, but that function only accepts `token` (a `client_token` from the `dossiers` table). Since no dossier exists yet when uploading, **all file uploads from the public link fail silently**.

### Changes

#### 1. Update `supabase/functions/upload-client-media/index.ts`
- Accept both `token` (existing flow) and `slug` (public link flow) from form data
- When `slug` is provided: look up `profiles.public_client_slug` to get `user_id`, then upload to a temporary path like `{user_id}/public-uploads/client_{timestamp}.{ext}`
- When `token` is provided: keep existing behavior unchanged
- Return the storage file path as `url` (same as current)

#### 2. Update `src/pages/PublicClientForm.tsx`
- Fix the upload call: currently sends `formData.append("slug", slug!)` but the edge function reads `formData.get("token")` — these don't match
- The response field is `url` but the code checks `result.url` — verify this matches (it does, OK)
- Add `HEIC` and `HEIF` to `ALLOWED_TYPES` for iPhone compatibility

#### 3. No other files affected
The `submit-public-form` edge function already receives `media_urls` (storage paths) and inserts them correctly. No database changes needed.

### Technical detail
```text
Current broken flow:
  PublicClientForm → upload-client-media(slug=X) → function reads "token" → null → 400 error

Fixed flow:
  PublicClientForm → upload-client-media(slug=X) → lookup profiles by slug → get user_id → upload to storage → return path
  PublicClientForm → submit-public-form(slug, data, media_urls) → create dossier + link medias
```

