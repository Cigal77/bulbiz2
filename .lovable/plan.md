

## Personnaliser les types d'intervention par email artisan

### Modifications dans `src/pages/PublicClientForm.tsx`

**1. Constantes** (après les imports, ~ligne 35) : ajouter les trades personnalisés et le mapping par email :

```ts
const CEDRIC_SCHORR_TRADES: typeof TRADE_TYPES = [
  { id: "plomberie", label: "Plomberie", icon: "🛠️", problems: [] },
  { id: "chauffage", label: "Chauffage", icon: "🔥", problems: [] },
  { id: "sanitaire", label: "Sanitaire", icon: "🚿", problems: [] },
  { id: "depannage", label: "Dépannage", icon: "⚡", problems: [] },
  { id: "chantier_renovation", label: "Chantier et rénovation", icon: "🏗️", problems: [] },
];

const CUSTOM_TRADES_BY_EMAIL: Record<string, typeof TRADE_TYPES> = {
  "schorr.cedric@gmail.com": CEDRIC_SCHORR_TRADES,
};
```

**2. Variable dynamique** (après `artisanName`, ligne ~139) :

```ts
const activeTrades = (artisan?.email && CUSTOM_TRADES_BY_EMAIL[artisan.email.toLowerCase()]) || TRADE_TYPES;
```

**3. Rendu Step 1** (ligne 473) : remplacer `TRADE_TYPES.map(...)` par `activeTrades.map(...)`.

### Résultat
- Pour `schorr.cedric@gmail.com` : 5 catégories personnalisées
- Pour tout autre artisan : liste standard inchangée
- Extensible : ajouter d'autres emails dans `CUSTOM_TRADES_BY_EMAIL`

