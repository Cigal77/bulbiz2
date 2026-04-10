

## Rendre l'email obligatoire dans PublicClientForm

### Problème
Dans `src/pages/PublicClientForm.tsx`, ligne 429, la condition `canGoNext` pour l'étape 2 rend l'email optionnel : si le champ est vide, la validation passe quand même. Sans email, les notifications (confirmation client, relances) ne fonctionnent pas.

### Modification unique

**Fichier** : `src/pages/PublicClientForm.tsx`

**1. `canGoNext` (ligne 425-430)** — Rendre l'email requis et validé :

```ts
if (step === 2)
  return (
    form.client_first_name.trim() &&
    form.client_last_name.trim() &&
    form.client_email.trim() !== "" &&
    validateEmail(form.client_email)
  );
```

**2. Label du champ email (dans le rendu step 2)** — Ajouter un astérisque `*` pour indiquer visuellement que le champ est obligatoire, comme pour le prénom et le nom.

### Impact
- Le bouton "Suivant" reste grisé tant qu'un email valide n'est pas saisi
- Aucun changement sur `ClientForm.tsx` (formulaire par token, logique différente)

