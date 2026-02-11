import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ImportDevisDialogProps {
  open: boolean;
  onClose: () => void;
  dossierId: string;
  clientEmail?: string | null;
}

export function ImportDevisDialog({ open, onClose, dossierId, clientEmail }: ImportDevisDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [quoteNumber, setQuoteNumber] = useState("");
  const [totalHt, setTotalHt] = useState("");
  const [totalTtc, setTotalTtc] = useState("");
  const [totalTva, setTotalTva] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setFile(null);
    setQuoteNumber("");
    setTotalHt("");
    setTotalTtc("");
    setTotalTva("");
    setIssueDate(new Date().toISOString().split("T")[0]);
  };

  const handleSubmit = async () => {
    if (!file || !user) return;
    if (file.type !== "application/pdf") {
      toast({ title: "Format invalide", description: "Seuls les PDF sont acceptés.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Generate quote number if not provided
      let finalNumber = quoteNumber.trim();
      if (!finalNumber) {
        const { data: numData, error: numError } = await supabase.rpc("generate_quote_number", {
          p_user_id: user.id,
        });
        if (numError) throw numError;
        finalNumber = numData as string;
      }

      // Upload PDF
      const filePath = `${dossierId}/devis_${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("dossier-medias")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("dossier-medias").getPublicUrl(filePath);

      // Create quote record as "envoye" (imported = already sent)
      const { error: insertError } = await supabase
        .from("quotes")
        .insert({
          dossier_id: dossierId,
          user_id: user.id,
          quote_number: finalNumber,
          is_imported: true,
          pdf_url: urlData.publicUrl,
          status: "envoye" as const,
          sent_at: new Date().toISOString(),
          total_ht: totalHt ? parseFloat(totalHt) : 0,
          total_tva: totalTva ? parseFloat(totalTva) : 0,
          total_ttc: totalTtc ? parseFloat(totalTtc) : 0,
        });
      if (insertError) throw insertError;

      // Update dossier status → devis_envoye
      await supabase
        .from("dossiers")
        .update({
          status: "devis_envoye",
          status_changed_at: new Date().toISOString(),
          relance_active: true,
        })
        .eq("id", dossierId);

      // Historique
      await supabase.from("historique").insert({
        dossier_id: dossierId,
        user_id: user.id,
        action: "quote_imported",
        details: `Devis ${finalNumber} importé (PDF) — ${totalTtc ? totalTtc + " € TTC" : "montant non renseigné"}`,
      });

      // Send quote notification to client
      if (clientEmail) {
        try {
          await supabase.functions.invoke("send-quote", {
            body: { dossier_id: dossierId },
          });
        } catch (e) {
          console.error("Notification error:", e);
        }
      }

      toast({ title: "Devis importé ✅", description: `N° ${finalNumber} — Statut → Devis envoyé` });
      queryClient.invalidateQueries({ queryKey: ["quotes", dossierId] });
      queryClient.invalidateQueries({ queryKey: ["dossier", dossierId] });
      queryClient.invalidateQueries({ queryKey: ["historique", dossierId] });
      queryClient.invalidateQueries({ queryKey: ["dossiers"] });
      resetForm();
      onClose();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Importer un devis (PDF)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File upload */}
          <div className="space-y-1.5">
            <Label className="text-xs">Fichier PDF *</Label>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {file ? file.name : "Choisir un fichier PDF"}
            </Button>
          </div>

          {/* Quote number (optional) */}
          <div className="space-y-1.5">
            <Label className="text-xs">Numéro de devis (facultatif)</Label>
            <Input
              placeholder="Ex: DEV-2026-001"
              value={quoteNumber}
              onChange={(e) => setQuoteNumber(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Montant HT</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={totalHt}
                onChange={(e) => setTotalHt(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">TVA</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={totalTva}
                onChange={(e) => setTotalTva(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Montant TTC</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={totalTtc}
                onChange={(e) => setTotalTtc(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Issue date */}
          <div className="space-y-1.5">
            <Label className="text-xs">Date d'émission</Label>
            <Input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <Button
            className="w-full gap-2"
            onClick={handleSubmit}
            disabled={!file || loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importer et envoyer au client
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
