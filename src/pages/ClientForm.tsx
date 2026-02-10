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
import { Camera, Upload, CheckCircle2, AlertTriangle, Loader2, X, Shield, Lock } from "lucide-react";
import { BulbizLogo } from "@/components/BulbizLogo";
import { CATEGORY_LABELS, URGENCY_LABELS } from "@/lib/constants";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"];

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
}

export default function ClientForm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [dossier, setDossier] = useState<DossierData | null>(null);
  // Editable fields (only for fields that are missing)
  const [form, setForm] = useState({
    client_first_name: "",
    client_last_name: "",
    client_phone: "",
    client_email: "",
    address: "",
    description: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [rgpdConsent, setRgpdConsent] = useState(false);

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
    } catch (e: any) {
      setError(e.message || "Lien invalide ou expiré");
    } finally {
      setLoading(false);
    }
  };

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []);
    const valid = newFiles.filter((f) => ALLOWED_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE);
    setFiles((prev) => [...prev, ...valid].slice(0, MAX_FILES));
    e.target.value = "";
  };

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  // Check which fields are missing (editable by client)
  const missingFields = dossier ? {
    client_first_name: !dossier.client_first_name,
    client_last_name: !dossier.client_last_name,
    client_phone: !dossier.client_phone,
    client_email: !dossier.client_email,
    address: !dossier.address,
    description: !dossier.description,
  } : {};

  const hasMissingInfo = Object.values(missingFields).some(Boolean);

  const handleSubmit = async () => {
    if (!rgpdConsent || !dossier) return;
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

      // Submit to edge function — only send data for missing fields
      const clientData: Record<string, string> = {};
      for (const [key, isMissing] of Object.entries(missingFields)) {
        if (isMissing && form[key as keyof typeof form]?.trim()) {
          clientData[key] = form[key as keyof typeof form].trim();
        }
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

  const totalSteps = 3;
  const progressPercent = (step / totalSteps) * 100;

  const ReadOnlyField = ({ label, value }: { label: string; value: string }) => (
    <div className="space-y-1">
      <Label className="text-muted-foreground text-xs flex items-center gap-1">
        <Lock className="h-3 w-3" /> {label}
      </Label>
      <div className="rounded-md bg-muted/50 border border-border px-3 py-2 text-sm text-foreground">{value}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur px-4 py-3">
        <div className="max-w-lg mx-auto">
          <BulbizLogo size={20} />
        </div>
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
          Bonjour{dossier?.client_first_name ? ` ${dossier.client_first_name}` : ""}, complétez les informations manquantes pour que votre artisan puisse intervenir au mieux.
        </p>

        {/* Step 1: Info — show existing read-only + fill missing */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vos informations</CardTitle>
              <CardDescription>Les champs verrouillés ont déjà été renseignés. Complétez les autres.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                {dossier?.client_first_name ? (
                  <ReadOnlyField label="Prénom" value={dossier.client_first_name} />
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs">Prénom</Label>
                    <Input placeholder="Jean" value={form.client_first_name} onChange={(e) => setForm({ ...form, client_first_name: e.target.value })} />
                  </div>
                )}
                {dossier?.client_last_name ? (
                  <ReadOnlyField label="Nom" value={dossier.client_last_name} />
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs">Nom</Label>
                    <Input placeholder="Dupont" value={form.client_last_name} onChange={(e) => setForm({ ...form, client_last_name: e.target.value })} />
                  </div>
                )}
              </div>

              {/* Phone */}
              {dossier?.client_phone ? (
                <ReadOnlyField label="Téléphone" value={dossier.client_phone} />
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Téléphone</Label>
                  <Input placeholder="06 12 34 56 78" type="tel" value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} />
                </div>
              )}

              {/* Email */}
              {dossier?.client_email ? (
                <ReadOnlyField label="Email" value={dossier.client_email} />
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input placeholder="client@email.com" type="email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} />
                </div>
              )}

              {/* Address */}
              {dossier?.address ? (
                <ReadOnlyField label="Adresse" value={dossier.address} />
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Adresse d'intervention</Label>
                  <Input placeholder="12 rue de la Paix, 75002 Paris" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
              )}

              {/* Category + urgency (read-only if set by artisan) */}
              {dossier?.category && dossier.category !== "autre" && (
                <ReadOnlyField label="Catégorie" value={CATEGORY_LABELS[dossier.category as keyof typeof CATEGORY_LABELS] || dossier.category} />
              )}
              {dossier?.urgency && dossier.urgency !== "semaine" && (
                <ReadOnlyField label="Urgence" value={URGENCY_LABELS[dossier.urgency as keyof typeof URGENCY_LABELS] || dossier.urgency} />
              )}

              {/* Description */}
              {dossier?.description ? (
                <ReadOnlyField label="Description" value={dossier.description} />
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Décrivez votre problème</Label>
                  <Textarea
                    rows={5}
                    placeholder="Ex : Fuite sous l'évier de la cuisine depuis hier soir…"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    maxLength={5000}
                  />
                  <span className="text-xs text-muted-foreground">{form.description.length}/5000</span>
                </div>
              )}

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
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Appuyez pour ajouter</span>
                  <span className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP, MP4 · Max 10 Mo</span>
                  <input type="file" accept={ALLOWED_TYPES.join(",")} multiple className="hidden" onChange={handleFileAdd} />
                </label>
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
                {hasMissingInfo && (
                  <p className="text-muted-foreground">
                    Champs complétés : {Object.entries(missingFields).filter(([, missing]) => missing && form[Object.keys(missingFields).find(k => k === Object.keys(missingFields).find(k2 => k2)) as keyof typeof form]).length > 0 ? "oui" : "aucun nouveau champ"}
                  </p>
                )}
                {form.description && !dossier?.description && (
                  <p className="text-muted-foreground line-clamp-3">Description : {form.description}</p>
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
                      Elles ne sont pas partagées avec des tiers. Vous pouvez exercer vos droits en contactant votre artisan.
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
    </div>
  );
}
