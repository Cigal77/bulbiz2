

L'utilisateur signale un problème UX desktop sur la page Dossiers (`/`) : le texte déborde sur les tuiles de statut. Sur la capture d'écran, on voit clairement :
- Les tuiles "Rendez-vous" (Créneaux à proposer, En attente client, RDV pris, RDV terminé) — OK car seulement 4 tuiles larges
- Les tuiles "Statuts dossiers" (Nouveau, En attente de RDV, RDV pris, RDV terminé, Devis à faire, Devis envoyé, Devis signé, Facture en attente, Facture payée, Clos perdu) → **10 tuiles** dans une grille `lg:grid-cols-7`, donc 10 items pour 7 colonnes = wrapping désordonné, et chaque tuile est trop étroite → textes coupés ("Nouve...", "RDV termin...", "Devis envoy...", "Factur en attente").

Je vais vérifier le code pour confirmer.
<lov-tool-use id="toolu_vrtx_01TSTJnMMnMrkBfnJaccmRfx" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/dashboard/StatusCounters.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Pbs93aVDPAULLAdsub8nap" name="code--view" integration-id="code" data="{\"file_path\": \"src/lib/constants.ts\", \"lines\": \"1-100\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Et3wDZUSFddkquYP1aGmsW" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/dashboard/StatusCounters.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01CXsyNXdBV1BsNbAiYjqxHc" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/dashboard/AppointmentCounters.tsx\"}">
</lov-tool-use>
Le screenshot montre clairement : `StatusCounters` est en `lg:grid-cols-10` avec 10 statuts → chaque tuile fait ~80px de large à 1055px viewport, ce qui force le texte (« Nouveau », « En attente de RDV », « RDV terminé », « Devis envoyé », « Facture en attente », « Facture payée », « Clos (perdu) ») à déborder/être tronqué visuellement (le label sort de la pastille colorée).

<lov-plan>

## Plan — Fix débordement texte dashboard desktop

### Diagnostic
À 1055px (desktop intermédiaire), `StatusCounters` utilise `lg:grid-cols-10` → 10 colonnes pour 10 statuts → chaque tuile fait ~80px → les labels longs comme « En attente de RDV », « Facture en attente », « Devis envoyé », « Facture payée », « Clos (perdu) » débordent de leur badge coloré et sont tronqués brutalement (visible sur la capture).

`AppointmentCounters` (4 tuiles en `sm:grid-cols-4`) souffre du même mal sur viewport étroit : « Créneaux à proposer » coupé.

### Corrections

**1. `StatusCounters.tsx`**
- Remplacer la grille fixe par un wrap responsive plus souple : `grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-10` (au lieu de sauter direct à 10 dès `lg`).
- Permettre au label de wrapper sur 2 lignes : ajouter `whitespace-normal leading-tight text-left` + retirer le badge coloré inline qui contraint la largeur. Garder l'icône + label visible sur 2 lignes max.
- Rendre la pastille de couleur uniquement décorative (pastille fine en haut OU rond coloré derrière l'icône) pour ne plus contraindre la largeur.
- Réduire le padding intérieur à `p-3` pour gagner de la place.

**2. `AppointmentCounters.tsx`**
- Même traitement : labels en `whitespace-normal leading-tight`, icône au-dessus du label si besoin, padding réduit.
- Garder `sm:grid-cols-4` mais autoriser le label à passer sur 2 lignes proprement.

**3. Vérification mobile**
Conserver `grid-cols-2` en mobile — déjà OK, juste s'assurer que le label wrap ne casse pas la hauteur.

### Périmètre
- 2 fichiers modifiés uniquement
- Aucun changement de logique métier, juste CSS/layout
- Compatible toutes tailles d'écran (mobile, tablette, desktop, ultra-large)

### Hors scope
- Refonte des couleurs de statuts
- Réduction du nombre de statuts affichés (peut être proposé en suggestion)

