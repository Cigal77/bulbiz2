

## Diagnostic

La fonction `summarize-dossier` **crash au démarrage** avec l'erreur :
```
SyntaxError: Identifier 'invoices' has already been declared (line 289)
```

C'est exactement le même bug que celui corrigé précédemment pour `quotes` : la variable `const invoices` est déclarée deux fois (ligne 118 et ligne 271). Cela empêche la fonction de démarrer, d'où le message "IA indisponible" et l'absence de liste de matériel.

## Correction

**Fichier** : `supabase/functions/summarize-dossier/index.ts`

- **Ligne 271** : Remplacer `const invoices = invoicesRes.data || [];` par une simple réutilisation de la variable déjà déclarée ligne 118. Changer en commentaire ou supprimer la redéclaration.

C'est un fix d'une seule ligne. Après redéploiement, le résumé IA et la liste de matériel fonctionneront à nouveau.

