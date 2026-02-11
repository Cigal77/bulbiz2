import { useParams, useNavigate } from "react-router-dom";
import { useDossier, useDossierHistorique, useDossierMedias } from "@/hooks/useDossier";
import { ClientBlock } from "@/components/dossier/ClientBlock";
import { DossierProgressBanner } from "@/components/dossier/DossierProgressBanner";
import { NextStepBanner } from "@/components/dossier/NextStepBanner";
import { InterventionBlock } from "@/components/dossier/InterventionBlock";
import { MediaGallery } from "@/components/dossier/MediaGallery";
import { SummaryBlock } from "@/components/dossier/SummaryBlock";
import { HistoriqueTimeline } from "@/components/dossier/HistoriqueTimeline";
import { DossierActions } from "@/components/dossier/DossierActions";
import { ClientLinkBlock } from "@/components/dossier/ClientLinkBlock";
import { QuoteBlock } from "@/components/dossier/QuoteBlock";
import { AppointmentBlock } from "@/components/dossier/AppointmentBlock";
import { AppointmentBanner } from "@/components/dossier/AppointmentBanner";
import { InvoiceBlock } from "@/components/dossier/InvoiceBlock";
import { ImportDevisDialog } from "@/components/dossier/ImportDevisDialog";
import { ImportFactureDialog } from "@/components/dossier/ImportFactureDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { BulbizLogo } from "@/components/BulbizLogo";
import { useRef, useState, useEffect } from "react";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function DossierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: dossier, isLoading } = useDossier(id!);
  const { data: historique = [], isLoading: histLoading } = useDossierHistorique(id!);
  const { data: medias = [], isLoading: mediasLoading } = useDossierMedias(id!);
  const appointmentRef = useRef<HTMLDivElement>(null);
  const [importDevisOpen, setImportDevisOpen] = useState(false);
  const [importFactureOpen, setImportFactureOpen] = useState(false);

  // Listen for custom events from NextStepBanner
  useEffect(() => {
    const openDevis = () => setImportDevisOpen(true);
    const openFacture = () => setImportFactureOpen(true);
    window.addEventListener("open-import-devis", openDevis);
    window.addEventListener("open-import-facture", openFacture);
    return () => {
      window.removeEventListener("open-import-devis", openDevis);
      window.removeEventListener("open-import-facture", openFacture);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/95 backdrop-blur px-4 sm:px-6 py-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-5 w-48" />
        </header>
        <main className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div>
            <div className="space-y-4">
              {[1, 2].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <p className="text-lg font-medium text-foreground">Dossier introuvable</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour au dashboard
        </Button>
      </div>
    );
  }

  const clientName = dossier.client_first_name || dossier.client_last_name
    ? `${dossier.client_first_name ?? ""} ${dossier.client_last_name ?? ""}`.trim()
    : "Dossier sans nom";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header with client name + status badge */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/95 backdrop-blur px-4 sm:px-6 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <BulbizLogo size={20} />
        <span className="font-semibold text-foreground truncate ml-2">{clientName}</span>
        <Badge className={cn("text-[10px] ml-auto shrink-0", STATUS_COLORS[dossier.status])}>
          {STATUS_LABELS[dossier.status]}
        </Badge>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - main info */}
          <div className="lg:col-span-2 space-y-4">
            <DossierProgressBanner dossier={dossier} />
            <NextStepBanner
              dossier={dossier}
              onScrollToAppointment={() => appointmentRef.current?.scrollIntoView({ behavior: "smooth" })}
            />
            <AppointmentBanner
              dossier={dossier}
              onNavigateToAppointment={() => appointmentRef.current?.scrollIntoView({ behavior: "smooth" })}
            />
            <SummaryBlock dossier={dossier} />
            <ClientBlock dossier={dossier} />
            <InterventionBlock dossier={dossier} />
            <QuoteBlock dossier={dossier} />
            <MediaGallery medias={medias} isLoading={mediasLoading} dossierId={dossier.id} />
            <HistoriqueTimeline historique={historique} isLoading={histLoading} />
          </div>

          {/* Right column - actions */}
          <div className="space-y-4">
            <DossierActions dossier={dossier} />
            <div ref={appointmentRef}>
              <AppointmentBlock dossier={dossier} />
            </div>
            <InvoiceBlock dossier={dossier} />
            <ClientLinkBlock dossier={dossier} />
          </div>
        </div>
      </main>

      {/* Import dialogs (triggered from NextStepBanner + DossierActions) */}
      <ImportDevisDialog open={importDevisOpen} onClose={() => setImportDevisOpen(false)} dossierId={dossier.id} clientEmail={dossier.client_email} />
      <ImportFactureDialog open={importFactureOpen} onClose={() => setImportFactureOpen(false)} dossierId={dossier.id} clientEmail={dossier.client_email} />
    </div>
  );
}
