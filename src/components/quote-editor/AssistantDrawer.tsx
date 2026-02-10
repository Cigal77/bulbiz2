import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wrench, Package } from "lucide-react";
import { ProblemTreePanel } from "./ProblemTreePanel";
import { MaterialPickerPanel } from "./MaterialPickerPanel";
import type { QuoteItem } from "@/lib/quote-types";

interface AssistantDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddItem: (item: Omit<QuoteItem, "id">) => void;
  onSetLabourContext: (tags: string[], problemLabel: string) => void;
}

export function AssistantDrawer({ open, onOpenChange, onAddItem, onSetLabourContext }: AssistantDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[420px] p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-base">Assistant devis</SheetTitle>
        </SheetHeader>
        <Tabs defaultValue="problems" className="flex-1 flex flex-col px-4 pb-4">
          <TabsList className="w-full grid grid-cols-2 h-9 mb-3">
            <TabsTrigger value="problems" className="gap-1.5 text-xs">
              <Wrench className="h-3.5 w-3.5" />
              Problèmes
            </TabsTrigger>
            <TabsTrigger value="material" className="gap-1.5 text-xs">
              <Package className="h-3.5 w-3.5" />
              Matériel
            </TabsTrigger>
          </TabsList>
          <TabsContent value="problems" className="flex-1 mt-0">
            <ProblemTreePanel onAddItem={onAddItem} onSetLabourContext={onSetLabourContext} />
          </TabsContent>
          <TabsContent value="material" className="flex-1 mt-0">
            <MaterialPickerPanel onAddItem={onAddItem} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
