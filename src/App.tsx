import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import Index from "./pages/Index";
import TodoActions from "./pages/TodoActions";
import RdvList from "./pages/RdvList";
import Auth from "./pages/Auth";
import DossierDetail from "./pages/DossierDetail";
import CreateDossier from "./pages/CreateDossier";
import Settings from "./pages/Settings";
import ClientForm from "./pages/ClientForm";
import QuoteEditor from "./pages/QuoteEditor";
import QuoteValidation from "./pages/QuoteValidation";
import InvoiceEditor from "./pages/InvoiceEditor";
import InvoiceView from "./pages/InvoiceView";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import Pricing from "./pages/Pricing";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="pb-16 md:pb-0">
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/client" element={<ClientForm />} />
              <Route path="/devis/validation" element={<QuoteValidation />} />
              <Route path="/facture/view" element={<InvoiceView />} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/a-faire" element={<ProtectedRoute><TodoActions /></ProtectedRoute>} />
              <Route path="/rdv" element={<ProtectedRoute><RdvList /></ProtectedRoute>} />
              <Route path="/dossier/:id" element={<ProtectedRoute><DossierDetail /></ProtectedRoute>} />
              <Route path="/nouveau" element={<ProtectedRoute><CreateDossier /></ProtectedRoute>} />
              <Route path="/dossier/:dossierId/devis" element={<ProtectedRoute><QuoteEditor /></ProtectedRoute>} />
              <Route path="/dossier/:id/facture/:invoiceId" element={<ProtectedRoute><InvoiceEditor /></ProtectedRoute>} />
              <Route path="/parametres" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/pricing" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <MobileBottomNav />
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
