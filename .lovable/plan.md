

## Plan : Popup d'onboarding pour les nouveaux inscrits

### Logique de déclenchement
Le popup s'affiche si le profil existe mais que les champs clés (`company_name`, `phone`, `siret`) sont vides, ET que le compte a été créé il y a moins de 30 jours. On utilise un flag `localStorage` (`onboarding_popup_dismissed`) pour ne plus l'afficher après fermeture.

### Composant
Créer `src/components/OnboardingPrompt.tsx` :
- Mobile-first : bottom sheet style (fixé en bas, arrondi en haut) sur mobile, petit toast/card flottant en bas à droite sur desktop
- Non invasif : pas de modal bloquant, juste un panneau discret avec :
  - Titre : "Bienvenue sur Bulbiz ! 👋"
  - Message court : "Complétez vos informations pour profiter pleinement de l'outil. Vos retours nous aident à améliorer la solution."
  - Bouton principal "Compléter mon profil" → navigate vers `/parametres`
  - Bouton secondaire "Plus tard" → ferme et enregistre dans localStorage
- Animation d'entrée avec framer-motion (slide up)

### Intégration
Ajouter `<OnboardingPrompt />` dans `AppLayout.tsx`, après le children. Il se charge de sa propre logique d'affichage (useProfile + useAuth + localStorage check).

### Fichiers modifiés
- `src/components/OnboardingPrompt.tsx` — nouveau composant
- `src/components/AppLayout.tsx` — ajout du composant

