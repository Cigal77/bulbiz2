import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useInvoices, useInvoiceActions } from "@/hooks/useInvoices";
import { useQuotes } from "@/hooks/useQuotes";
import type { Dossier } from "@/hooks/useDossier";
import type { AppointmentStatus } from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Calendar, Send, CheckCircle2, FileText, Receipt, Loader2, ArrowRight, Sparkles, CreditCard,
} from "lucide-react";

interface NextStepBannerProps {
  dossier: Dossier;
  onScrollToAppointment?: () => void;
}

export function NextStepBanner({ dossier, onScrollToAppointment }: NextStepBannerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const appointmentStatus = ((dossier as any).appointment_status || "none") as AppointmentStatus;
  const { data: invoices = [] } = useInvoices(dossier.id);
  const { data: quotes = [] } = useQuotes(dossier.id);
  const { generateFromQuote } = useInvoiceActions(dossier.id);

  const [showManualRdv, setShowManualRdv] = useState(false);
  const [manualDate, setManualDate] = useState("");
  const [manualStart, setManualStart] = useState("09:00");
  const [manualEnd, setManualEnd] = useState("11:00");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["dossier", dossier.id] });
    queryClient.invalidateQueries({ queryKey: ["historique", dossier.id] });
    queryClient.invalidateQueries({ queryKey: ["dossiers"] });
  };

  // Manual RDV mutation
  const setManualRdv = useMutation({
    mutationFn: async () => {
      if (!manualDate) throw new Error("Choisissez une date");
      const { error } = await supabase
        .from("dossiers")
        .update({
          status: "rdv_pris",
          status_changed_at: new Date().toISOString(),
          appointment_status: "rdv_confirmed",
          appointment_date: manualDate,
          appointment_time_start: manualStart,
          appointment_time_end: manualEnd,
          appointment_source: "manual",
          appointment_confirmed_at: new Date().toISOString(),
        } as any)
        .eq("id", dossier.id);
      if (error) throw error;

      const dateStr = format(new Date(manualDate), "EEEE d MMMM yyyy", { locale: fr });
      await supabase.from("historique").insert({
        dossier_id: dossier.id,
        user_id: user?.id ?? null,
        action: "rdv_confirmed",
        details: `Rendez-vous fixé manuellement : ${dateStr} ${manualStart}–${manualEnd}`,
      });

      // Send notification
      try {
        await supabase.functions.invoke("send-appointment-notification", {
          body: {
            event_type: "APPOINTMENT_CONFIRMED",
            dossier_id: dossier.id,
            payload: {
              appointment_date: dateStr,
              appointment_time: `${manualStart}–${manualEnd}`,
            },
          },
        });
      } catch (e) {
        console.error("Notification error:", e);
      }
    },
    onSuccess: () => {
      toast({ title: "Rendez-vous confirmé ✅" });
      setShowManualRdv(false);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // Mark done mutation
  const markDone = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("dossiers")
        .update({
          status: "rdv_termine",
          status_changed_at: new Date().toISOString(),
          appointment_status: "done",
        } as any)
        .eq("id", dossier.id);
      if (error) throw error;
      await supabase.from("historique").insert({
        dossier_id: dossier.id,
        user_id: user?.id ?? null,
        action: "intervention_done",
        details: "Intervention marquée comme réalisée",
      });
    },
    onSuccess: () => {
      toast({ title: "Intervention réalisée ✅" });
      invalidate();
    },
  });

  // Mark paid mutation
  const markPaid = useMutation({
    mutationFn: async () => {
      if (invoices.length === 0) throw new Error("Aucune facture");
      const inv = invoices[0];
      const { error: invErr } = await supabase
        .from("invoices")
        .update({ status: "paid", paid_at: new Date().toISOString() } as any)
        .eq("id", inv.id);
      if (invErr) throw invErr;

      const { error } = await supabase
        .from("dossiers")
        .update({ status: "invoice_paid", status_changed_at: new Date().toISOString() })
        .eq("id", dossier.id);
      if (error) throw error;

      await supabase.from("historique").insert({
        dossier_id: dossier.id,
        user_id: user?.id ?? null,
        action: "invoice_paid",
        details: `Facture ${inv.invoice_number} marquée comme payée`,
      });
    },
    onSuccess: () => {
      toast({ title: "Facture marquée payée ✅" });
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["invoices", dossier.id] });
    },
  });

  const handleGenerate = () => {
    generateFromQuote.mutate(undefined, {
      onSuccess: (invoice: any) => {
        toast({ title: "Facture générée ✅", description: `N° ${invoice.invoice_number}` });
        navigate(`/dossier/${dossier.id}/facture/${invoice.id}`);
      },
      onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
    });
  };

  // Determine next step
  const getNextStep = (): {
    message: string;
    primaryLabel: string;
    primaryIcon: React.ReactNode;
    primaryAction: () => void;
    secondaryLabel?: string;
    secondaryAction?: () => void;
    isPending?: boolean;
    done?: boolean;
    badge?: string;
  } | null => {
    const status = dossier.status;

    if (status === "nouveau" || status === "a_qualifier" || status === "devis_a_faire") {
      return {
        message: "Prochaine étape : Importer ou créer un devis",
        primaryLabel: "Importer devis (PDF)",
        primaryIcon: <FileText className="h-4 w-4" />,
        primaryAction: () => {
          // Trigger import dialog via DOM event (handled in DossierDetail)
          window.dispatchEvent(new CustomEvent("open-import-devis"));
        },
        secondaryLabel: "Créer un devis",
        secondaryAction: () => navigate(`/dossier/${dossier.id}/devis`),
      };
    }

    if (status === "devis_envoye") {
      return {
        message: "En attente de la signature du client",
        primaryLabel: "Renvoyer le devis",
        primaryIcon: <Send className="h-4 w-4" />,
        primaryAction: () => {
          if (quotes.length > 0 && quotes[0].status === "envoye") {
            supabase.functions.invoke("send-quote", { body: { quote_id: quotes[0].id } })
              .then(() => toast({ title: "Devis renvoyé !" }))
              .catch((e) => toast({ title: "Erreur", description: e.message, variant: "destructive" }));
          }
        },
      };
    }

    if (status === "devis_signe" || (status === "en_attente_rdv")) {
      return {
        message: "Prochaine étape : Fixer un rendez-vous",
        primaryLabel: "Proposer des créneaux",
        primaryIcon: <Calendar className="h-4 w-4" />,
        primaryAction: () => onScrollToAppointment?.(),
        secondaryLabel: "Fixer le RDV manuellement",
        secondaryAction: () => setShowManualRdv(true),
      };
    }

    if (status === "rdv_pris") {
      const appointmentDate = (dossier as any).appointment_date;
      const timeStart = (dossier as any).appointment_time_start;
      const timeEnd = (dossier as any).appointment_time_end;
      const dateInfo = appointmentDate
        ? format(new Date(appointmentDate), "EEEE d MMMM", { locale: fr })
        : "";
      const timeInfo = timeStart && timeEnd ? ` de ${timeStart.slice(0, 5)} à ${timeEnd.slice(0, 5)}` : "";

      return {
        message: `Intervention prévue ${dateInfo}${timeInfo}`,
        primaryLabel: "Marquer intervention terminée",
        primaryIcon: <CheckCircle2 className="h-4 w-4" />,
        primaryAction: () => markDone.mutate(),
        isPending: markDone.isPending,
      };
    }

    if (status === "rdv_termine") {
      return {
        message: "Prochaine étape : Importer ou générer la facture",
        primaryLabel: "Importer facture (PDF)",
        primaryIcon: <Receipt className="h-4 w-4" />,
        primaryAction: () => {
          window.dispatchEvent(new CustomEvent("open-import-facture"));
        },
        secondaryLabel: "Générer la facture",
        secondaryAction: handleGenerate,
      };
    }

    if (status === "invoice_pending") {
      const inv = invoices[0];
      return {
        message: inv ? `Facture ${inv.invoice_number} en attente de paiement` : "Facture en attente de paiement",
        primaryLabel: "Marquer payée",
        primaryIcon: <CreditCard className="h-4 w-4" />,
        primaryAction: () => markPaid.mutate(),
        isPending: markPaid.isPending,
        secondaryLabel: inv ? "Voir la facture" : undefined,
        secondaryAction: inv ? () => navigate(`/dossier/${dossier.id}/facture/${inv.id}`) : undefined,
      };
    }

    if (status === "invoice_paid") {
      return {
        message: "Dossier terminé avec succès !",
        primaryLabel: "",
        primaryIcon: null,
        primaryAction: () => {},
        done: true,
        badge: "✅ Terminé",
      };
    }

    if (status === "clos_perdu") {
      return {
        message: "Ce dossier est classé comme perdu",
        primaryLabel: "",
        primaryIcon: null,
        primaryAction: () => {},
        done: true,
        badge: "Clos",
      };
    }

    return null;
  };

  const step = getNextStep();
  if (!step) return null;

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
      {/* Next step message */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <p className="text-sm font-medium text-foreground">{step.message}</p>
      </div>

      {/* Done state */}
      {step.done && step.badge && (
        <Badge className="bg-success/15 text-success text-sm px-3 py-1">{step.badge}</Badge>
      )}

      {/* Primary action button */}
      {!step.done && step.primaryLabel && (
        <div className="flex flex-wrap gap-2">
          <Button
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md"
            onClick={step.primaryAction}
            disabled={step.isPending}
          >
            {step.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : step.primaryIcon}
            {step.primaryLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>

          {step.secondaryLabel && step.secondaryAction && (
            <Button variant="outline" className="gap-2" onClick={step.secondaryAction}>
              {step.secondaryLabel}
            </Button>
          )}
        </div>
      )}

      {/* Manual RDV inline form */}
      {showManualRdv && (
        <div className="border border-border rounded-lg p-3 space-y-3 bg-background">
          <p className="text-xs font-medium text-foreground">Fixer un rendez-vous</p>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-[10px]">Date</Label>
              <Input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="w-20 space-y-1">
              <Label className="text-[10px]">Début</Label>
              <Input
                type="time"
                value={manualStart}
                onChange={(e) => setManualStart(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="w-20 space-y-1">
              <Label className="text-[10px]">Fin</Label>
              <Input
                type="time"
                value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setManualRdv.mutate()} disabled={setManualRdv.isPending}>
              {setManualRdv.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirmer le RDV"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowManualRdv(false)}>Annuler</Button>
          </div>
        </div>
      )}
    </div>
  );
}