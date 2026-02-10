import type { QuoteItem } from "@/lib/quote-types";
import { calcTotals } from "@/lib/quote-types";

interface QuoteTotalsFooterProps {
  items: QuoteItem[];
}

export function QuoteTotalsFooter({ items }: QuoteTotalsFooterProps) {
  const { total_ht, total_tva, total_ttc } = calcTotals(items);

  return (
    <div className="rounded-xl border bg-card p-4 mt-3">
      <div className="flex flex-col items-end gap-1.5 text-sm">
        <div className="flex items-center gap-6">
          <span className="text-muted-foreground text-xs">Total HT</span>
          <span className="font-medium w-24 text-right">{total_ht.toFixed(2)} €</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-muted-foreground text-xs">TVA</span>
          <span className="font-medium w-24 text-right">{total_tva.toFixed(2)} €</span>
        </div>
        <div className="flex items-center gap-6 pt-2 mt-1 border-t">
          <span className="font-bold text-base">Total TTC</span>
          <span className="font-bold text-lg text-primary w-24 text-right">{total_ttc.toFixed(2)} €</span>
        </div>
      </div>
    </div>
  );
}
