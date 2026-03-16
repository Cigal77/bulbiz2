

## Constat

Après recherche dans tout le projet, **aucun fichier** ne référence `favicon.ico`. Le `index.html` utilise déjà exclusivement `/logo.png` pour le favicon, les icônes et l'apple-touch-icon.

Le fichier `public/favicon.ico` est simplement un résidu inutilisé.

## Plan

1. **Supprimer `public/favicon.ico`** — c'est le favicon Lovable par défaut, il n'est référencé nulle part mais pourrait être servi automatiquement par certains navigateurs qui cherchent `/favicon.ico` par convention.

2. **Générer un `public/favicon.ico` à partir de `logo.png`** — pour que les navigateurs qui requêtent `/favicon.ico` par défaut obtiennent le bon logo Bulbiz au lieu de l'ancien Lovable.

Concrètement : écraser le fichier `public/favicon.ico` existant par une copie de `logo.png` (renommée en `.ico` ou convertie), et ajouter une balise `<link rel="icon" href="/favicon.ico">` dans `index.html` en complément des références existantes à `/logo.png`.

