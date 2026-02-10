import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Dossier } from "@/hooks/useDossier";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_COLORS,
  type AppointmentStatus,
} from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Calendar, Clock, Plus, Check, X, Send, Edit2, Loader2, AlertTriangle, CheckCircle2, RefreshCw,
} from "lucide-react";

interface AppointmentBlockProps {
  dossier: Dossier;
}

interface Slot {
  id: string;
  slot_date: string;
  time_start: string;
  time_end: string;
  selected_at: string | null;
}

export function AppointmentBlock({ dossier }: AppointmentBlockProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const status = ((dossier as any).appointment_status || "none") as AppointmentStatus;
  const appointmentDate = (dossier as any).appointment_date as string | null;
  const timeStart = (dossier as any).appointment_time_start as string | null;
  const timeEnd = (dossier as any).appointment_time_end as string | null;

  const [showSlotForm, setShowSlotForm] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [newSlots, setNewSlots] = useState<{ date: string; start: string; end: string }[]>([
    { date: "", start: "09:00", end: "11:00" },
  ]);
  const [manualDate, setManualDate] = useState("");
  const [manualStart, setManualStart] = useState("09:00");
  const [manualEnd, setManualEnd] = useState("11:00");
  const [resending, setResending] = useState(false);

  const hasValidContact = !!(dossier.client_email || dossier.client_phone);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["dossier", dossier.id] });
    queryClient.invalidateQueries({ queryKey: ["historique", dossier.id] });
    queryClient.invalidateQueries({ queryKey: ["appointment_slots", dossier.id] });
  };

  // Fetch slots
  const { data: slots = [] } = useQuery({
    queryKey: ["appointment_slots", dossier.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_slots")
        .select("*")
        .eq("dossier_id", dossier.id)
        .order("slot_date", { ascending: true });
      if (error) throw error;
      return data as Slot[];
    },
  });

  const addHistorique = async (action: string, details: string) => {
    await supabase.from("historique").insert({
      dossier_id: dossier.id,
      user_id: user?.id ?? null,
      action,
      details,
    });
  };

  // Send notification helper
  const sendNotification = async (eventType: string, extraPayload?: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("send-appointment-notification", {
      body: { event_type: eventType, dossier_id: dossier.id, payload: extraPayload || {} },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    // Show result
    if (data?.email_status === "FAILED" && data?.sms_status === "FAILED") {
      toast({
        title: "⚠️ Notifications échouées",
        description: data.error_message || "Email et SMS n'ont pas pu être envoyés.",
        variant: "destructive",
      });
    } else if (data?.email_status === "SENT" || data?.sms_status === "SENT") {
      const parts: string[] = [];
      if (data.email_status === "SENT") parts.push("Email");
      if (data.sms_status === "SENT") parts.push("SMS");
      toast({ title: `${parts.join(" + ")} envoyé(s) ✅` });
    }

    return data;
  };

  // Resend notification
  const handleResend = async (eventType: string) => {
    setResending(true);
    try {
      // Build extra payload for SLOTS_PROPOSED
      let extraPayload: Record<string, unknown> = {};
      if (eventType === "SLOTS_PROPOSED" && slots.length > 0) {
        const slotsText = slots.map(s =>
          `<p>• ${format(new Date(s.slot_date), "EEEE d MMMM", { locale: fr })} ${s.time_start.slice(0, 5)}–${s.time_end.slice(0, 5)}</p>`
        ).join("");
        extraPayload = { slots_text: slotsText };
        if (dossier.client_token) {
          extraPayload.appointment_link = `${window.location.origin}/client?token=${dossier.client_token}`;
        }
      }
      if (eventType === "APPOINTMENT_CONFIRMED" && appointmentDate) {
        extraPayload = {
          appointment_date: format(new Date(appointmentDate), "EEEE d MMMM yyyy", { locale: fr }),
          appointment_time: timeStart && timeEnd ? `${timeStart.slice(0, 5)}–${timeEnd.slice(0, 5)}` : "",
        };
      }

      await sendNotification(eventType, extraPayload);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setResending(false);
      invalidate();
    }
  };

  // Propose slots mutation
  const proposeSlots = useMutation({
    mutationFn: async () => {
      const validSlots = newSlots.filter((s) => s.date && s.start && s.end);
      if (!validSlots.length) throw new Error("Ajoutez au moins un créneau");

      // Insert slots
      const { error: slotErr } = await supabase.from("appointment_slots").insert(
        validSlots.map((s) => ({
          dossier_id: dossier.id,
          slot_date: s.date,
          time_start: s.start,
          time_end: s.end,
        }))
      );
      if (slotErr) throw slotErr;

      // Update status
      const { error: statusErr } = await supabase
        .from("dossiers")
        .update({ appointment_status: "slots_proposed" } as any)
        .eq("id", dossier.id);
      if (statusErr) throw statusErr;

      await addHistorique("slots_proposed", `${validSlots.length} créneau(x) proposé(s)`);

      // Send notification
      const slotsText = validSlots.map(s =>
        `<p>• ${s.date} ${s.start}–${s.end}</p>`
      ).join("");

      let appointmentLink = "";
      if (dossier.client_token) {
        appointmentLink = `${window.location.origin}/client?token=${dossier.client_token}`;
      }

      try {
        await sendNotification("SLOTS_PROPOSED", {
          slots_text: slotsText,
          appointment_link: appointmentLink,
        });
      } catch (e) {
        console.error("Notification error after slots proposed:", e);
      }
    },
    onSuccess: () => {
      setShowSlotForm(false);
      setNewSlots([{ date: "", start: "09:00", end: "11:00" }]);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // Manual RDV mutation
  const setManualRdv = useMutation({
    mutationFn: async () => {
      if (!manualDate) throw new Error("Choisissez une date");

      const { error } = await supabase
        .from("dossiers")
        .update({
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
      await addHistorique("rdv_confirmed", `Rendez-vous fixé manuellement : ${dateStr} ${manualStart}–${manualEnd}`);

      // Send confirmation notification
      try {
        await sendNotification("APPOINTMENT_CONFIRMED", {
          appointment_date: dateStr,
          appointment_time: `${manualStart}–${manualEnd}`,
        });
      } catch (e) {
        console.error("Notification error after manual rdv:", e);
      }
    },
    onSuccess: () => {
      toast({ title: "Rendez-vous confirmé ✅" });
      setShowManualForm(false);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // Confirm selected slot
  const confirmSlot = useMutation({
    mutationFn: async () => {
      const selected = slots.find((s) => s.selected_at);
      if (!selected) throw new Error("Aucun créneau sélectionné par le client");

      const { error } = await supabase
        .from("dossiers")
        .update({
          appointment_status: "rdv_confirmed",
          appointment_date: selected.slot_date,
          appointment_time_start: selected.time_start,
          appointment_time_end: selected.time_end,
          appointment_source: "client_selected",
          appointment_confirmed_at: new Date().toISOString(),
        } as any)
        .eq("id", dossier.id);
      if (error) throw error;

      const dateStr = format(new Date(selected.slot_date), "EEEE d MMMM yyyy", { locale: fr });
      await addHistorique("rdv_confirmed", `Rendez-vous confirmé : ${dateStr} ${selected.time_start}–${selected.time_end}`);

      // Send confirmation notification
      try {
        await sendNotification("APPOINTMENT_CONFIRMED", {
          appointment_date: dateStr,
          appointment_time: `${selected.time_start.slice(0, 5)}–${selected.time_end.slice(0, 5)}`,
        });
      } catch (e) {
        console.error("Notification error after confirm slot:", e);
      }
    },
    onSuccess: () => {
      toast({ title: "Rendez-vous confirmé ✅" });
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // Cancel RDV
  const cancelRdv = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("dossiers")
        .update({
          appointment_status: "cancelled",
          appointment_date: null,
          appointment_time_start: null,
          appointment_time_end: null,
          appointment_confirmed_at: null,
        } as any)
        .eq("id", dossier.id);
      if (error) throw error;
      await addHistorique("rdv_cancelled", "Rendez-vous annulé");
    },
    onSuccess: () => {
      toast({ title: "Rendez-vous annulé" });
      invalidate();
    },
  });

  // Mark intervention as done
  const markDone = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("dossiers")
        .update({ appointment_status: "done" } as any)
        .eq("id", dossier.id);
      if (error) throw error;
      await addHistorique("intervention_done", "Intervention marquée comme réalisée");
    },
    onSuccess: () => {
      toast({ title: "Intervention réalisée ✅" });
      invalidate();
    },
  });

  const addSlotRow = () => {
    if (newSlots.length >= 5) return;
    setNewSlots([...newSlots, { date: "", start: "09:00", end: "11:00" }]);
  };

  const removeSlotRow = (idx: number) => {
    setNewSlots(newSlots.filter((_, i) => i !== idx));
  };

  const updateSlotRow = (idx: number, field: string, value: string) => {
    setNewSlots(newSlots.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const selectedSlot = slots.find((s) => s.selected_at);

  // Determine which resend event to show
  const resendEventMap: Partial<Record<AppointmentStatus, { label: string; event: string }>> = {
    rdv_pending: { label: "Renvoyer la proposition de RDV", event: "APPOINTMENT_REQUESTED" },
    slots_proposed: { label: "Renvoyer le lien de choix de créneau", event: "SLOTS_PROPOSED" },
    client_selected: { label: "Renvoyer le lien de choix de créneau", event: "SLOTS_PROPOSED" },
    rdv_confirmed: { label: "Renvoyer la confirmation RDV", event: "APPOINTMENT_CONFIRMED" },
  };
  const resendInfo = resendEventMap[status];

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          Rendez-vous
        </h3>
        <Badge className={cn("text-[10px]", APPOINTMENT_STATUS_COLORS[status])}>
          {APPOINTMENT_STATUS_LABELS[status]}
        </Badge>
      </div>

      {/* Confirmed RDV display */}
      {status === "rdv_confirmed" && appointmentDate && (
        <div className="rounded-lg bg-success/10 border border-success/20 p-3">
          <p className="text-sm font-semibold text-foreground">
            📅 {format(new Date(appointmentDate), "EEEE d MMMM yyyy", { locale: fr })}
          </p>
          {timeStart && timeEnd && (
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock className="h-3 w-3" />
              {timeStart.slice(0, 5)} – {timeEnd.slice(0, 5)}
            </p>
          )}
        </div>
      )}

      {/* Client selected - pending confirmation */}
      {status === "client_selected" && selectedSlot && (
        <div className="rounded-lg bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/30 p-3 space-y-2">
          <p className="text-sm font-medium text-foreground">
            Le client a choisi : {format(new Date(selectedSlot.slot_date), "EEEE d MMMM", { locale: fr })} {selectedSlot.time_start.slice(0, 5)}–{selectedSlot.time_end.slice(0, 5)}
          </p>
        </div>
      )}

      {/* Proposed slots list */}
      {(status === "slots_proposed" || status === "client_selected") && slots.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground font-medium">Créneaux proposés :</p>
          {slots.map((slot) => (
            <div
              key={slot.id}
              className={cn(
                "text-xs rounded px-2 py-1 flex items-center gap-2",
                slot.selected_at ? "bg-primary/10 text-primary font-medium" : "bg-muted text-muted-foreground"
              )}
            >
              {format(new Date(slot.slot_date), "EEE d MMM", { locale: fr })} {slot.time_start.slice(0, 5)}–{slot.time_end.slice(0, 5)}
              {slot.selected_at && <Check className="h-3 w-3" />}
            </div>
          ))}
        </div>
      )}

      {/* Actions based on status */}
      <div className="flex flex-col gap-2">
        {(status === "none" || status === "rdv_pending") && (
          <>
            <Button
              variant="default"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => setShowSlotForm(true)}
            >
              <Send className="h-3.5 w-3.5" />
              Proposer des créneaux
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => setShowManualForm(true)}
            >
              <Edit2 className="h-3.5 w-3.5" />
              Définir RDV manuellement
            </Button>
          </>
        )}

        {status === "slots_proposed" && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => setShowSlotForm(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Proposer d'autres créneaux
          </Button>
        )}

        {status === "client_selected" && (
          <>
            <Button
              variant="default"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => confirmSlot.mutate()}
              disabled={confirmSlot.isPending}
            >
              {confirmSlot.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Confirmer le rendez-vous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => setShowSlotForm(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Proposer d'autres créneaux
            </Button>
          </>
        )}

        {status === "rdv_confirmed" && (
          <>
            <Button
              variant="default"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => markDone.mutate()}
              disabled={markDone.isPending}
            >
              {markDone.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Marquer intervention réalisée
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => setShowManualForm(true)}
            >
              <Edit2 className="h-3.5 w-3.5" />
              Modifier le RDV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-destructive"
              onClick={() => cancelRdv.mutate()}
              disabled={cancelRdv.isPending}
            >
              <X className="h-3.5 w-3.5" />
              Annuler le RDV
            </Button>
          </>
        )}

        {status === "done" && (
          <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-center">
            <p className="text-sm font-medium text-primary">✅ Intervention réalisée</p>
          </div>
        )}

        {status === "cancelled" && (
          <Button
            variant="default"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => setShowSlotForm(true)}
          >
            <Send className="h-3.5 w-3.5" />
            Proposer de nouveaux créneaux
          </Button>
        )}

        {/* Resend notification button */}
        {resendInfo && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-1.5 text-xs text-muted-foreground"
                  onClick={() => handleResend(resendInfo.event)}
                  disabled={resending || !hasValidContact}
                >
                  {resending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  {resendInfo.label}
                </Button>
              </div>
            </TooltipTrigger>
            {!hasValidContact && (
              <TooltipContent>
                <p>Ajoutez un email ou téléphone client pour envoyer</p>
              </TooltipContent>
            )}
          </Tooltip>
        )}
      </div>

      {/* Slot proposal form */}
      {showSlotForm && (
        <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">
          <p className="text-xs font-medium text-foreground">Ajouter des créneaux (max 5)</p>
          {newSlots.map((slot, idx) => (
            <div key={idx} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-[10px]">Date</Label>
                <Input
                  type="date"
                  value={slot.date}
                  onChange={(e) => updateSlotRow(idx, "date", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="w-20 space-y-1">
                <Label className="text-[10px]">Début</Label>
                <Input
                  type="time"
                  value={slot.start}
                  onChange={(e) => updateSlotRow(idx, "start", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="w-20 space-y-1">
                <Label className="text-[10px]">Fin</Label>
                <Input
                  type="time"
                  value={slot.end}
                  onChange={(e) => updateSlotRow(idx, "end", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              {newSlots.length > 1 && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeSlotRow(idx)}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          <div className="flex gap-2">
            {newSlots.length < 5 && (
              <Button variant="ghost" size="sm" onClick={addSlotRow} className="gap-1 text-xs">
                <Plus className="h-3 w-3" /> Ajouter créneau
              </Button>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => proposeSlots.mutate()} disabled={proposeSlots.isPending}>
              {proposeSlots.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Envoyer"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowSlotForm(false)}>Annuler</Button>
          </div>
        </div>
      )}

      {/* Manual RDV form */}
      {showManualForm && (
        <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">
          <p className="text-xs font-medium text-foreground">Définir un rendez-vous</p>
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
              {setManualRdv.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirmer"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowManualForm(false)}>Annuler</Button>
          </div>
        </div>
      )}
    </div>
  );
}
