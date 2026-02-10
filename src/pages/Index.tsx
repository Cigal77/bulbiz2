import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, Zap } from "lucide-react";

const Index = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold text-foreground">Bulbiz</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Dashboard placeholder */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Zap className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Bienvenue sur Bulbiz</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Votre espace de centralisation des demandes clients est prêt.
            Le dashboard arrive dans la prochaine phase.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Index;
