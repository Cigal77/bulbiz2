import { useState } from "react";
import { motion } from "framer-motion";
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
  Calendar, Send, CheckCircle2, FileText, Receipt, Loader2, ArrowRight, Sparkles, CreditCard, Link2, AlertCircle, Clock,
} from "lucide-react";
import { differenceInHours, differenceInDays } from "date-fns";

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

  // Send client link mutation
  const sendClientLink = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("send-client-link", {
        body: { dossier_id: dossier.id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Lien envoyé au client ✅" });
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // Detect missing client info
  const missingFields: string[] = [];
  if (!dossier.client_email) missingFields.push("email");
  if (!dossier.client_phone) missingFields.push("téléphone");
  if (!dossier.address && !dossier.address_line) missingFields.push("adresse");
  const hasIncompleteInfo = missingFields.length > 0;

  // Determine next step with priority logic
  // ── Smart time counter logic ──
  const getTimeCounter = (): { text: string; color: "muted" | "warning" | "destructive" } | null => {
    const now = new Date();
    const status = dossier.status;

    // Don't show for early/terminal statuses
    const noCounterStatuses = ["nouveau", "a_qualifier", "rdv_termine", "devis_a_faire", "invoice_paid", "clos_perdu", "clos_signe"];
    if (noCounterStatuses.includes(status)) return null;

    // En attente RDV → since status change
    if (status === "en_attente_rdv") {
      const ref = new Date(dossier.status_changed_at);
      return formatCounter("En attente", ref, now);
    }

    // RDV pris → countdown to appointment
    if (status === "rdv_pris") {
      const appointmentDate = (dossier as any).appointment_date;
      if (appointmentDate) {
        const rdvDate = new Date(appointmentDate);
        const hoursUntil = differenceInHours(rdvDate, now);
        const daysUntil = differenceInDays(rdvDate, now);
        if (hoursUntil < 0) return { text: `RDV passé depuis ${Math.abs(daysUntil)} jour(s)`, color: "warning" };
        if (hoursUntil < 24) return { text: `RDV dans ${Math.max(1, hoursUntil)} heure(s)`, color: "muted" };
        return { text: `RDV dans ${daysUntil} jour(s)`, color: "muted" };
      }
      return null;
    }

    // Devis envoyé → since sent_at
    if (status === "devis_envoye") {
      const sentQuote = quotes.find(q => q.sent_at);
      const ref = sentQuote?.sent_at ? new Date(sentQuote.sent_at) : new Date(dossier.status_changed_at);
      return formatCounter("Envoyé", ref, now);
    }

    // Devis signé → since status change
    if (status === "devis_signe") {
      const ref = new Date(dossier.status_changed_at);
      return formatCounter("Signé", ref, now);
    }

    // Facture en attente → since invoice creation
    if (status === "invoice_pending") {
      const inv = invoices[0];
      const ref = inv ? new Date(inv.created_at) : new Date(dossier.status_changed_at);
      const days = differenceInDays(now, ref);
      // Check payment terms for overdue
      if (inv?.payment_terms) {
        const termDays = parseInt(inv.payment_terms, 10);
        if (!isNaN(termDays)) {
          const dueDate = new Date(ref);
          dueDate.setDate(dueDate.getDate() + termDays);
          if (now > dueDate) {
            const overdueDays = differenceInDays(now, dueDate);
            return { text: `En retard de ${overdueDays} jour(s)`, color: "destructive" };
          }
        }
      }
      return formatCounter("Émise", ref, now);
    }

    return null;
  };

  const formatCounter = (prefix: string, ref: Date, now: Date): { text: string; color: "muted" | "warning" | "destructive" } => {
    const hours = differenceInHours(now, ref);
    const days = differenceInDays(now, ref);
    if (hours < 24) return { text: `${prefix} il y a ${Math.max(1, hours)} heure(s)`, color: "muted" };
    if (days <= 7) return { text: `${prefix} il y a ${days} jour(s)`, color: "muted" };
    return { text: `${prefix} il y a ${days} jour(s)`, color: "warning" };
  };

  const getNextStep = (): {
    message: string;
    hint?: string;
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

    // ──── PRIORITY 1: Incomplete client info (for early statuses) ────
    if (hasIncompleteInfo && ["nouveau", "a_qualifier"].includes(status)) {
      return {
        message: "Prochaine étape : Récupérer les informations manquantes",
        hint: `Le client n'a pas encore renseigné : ${missingFields.join(", ")}.`,
        primaryLabel: "Envoyer lien client",
        primaryIcon: <Link2 className="h-4 w-4" />,
        primaryAction: () => sendClientLink.mutate(),
        isPending: sendClientLink.isPending,
        secondaryLabel: "Fixer un rendez-vous",
        secondaryAction: () => onScrollToAppointment?.(),
      };
    }

    // ──── Early statuses with complete info → Fixer RDV ────
    if (["nouveau", "a_qualifier", "en_attente_rdv"].includes(status)) {
      return {
        message: "Prochaine étape : Fixer un rendez-vous",
        hint: "Proposez des créneaux au client ou fixez le RDV directement.",
        primaryLabel: "Proposer des créneaux",
        primaryIcon: <Calendar className="h-4 w-4" />,
        primaryAction: () => onScrollToAppointment?.(),
        secondaryLabel: "Fixer le RDV manuellement",
        secondaryAction: () => setShowManualRdv(true),
      };
    }

    // ──── RDV pris → Marquer intervention terminée ────
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
        hint: "Une fois l'intervention réalisée, marquez-la comme terminée pour passer au devis.",
        primaryLabel: "Marquer intervention terminée",
        primaryIcon: <CheckCircle2 className="h-4 w-4" />,
        primaryAction: () => markDone.mutate(),
        isPending: markDone.isPending,
      };
    }

    // ──── RDV terminé / Devis à faire → Importer devis ────
    if (status === "rdv_termine" || status === "devis_a_faire") {
      return {
        message: "Prochaine étape : Importer le devis",
        hint: "L'intervention est terminée. Envoyez le devis au client.",
        primaryLabel: "Importer devis (PDF)",
        primaryIcon: <FileText className="h-4 w-4" />,
        primaryAction: () => window.dispatchEvent(new CustomEvent("open-import-devis")),
      };
    }

    // ──── Devis envoyé → Waiting for signature ────
    if (status === "devis_envoye") {
      return {
        message: "En attente de la signature du client",
        hint: "Le devis a été envoyé. Relancez si le client tarde à répondre.",
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

    // ──── Devis signé → Facturer ────
    if (status === "devis_signe") {
      return {
        message: "Prochaine étape : Importer la facture",
        hint: "Le devis est signé. Envoyez la facture au client.",
        primaryLabel: "Importer facture (PDF)",
        primaryIcon: <Receipt className="h-4 w-4" />,
        primaryAction: () => window.dispatchEvent(new CustomEvent("open-import-facture")),
      };
    }

    // ──── Facture en attente → Marquer payée ────
    if (status === "invoice_pending") {
      const inv = invoices[0];
      return {
        message: inv ? `Facture ${inv.invoice_number} en attente de paiement` : "Facture en attente de paiement",
        hint: "Marquez la facture comme payée dès réception du règlement.",
        primaryLabel: "Marquer payée",
        primaryIcon: <CreditCard className="h-4 w-4" />,
        primaryAction: () => markPaid.mutate(),
        isPending: markPaid.isPending,
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
  const timeCounter = getTimeCounter();
  if (!step) return null;

  const counterColorClass = timeCounter?.color === "destructive"
    ? "text-destructive"
    : timeCounter?.color === "warning"
      ? "text-warning"
      : "text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3"
    >
      {/* Next step message */}
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="space-y-1"
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
          >
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
          </motion.div>
          <p className="text-sm font-medium text-foreground">{step.message}</p>
        </div>
        {timeCounter && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            className={`text-[11px] flex items-center gap-1 ml-6 ${counterColorClass}`}
          >
            <Clock className="h-3 w-3" />
            {timeCounter.text}
          </motion.p>
        )}
      </motion.div>

      {/* Hint — "Pourquoi ?" */}
      {step.hint && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ delay: 0.25, duration: 0.3 }}
          className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2"
        >
          <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">{step.hint}</p>
        </motion.div>
      )}

      {/* Done state */}
      {step.done && step.badge && (
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 300 }}>
          <Badge className="bg-success/15 text-success text-sm px-3 py-1">{step.badge}</Badge>
        </motion.div>
      )}

      {/* Primary action button */}
      {!step.done && step.primaryLabel && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.3 }}
          className="flex flex-wrap gap-2"
        >
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md"
              onClick={step.primaryAction}
              disabled={step.isPending}
            >
              {step.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : step.primaryIcon}
              {step.primaryLabel}
              <motion.div animate={{ x: [0, 4, 0] }} transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2 }}>
                <ArrowRight className="h-4 w-4" />
              </motion.div>
            </Button>
          </motion.div>

          {step.secondaryLabel && step.secondaryAction && (
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button variant="outline" className="gap-2" onClick={step.secondaryAction}>
                {step.secondaryLabel}
              </Button>
            </motion.div>
          )}
        </motion.div>
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
    </motion.div>
  );
}