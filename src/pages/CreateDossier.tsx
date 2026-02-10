import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { dossierSchema, defaultDossierValues, type DossierFormData } from "@/lib/dossier-schema";
import { parseEmailContent } from "@/lib/email-parser";
import { CATEGORY_LABELS, URGENCY_LABELS } from "@/lib/constants";
import { AddressAutocomplete, type AddressData } from "@/components/AddressAutocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, PenLine, Mail, Loader2 } from "lucide-react";
import { BulbizLogo } from "@/components/BulbizLogo";
import type { Database } from "@/integrations/supabase/types";

type DossierSource = Database["public"]["Enums"]["dossier_source"];
type ProblemCategory = Database["public"]["Enums"]["problem_category"];
type UrgencyLevel = Database["public"]["Enums"]["urgency_level"];

const CATEGORIES: ProblemCategory[] = ["wc", "fuite", "chauffe_eau", "evier", "douche", "autre"];
const URGENCIES: UrgencyLevel[] = ["aujourdhui", "48h", "semaine"];

export default function CreateDossier() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("manuel");
  const [emailText, setEmailText] = useState("");

  const form = useForm<DossierFormData>({
    resolver: zodResolver(dossierSchema),
    defaultValues: defaultDossierValues,
  });

  const handleAddressSelect = useCallback((data: AddressData) => {
    form.setValue("address", data.address);
    form.setValue("address_line", data.address_line || "");
    form.setValue("postal_code", data.postal_code || "");
    form.setValue("city", data.city || "");
    form.setValue("country", data.country || "");
    form.setValue("google_place_id", data.google_place_id || "");
    if (data.lat) form.setValue("lat", data.lat);
    if (data.lng) form.setValue("lng", data.lng);
  }, [form]);

  const createMutation = useMutation({
    mutationFn: async ({ data, source }: { data: DossierFormData; source: DossierSource }) => {
      // Determine if dossier has enough info or is partial
      const hasMinimalInfo = !!(data.client_first_name && data.client_phone && data.address);
      const initialStatus = hasMinimalInfo ? "nouveau" : "a_qualifier";

      const { data: dossier, error } = await supabase
        .from("dossiers")
        .insert({
          user_id: user!.id,
          client_first_name: data.client_first_name || null,
          client_last_name: data.client_last_name || null,
          client_phone: data.client_phone || null,
          client_email: data.client_email || null,
          address: data.address || null,
          address_line: data.address_line || null,
          postal_code: data.postal_code || null,
          city: data.city || null,
          country: data.country || null,
          google_place_id: data.google_place_id || null,
          lat: data.lat || null,
          lng: data.lng || null,
          category: data.category,
          urgency: data.urgency,
          description: data.description || null,
          source,
          status: initialStatus,
        })
        .select("id")
        .single();
      if (error) throw error;

      await supabase.from("historique").insert({
        dossier_id: dossier.id,
        user_id: user!.id,
        action: "created",
        details: `Dossier créé (${source === "email" ? "import email" : "création manuelle"})${!hasMinimalInfo ? " – informations partielles" : ""}`,
      });

      return dossier;
    },
    onSuccess: async (dossier) => {
      queryClient.invalidateQueries({ queryKey: ["dossiers"] });

      // Auto-generate and send client link
      const autoSend = (profile as any)?.auto_send_client_link !== false; // default true
      if (autoSend) {
        try {
          const { data, error } = await supabase.functions.invoke("send-client-link", {
            body: { dossier_id: dossier.id },
          });

          const parts: string[] = ["Dossier créé ✅"];
          if (data?.token_generated) parts.push("Lien client généré ✅");
          if (data?.email_sent) parts.push("Lien envoyé par email ✅");
          if (data?.sms_sent) parts.push("Lien envoyé par SMS ✅");
          if (data?.no_contact) parts.push("Coordonnées manquantes ⚠️");
          if (data?.email_error) parts.push("Erreur envoi email");
          if (data?.sms_error) parts.push("Erreur envoi SMS");

          toast({ title: "Dossier créé", description: parts.join(" • ") });
        } catch {
          toast({ title: "Dossier créé !", description: "Erreur lors de l'envoi automatique du lien client." });
        }
      } else {
        toast({ title: "Dossier créé !" });
      }

      navigate(`/dossier/${dossier.id}`);
    },
    onError: (e: Error) => {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: DossierFormData) => {
    const source: DossierSource = activeTab === "email" ? "email" : "manuel";
    createMutation.mutate({ data, source });
  };

  const handleParseEmail = () => {
    if (!emailText.trim()) return;
    const parsed = parseEmailContent(emailText);
    // Prefill form with parsed data
    if (parsed.client_first_name) form.setValue("client_first_name", parsed.client_first_name);
    if (parsed.client_last_name) form.setValue("client_last_name", parsed.client_last_name);
    if (parsed.client_phone) form.setValue("client_phone", parsed.client_phone);
    if (parsed.client_email) form.setValue("client_email", parsed.client_email);
    if (parsed.address) form.setValue("address", parsed.address);
    if (parsed.category) form.setValue("category", parsed.category);
    if (parsed.urgency) form.setValue("urgency", parsed.urgency);
    if (parsed.description) form.setValue("description", parsed.description);
    toast({ title: "Email analysé", description: "Les champs ont été pré-remplis. Vérifiez et complétez." });
  };

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.name.endsWith(".eml") && !file.name.endsWith(".msg") && !file.name.endsWith(".txt")) {
      toast({ title: "Format non supporté", description: "Glissez un fichier .eml, .msg ou .txt", variant: "destructive" });
      return;
    }
    const text = await file.text();
    setEmailText(text);
    const parsed = parseEmailContent(text);
    if (parsed.client_first_name) form.setValue("client_first_name", parsed.client_first_name);
    if (parsed.client_last_name) form.setValue("client_last_name", parsed.client_last_name);
    if (parsed.client_phone) form.setValue("client_phone", parsed.client_phone);
    if (parsed.client_email) form.setValue("client_email", parsed.client_email);
    if (parsed.address) form.setValue("address", parsed.address);
    if (parsed.category) form.setValue("category", parsed.category);
    if (parsed.urgency) form.setValue("urgency", parsed.urgency);
    if (parsed.description) form.setValue("description", parsed.description);
    toast({ title: "Fichier importé", description: "Les champs ont été pré-remplis." });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/95 backdrop-blur px-4 sm:px-6 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <BulbizLogo size={20} />
        <span className="font-semibold text-foreground ml-2">Nouveau dossier</span>
      </header>

      <main className="flex-1 p-4 sm:p-6 max-w-2xl mx-auto w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manuel" className="gap-2">
              <PenLine className="h-4 w-4" />
              Création manuelle
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-4 w-4" />
              Import email
            </TabsTrigger>
          </TabsList>

          {/* Email import zone */}
          <TabsContent value="email" className="space-y-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className="rounded-xl border-2 border-dashed border-border bg-muted/50 p-6 text-center space-y-3 hover:border-primary/30 transition-colors"
            >
              <Mail className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium text-foreground">
                Collez le contenu d'un email ci-dessous
              </p>
              <p className="text-xs text-muted-foreground">
                Ou glissez-déposez un fichier .eml / .msg / .txt
              </p>
            </div>
            <Textarea
              placeholder="Collez ici le contenu de l'email du client…"
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              className="min-h-[160px]"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleParseEmail}
              disabled={!emailText.trim()}
              className="w-full"
            >
              Analyser et pré-remplir le formulaire
            </Button>
          </TabsContent>

          <TabsContent value="manuel">
            {/* Empty – form is always visible below */}
          </TabsContent>

          {/* Shared form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Client section */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</h3>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="client_first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prénom <span className="text-muted-foreground font-normal">(optionnel)</span></FormLabel>
                        <FormControl>
                          <Input placeholder="Jean" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="client_last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom <span className="text-muted-foreground font-normal">(optionnel)</span></FormLabel>
                        <FormControl>
                          <Input placeholder="Dupont" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="client_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Téléphone <span className="text-muted-foreground font-normal">(optionnel)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="06 12 34 56 78" type="tel" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="client_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email <span className="text-muted-foreground font-normal">(optionnel)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="client@email.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Intervention section */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Intervention</h3>
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adresse <span className="text-muted-foreground font-normal">(optionnel)</span></FormLabel>
                      <FormControl>
                        <AddressAutocomplete
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onAddressSelect={handleAddressSelect}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Category quick select */}
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Catégorie</FormLabel>
                      <div className="flex flex-wrap gap-2">
                        {CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => field.onChange(cat)}
                            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
                              field.value === cat
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-card text-muted-foreground hover:border-primary/30"
                            }`}
                          >
                            {CATEGORY_LABELS[cat]}
                          </button>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Urgency quick select */}
                <FormField
                  control={form.control}
                  name="urgency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Urgence</FormLabel>
                      <div className="flex gap-2">
                        {URGENCIES.map((urg) => (
                          <button
                            key={urg}
                            type="button"
                            onClick={() => field.onChange(urg)}
                            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium text-center transition-all ${
                              field.value === urg
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-card text-muted-foreground hover:border-primary/30"
                            }`}
                          >
                            {URGENCY_LABELS[urg]}
                          </button>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description <span className="text-muted-foreground font-normal">(optionnel)</span></FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Décrivez le problème du client…"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Création…
                  </>
                ) : (
                  "Créer le dossier"
                )}
              </Button>
            </form>
          </Form>
        </Tabs>
      </main>
    </div>
  );
}
