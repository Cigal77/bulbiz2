import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import type { Dossier } from "@/hooks/useDossier";
import { useDossierActions } from "@/hooks/useDossierActions";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { useToast } from "@/hooks/use-toast";
import {
  Phone, MessageSquarePlus, FileText, Bell, BellOff, Calendar, RefreshCw, Loader2,
  Mic, Camera, Map, Receipt,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { VoiceRecorderDialog } from "./VoiceRecorderDialog";
import { MediaUploadDialog } from "./MediaUploadDialog";
import { ImportDevisDialog } from "./ImportDevisDialog";
import { ImportFactureDialog } from "./ImportFactureDialog";

interface DossierActionsProps {
  dossier: Dossier;
}

export function DossierActions({ dossier }: DossierActionsProps) {
  const { addNote, toggleRelance, sendRelance } = useDossierActions(dossier.id);
  const { uploadFiles } = useMediaUpload(dossier.id);
  const { toast } = useToast();
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [importDevisOpen, setImportDevisOpen] = useState(false);
  const [importFactureOpen, setImportFactureOpen] = useState(false);

  const status = dossier.status;

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
    const type = status === "devis_envoye" ? "devis_non_signe" as const : "info_manquante" as const;
    sendRelance.mutate(type, {
      onSuccess: () => toast({ title: "Relance envoyée !" }),
      onError: (e) => toast({ title: "Erreur d'envoi", description: e.message, variant: "destructive" }),
    });
  };

  const handleVoiceSave = async (blob: Blob, duration: number) => {
    await uploadFiles.mutateAsync({ files: [blob], category: "audio", duration });
    toast({ title: "Note vocale enregistrée" });
  };

  const handlePhotoUpload = async (files: File[]) => {
    for (const f of files) {
      const cat = f.type.startsWith("video/") ? "video" as const : "image" as const;
      await uploadFiles.mutateAsync({ files: [f], category: cat });
    }
    toast({ title: `${files.length} fichier(s) ajouté(s)` });
  };

  const handlePlanUpload = async (files: File[]) => {
    await uploadFiles.mutateAsync({ files, category: "plan" });
    toast({ title: "Plan ajouté" });
  };

  // Status-aware visibility for contextual actions
  const showRelancerNow = ["devis_envoye", "en_attente_rdv", "invoice_pending"].includes(status);
  const showToggleRelance = ["devis_envoye", "en_attente_rdv", "invoice_pending"].includes(status);

  return (
    <div className="space-y-4">
      {/* Status + meta */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Infos dossier</h3>

        <div className="flex items-center gap-2">
          <Badge className={cn("text-xs", STATUS_COLORS[status])}>
            {STATUS_LABELS[status]}
          </Badge>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            Créé le {format(new Date(dossier.created_at), "d MMMM yyyy", { locale: fr })}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Actions rapides</h3>

        {/* 1. Phone */}
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

        {/* 2. Note text */}
        <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setNoteOpen(!noteOpen)}>
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

        {/* 3. Voice note */}
        <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setVoiceOpen(true)}>
          <Mic className="h-4 w-4 text-primary" />
          Ajouter note vocale
        </Button>

        {/* 4. Photo / Video */}
        <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setPhotoOpen(true)}>
          <Camera className="h-4 w-4 text-primary" />
          Ajouter photo / vidéo
        </Button>

        {/* 5. Plan */}
        <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setPlanOpen(true)}>
          <Map className="h-4 w-4 text-primary" />
          Ajouter plan
        </Button>

        {/* 6. Relancer maintenant (contextual) */}
        {showRelancerNow && (
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
        )}

        {/* 7. Importer devis (always available) */}
        <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setImportDevisOpen(true)}>
          <FileText className="h-4 w-4 text-primary" />
          Importer devis (PDF)
        </Button>

        {/* 8. Importer facture (always available) */}
        <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setImportFactureOpen(true)}>
          <Receipt className="h-4 w-4 text-primary" />
          Importer facture (PDF)
        </Button>

        {/* 9. Toggle relances (contextual) */}
        {showToggleRelance && (
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
        )}
      </div>

      {/* Dialogs */}
      <VoiceRecorderDialog open={voiceOpen} onClose={() => setVoiceOpen(false)} onSave={handleVoiceSave} />
      <MediaUploadDialog open={photoOpen} onClose={() => setPhotoOpen(false)} onUpload={handlePhotoUpload} mode="photo_video" />
      <MediaUploadDialog open={planOpen} onClose={() => setPlanOpen(false)} onUpload={handlePlanUpload} mode="plan" />
      <ImportDevisDialog open={importDevisOpen} onClose={() => setImportDevisOpen(false)} dossierId={dossier.id} clientEmail={dossier.client_email} />
      <ImportFactureDialog open={importFactureOpen} onClose={() => setImportFactureOpen(false)} dossierId={dossier.id} clientEmail={dossier.client_email} />
    </div>
  );
}
