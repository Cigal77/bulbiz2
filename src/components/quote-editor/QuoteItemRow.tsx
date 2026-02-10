import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Copy, GripVertical, Trash2 } from "lucide-react";
import type { QuoteItem } from "@/lib/quote-types";
import { calcLineTotal, UNIT_OPTIONS } from "@/lib/quote-types";
import { cn } from "@/lib/utils";

interface QuoteItemRowProps {
  item: QuoteItem;
  index: number;
  onChange: (id: string, field: keyof QuoteItem, value: unknown) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  dragHandleProps?: Record<string, unknown>;
}

export function QuoteItemRow({ item, index, onChange, onDuplicate, onDelete, dragHandleProps }: QuoteItemRowProps) {
  const lineTotal = calcLineTotal(item);
  const typeColors: Record<QuoteItem["type"], string> = {
    standard: "",
    main_oeuvre: "border-l-4 border-l-primary/40",
    deplacement: "border-l-4 border-l-warning/40",
  };

  return (
    <div className={cn("rounded-lg border bg-card p-3 space-y-3", typeColors[item.type])}>
      {/* Header row */}
      <div className="flex items-center gap-2">
        <div {...dragHandleProps} className="cursor-grab text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
        <span className="text-xs font-medium text-muted-foreground w-6">{index + 1}</span>
        <Input
          value={item.label}
          onChange={(e) => onChange(item.id, "label", e.target.value)}
          placeholder="Désignation"
          className="flex-1 font-medium"
        />
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDuplicate(item.id)}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(item.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Description (optional) */}
      <Input
        value={item.description}
        onChange={(e) => onChange(item.id, "description", e.target.value)}
        placeholder="Description (optionnel)"
        className="text-sm text-muted-foreground"
      />

      {/* Numbers row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Qté</label>
          <Input
            type="number"
            min={0}
            step="0.5"
            value={item.qty}
            onChange={(e) => onChange(item.id, "qty", parseFloat(e.target.value) || 0)}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Unité</label>
          <Select value={item.unit} onValueChange={(v) => onChange(item.id, "unit", v)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_OPTIONS.map((u) => (
                <SelectItem key={u} value={u} className="text-sm">{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">PU HT (€)</label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={item.unit_price}
            onChange={(e) => onChange(item.id, "unit_price", parseFloat(e.target.value) || 0)}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">TVA %</label>
          <Select value={String(item.vat_rate)} onValueChange={(v) => onChange(item.id, "vat_rate", parseFloat(v))}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 5.5, 10, 20].map((r) => (
                <SelectItem key={r} value={String(r)} className="text-sm">{r}%</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 text-right">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Total HT</label>
          <div className="h-9 flex items-center justify-end text-sm font-semibold">
            {lineTotal.toFixed(2)} €
          </div>
        </div>
      </div>
    </div>
  );
}
