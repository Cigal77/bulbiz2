import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Plus, Wrench, Truck, FileText } from "lucide-react";
import type { QuoteItem } from "@/lib/quote-types";
import { createEmptyItem, QUOTE_TEMPLATES } from "@/lib/quote-types";
import { QuoteItemRow } from "./QuoteItemRow";

interface StepItemsProps {
  items: QuoteItem[];
  setItems: React.Dispatch<React.SetStateAction<QuoteItem[]>>;
}

export function StepItems({ items, setItems }: StepItemsProps) {
  const addItem = (type: QuoteItem["type"] = "standard") => {
    setItems((prev) => [...prev, createEmptyItem(type)]);
  };

  const applyTemplate = (key: string) => {
    const tpl = QUOTE_TEMPLATES[key];
    if (!tpl) return;
    const newItems = tpl.items.map((i) => ({ ...i, id: crypto.randomUUID() }));
    setItems((prev) => [...prev, ...newItems]);
  };

  const handleChange = (id: string, field: keyof QuoteItem, value: unknown) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const handleDuplicate = (id: string) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx < 0) return prev;
      const copy = { ...prev[idx], id: crypto.randomUUID() };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">Aucune ligne</p>
          <p className="text-xs mt-1">Ajoutez des lignes ou utilisez un modèle.</p>
        </div>
      )}

      {items.map((item, index) => (
        <QuoteItemRow
          key={item.id}
          item={item}
          index={index}
          onChange={handleChange}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
        />
      ))}

      {/* Add buttons */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => addItem("standard")}>
          <Plus className="h-3.5 w-3.5" />
          Ajouter une ligne
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => addItem("main_oeuvre")}>
          <Wrench className="h-3.5 w-3.5" />
          Main d'œuvre
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => addItem("deplacement")}>
          <Truck className="h-3.5 w-3.5" />
          Déplacement
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Modèles
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel className="text-xs">Appliquer un modèle</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {Object.entries(QUOTE_TEMPLATES).map(([key, tpl]) => (
              <DropdownMenuItem key={key} onClick={() => applyTemplate(key)}>
                {tpl.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
