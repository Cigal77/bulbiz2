import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save } from "lucide-react";
import { BulbizLogo } from "@/components/BulbizLogo";
import { toast } from "sonner";

interface SettingsForm {
  first_name: string;
  last_name: string;
  company_name: string;
  phone: string;
  email: string;
  siret: string;
  address: string;
  default_vat_rate: number;
  default_validity_days: number;
  auto_relance_enabled: boolean;
  relance_delay_info: number;
  relance_delay_devis_1: number;
  relance_delay_devis_2: number;
  email_signature: string;
  auto_send_client_link: boolean;
  client_link_validity_days: number;
  sms_enabled: boolean;
}

export default function Settings() {
  const navigate = useNavigate();
  const { profile, isLoading, update } = useProfile();

  const { register, handleSubmit, reset, watch, setValue } = useForm<SettingsForm>();

  const autoRelance = watch("auto_relance_enabled");
  const autoSendLink = watch("auto_send_client_link");
  const smsEnabled = watch("sms_enabled");


  useEffect(() => {
    if (profile) {
      reset({
        first_name: profile.first_name ?? "",
        last_name: profile.last_name ?? "",
        company_name: profile.company_name ?? "",
        phone: profile.phone ?? "",
        email: profile.email ?? "",
        siret: profile.siret ?? "",
        address: profile.address ?? "",
        default_vat_rate: profile.default_vat_rate ?? 10,
        default_validity_days: profile.default_validity_days ?? 30,
        auto_relance_enabled: profile.auto_relance_enabled,
        relance_delay_info: profile.relance_delay_info,
        relance_delay_devis_1: profile.relance_delay_devis_1,
        relance_delay_devis_2: profile.relance_delay_devis_2,
        email_signature: profile.email_signature ?? "",
        auto_send_client_link: (profile as any).auto_send_client_link ?? true,
        client_link_validity_days: (profile as any).client_link_validity_days ?? 7,
        sms_enabled: (profile as any).sms_enabled ?? true,
      });
    }
  }, [profile, reset]);

  const onSubmit = async (data: SettingsForm) => {
    try {
      await update.mutateAsync({
        first_name: data.first_name || null,
        last_name: data.last_name || null,
        company_name: data.company_name || null,
        phone: data.phone || null,
        email: data.email || null,
        siret: data.siret || null,
        address: data.address || null,
        default_vat_rate: data.default_vat_rate,
        default_validity_days: data.default_validity_days,
        auto_relance_enabled: data.auto_relance_enabled,
        relance_delay_info: data.relance_delay_info,
        relance_delay_devis_1: data.relance_delay_devis_1,
        relance_delay_devis_2: data.relance_delay_devis_2,
        email_signature: data.email_signature || null,
        auto_send_client_link: data.auto_send_client_link,
        client_link_validity_days: data.client_link_validity_days,
        sms_enabled: data.sms_enabled,
      });
      toast.success("Paramètres sauvegardés");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 backdrop-blur px-4 sm:px-6 py-3">
        <BulbizLogo />
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
      </header>

      <main className="p-4 sm:p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">Paramètres</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Profil */}
          <Card>
            <CardHeader>
              <CardTitle>Profil artisan</CardTitle>
              <CardDescription>Vos coordonnées professionnelles</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Prénom</Label>
                <Input id="first_name" {...register("first_name")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Nom</Label>
                <Input id="last_name" {...register("last_name")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Entreprise</Label>
                <Input id="company_name" {...register("company_name")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" {...register("phone")} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="email">Email professionnel</Label>
                <Input id="email" type="email" {...register("email")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="siret">SIRET</Label>
                <Input id="siret" {...register("siret")} placeholder="123 456 789 00012" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input id="address" {...register("address")} placeholder="12 rue des Artisans, 75001 Paris" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_vat_rate">TVA par défaut (%)</Label>
                <Input id="default_vat_rate" type="number" step="0.1" {...register("default_vat_rate", { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_validity_days">Validité devis (jours)</Label>
                <Input id="default_validity_days" type="number" min={1} {...register("default_validity_days", { valueAsNumber: true })} />
              </div>
            </CardContent>
          </Card>

          {/* Client link settings */}
          <Card>
            <CardHeader>
              <CardTitle>Lien client</CardTitle>
              <CardDescription>Envoi automatique du lien de collecte d'informations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Envoi auto à la création du dossier</Label>
                  <p className="text-sm text-muted-foreground">Envoyer automatiquement le lien client par email</p>
                </div>
                <Switch
                  checked={autoSendLink}
                  onCheckedChange={(v) => setValue("auto_send_client_link", v)}
                />
              </div>
              <div className="space-y-2 max-w-[200px]">
                <Label htmlFor="client_link_validity_days">Durée de validité du lien (jours)</Label>
                <Input
                  id="client_link_validity_days"
                  type="number"
                  min={1}
                  max={90}
                  {...register("client_link_validity_days", { valueAsNumber: true })}
                />
              </div>
            </CardContent>
          </Card>

          {/* SMS */}
          <Card>
            <CardHeader>
              <CardTitle>SMS</CardTitle>
              <CardDescription>Envoi de SMS au client en complément des emails</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Envoyer aussi par SMS</Label>
                  <p className="text-sm text-muted-foreground">Quand un numéro de téléphone client est disponible</p>
                </div>
                <Switch
                  checked={smsEnabled}
                  onCheckedChange={(v) => setValue("sms_enabled", v)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                💡 Pour activer l'envoi réel de SMS, configurez les clés Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER) dans les secrets du projet.
              </p>
            </CardContent>
          </Card>

          {/* Relances */}
          <Card>
            <CardHeader>
              <CardTitle>Relances automatiques</CardTitle>
              <CardDescription>Configurez les délais et l'activation des relances email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Activer les relances auto</Label>
                  <p className="text-sm text-muted-foreground">Envoi automatique des rappels par email</p>
                </div>
                <Switch
                  checked={autoRelance}
                  onCheckedChange={(v) => setValue("auto_relance_enabled", v)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="relance_delay_info">Délai info manquante (jours)</Label>
                  <Input
                    id="relance_delay_info"
                    type="number"
                    min={1}
                    {...register("relance_delay_info", { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="relance_delay_devis_1">1ère relance devis (jours)</Label>
                  <Input
                    id="relance_delay_devis_1"
                    type="number"
                    min={1}
                    {...register("relance_delay_devis_1", { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="relance_delay_devis_2">2ème relance devis (jours)</Label>
                  <Input
                    id="relance_delay_devis_2"
                    type="number"
                    min={1}
                    {...register("relance_delay_devis_2", { valueAsNumber: true })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Signature email */}
          <Card>
            <CardHeader>
              <CardTitle>Signature email</CardTitle>
              <CardDescription>Texte ajouté en bas de chaque email de relance</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={4}
                placeholder="Cordialement,&#10;Votre entreprise&#10;01 23 45 67 89"
                {...register("email_signature")}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={update.isPending} className="gap-2">
              <Save className="h-4 w-4" />
              {update.isPending ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
