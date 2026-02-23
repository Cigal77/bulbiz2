import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInvoice, useInvoiceLines, type Invoice, type InvoiceLine } from "@/hooks/useInvoices";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BulbizLogo } from "@/components/BulbizLogo";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from "@/hooks/useInvoices";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Save, Trash2, Plus, Send, FileDown, Loader2, CheckCircle2, Link2,
} from "lucide-react";

export default function InvoiceEditor() {
  const { id: dossierId, invoiceId } = useParams<{ id: string; invoiceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invoice, isLoading: invLoading } = useInvoice(invoiceId!);
  const { data: lines = [], isLoading: linesLoading } = useInvoiceLines(invoiceId!);

  // Local state for editing
  const [form, setForm] = useState<Partial<Invoice>>({});
  const [localLines, setLocalLines] = useState<InvoiceLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  useEffect(() => {
    if (invoice) {
      setForm(invoice);
    }
  }, [invoice]);

  useEffect(() => {
    if (lines.length > 0) {
      setLocalLines(lines);
    }
  }, [lines]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
    queryClient.invalidateQueries({ queryKey: ["invoice_lines", invoiceId] });
    queryClient.invalidateQueries({ queryKey: ["invoices", dossierId] });
    queryClient.invalidateQueries({ queryKey: ["historique", dossierId] });
  };

  // Compute totals
  const computeTotals = useCallback((items: InvoiceLine[], vatMode: string) => {
    let totalHT = 0;
    let totalTVA = 0;
    items.forEach((line) => {
      const lineHT = line.qty * line.unit_price * (1 - (line.discount || 0) / 100);
      totalHT += lineHT;
      if (vatMode === "normal") {
        totalTVA += lineHT * (line.tva_rate / 100);
      }
    });
    return { totalHT, totalTVA, totalTTC: totalHT + totalTVA };
  }, []);

  const totals = computeTotals(localLines, form.vat_mode || "normal");

  const handleSave = async () => {
    if (!invoice) return;
    setSaving(true);
    try {
      // Update invoice
      const { error: invErr } = await supabase
        .from("invoices")
        .update({
          issue_date: form.issue_date,
          service_date: form.service_date || null,
          client_first_name: form.client_first_name || null,
          client_last_name: form.client_last_name || null,
          client_email: form.client_email || null,
          client_phone: form.client_phone || null,
          client_address: form.client_address || null,
          client_company: form.client_company || null,
          artisan_tva_intracom: form.artisan_tva_intracom || null,
          vat_mode: form.vat_mode,
          client_type: form.client_type,
          payment_terms: form.payment_terms || null,
          late_fees_text: form.late_fees_text || null,
          notes: form.notes || null,
          total_ht: totals.totalHT,
          total_tva: totals.totalTVA,
          total_ttc: totals.totalTTC,
        } as any)
        .eq("id", invoiceId);
      if (invErr) throw invErr;

      // Delete existing lines and re-insert
      await supabase.from("invoice_lines").delete().eq("invoice_id", invoiceId);
      if (localLines.length > 0) {
        const linesToInsert = localLines.map((l, idx) => ({
          invoice_id: invoiceId!,
          label: l.label,
          description: l.description || null,
          qty: l.qty,
          unit: l.unit,
          unit_price: l.unit_price,
          tva_rate: l.tva_rate,
          discount: l.discount || 0,
          sort_order: idx,
        }));
        const { error: lineErr } = await supabase.from("invoice_lines").insert(linesToInsert);
        if (lineErr) throw lineErr;
      }

      invalidate();
      toast({ title: "Facture sauvegardée ✅" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!invoice) return;
    setGeneratingPdf(true);
    try {
      await handleSave();
      const { data, error } = await supabase.functions.invoke("generate-invoice-pdf", {
        body: { invoice_id: invoiceId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.pdf_url) {
        window.open(data.pdf_url, "_blank");
      }
      invalidate();
      toast({ title: "PDF généré ✅" });
    } catch (e: any) {
      toast({ title: "Erreur PDF", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSend = async () => {
    if (!invoice) return;
    setSending(true);
    try {
      await handleSave();
      const { data, error } = await supabase.functions.invoke("send-invoice", {
        body: { invoice_id: invoiceId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      invalidate();
      toast({ title: "Facture envoyée ✅", description: data?.email_sent ? "Email envoyé" : "Envoi effectué" });
    } catch (e: any) {
      toast({ title: "Erreur d'envoi", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!invoice) return;
    try {
      await supabase
        .from("invoices")
        .update({ status: "paid", paid_at: new Date().toISOString() } as any)
        .eq("id", invoiceId);
      await supabase.from("historique").insert({
        dossier_id: dossierId!,
        user_id: user!.id,
        action: "invoice_paid",
        details: `Facture ${invoice.invoice_number} marquée comme payée`,
      });
      invalidate();
      toast({ title: "Facture marquée comme payée ✅" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const addLine = () => {
    setLocalLines([
      ...localLines,
      {
        id: crypto.randomUUID(),
        invoice_id: invoiceId!,
        label: "",
        description: null,
        qty: 1,
        unit: "u",
        unit_price: 0,
        tva_rate: 10,
        discount: 0,
        sort_order: localLines.length,
      },
    ]);
  };

  const removeLine = (idx: number) => {
    setLocalLines(localLines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: string, value: any) => {
    setLocalLines(localLines.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  if (invLoading) {
    return (
      <div className="flex-1 bg-background p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-background gap-4">
        <p className="text-lg font-medium">Facture introuvable</p>
        <Button variant="outline" onClick={() => navigate(`/dossier/${dossierId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
      </div>
    );
  }

  const isLocked = invoice.status !== "draft";

  return (
    <div className="flex flex-1 flex-col bg-background min-h-0">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 backdrop-blur px-4 sm:px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/dossier/${dossierId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <BulbizLogo size={20} />
          <span className="font-semibold text-foreground ml-2">{invoice.invoice_number}</span>
          <Badge className={cn("text-[10px]", INVOICE_STATUS_COLORS[invoice.status])}>
            {INVOICE_STATUS_LABELS[invoice.status]}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              setGeneratingLink(true);
              try {
                const { data, error } = await supabase.functions.invoke("generate-invoice-token", {
                  body: { invoice_id: invoiceId },
                });
                if (error) throw error;
                if (data?.token) {
                  const url = `${window.location.origin}/facture/view?token=${data.token}`;
                  await navigator.clipboard.writeText(url);
                  toast({ title: "Lien copié ✅", description: "Le lien client a été copié dans le presse-papiers." });
                }
              } catch (e: any) {
                toast({ title: "Erreur", description: e.message, variant: "destructive" });
              } finally {
                setGeneratingLink(false);
              }
            }}
            disabled={generatingLink}
            className="gap-1.5"
          >
            {generatingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            Lien client
          </Button>
          <Button size="sm" variant="outline" onClick={handleGeneratePdf} disabled={generatingPdf} className="gap-1.5">
            {generatingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
            Télécharger PDF
          </Button>
          {!isLocked && (
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Sauvegarder
            </Button>
          )}
          {invoice.status === "draft" && (
            <Button size="sm" variant="default" onClick={handleSend} disabled={sending} className="gap-1.5">
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Envoyer
            </Button>
          )}
          {invoice.status === "sent" && (
            <Button size="sm" variant="default" onClick={handleMarkPaid} className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Marquer payée
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-6">
        {/* Client & Artisan info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">Prénom</Label>
                <Input className="h-8 text-xs" value={form.client_first_name || ""} onChange={(e) => setForm({ ...form, client_first_name: e.target.value })} disabled={isLocked} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Nom</Label>
                <Input className="h-8 text-xs" value={form.client_last_name || ""} onChange={(e) => setForm({ ...form, client_last_name: e.target.value })} disabled={isLocked} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Email</Label>
              <Input className="h-8 text-xs" value={form.client_email || ""} onChange={(e) => setForm({ ...form, client_email: e.target.value })} disabled={isLocked} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Adresse</Label>
              <Input className="h-8 text-xs" value={form.client_address || ""} onChange={(e) => setForm({ ...form, client_address: e.target.value })} disabled={isLocked} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Société (si pro)</Label>
              <Input className="h-8 text-xs" value={form.client_company || ""} onChange={(e) => setForm({ ...form, client_company: e.target.value })} disabled={isLocked} />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Label className="text-[10px]">Client professionnel</Label>
              <Switch
                checked={form.client_type === "business"}
                onCheckedChange={(v) => setForm({ ...form, client_type: v ? "business" : "individual" })}
                disabled={isLocked}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Facture</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">Date d'émission</Label>
                <Input type="date" className="h-8 text-xs" value={form.issue_date || ""} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} disabled={isLocked} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Date intervention</Label>
                <Input type="date" className="h-8 text-xs" value={form.service_date || ""} onChange={(e) => setForm({ ...form, service_date: e.target.value })} disabled={isLocked} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-[10px]">TVA non applicable (art. 293 B)</Label>
              <Switch
                checked={form.vat_mode === "no_vat_293b"}
                onCheckedChange={(v) => setForm({ ...form, vat_mode: v ? "no_vat_293b" : "normal" })}
                disabled={isLocked}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Conditions de paiement</Label>
              <Textarea className="text-xs min-h-[60px]" value={form.payment_terms || ""} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} disabled={isLocked} />
            </div>
            {form.client_type === "business" && (
              <div className="space-y-1">
                <Label className="text-[10px]">Pénalités de retard</Label>
                <Textarea className="text-xs min-h-[40px]" value={form.late_fees_text || ""} onChange={(e) => setForm({ ...form, late_fees_text: e.target.value })} disabled={isLocked} />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-[10px]">Notes</Label>
              <Textarea className="text-xs min-h-[40px]" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} disabled={isLocked} />
            </div>
          </div>
        </div>

        {/* Lines */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lignes de facture</h3>
            {!isLocked && (
              <Button variant="outline" size="sm" onClick={addLine} className="gap-1 text-xs">
                <Plus className="h-3 w-3" /> Ajouter
              </Button>
            )}
          </div>

          {/* Header row */}
          <div className="hidden sm:grid grid-cols-[1fr_60px_60px_80px_60px_60px_30px] gap-2 text-[10px] font-medium text-muted-foreground uppercase px-1">
            <span>Désignation</span>
            <span>Qté</span>
            <span>Unité</span>
            <span>PU HT</span>
            <span>TVA %</span>
            <span>Total</span>
            <span></span>
          </div>

          {localLines.map((line, idx) => {
            const lineTotal = line.qty * line.unit_price * (1 - (line.discount || 0) / 100);
            return (
              <div key={line.id} className="grid grid-cols-1 sm:grid-cols-[1fr_60px_60px_80px_60px_60px_30px] gap-2 items-center">
                <Input className="h-8 text-xs" placeholder="Désignation" value={line.label} onChange={(e) => updateLine(idx, "label", e.target.value)} disabled={isLocked} />
                <Input className="h-8 text-xs" type="number" min={0} step={0.01} value={line.qty} onChange={(e) => updateLine(idx, "qty", parseFloat(e.target.value) || 0)} disabled={isLocked} />
                <Input className="h-8 text-xs" value={line.unit} onChange={(e) => updateLine(idx, "unit", e.target.value)} disabled={isLocked} />
                <Input className="h-8 text-xs" type="number" min={0} step={0.01} value={line.unit_price} onChange={(e) => updateLine(idx, "unit_price", parseFloat(e.target.value) || 0)} disabled={isLocked} />
                <Input className="h-8 text-xs" type="number" min={0} step={0.1} value={line.tva_rate} onChange={(e) => updateLine(idx, "tva_rate", parseFloat(e.target.value) || 0)} disabled={isLocked || form.vat_mode === "no_vat_293b"} />
                <span className="text-xs font-medium text-foreground text-right">{lineTotal.toFixed(2)} €</span>
                {!isLocked && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLine(idx)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
            );
          })}

          {localLines.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Aucune ligne. Cliquez "Ajouter" pour commencer.</p>
          )}
        </div>

        {/* Totals footer */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-8 text-sm">
              <span className="text-muted-foreground">Total HT</span>
              <span className="font-medium text-foreground w-24 text-right">{totals.totalHT.toFixed(2)} €</span>
            </div>
            {form.vat_mode === "normal" && (
              <div className="flex gap-8 text-sm">
                <span className="text-muted-foreground">TVA</span>
                <span className="font-medium text-foreground w-24 text-right">{totals.totalTVA.toFixed(2)} €</span>
              </div>
            )}
            {form.vat_mode === "no_vat_293b" && (
              <p className="text-[10px] text-muted-foreground italic">TVA non applicable, art. 293 B du CGI</p>
            )}
            <div className="flex gap-8 text-base border-t border-border pt-1 mt-1">
              <span className="font-semibold text-foreground">Total TTC</span>
              <span className="font-bold text-foreground w-24 text-right">{totals.totalTTC.toFixed(2)} €</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
