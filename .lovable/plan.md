

L'utilisateur demande un audit complet de sécurité + non-régression avant publication. C'est un meta-patch très large. Je vais explorer rapidement les points critiques (RLS, isolation, liens publics, ref ref de la console error sur MaterialGroupedGrid) puis proposer un plan d'audit + fixes ciblés.

**Points déjà visibles dans le contexte :**
- ✅ RLS bien posée sur toutes les tables (user_id = auth.uid() partout)
- ✅ Liens publics : token + expiration sur dossiers/invoices, RLS spécifiques anon
- ✅ Multi-tenant via user_id (pas de company_id explicite — Bulbiz est mono-utilisateur par compte)
- ⚠️ Console : warning React `forwardRef` sur `MaterialGroupedGrid` (non bloquant mais visible)
- ⚠️ Linter Supabase à exécuter pour confirmer
- ⚠️ Plusieurs nouvelles tables PATCH 6/7 sans backfill : `sector_id`, `category_id` NULLables sur `catalog_material` → OK rétrocompatible

Je vais aussi vérifier 2-3 points clés rapidement.
