

## Plan : Augmenter la limite vidéo à 200 MB

Trois endroits à modifier :

### 1. `src/components/dossier/MediaUploadDialog.tsx` (ligne 25)
- Passer `MAX_VIDEO_SIZE` de `50 * 1024 * 1024` à `200 * 1024 * 1024`

### 2. `supabase/functions/upload-client-media/index.ts` (ligne 28-30)
- Passer la validation de taille de `50 * 1024 * 1024` à `200 * 1024 * 1024`
- Mettre à jour le message d'erreur : "max 200 MB"

### 3. `src/pages/ClientForm.tsx`
- Vérifier s'il y a une limite vidéo côté formulaire client public et l'aligner aussi à 200 MB

C'est tout. Pas de compression nécessaire, le stockage backend supporte ces tailles.

