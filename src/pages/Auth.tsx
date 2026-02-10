import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Mail, Lock, ArrowRight, Zap } from "lucide-react";

type AuthMode = "login" | "signup" | "magic";

export default function Auth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { first_name: firstName, last_name: lastName },
          },
        });
        if (error) throw error;
        toast({
          title: "Inscription réussie",
          description: "Vérifiez votre email pour confirmer votre compte.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      toast({
        title: "Lien envoyé",
        description: "Vérifiez votre boîte mail pour vous connecter.",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-primary p-12">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="h-8 w-8 text-primary-foreground" />
            <span className="text-2xl font-bold text-primary-foreground">Bulbiz</span>
          </div>
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-primary-foreground leading-tight text-balance">
            Toutes vos demandes clients, au même endroit.
          </h1>
          <p className="text-lg text-primary-foreground/80">
            Ne perdez plus aucune demande. Centralisez, suivez et relancez en quelques clics.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/60">
          © 2026 Bulbiz. Conçu pour les artisans du BTP.
        </p>
      </div>

      {/* Right panel - form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden flex items-center gap-2 justify-center mb-4">
            <Zap className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold text-foreground">Bulbiz</span>
          </div>

          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-foreground">
              {mode === "signup" ? "Créer un compte" : mode === "magic" ? "Connexion par lien" : "Se connecter"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === "signup"
                ? "Commencez à centraliser vos demandes"
                : mode === "magic"
                ? "Recevez un lien de connexion par email"
                : "Accédez à vos dossiers"}
            </p>
          </div>

          {mode === "magic" ? (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="magic-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="magic-email"
                    type="email"
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Envoi..." : "Envoyer le lien"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          ) : (
            <form onSubmit={handleEmailPassword} className="space-y-4">
              {mode === "signup" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Prénom</Label>
                    <Input
                      id="firstName"
                      placeholder="Jean"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nom</Label>
                    <Input
                      id="lastName"
                      placeholder="Dupont"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Chargement..." : mode === "signup" ? "Créer mon compte" : "Se connecter"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          )}

          <div className="space-y-3 pt-2">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            {mode !== "magic" && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setMode("magic")}
                type="button"
              >
                <Mail className="mr-2 h-4 w-4" />
                Connexion sans mot de passe
              </Button>
            )}

            <p className="text-center text-sm text-muted-foreground">
              {mode === "signup" ? (
                <>
                  Déjà un compte ?{" "}
                  <button onClick={() => setMode("login")} className="text-primary hover:underline font-medium">
                    Se connecter
                  </button>
                </>
              ) : (
                <>
                  Pas encore de compte ?{" "}
                  <button onClick={() => setMode("signup")} className="text-primary hover:underline font-medium">
                    S'inscrire
                  </button>
                </>
              )}
              {mode === "magic" && (
                <>
                  {" · "}
                  <button onClick={() => setMode("login")} className="text-primary hover:underline font-medium">
                    Connexion classique
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
