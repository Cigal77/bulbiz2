import { useState, useEffect } from "react";
import { Star, Clock, Flame, BookOpen, History, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from "@/components/ui/popover";
import { useMaterialSuggestions, type MaterialSuggestion } from "@/hooks/useMaterialSuggestions";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (label: string) => void;
  onPick: (s: MaterialSuggestion) => void;
  onCreateNew?: (label: string) => void;
  placeholder?: string;
  className?: string;
}

const SOURCE_META: Record<MaterialSuggestion["source"], { icon: typeof Star; label: string; color: string }> = {
  favorite: { icon: Star, label: "Favoris", color: "text-amber-500" },
  frequent: { icon: Flame, label: "Souvent utilisé", color: "text-orange-500" },
  recent: { icon: Clock, label: "Mon matériel", color: "text-blue-500" },
  history: { icon: History, label: "Déjà saisi", color: "text-purple-500" },
  bulbiz: { icon: BookOpen, label: "Base Bulbiz BTP", color: "text-emerald-500" },
};

export function MaterialAutocomplete({ value, onChange, onPick, onCreateNew, placeholder, className }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);

  useEffect(() => setQuery(value), [value]);

  const { data: suggestions = [] } = useMaterialSuggestions(query);

  // Group by source
  const grouped: Record<MaterialSuggestion["source"], MaterialSuggestion[]> = {
    favorite: [],
    frequent: [],
    recent: [],
    history: [],
    bulbiz: [],
  };
  suggestions.forEach((s) => grouped[s.source].push(s));

  const showDropdown = open && query.trim().length >= 2;

  return (
    <Popover open={showDropdown} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <PopoverTrigger asChild>
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onChange(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder={placeholder ?? "Désignation"}
            className={cn("font-medium", className)}
          />
        </PopoverTrigger>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="p-0 w-[min(420px,calc(100vw-2rem))] max-h-[60vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {suggestions.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground text-center">
            Aucune correspondance trouvée
            {onCreateNew && (
              <button
                type="button"
                className="block w-full mt-2 text-primary hover:underline"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onCreateNew(query);
                  setOpen(false);
                }}
              >
                <Plus className="h-3 w-3 inline mr-1" />
                Créer "{query}" dans le catalogue
              </button>
            )}
          </div>
        ) : (
          <div className="py-1">
            {(Object.keys(grouped) as MaterialSuggestion["source"][]).map((src) => {
              const items = grouped[src];
              if (!items.length) return null;
              const meta = SOURCE_META[src];
              const Icon = meta.icon;
              return (
                <div key={src}>
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                    <Icon className={cn("h-3 w-3", meta.color)} /> {meta.label}
                  </div>
                  {items.map((s, i) => (
                    <button
                      key={`${s.id ?? "h"}-${i}`}
                      type="button"
                      className="w-full text-left px-2 py-1.5 hover:bg-accent text-sm flex items-center gap-2 group"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onPick(s);
                        setOpen(false);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{s.label}</div>
                        {s.category_path && (
                          <div className="text-[10px] text-muted-foreground truncate">{s.category_path}</div>
                        )}
                      </div>
                      <div className="text-xs text-right shrink-0">
                        <div className="font-semibold">{s.unit_price.toFixed(2)} €</div>
                        <div className="text-[10px] text-muted-foreground">/ {s.unit} · {s.vat_rate}%</div>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
            {onCreateNew && (
              <button
                type="button"
                className="w-full text-left px-2 py-2 hover:bg-accent text-sm border-t text-primary flex items-center gap-1"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onCreateNew(query);
                  setOpen(false);
                }}
              >
                <Plus className="h-3 w-3" /> Créer "{query}" dans le catalogue
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
