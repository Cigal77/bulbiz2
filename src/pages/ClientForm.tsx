import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Upload, CheckCircle2, AlertTriangle, Loader2, X, Shield, Calendar, Clock, Info, Video } from "lucide-react";
import { VideoRecorderWithTorch } from "@/components/VideoRecorderWithTorch";
import { BulbizLogo } from "@/components/BulbizLogo";
import { CATEGORY_LABELS, URGENCY_LABELS } from "@/lib/constants";
import { AddressAutocomplete, type AddressData } from "@/components/AddressAutocomplete";
import { cn } from "@/lib/utils";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"];

interface SlotData {
  id: string;
  slot_date: string;
  time_start: string;
  time_end: string;
  selected_at: string | null;
}

interface DossierData {
  dossier_id: string;
  client_first_name: string | null;
  client_last_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  address: string | null;
  category: string;
  urgency: string;
  description: string | null;
  status: string;
  appointment_status?: string;
  appointment_slots?: SlotData[];
}

function validateEmail(email: string): boolean {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s.\-()]/g, "");
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return "+33" + cleaned.slice(1);
  }
  return cleaned;
}

function PrefilledBadge() {
  return (
    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal gap-0.5">
      <Info className="h-2.5 w-2.5" />
      Pré-rempli
    </Badge>
  );
}

