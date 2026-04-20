import type { QuoteItem, QuoteItemType } from "./quote-types";

export type AiLineSource = "catalog" | "ai_fallback";

export interface AiQuoteLine {
  ref: string; // unique id within the draft
  label: string;
  description: string;
  qty: number;
  unit: string;
  unit_price: number;
  vat_rate: number;
  type: QuoteItemType;
  source: AiLineSource;
  catalog_item_id?: string | null;
  rationale?: string | null;
}

export interface AiQuoteVariant {
  label: string;
  description?: string;
  lines: AiQuoteLine[];
}

export interface AiQuoteDraft {
  log_id: string;
  title: string;
  summary: string;
  confidence: number; // 0..1
  lines: AiQuoteLine[];
  assumptions: string[];
  missing_questions: string[];
  variants: AiQuoteVariant[];
  catalog_match_count: number;
  ai_fallback_count: number;
}

export function aiLineToQuoteItem(line: AiQuoteLine): Omit<QuoteItem, "id"> {
  return {
    label: line.label,
    description: line.description ?? "",
    qty: line.qty,
    unit: line.unit,
    unit_price: line.unit_price,
    vat_rate: line.vat_rate,
    discount: 0,
    type: line.type,
  };
}
