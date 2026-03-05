import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Camera, Upload, CheckCircle2, AlertTriangle, Loader2, X, Shield, Info,
} from "lucide-react";
import { BulbizLogo } from "@/components/BulbizLogo";
import { TRADE_TYPES } from "@/lib/trade-types";
import { AddressAutocomplete, type AddressData } from "@/components/AddressAutocomplete";
import { cn } from "@/lib/utils";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"];

interface ArtisanProfile {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
}

export default function PublicClientForm() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [artisan, setArtisan] = useState<ArtisanProfile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [existingDossier, setExistingDossier] = useState<any>(null);
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    client_first_name: "",
    client_last_name: "",
    client_phone: "",
    client_email: "",
    description: "",
    urgency: "semaine",
  });
  const [addressData, setAddressData] = useState<Partial<AddressData>>({});
  const [addressInput, setAddressInput] = useState("");
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [rgpdConsent, setRgpdConsent] = useState(false);
  const [emailError, setEmailError] = useState("");

  const galleryRef = React.useRef<HTMLInputElement>(null);

  // Load artisan profile
  useEffect(() => {
    async function loadArtisan() {
      if (!slug) { setNotFound(true); setLoading(false); return; }
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, company_name, phone, email")
        .eq("public_client_slug", slug)
        .maybeSingle();
      if (error || !data) { setNotFound(true); } else { setArtisan(data); }
      setLoading(false);
    }
    loadArtisan();
  }, [slug]);

  const artisanName = artisan?.company_name || [artisan?.first_name, artisan?.last_name].filter(Boolean).join(" ") || "Artisan";

  function validateEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files).filter(
      (f) => ALLOWED_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE
    );
    setFiles((prev) => [...prev, ...newFiles].slice(0, MAX_FILES));
    e.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!form.client_first_name.trim() || !form.client_last_name.trim()) return;
    if (form.client_email && !validateEmail(form.client_email)) {
      setEmailError("Email invalide");
      return;
    }
    if (!rgpdConsent) return;

    setSubmitting(true);
    setUploadProgress(10);

    try {
      // Upload files
      const mediaUrls: string[] = [];
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const formData = new FormData();
          formData.append("file", file);
          formData.append("slug", slug!);

          const uploadUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-client-media`;
          const resp = await fetch(uploadUrl, {
            method: "POST",
            headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
            body: formData,
          });
          const result = await resp.json();
          if (result.url) mediaUrls.push(result.url);
          setUploadProgress(10 + ((i + 1) / files.length) * 60);
        }
      }

      setUploadProgress(80);

      const submitData = {
        ...form,
        address: addressData.address || addressInput,
        address_line: addressData.address_line || "",
        postal_code: addressData.postal_code || "",
        city: addressData.city || "",
        country: addressData.country || "France",
        google_place_id: addressData.google_place_id || "",
        lat: addressData.lat,
        lng: addressData.lng,
        trade_types: selectedTrades,
        category: "autre",
      };

      const { data: result, error } = await supabase.functions.invoke("submit-public-form", {
        body: { slug, data: submitData, media_urls: mediaUrls, rgpd_consent: true },
      });

      setUploadProgress(100);

      if (error) throw error;
      if (result?.existing_dossier) setExistingDossier(result.existing_dossier);
      setSuccess(true);
    } catch (err) {
      console.error("Submit error:", err);
      alert("Erreur lors de l'envoi. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  }

  // Loading
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not found
  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <h2 className="text-xl font-semibold text-foreground">Page introuvable</h2>
            <p className="text-muted-foreground text-center">Ce lien n'est pas valide. Vérifiez l'adresse ou contactez votre artisan.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
            <CheckCircle2 className="h-14 w-14 text-green-500" />
            <h2 className="text-xl font-bold text-foreground">Demande envoyée !</h2>
            <p className="text-muted-foreground text-center">
              Votre demande a été transmise à <strong>{artisanName}</strong>.
              {form.client_email && " Vous recevrez un email de confirmation."}
            </p>
            <p className="text-sm text-muted-foreground text-center">
              {artisanName} reviendra vers vous rapidement.
            </p>
            {existingDossier && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-center w-full">
                <Info className="h-4 w-4 inline mr-1 text-amber-600" />
                Une demande précédente existe déjà pour ces coordonnées. Votre nouvelle demande a bien été créée séparément.
              </div>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setSuccess(false);
                setForm({ client_first_name: "", client_last_name: "", client_phone: "", client_email: "", description: "", urgency: "semaine" });
                setFiles([]);
                setAddressData({});
                setAddressInput("");
                setSelectedTrades([]);
                setRgpdConsent(false);
                setStep(1);
                setExistingDossier(null);
              }}
            >
              Envoyer une autre demande
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canGoNext = () => {
    if (step === 1) return selectedTrades.length > 0;
    if (step === 2) return form.client_first_name.trim() && form.client_last_name.trim() && (form.client_email ? validateEmail(form.client_email) : true);
    if (step === 3) return true;
    if (step === 4) return rgpdConsent;
    return false;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <BulbizLogo />
          <span className="text-sm font-medium text-muted-foreground">{artisanName}</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 pb-24">
        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Étape {step}/4</span>
            <span>{Math.round((step / 4) * 100)}%</span>
          </div>
          <Progress value={(step / 4) * 100} className="h-2" />
        </div>

        {/* Step 1: Trade selection */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Type d'intervention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Sélectionnez le(s) type(s) de travaux concernés :</p>
              <div className="grid grid-cols-2 gap-2">
                {TRADE_TYPES.map((trade) => (
                  <button
                    key={trade.value}
                    type="button"
                    onClick={() => {
                      setSelectedTrades((prev) =>
                        prev.includes(trade.value) ? prev.filter((t) => t !== trade.value) : [...prev, trade.value]
                      );
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
                      selectedTrades.includes(trade.value)
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border hover:border-primary/40"
                    )}
                  >
                    <span>{trade.icon}</span>
                    <span>{trade.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Client info */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vos coordonnées</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="first_name">Prénom *</Label>
                  <Input
                    id="first_name"
                    value={form.client_first_name}
                    onChange={(e) => setForm({ ...form, client_first_name: e.target.value })}
                    autoComplete="given-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last_name">Nom *</Label>
                  <Input
                    id="last_name"
                    value={form.client_last_name}
                    onChange={(e) => setForm({ ...form, client_last_name: e.target.value })}
                    autoComplete="family-name"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  value={form.client_phone}
                  onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                  autoComplete="tel"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.client_email}
                  onChange={(e) => {
                    setForm({ ...form, client_email: e.target.value });
                    setEmailError("");
                  }}
                  autoComplete="email"
                />
                {emailError && <p className="text-xs text-destructive">{emailError}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Adresse d'intervention</Label>
                <AddressAutocomplete
                  defaultValue={addressInput}
                  onSelect={(data) => {
                    setAddressData(data);
                    setAddressInput(data.address || "");
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Problem description + media */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Décrivez votre problème</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={4}
                  placeholder="Décrivez votre problème en quelques mots..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Urgence</Label>
                <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aujourdhui">Aujourd'hui</SelectItem>
                    <SelectItem value="48h">Sous 48h</SelectItem>
                    <SelectItem value="semaine">Dans la semaine</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Media upload */}
              <div className="space-y-2">
                <Label>Photos / Vidéos ({files.length}/{MAX_FILES})</Label>
                {files.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {files.map((f, i) => (
                      <div key={i} className="relative rounded-lg overflow-hidden border aspect-square bg-muted">
                        {f.type.startsWith("image") ? (
                          <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Camera className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {files.length < MAX_FILES && (
                  <>
                    <input
                      ref={galleryRef}
                      type="file"
                      accept={ALLOWED_TYPES.join(",")}
                      multiple
                      className="hidden"
                      onChange={handleFileAdd}
                    />
                    <button
                      type="button"
                      onClick={() => galleryRef.current?.click()}
                      className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-6 w-full hover:border-primary/50 transition-colors"
                    >
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Ajouter des photos ou vidéos</span>
                      <span className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP, MP4 · Max 50 Mo</span>
                    </button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: RGPD + Submit */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Confirmation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2 text-sm">
                <p><strong>Type :</strong> {selectedTrades.map(t => TRADE_TYPES.find(tt => tt.value === t)?.label).join(", ") || "—"}</p>
                <p><strong>Nom :</strong> {form.client_first_name} {form.client_last_name}</p>
                {form.client_phone && <p><strong>Tél :</strong> {form.client_phone}</p>}
                {form.client_email && <p><strong>Email :</strong> {form.client_email}</p>}
                {(addressData.address || addressInput) && <p><strong>Adresse :</strong> {addressData.address || addressInput}</p>}
                {form.description && <p><strong>Description :</strong> {form.description}</p>}
                {files.length > 0 && <p><strong>Médias :</strong> {files.length} fichier(s)</p>}
              </div>

              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <Checkbox
                  id="rgpd"
                  checked={rgpdConsent}
                  onCheckedChange={(v) => setRgpdConsent(v === true)}
                />
                <Label htmlFor="rgpd" className="text-xs leading-relaxed cursor-pointer">
                  J'accepte que mes données soient traitées par {artisanName} pour le suivi de ma demande, conformément à la{" "}
                  <a href="/politique-confidentialite" target="_blank" className="underline text-primary">politique de confidentialité</a>.
                </Label>
              </div>

              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Shield className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Vos données sont sécurisées et ne seront partagées qu'avec {artisanName}.</span>
              </div>

              {submitting && <Progress value={uploadProgress} className="h-2" />}
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} disabled={submitting} className="flex-1">
              Retour
            </Button>
          )}
          {step < 4 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canGoNext()} className="flex-1">
              Suivant
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting || !rgpdConsent} className="flex-1 gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitting ? "Envoi en cours..." : "Envoyer ma demande"}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
