import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Wrench, Package, Lightbulb, PackageOpen } from "lucide-react";
import { ProblemTreePanel } from "./ProblemTreePanel";
import { MaterialPickerPanel } from "./MaterialPickerPanel";
import { BundleSuggestionPanel } from "./BundleSuggestionPanel";
import type { QuoteItem } from "@/lib/quote-types";
import { useIsMobile } from "@/hooks/use-mobile";

interface AssistantSidebarProps {
  onAddItem: (item: Omit<QuoteItem, "id">) => void;
  onAddItems: (items: Omit<QuoteItem, "id">[]) => void;
  onSetLabourContext: (tags: string[], problemLabel: string) => void;
  dossierCategory?: string;
  dossierDescription?: string;
}

function AssistantContent({ onAddItem, onAddItems, onSetLabourContext, dossierCategory, dossierDescription }: AssistantSidebarProps) {
  return (
    <Tabs defaultValue="packs" className="flex-1 flex flex-col">
      <TabsList className="w-full grid grid-cols-3 h-10 mb-3 mx-0">
        <TabsTrigger value="packs" className="gap-1 text-xs font-semibold">
          <PackageOpen className="h-3.5 w-3.5" />
          Packs
        </TabsTrigger>
        <TabsTrigger value="problems" className="gap-1 text-xs font-semibold">
          <Wrench className="h-3.5 w-3.5" />
          Gestes
        </TabsTrigger>
        <TabsTrigger value="material" className="gap-1 text-xs font-semibold">
          <Package className="h-3.5 w-3.5" />
          Matériel
        </TabsTrigger>
      </TabsList>
      <TabsContent value="packs" className="flex-1 mt-0 overflow-hidden">
        <BundleSuggestionPanel
          dossierCategory={dossierCategory}
          dossierDescription={dossierDescription}
          onAddItems={onAddItems}
          onAddItem={onAddItem}
        />
      </TabsContent>
      <TabsContent value="problems" className="flex-1 mt-0 overflow-hidden">
        <ProblemTreePanel onAddItem={onAddItem} onAddItems={onAddItems} onSetLabourContext={onSetLabourContext} />
      </TabsContent>
      <TabsContent value="material" className="flex-1 mt-0 overflow-hidden">
        <MaterialPickerPanel onAddItem={onAddItem} />
      </TabsContent>
    </Tabs>
  );
}

export function AssistantSidebar(props: AssistantSidebarProps) {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        <Button
          className="fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full shadow-lg gap-0"
          size="icon"
          onClick={() => setDrawerOpen(true)}
        >
          <Lightbulb className="h-5 w-5" />
        </Button>

        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="bottom" className="h-[90vh] p-0 flex flex-col rounded-t-xl">
            <SheetHeader className="px-4 pt-4 pb-2">
              <SheetTitle className="text-sm font-bold">Assistant devis</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-hidden px-4 pb-4">
              <AssistantContent {...props} />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <aside className="w-[380px] shrink-0 border-r bg-card/50 flex flex-col sticky top-[88px] h-[calc(100vh-88px)] overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-center gap-2 border-b">
        <Lightbulb className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">Assistant devis</h2>
      </div>
      <div className="flex-1 overflow-hidden px-4 pt-3 pb-4">
        <AssistantContent {...props} />
      </div>
    </aside>
  );
}
