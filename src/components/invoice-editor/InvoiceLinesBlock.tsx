import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { EditableLineCard, type EditableLine, type LineType } from "@/components/documents/EditableLineCard";
import type { InvoiceLine } from "@/hooks/useInvoices";

interface InvoiceLinesBlockProps {
  lines: InvoiceLine[];
  onChange: (lines: InvoiceLine[]) => void;
  disabled?: boolean;
}

export function InvoiceLinesBlock({ lines, onChange, disabled }: InvoiceLinesBlockProps) {
  const addLine = () => {
    onChange([
      ...lines,
      {
        id: crypto.randomUUID(),
        invoice_id: "",
        label: "",
        description: null,
        qty: 1,
        unit: "u",
        unit_price: 0,
        tva_rate: 10,
        discount: 0,
        sort_order: lines.length,
      },
    ]);
  };

  const updateLine = (idx: number, patch: Partial<InvoiceLine>) => {
    onChange(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };
  const duplicateLine = (idx: number) => {
    const copy = { ...lines[idx], id: crypto.randomUUID() };
    const next = [...lines];
    next.splice(idx + 1, 0, copy);
    onChange(next);
  };
  const removeLine = (idx: number) => onChange(lines.filter((_, i) => i !== idx));
  const moveLine = (idx: number, dir: -1 | 1) => {
    const next = [...lines];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <section className="rounded-xl border bg-card overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
        <h2 className="text-sm font-semibold text-foreground flex-1">
          Lignes <span className="text-muted-foreground font-normal">({lines.length})</span>
        </h2>
        {!disabled && (
          <Button variant="outline" size="sm" onClick={addLine} className="gap-1 h-7 text-xs">
            <Plus className="h-3 w-3" /> Ligne
          </Button>
        )}
      </header>
      <div className="p-3 space-y-2">
        {lines.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Aucune ligne — cliquez sur « + Ligne » ou utilisez l'assistant IA →
          </p>
        ) : (
          lines.map((line, idx) => {
            const ln: EditableLine = {
              id: line.id,
              label: line.label,
              description: line.description,
              qty: line.qty,
              unit: line.unit,
              unit_price: line.unit_price,
              vat_rate: line.tva_rate,
              discount: line.discount ?? 0,
              type: "standard",
            };
            const total = line.qty * line.unit_price * (1 - (line.discount || 0) / 100);
            return (
              <EditableLineCard
                key={line.id}
                line={ln}
                index={idx}
                total={total}
                disabled={disabled}
                showType={false}
                onChange={(patch) => {
                  const mapped: Partial<InvoiceLine> = {};
                  if (patch.label !== undefined) mapped.label = patch.label;
                  if (patch.description !== undefined) mapped.description = patch.description ?? null;
                  if (patch.qty !== undefined) mapped.qty = patch.qty;
                  if (patch.unit !== undefined) mapped.unit = patch.unit;
                  if (patch.unit_price !== undefined) mapped.unit_price = patch.unit_price;
                  if (patch.vat_rate !== undefined) mapped.tva_rate = patch.vat_rate;
                  if (patch.discount !== undefined) mapped.discount = patch.discount;
                  updateLine(idx, mapped);
                }}
                onDuplicate={() => duplicateLine(idx)}
                onDelete={() => removeLine(idx)}
                onMoveUp={idx > 0 ? () => moveLine(idx, -1) : undefined}
                onMoveDown={idx < lines.length - 1 ? () => moveLine(idx, 1) : undefined}
              />
            );
          })
        )}
      </div>
    </section>
  );
}
