
# Transition automatique appointment_status = rdv_pending apres validation devis

## Contexte

Deux chemins permettent de passer un devis au statut "signe" :
1. **Edge function `validate-quote`** : le client valide via un lien public (token)
2. **Hook `useQuotes.tsx` > `updateStatus`** : l'artisan change manuellement le statut

Les deux doivent declencher `appointment_status = 'rdv_pending'` sur le dossier et ajouter une entree historique.

## Modifications

### 1. `supabase/functions/validate-quote/index.ts`

Dans le bloc `if (action === "accept")`, ajouter `appointment_status: 'rdv_pending'` a l'update du dossier (ligne 90-92) :

```typescript
await supabase.from("dossiers").update({
  status: "clos_signe",
  status_changed_at: now,
  relance_active: false,
  appointment_status: "rdv_pending",  // <-- ajout
}).eq("id", dossier.id);
```

Ajouter une entree historique supplementaire juste apres :

```typescript
await supabase.from("historique").insert({
  dossier_id: dossier.id,
  user_id: dossier.user_id,
  action: "appointment_status_change",
  details: "Prise de rendez-vous en attente",
});
```

### 2. `src/hooks/useQuotes.tsx`

Dans le bloc `if (status === "signe")` (lignes 136-141), ajouter `appointment_status` a l'update :

```typescript
if (status === "signe") {
  await supabase
    .from("dossiers")
    .update({
      status: "clos_signe",
      status_changed_at: new Date().toISOString(),
      appointment_status: "rdv_pending",  // <-- ajout
    })
    .eq("id", dossierId);

  await supabase.from("historique").insert({
    dossier_id: dossierId,
    user_id: user.id,
    action: "appointment_status_change",
    details: "Prise de rendez-vous en attente",
  });
}
```

## Resultat

Quel que soit le chemin de validation (client ou artisan), le dossier passera automatiquement en "Prise de rendez-vous en attente" et l'evenement sera trace dans l'historique.
