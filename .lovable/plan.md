

# Prise de RDV rapide et intelligente

## Probleme actuel
- Sur mobile, le bloc RDV est enfoui dans la page et peut necessiter du scroll
- Le formulaire de proposition de creneaux ne pre-remplit pas les dates/heures intelligemment
- L'artisan doit verifier manuellement si un creneau est libre
- Les creneaux deja pris sont detectes uniquement au moment de la soumission (conflit affiche apres coup)

## Solution proposee

### 1. Bouton flottant "Proposer RDV" toujours visible (mobile)
- Ajouter un bouton flottant (FAB) en bas a droite sur la page DossierDetail quand le statut du RDV est `none`, `cancelled`, `rdv_pending` ou `slots_proposed`
- Un tap ouvre directement le formulaire de proposition de creneaux dans un Sheet (bottom drawer)
- Evite de scroller jusqu'au bloc Appointment

### 2. Proposition de creneaux intelligente
Quand l'artisan ouvre le formulaire de proposition :
- **Pre-remplissage auto** : les 3 prochains jours ouvrables (lundi-samedi) sont pre-selectionnes avec des heures par defaut (9h-11h, 14h-16h)
- **Creneaux occupes visibles en temps reel** : pour chaque date selectionnee, afficher les RDV deja confirmes de l'artisan ce jour-la sous forme de "plages grises" pour qu'il voie immediatement ses disponibilites
- **Alerte conflit en direct** : le warning de conflit existant reste, mais s'affiche en temps reel des que l'artisan saisit une date/heure (deja en place, on l'ameliore visuellement)

### 3. Vue agenda rapide dans le formulaire
- Sous chaque ligne de creneau, afficher les RDV du jour selectionne : `09:00-11:00 - Dupont (confirme)` en gris
- Cela permet a l'artisan de voir d'un coup d'oeil ses creneaux occupes et de choisir un creneau libre

## Details techniques

### Fichiers modifies

**`src/pages/DossierDetail.tsx`**
- Ajouter un bouton FAB (position fixed, bottom-right, au-dessus de la nav mobile) visible quand `appointment_status` est `none`, `cancelled`, `rdv_pending` ou `slots_proposed`
- Ce bouton ouvre un `Sheet` (bottom drawer) contenant le formulaire de proposition de creneaux

**`src/components/dossier/AppointmentBlock.tsx`**
- Extraire la logique du formulaire de proposition dans un composant reutilisable `SlotProposalForm` (ou le garder inline mais exportable)
- Modifier le pre-remplissage des `newSlots` : au lieu de `[{ date: "", start: "09:00", end: "11:00" }]`, calculer les 3 prochains jours ouvrables
- Pour chaque ligne de creneau, afficher sous le champ date la liste des RDV confirmes ce jour-la (filtre depuis `confirmedRdvs`)
- Format : petites lignes grises `09:00-11:00 Dupont` pour montrer les creneaux occupes

**`src/components/dossier/SmartSlotSheet.tsx`** (nouveau fichier)
- Sheet/Drawer qui encapsule le formulaire de proposition + formulaire RDV manuel
- Deux onglets : "Proposer des creneaux" / "Fixer manuellement"
- Reutilise la meme logique de conflit et de mutation que AppointmentBlock
- Affiche l'agenda du jour selectionne pour chaque creneau

### Logique de pre-remplissage intelligent
```text
function getNextWorkdays(count: number): string[] {
  // Retourne les N prochains jours lun-sam
  // Saute dimanche
  // Format YYYY-MM-DD
}
```
- Slot 1 : prochain jour ouvrable, 09:00-11:00
- Slot 2 : prochain jour ouvrable, 14:00-16:00  
- Slot 3 : jour ouvrable suivant, 09:00-11:00

### Affichage des creneaux occupes par jour
```text
Pour chaque date saisie dans le formulaire :
  -> Filtrer confirmedRdvs par appointment_date === date
  -> Afficher sous le champ : "Deja pris : 09:00-11:00 (Dupont), 14:00-16:00 (Martin)"
```

### Bouton FAB
- Position: `fixed bottom-24 right-4 z-20` (au-dessus de la MobileBottomNav)
- Icone: Calendar + "RDV"
- Animation: leger pulse quand status est `rdv_pending`
- Masque sur desktop (le bloc AppointmentBlock est deja visible dans la sidebar)

