import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ChevronRight, ChevronDown, ArrowLeft } from "lucide-react";
import { useProblemTaxonomy, useProblemManoeuvres, type TaxonomyNode, type Manoeuvre } from "@/hooks/useProblemTaxonomy";
import { RecommendationTabs } from "./RecommendationTabs";
import type { QuoteItem } from "@/lib/quote-types";

interface ProblemTreePanelProps {
  onAddItem: (item: Omit<QuoteItem, "id">) => void;
  onSetLabourContext: (tags: string[], problemLabel: string) => void;
}

export function ProblemTreePanel({ onAddItem, onSetLabourContext }: ProblemTreePanelProps) {
  const { data: taxonomy = [], isLoading } = useProblemTaxonomy();
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const { data: manoeuvres = [] } = useProblemManoeuvres(selectedProblemId);

  const categories = useMemo(() => taxonomy.filter((n) => !n.parent_id), [taxonomy]);
  const childrenOf = useMemo(() => {
    const map = new Map<string, TaxonomyNode[]>();
    taxonomy.filter((n) => n.parent_id).forEach((n) => {
      const arr = map.get(n.parent_id!) || [];
      arr.push(n);
      map.set(n.parent_id!, arr);
    });
    return map;
  }, [taxonomy]);

  const filtered = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return taxonomy.filter(
      (n) => n.parent_id && (n.label.toLowerCase().includes(q) || n.keywords.some((k) => k.toLowerCase().includes(q)))
    );
  }, [search, taxonomy]);

  const selectedProblem = taxonomy.find((n) => n.id === selectedProblemId);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectProblem = (node: TaxonomyNode) => {
    setSelectedProblemId(node.id);
    const ctx = node.default_context as Record<string, string>;
    if (ctx?.type) {
      onSetLabourContext([ctx.type], node.label);
    }
  };

  const handleAddManoeuvre = (m: Manoeuvre | { label: string; description?: string; unit: string; default_qty: number; unit_price: number; vat_rate: number; type?: string }) => {
    onAddItem({
      label: m.label,
      description: m.description || "",
      qty: Number(m.default_qty),
      unit: m.unit,
      unit_price: Number(m.unit_price),
      vat_rate: Number(m.vat_rate),
      discount: 0,
      type: (m.type === "main_oeuvre" || m.type === "deplacement" ? m.type : "standard") as QuoteItem["type"],
    });
  };

  // Detail view for selected problem
  if (selectedProblem) {
    return (
      <div className="flex flex-col h-full">
        <Button variant="ghost" size="sm" className="justify-start gap-1.5 mb-2 -ml-2" onClick={() => setSelectedProblemId(null)}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour
        </Button>
        <h3 className="text-sm font-semibold mb-3 text-foreground">{selectedProblem.label}</h3>
        <ScrollArea className="flex-1">
          {manoeuvres.length > 0 ? (
            <RecommendationTabs
              items={manoeuvres.map((m) => ({
                ...m,
                default_qty: Number(m.default_qty),
                unit_price: Number(m.unit_price),
                vat_rate: Number(m.vat_rate),
              }))}
              onAdd={handleAddManoeuvre}
            />
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              Aucun geste recommandé pour ce problème.
            </p>
          )}
        </ScrollArea>
      </div>
    );
  }

  // Tree view
  return (
    <div className="flex flex-col h-full">
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Rechercher un problème…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>
      <ScrollArea className="flex-1">
        {isLoading ? (
          <p className="text-xs text-muted-foreground text-center py-4">Chargement…</p>
        ) : filtered ? (
          <div className="space-y-0.5">
            {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Aucun résultat</p>}
            {filtered.map((node) => (
              <button
                key={node.id}
                className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted/50 text-sm"
                onClick={() => selectProblem(node)}
              >
                {node.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-0.5">
            {categories.map((cat) => {
              const children = childrenOf.get(cat.id) || [];
              const isExpanded = expandedIds.has(cat.id);
              return (
                <div key={cat.id}>
                  <button
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-muted/50 text-sm font-medium"
                    onClick={() => toggleExpand(cat.id)}
                  >
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                    {cat.label}
                  </button>
                  {isExpanded && (
                    <div className="ml-5 space-y-0.5">
                      {children.map((child) => (
                        <button
                          key={child.id}
                          className="w-full text-left px-2 py-1 rounded-md hover:bg-muted/50 text-sm text-muted-foreground hover:text-foreground"
                          onClick={() => selectProblem(child)}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
