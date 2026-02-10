import type { Dossier } from "@/hooks/useDossier";
import { generateStructuredSummary } from "@/lib/summary";
import { Sparkles } from "lucide-react";

interface SummaryBlockProps {
  dossier: Dossier;
}

export function SummaryBlock({ dossier }: SummaryBlockProps) {
  const { headline, bullets } = generateStructuredSummary(dossier);

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5" />
        Résumé
      </h3>
      <p className="text-sm font-semibold text-foreground">{headline}</p>
      <ul className="space-y-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}
