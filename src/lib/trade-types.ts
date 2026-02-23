// Trade types and their associated problem sub-types for the client form

export interface TradeType {
  id: string;
  label: string;
  icon: string;
  problems: { id: string; label: string }[];
}

export const TRADE_TYPES: TradeType[] = [
  {
    id: "plomberie",
    label: "Plomberie",
    icon: "🛠️",
    problems: [
      { id: "fuite", label: "Fuite" },
      { id: "canalisation_bouchee", label: "Canalisation bouchée" },
      { id: "chauffe_eau", label: "Chauffe-eau" },
      { id: "wc", label: "WC" },
      { id: "robinetterie", label: "Robinetterie" },
      { id: "autre_plomberie", label: "Autre" },
    ],
  },
  {
    id: "maconnerie",
    label: "Maçonnerie",
    icon: "🧱",
    problems: [
      { id: "fissures", label: "Fissures" },
      { id: "mur", label: "Mur / Cloison" },
      { id: "fondations", label: "Fondations" },
      { id: "autre_maconnerie", label: "Autre" },
    ],
  },
  {
    id: "carrelage",
    label: "Carrelage",
    icon: "🧩",
    problems: [
      { id: "pose_carrelage", label: "Pose" },
      { id: "reparation_carrelage", label: "Réparation" },
      { id: "joints", label: "Joints" },
      { id: "autre_carrelage", label: "Autre" },
    ],
  },
  {
    id: "toiture",
    label: "Toiture",
    icon: "🏠",
    problems: [
      { id: "fuite_toiture", label: "Fuite toiture" },
      { id: "tuiles", label: "Tuiles / Ardoises" },
      { id: "gouttiere", label: "Gouttière" },
      { id: "isolation_toiture", label: "Isolation" },
      { id: "autre_toiture", label: "Autre" },
    ],
  },
  {
    id: "electricite",
    label: "Électricité",
    icon: "⚡",
    problems: [
      { id: "panne_generale", label: "Panne générale" },
      { id: "tableau_electrique", label: "Tableau électrique" },
      { id: "prise_interrupteur", label: "Prise / Interrupteur" },
      { id: "mise_aux_normes", label: "Mise aux normes" },
      { id: "autre_electricite", label: "Autre" },
    ],
  },
  {
    id: "renovation",
    label: "Rénovation intérieure",
    icon: "🎨",
    problems: [
      { id: "peinture", label: "Peinture" },
      { id: "sols", label: "Sols" },
      { id: "amenagement", label: "Aménagement" },
      { id: "autre_renovation", label: "Autre" },
    ],
  },
  {
    id: "autre_metier",
    label: "Autre",
    icon: "🔧",
    problems: [],
  },
];

export const HOUSING_TYPES = [
  { id: "appartement", label: "Appartement" },
  { id: "maison", label: "Maison" },
  { id: "local_pro", label: "Local professionnel" },
  { id: "autre_logement", label: "Autre" },
];

export const OCCUPANT_TYPES = [
  { id: "proprietaire", label: "Propriétaire" },
  { id: "locataire", label: "Locataire" },
  { id: "syndic", label: "Syndic / Gestionnaire" },
];

export const AVAILABILITY_OPTIONS = [
  { id: "semaine", label: "En semaine" },
  { id: "weekend", label: "Le week-end" },
  { id: "peu_importe", label: "Peu importe" },
];

// Labels for display in dossier detail
export const TRADE_LABELS: Record<string, string> = Object.fromEntries(
  TRADE_TYPES.map((t) => [t.id, `${t.icon} ${t.label}`])
);

export const PROBLEM_LABELS: Record<string, string> = Object.fromEntries(
  TRADE_TYPES.flatMap((t) => t.problems.map((p) => [p.id, p.label]))
);

export const HOUSING_LABELS: Record<string, string> = Object.fromEntries(
  HOUSING_TYPES.map((h) => [h.id, h.label])
);

export const OCCUPANT_LABELS: Record<string, string> = Object.fromEntries(
  OCCUPANT_TYPES.map((o) => [o.id, o.label])
);

export const AVAILABILITY_LABELS: Record<string, string> = Object.fromEntries(
  AVAILABILITY_OPTIONS.map((a) => [a.id, a.label])
);
