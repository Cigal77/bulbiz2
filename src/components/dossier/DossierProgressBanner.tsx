import type { Dossier } from "@/hooks/useDossier";
import { STATUS_LABELS, APPOINTMENT_STATUS_LABELS } from "@/lib/constants";
import type { AppointmentStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { FileText, ClipboardList, Send, CheckCircle, Calendar, Receipt } from "lucide-react";

interface DossierProgressBannerProps {
  dossier: Dossier;
}

type Step = {
  key: string;
  label: string;
  subLabel?: string;
  icon: React.ReactNode;
  done: boolean;
  active: boolean;
};

export function DossierProgressBanner({ dossier }: DossierProgressBannerProps) {
  const status = dossier.status;
  const rdvStatus = (dossier.appointment_status || "none") as AppointmentStatus;

  const statusOrder = ["nouveau", "a_qualifier", "devis_a_faire", "devis_envoye", "clos_signe", "invoice_pending", "invoice_paid"];
  const currentIdx = statusOrder.indexOf(status);

  const rdvActive = rdvStatus !== "none" && rdvStatus !== "cancelled";
  const rdvDone = rdvStatus === "done";

  const steps: Step[] = [
    {
      key: "dossier",
      label: "Dossier",
      subLabel: currentIdx <= 1 ? "Nouveau" : "Complété",
      icon: <FileText className="h-4 w-4" />,
      done: currentIdx > 1,
      active: currentIdx <= 1,
    },
    {
      key: "devis",
      label: "Devis",
      subLabel: currentIdx === 2 ? "À faire" : currentIdx === 3 ? "Envoyé" : currentIdx >= 4 ? "Signé" : undefined,
      icon: <ClipboardList className="h-4 w-4" />,
      done: currentIdx >= 4,
      active: currentIdx === 2 || currentIdx === 3,
    },
    {
      key: "signature",
      label: "Signature",
      subLabel: currentIdx >= 4 ? "Validée" : undefined,
      icon: <CheckCircle className="h-4 w-4" />,
      done: currentIdx >= 4,
      active: currentIdx === 3,
    },
    {
      key: "rdv",
      label: "RDV",
      subLabel: rdvActive ? APPOINTMENT_STATUS_LABELS[rdvStatus] : undefined,
      icon: <Calendar className="h-4 w-4" />,
      done: rdvDone,
      active: rdvActive && !rdvDone,
    },
    {
      key: "facture",
      label: "Facture",
      subLabel: status === "invoice_pending" ? "En attente" : status === "invoice_paid" ? "Payée" : undefined,
      icon: <Receipt className="h-4 w-4" />,
      done: status === "invoice_paid",
      active: status === "invoice_pending",
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div
                className={cn(
                  "flex items-center justify-center h-8 w-8 rounded-full transition-colors",
                  step.done
                    ? "bg-success text-success-foreground"
                    : step.active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {step.icon}
              </div>
              <span className={cn(
                "text-[11px] font-medium text-center leading-tight",
                step.done ? "text-success" : step.active ? "text-primary" : "text-muted-foreground"
              )}>
                {step.label}
              </span>
              {step.subLabel && (
                <span className="text-[10px] text-muted-foreground text-center leading-tight">
                  {step.subLabel}
                </span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className={cn(
                "flex-1 h-0.5 mx-2 mt-[-16px]",
                step.done ? "bg-success" : "bg-border"
              )} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
