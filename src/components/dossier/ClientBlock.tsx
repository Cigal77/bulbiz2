import type { Dossier } from "@/hooks/useDossier";
import { Phone, Mail, User } from "lucide-react";

interface ClientBlockProps {
  dossier: Dossier;
}

export function ClientBlock({ dossier }: ClientBlockProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</h3>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-foreground">
            {dossier.client_first_name || dossier.client_last_name
              ? `${dossier.client_first_name ?? ""} ${dossier.client_last_name ?? ""}`.trim()
              : <span className="text-muted-foreground italic">Non renseigné</span>}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {dossier.client_phone ? (
          <a href={`tel:${dossier.client_phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline font-medium">
            <Phone className="h-4 w-4" />
            {dossier.client_phone}
          </a>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground italic">
            <Phone className="h-4 w-4" />
            Téléphone non renseigné
          </p>
        )}
        {dossier.client_email && (
          <a
            href={`mailto:${dossier.client_email}`}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Mail className="h-4 w-4" />
            {dossier.client_email}
          </a>
        )}
      </div>
    </div>
  );
}
