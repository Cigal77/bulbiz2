import type { QuoteItem } from "@/lib/quote-types";
import { calcTotals } from "@/lib/quote-types";

interface QuoteTotalsFooterProps {
  items: QuoteItem[];
}

export function QuoteTotalsFooter({ items }: QuoteTotalsFooterProps) {
  const { total_ht, total_tva, total_ttc } = calcTotals(items);

  return (
    <div className="sticky bottom-0 z-10 border-t bg-card/95 backdrop-blur px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-end gap-6 text-sm">
        <div className="text-muted-foreground">
          Total HT : <span className="font-medium text-foreground">{total_ht.toFixed(2)} €</span>
        </div>
        <div className="text-muted-foreground">
          TVA : <span className="font-medium text-foreground">{total_tva.toFixed(2)} €</span>
        </div>
        <div className="text-base font-bold text-foreground">
          TTC : {total_ttc.toFixed(2)} €
        </div>
      </div>
    </div>
  );
}
