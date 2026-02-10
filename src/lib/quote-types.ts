export interface QuoteItem {
  id: string;
  label: string;
  description: string;
  qty: number;
  unit: string;
  unit_price: number;
  vat_rate: number;
  discount: number;
  type: "standard" | "main_oeuvre" | "deplacement";
}

export function createEmptyItem(type: QuoteItem["type"] = "standard"): QuoteItem {
  const defaults: Record<QuoteItem["type"], Partial<QuoteItem>> = {
    standard: { label: "", unit: "u", unit_price: 0, vat_rate: 10 },
    main_oeuvre: { label: "Main d'œuvre", unit: "h", unit_price: 65, vat_rate: 10 },
    deplacement: { label: "Déplacement", unit: "forfait", unit_price: 35, vat_rate: 20 },
  };
  return {
    id: crypto.randomUUID(),
    description: "",
    qty: 1,
    discount: 0,
    vat_rate: 10,
    unit_price: 0,
    label: "",
    unit: "u",
    type,
    ...defaults[type],
  };
}

export function calcLineTotal(item: QuoteItem): number {
  const base = item.qty * item.unit_price;
  return base - (base * item.discount) / 100;
}

export function calcLineTva(item: QuoteItem): number {
  return (calcLineTotal(item) * item.vat_rate) / 100;
}

export function calcTotals(items: QuoteItem[]) {
  const total_ht = items.reduce((s, i) => s + calcLineTotal(i), 0);
  const total_tva = items.reduce((s, i) => s + calcLineTva(i), 0);
  return { total_ht, total_tva, total_ttc: total_ht + total_tva };
}

export const UNIT_OPTIONS = ["u", "h", "m", "m²", "m³", "kg", "L", "forfait", "lot"];

export const QUOTE_TEMPLATES: Record<string, { label: string; items: Omit<QuoteItem, "id">[] }> = {
  fuite: {
    label: "Intervention fuite",
    items: [
      { label: "Déplacement", description: "", qty: 1, unit: "forfait", unit_price: 35, vat_rate: 20, discount: 0, type: "deplacement" },
      { label: "Main d'œuvre", description: "Recherche et réparation de fuite", qty: 1, unit: "h", unit_price: 65, vat_rate: 10, discount: 0, type: "main_oeuvre" },
      { label: "Fournitures plomberie", description: "", qty: 1, unit: "lot", unit_price: 25, vat_rate: 20, discount: 0, type: "standard" },
    ],
  },
  chauffe_eau: {
    label: "Remplacement chauffe-eau",
    items: [
      { label: "Déplacement", description: "", qty: 1, unit: "forfait", unit_price: 35, vat_rate: 20, discount: 0, type: "deplacement" },
      { label: "Chauffe-eau 200L", description: "Fourniture et pose", qty: 1, unit: "u", unit_price: 650, vat_rate: 10, discount: 0, type: "standard" },
      { label: "Raccordements", description: "Plomberie et électrique", qty: 1, unit: "forfait", unit_price: 120, vat_rate: 10, discount: 0, type: "standard" },
      { label: "Main d'œuvre", description: "Dépose ancien + pose", qty: 3, unit: "h", unit_price: 65, vat_rate: 10, discount: 0, type: "main_oeuvre" },
      { label: "Enlèvement ancien chauffe-eau", description: "", qty: 1, unit: "forfait", unit_price: 50, vat_rate: 20, discount: 0, type: "standard" },
    ],
  },
  debouchage: {
    label: "Débouchage",
    items: [
      { label: "Déplacement", description: "", qty: 1, unit: "forfait", unit_price: 35, vat_rate: 20, discount: 0, type: "deplacement" },
      { label: "Débouchage canalisation", description: "Furet mécanique ou haute pression", qty: 1, unit: "forfait", unit_price: 150, vat_rate: 10, discount: 0, type: "standard" },
      { label: "Main d'œuvre", description: "", qty: 1, unit: "h", unit_price: 65, vat_rate: 10, discount: 0, type: "main_oeuvre" },
    ],
  },
};
