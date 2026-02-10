import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_LABELS, SOURCE_LABELS } from "@/lib/constants";
import type { Dossier } from "@/hooks/useDossier";
import type { Database } from "@/integrations/supabase/types";
import { useDossierActions } from "@/hooks/useDossierActions";
import { useToast } from "@/hooks/use-toast";
import {
  Phone, MessageSquarePlus, FileText, Bell, BellOff, ArrowRightLeft, Calendar, RefreshCw, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

type DossierStatus = Database["public"]["Enums"]["dossier_status"];

const ALL_STATUSES: DossierStatus[] = [
  "nouveau", "a_qualifier", "devis_a_faire", "devis_envoye", "clos_signe", "clos_perdu",
];

interface DossierActionsProps {
  dossier: Dossier;
}

export function DossierActions({ dossier }: DossierActionsProps) {
  const { changeStatus, addNote, toggleRelance, sendRelance } = useDossierActions(dossier.id);
  const { toast } = useToast();
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");

  const handleStatusChange = (status: string) => {
    changeStatus.mutate(status as DossierStatus, {
      onSuccess: () => toast({ title: "Statut mis à jour" }),
      onError: (e) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
    });
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNote.mutate(noteText.trim(), {
      onSuccess: () => {
        toast({ title: "Note ajoutée" });
        setNoteText("");
        setNoteOpen(false);
      },
    });
  };

  const handleToggleRelance = () => {
    toggleRelance.mutate(!dossier.relance_active, {
      onSuccess: () =>
        toast({ title: dossier.relance_active ? "Relances désactivées" : "Relances activées" }),
    });
  };

  const handleSendRelance = () => {
    const type = dossier.status === "devis_envoye" ? "devis_non_signe" as const : "info_manquante" as const;
    sendRelance.mutate(type, {
      onSuccess: () => toast({ title: "Relance envoyée !" }),
      onError: (e) => toast({ title: "Erreur d'envoi", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-4">
      {/* Status + meta */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Statut & actions</h3>

        <Select value={dossier.status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            Créé le {format(new Date(dossier.created_at), "d MMMM yyyy", { locale: fr })}
          </div>
          <div>Source : {SOURCE_LABELS[dossier.source]}</div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Actions rapides</h3>

        <Button variant="outline" className="w-full justify-start gap-2" disabled={!dossier.client_phone} asChild={!!dossier.client_phone}>
          {dossier.client_phone ? (
            <a href={`tel:${dossier.client_phone}`}>
              <Phone className="h-4 w-4 text-primary" />
              Appeler le client
            </a>
          ) : (
            <span>
              <Phone className="h-4 w-4 text-muted-foreground" />
              Téléphone non renseigné
            </span>
          )}
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => setNoteOpen(!noteOpen)}
        >
          <MessageSquarePlus className="h-4 w-4 text-primary" />
          Ajouter une note
        </Button>

        {noteOpen && (
          <div className="space-y-2 pt-1">
            <Textarea
              placeholder="Écrire une note…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddNote} disabled={addNote.isPending || !noteText.trim()}>
                Enregistrer
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setNoteOpen(false); setNoteText(""); }}>
                Annuler
              </Button>
            </div>
          </div>
        )}


        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={handleSendRelance}
          disabled={sendRelance.isPending || !dossier.client_email}
        >
          {sendRelance.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 text-primary" />
          )}
          Relancer maintenant
        </Button>

        <Button variant="outline" className="w-full justify-start gap-2" disabled>
          <FileText className="h-4 w-4 text-primary" />
          Créer devis
        </Button>

        <Button
          variant="outline"
          className={cn("w-full justify-start gap-2", !dossier.relance_active && "text-muted-foreground")}
          onClick={handleToggleRelance}
        >
          {dossier.relance_active ? (
            <BellOff className="h-4 w-4 text-destructive" />
          ) : (
            <Bell className="h-4 w-4 text-primary" />
          )}
          {dossier.relance_active ? "Stop relances" : "Activer relances"}
        </Button>
      </div>
    </div>
  );
}
