import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, Share2, Link2, Loader2, MessageSquare } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

function generateSlug(firstName: string, lastName: string): string {
  const raw = `${firstName} ${lastName}`
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return raw || "mon-lien";
}

export function PublicLinkCard() {
  const { profile, update } = useProfile();
  const [slug, setSlug] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.public_client_slug) {
      setSlug(profile.public_client_slug);
    } else if (profile) {
      setSlug(generateSlug(profile.first_name || "", profile.last_name || ""));
    }
  }, [profile]);

  const publicUrl = `https://app.bulbiz.io/${slug}`;

  const clientMessage = `Bonjour,

Afin d'intervenir rapidement, merci de cliquer sur ce lien et de remplir les informations nécessaires.

Si possible, vous pouvez également ajouter des photos ou une vidéo du problème (facultatif).

Je regarderai votre demande et je vous recontacterai rapidement.

${publicUrl}`;

  async function handleSave() {
    if (!slug.trim()) return;
    const cleanSlug = slug
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-|-$/g, "");
    if (!cleanSlug) return;

    setSaving(true);
    try {
      await update.mutateAsync({ public_client_slug: cleanSlug } as any);
      setSlug(cleanSlug);
      toast.success("Lien public sauvegardé");
    } catch (err: any) {
      if (err?.message?.includes("duplicate") || err?.message?.includes("unique")) {
        toast.error("Ce lien est déjà pris, choisissez-en un autre");
      } else {
        toast.error("Erreur lors de la sauvegarde");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Lien copié !");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCopyMessage() {
    navigator.clipboard.writeText(clientMessage);
    setCopiedMessage(true);
    toast.success("Message copié !");
    setTimeout(() => setCopiedMessage(false), 2000);
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({
        title: "Envoyez-moi vos photos et infos",
        text: clientMessage,
      }).catch(() => {});
    } else {
      handleCopyMessage();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Votre lien client Bulbiz
        </CardTitle>
        <CardDescription>
          Quand un client vous appelle, copiez le message ci-dessous et envoyez-le lui par SMS ou WhatsApp.
          Le client remplira les informations nécessaires (photo, description, adresse…).
          Sa demande sera automatiquement créée dans votre application Bulbiz sous forme de dossier.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="slug">Votre lien personnalisé</Label>
          <div className="flex gap-2">
            <div className="flex items-center bg-muted rounded-l-md px-3 text-sm text-muted-foreground border border-r-0">
              app.bulbiz.io/
            </div>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              className="rounded-l-none"
              placeholder="votre-nom"
            />
          </div>
        </div>

        {slug !== profile?.public_client_slug && (
          <Button onClick={handleSave} disabled={saving || !slug.trim()} size="sm" className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Sauvegarde..." : "Sauvegarder le lien"}
          </Button>
        )}

        {profile?.public_client_slug && (
          <>
            {/* Lien */}
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <span className="text-sm font-mono truncate flex-1">{publicUrl}</span>
              <Button variant="ghost" size="icon" onClick={handleCopy} className="flex-shrink-0">
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            {/* Message prêt à envoyer */}
            <div className="space-y-2">
              <Label>Message prêt à envoyer</Label>
              <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-line text-foreground">
                {clientMessage}
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={handleCopy} className="flex-1 gap-2">
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                {copied ? "Lien copié" : "Copier le lien"}
              </Button>
              <Button variant="outline" onClick={handleCopyMessage} className="flex-1 gap-2">
                {copiedMessage ? <Check className="h-4 w-4 text-primary" /> : <MessageSquare className="h-4 w-4" />}
                {copiedMessage ? "Message copié" : "Copier le message"}
              </Button>
              <Button variant="outline" onClick={handleShare} className="flex-1 gap-2">
                <Share2 className="h-4 w-4" />
                Partager
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              💡 Envoyez toujours le même message : copiez-le et collez-le dans SMS ou WhatsApp quand un client vous appelle.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