export default function ClientForm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [slotSuccess, setSlotSuccess] = useState(false);
  const [autoConfirmed, setAutoConfirmed] = useState(false);
  const [emailError, setEmailError] = useState("");

  const [dossier, setDossier] = useState<DossierData | null>(null);
  const [form, setForm] = useState({
    client_first_name: "",
    client_last_name: "",
    client_phone: "",
    client_email: "",
    address: "",
    description: "",
    category: "autre",
    urgency: "semaine",
  });
  const [addressData, setAddressData] = useState<Partial<AddressData>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [rgpdConsent, setRgpdConsent] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectingSlot, setSelectingSlot] = useState(false);
  const [videoRecorderOpen, setVideoRecorderOpen] = useState(false);

  const hasSlots = (dossier?.appointment_slots?.length ?? 0) > 0;
  const isSlotMode = hasSlots && (dossier?.appointment_status === "slots_proposed" || dossier?.appointment_status === "client_selected");
  const alreadySelected = dossier?.appointment_slots?.find(s => s.selected_at);

  // Track which fields were pre-filled by artisan
  const [prefilled, setPrefilled] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token) {
      setError("Lien invalide. Veuillez contacter votre artisan.");
      setLoading(false);
      return;
    }
    loadDossier();
  }, [token]);

  const loadDossier = async () => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("submit-client-form", {
        body: { token, action: "get" },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setDossier(data);

      // Pre-fill form with existing data
      const pf = new Set<string>();
      const newForm = { ...form };
      if (data.client_first_name) { newForm.client_first_name = data.client_first_name; pf.add("client_first_name"); }
      if (data.client_last_name) { newForm.client_last_name = data.client_last_name; pf.add("client_last_name"); }
      if (data.client_phone) { newForm.client_phone = data.client_phone; pf.add("client_phone"); }
      if (data.client_email) { newForm.client_email = data.client_email; pf.add("client_email"); }
      if (data.address) { newForm.address = data.address; pf.add("address"); }
      if (data.description) { newForm.description = data.description; pf.add("description"); }
      if (data.category) { newForm.category = data.category; if (data.category !== "autre") pf.add("category"); }
      if (data.urgency) { newForm.urgency = data.urgency; if (data.urgency !== "semaine") pf.add("urgency"); }
      setForm(newForm);
      setPrefilled(pf);

      const existing = data?.appointment_slots?.find((s: SlotData) => s.selected_at);
      if (existing) setSelectedSlotId(existing.id);
    } catch (e: any) {
      setError(e.message || "Lien invalide ou expiré");
    } finally {
      setLoading(false);
    }
  };

  const handleSlotSelect = async () => {
    if (!selectedSlotId || selectingSlot) return;
    setSelectingSlot(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("submit-client-form", {
        body: { token, action: "select_slot", slot_id: selectedSlotId },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      if (data?.auto_confirmed) setAutoConfirmed(true);
      setSlotSuccess(true);
    } catch (e: any) {
      setError(e.message || "Erreur lors de la sélection");
    } finally {
      setSelectingSlot(false);
    }
  };

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []);
    const valid = newFiles.filter((f) => ALLOWED_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE);
    setFiles((prev) => [...prev, ...valid].slice(0, MAX_FILES));
    e.target.value = "";
  };

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const handleVideoRecorded = (file: File) => {
    setFiles((prev) => [...prev, file].slice(0, MAX_FILES));
  };

  const handleSubmit = async () => {
    if (!rgpdConsent || !dossier || submitting) return;

    // Validate email
    if (form.client_email && !validateEmail(form.client_email)) {
      setEmailError("Format d'email invalide");
      setStep(1);
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Upload files
      const mediaUrls: { url: string; name: string; type: string; size: number }[] = [];
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const ext = file.name.split(".").pop();
          const filePath = `${dossier.dossier_id}/client_${Date.now()}_${i}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("dossier-medias")
            .upload(filePath, file);
          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage.from("dossier-medias").getPublicUrl(filePath);
          mediaUrls.push({ url: urlData.publicUrl, name: file.name, type: file.type, size: file.size });
          setUploadProgress(Math.round(((i + 1) / files.length) * 100));
        }
      }

      // Send ALL form data (not just missing fields)
      const clientData: Record<string, string> = {};
      const normalizedPhone = form.client_phone ? normalizePhone(form.client_phone) : "";
      
      if (form.client_first_name.trim()) clientData.client_first_name = form.client_first_name.trim();
      if (form.client_last_name.trim()) clientData.client_last_name = form.client_last_name.trim();
      if (normalizedPhone) clientData.client_phone = normalizedPhone;
      if (form.client_email.trim()) clientData.client_email = form.client_email.trim();
      if (form.address.trim()) clientData.address = form.address.trim();
      if (form.description.trim()) clientData.description = form.description.trim();
      if (form.category) clientData.category = form.category;
      if (form.urgency) clientData.urgency = form.urgency;

      // Pass address data if selected from Google
      if (addressData.google_place_id) {
        clientData.google_place_id = addressData.google_place_id;
        if (addressData.lat) clientData.lat = String(addressData.lat);
        if (addressData.lng) clientData.lng = String(addressData.lng);
        if (addressData.postal_code) clientData.postal_code = addressData.postal_code;
        if (addressData.city) clientData.city = addressData.city;
        if (addressData.address_line) clientData.address_line = addressData.address_line;
      }

      const { data, error: fnError } = await supabase.functions.invoke("submit-client-form", {
        body: {
          token,
          action: "submit",
          data: clientData,
          media_urls: mediaUrls,
          rgpd_consent: true,
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setSuccess(true);
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'envoi");
    } finally {
      setSubmitting(false);
    }
  };

  const formatSlotDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !dossier) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <p className="text-foreground font-medium">{error}</p>
            <p className="text-sm text-muted-foreground">Contactez votre artisan pour obtenir un nouveau lien.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (slotSuccess) {
    const chosen = dossier?.appointment_slots?.find(s => s.id === selectedSlotId);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
            <h2 className="text-xl font-bold text-foreground">
              {autoConfirmed ? "Rendez-vous confirmé !" : "Créneau confirmé !"}
            </h2>
            {chosen && (
              <div className="rounded-lg bg-success/10 border border-success/20 p-4">
                <p className="text-sm font-semibold text-foreground flex items-center justify-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {formatSlotDate(chosen.slot_date)}
                </p>
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
                  <Clock className="h-3.5 w-3.5" />
                  {chosen.time_start.slice(0, 5)} – {chosen.time_end.slice(0, 5)}
                </p>
              </div>
            )}
            <p className="text-muted-foreground text-sm">
              {autoConfirmed
                ? "Votre rendez-vous est confirmé. Un email de confirmation vous a été envoyé."
                : "Votre artisan va confirmer le rendez-vous. Vous recevrez une notification."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Merci !</h2>
            <p className="text-muted-foreground">Vos informations ont été envoyées. Votre artisan reviendra vers vous rapidement.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Slot selection mode
  if (isSlotMode) {
    const slots = dossier?.appointment_slots ?? [];
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-background/95 backdrop-blur px-4 py-3">
          <div className="max-w-lg mx-auto"><BulbizLogo size={20} /></div>
        </header>
        <main className="p-4 max-w-lg mx-auto mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Choisissez votre créneau
              </CardTitle>
              <CardDescription>Sélectionnez le créneau qui vous convient le mieux pour l'intervention.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {slots.map((slot) => {
                const isSelected = selectedSlotId === slot.id;
                const wasAlreadyChosen = !!slot.selected_at;
                return (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlotId(slot.id)}
                    className={cn(
                      "w-full text-left rounded-xl border-2 p-4 transition-all",
                      isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40 bg-card"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                        isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                      )}>
                        {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">{formatSlotDate(slot.slot_date)}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {slot.time_start.slice(0, 5)} – {slot.time_end.slice(0, 5)}
                        </p>
                      </div>
                      {wasAlreadyChosen && (
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Choisi</span>
                      )}
                    </div>
                  </button>
                );
              })}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button onClick={handleSlotSelect} disabled={!selectedSlotId || selectingSlot} className="w-full mt-4 gap-2">
                {selectingSlot ? (<><Loader2 className="h-4 w-4 animate-spin" />Confirmation…</>) : "Confirmer ce créneau"}
              </Button>
              {alreadySelected && selectedSlotId === alreadySelected.id && (
                <p className="text-xs text-muted-foreground text-center">Vous avez déjà choisi ce créneau. Vous pouvez en sélectionner un autre.</p>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Standard form mode — ALL fields editable
  const totalSteps = 3;
  const progressPercent = (step / totalSteps) * 100;
  const hasSomePrefilled = prefilled.size > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur px-4 py-3">
        <div className="max-w-lg mx-auto"><BulbizLogo size={20} /></div>
      </header>

      <main className="p-4 max-w-lg mx-auto mt-6 space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Étape {step}/{totalSteps}</span>
            <span>{step === 1 ? "Informations" : step === 2 ? "Photos" : "Validation"}</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        <p className="text-sm text-muted-foreground">
          Bonjour{form.client_first_name ? ` ${form.client_first_name}` : ""}, vérifiez et complétez vos informations pour que votre artisan puisse intervenir au mieux.
        </p>

        {hasSomePrefilled && step === 1 && (
          <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 p-3 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            Certaines informations sont pré-remplies par votre artisan. Vous pouvez les corriger si nécessaire.
          </div>
        )}

        {/* Step 1: Info — ALL fields editable */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vos informations</CardTitle>
              <CardDescription>Vérifiez et corrigez si besoin.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5">
                    Prénom
                    {prefilled.has("client_first_name") && <PrefilledBadge />}
                  </Label>
                  <Input
                    placeholder="Jean"
                    value={form.client_first_name}
                    onChange={(e) => setForm({ ...form, client_first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5">
                    Nom
                    {prefilled.has("client_last_name") && <PrefilledBadge />}
                  </Label>
                  <Input
                    placeholder="Dupont"
                    value={form.client_last_name}
                    onChange={(e) => setForm({ ...form, client_last_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5">
                  Téléphone
                  {prefilled.has("client_phone") && <PrefilledBadge />}
                </Label>
                <Input
                  placeholder="06 12 34 56 78"
                  type="tel"
                  value={form.client_phone}
                  onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5">
                  Email
                  {prefilled.has("client_email") && <PrefilledBadge />}
                </Label>
                <Input
                  placeholder="client@email.com"
                  type="email"
                  value={form.client_email}
                  onChange={(e) => { setForm({ ...form, client_email: e.target.value }); setEmailError(""); }}
                  className={emailError ? "border-destructive" : ""}
                />
                {emailError && <p className="text-xs text-destructive">{emailError}</p>}
              </div>

              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5">
                  Adresse d'intervention
                  {prefilled.has("address") && <PrefilledBadge />}
                </Label>
                <AddressAutocomplete
                  value={form.address}
                  onChange={(val) => { setForm({ ...form, address: val }); setAddressData({}); }}
                  onAddressSelect={(data) => { setForm({ ...form, address: data.address }); setAddressData(data); }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5">
                    Type de problème
                    {prefilled.has("category") && <PrefilledBadge />}
                  </Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5">
                    Urgence
                    {prefilled.has("urgency") && <PrefilledBadge />}
                  </Label>
                  <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(URGENCY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5">
                  Description du problème
                  {prefilled.has("description") && <PrefilledBadge />}
                </Label>
                <Textarea
                  rows={5}
                  placeholder="Ex : Fuite sous l'évier de la cuisine depuis hier soir…"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  maxLength={5000}
                />
                <span className="text-xs text-muted-foreground">{form.description.length}/5000</span>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setStep(2)}>Suivant</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Photos */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ajoutez des photos</CardTitle>
              <CardDescription>Photos ou vidéos du problème (optionnel, max {MAX_FILES} fichiers)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-border p-2">
                      {f.type.startsWith("image/") ? (
                        <img src={URL.createObjectURL(f)} alt="" className="h-12 w-12 rounded object-cover" />
                      ) : (
                        <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                          <Camera className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <span className="flex-1 text-sm truncate">{f.name}</span>
                      <Button variant="ghost" size="icon" onClick={() => removeFile(i)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {files.length < MAX_FILES && (
                <div className="space-y-3">
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:border-primary/50 transition-colors">
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Appuyez pour ajouter</span>
                    <span className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP, MP4 · Max 10 Mo</span>
                    <input type="file" accept={ALLOWED_TYPES.join(",")} multiple className="hidden" onChange={handleFileAdd} capture="environment" />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => setVideoRecorderOpen(true)}
                  >
                    <Video className="h-4 w-4" />
                    Filmer avec flash
                  </Button>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>Retour</Button>
                <Button onClick={() => setStep(3)}>{files.length === 0 ? "Passer" : "Suivant"}</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: RGPD + Submit */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Validation</CardTitle>
              <CardDescription>Relisez et confirmez votre envoi</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
                <p className="font-medium text-foreground">Récapitulatif :</p>
                {form.client_first_name && (
                  <p className="text-muted-foreground">Client : {form.client_first_name} {form.client_last_name}</p>
                )}
                {form.address && (
                  <p className="text-muted-foreground truncate">Adresse : {form.address}</p>
                )}
                {form.description && (
                  <p className="text-muted-foreground line-clamp-2">Description : {form.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {files.length} fichier{files.length !== 1 ? "s" : ""} joint{files.length !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Protection de vos données</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Vos données sont traitées uniquement pour la gestion de votre demande d'intervention.
                      Elles ne sont pas partagées avec des tiers.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox id="rgpd" checked={rgpdConsent} onCheckedChange={(v) => setRgpdConsent(v === true)} />
                  <Label htmlFor="rgpd" className="text-sm leading-tight cursor-pointer">
                    J'accepte le traitement de mes données pour la gestion de ma demande
                  </Label>
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              {submitting && files.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Upload des fichiers…</p>
                  <Progress value={uploadProgress} className="h-1.5" />
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(2)}>Retour</Button>
                <Button onClick={handleSubmit} disabled={submitting || !rgpdConsent} className="gap-2">
                  {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" />Envoi…</>) : "Envoyer"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <VideoRecorderWithTorch
        open={videoRecorderOpen}
        onClose={() => setVideoRecorderOpen(false)}
        onVideoRecorded={handleVideoRecorded}
      />
    </div>
  );
}
