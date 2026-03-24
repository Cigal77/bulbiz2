

## Ajouter l'étape "Infos pratiques" dans PublicClientForm

Le formulaire public passe directement de "Décrivez votre problème" (step 3) aux créneaux/validation. Il manque l'étape facultative présente dans ClientForm : type de logement, occupant, étage, ascenseur, digicode, disponibilités.

### Modifications dans `src/pages/PublicClientForm.tsx`

**1. Imports** -- Ajouter les icônes et constantes manquantes :
- Icônes : `Building2`, `User`, `ArrowUpDown`, `KeyRound`, `CalendarDays` depuis lucide-react
- Constantes : `HOUSING_TYPES`, `OCCUPANT_TYPES`, `AVAILABILITY_OPTIONS` depuis `@/lib/trade-types`
- Importer `CardDescription` depuis `@/components/ui/card`

**2. State** -- Ajouter les variables d'état (après les states existants ~ligne 91) :
- `housingType`, `occupantType`, `floorNumber`, `hasElevator`, `accessCode`, `availability`

**3. Recompter les étapes** -- TOTAL_STEPS passe de `slotsEnabled ? 5 : 4` à `slotsEnabled ? 6 : 5`. Le slotStep passe de `4` à `5`.

**4. canGoNext** -- Step 4 (infos pratiques) retourne toujours `true` (tout est facultatif). Décaler les conditions des steps suivants.

**5. Nouvelle Card step 4** -- Insérer entre step 3 et step slots/validation, copie exacte du bloc de ClientForm (lignes 848-1001) avec les mêmes champs : housing type, occupant type, étage/ascenseur, digicode, disponibilités. Boutons de navigation adaptés (retour vers step 3, passer ou continuer vers step suivant).

**6. submitData** -- Ajouter dans l'objet `submitData` les nouveaux champs : `housing_type`, `occupant_type`, `floor_number`, `has_elevator`, `access_code`, `availability`.

**7. Reset** -- Ajouter le reset des nouveaux champs dans le callback "Envoyer une autre demande".

**8. Résumé validation** -- Ajouter l'affichage des infos pratiques dans la Card de confirmation (step validation) si renseignées.

