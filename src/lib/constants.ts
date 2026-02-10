import type { Database } from "@/integrations/supabase/types";

type DossierStatus = Database["public"]["Enums"]["dossier_status"];
type DossierSource = Database["public"]["Enums"]["dossier_source"];
type ProblemCategory = Database["public"]["Enums"]["problem_category"];
type UrgencyLevel = Database["public"]["Enums"]["urgency_level"];

export const STATUS_LABELS: Record<DossierStatus, string> = {
  nouveau: "Nouveau",
  a_qualifier: "À qualifier",
  devis_a_faire: "Devis à faire",
  devis_envoye: "Devis envoyé",
  clos_signe: "Clos (signé)",
  clos_perdu: "Clos (perdu)",
};

export const STATUS_COLORS: Record<DossierStatus, string> = {
  nouveau: "bg-primary/15 text-primary",
  a_qualifier: "bg-warning/15 text-warning",
  devis_a_faire: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  devis_envoye: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  clos_signe: "bg-success/15 text-success",
  clos_perdu: "bg-muted text-muted-foreground",
};

export const SOURCE_LABELS: Record<DossierSource, string> = {
  lien_client: "Lien client",
  manuel: "Manuel",
  email: "Email",
};

export const CATEGORY_LABELS: Record<ProblemCategory, string> = {
  wc: "WC",
  fuite: "Fuite",
  chauffe_eau: "Chauffe-eau",
  evier: "Évier",
  douche: "Douche",
  autre: "Autre",
};

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  aujourdhui: "Aujourd'hui",
  "48h": "48h",
  semaine: "Semaine",
};

export const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  aujourdhui: "bg-destructive/15 text-destructive",
  "48h": "bg-warning/15 text-warning",
  semaine: "bg-muted text-muted-foreground",
};

// Urgency sort order (higher = more urgent)
export const URGENCY_ORDER: Record<UrgencyLevel, number> = {
  aujourdhui: 3,
  "48h": 2,
  semaine: 1,
};
