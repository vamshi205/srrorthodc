import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import SavedDcs from "./pages/SavedDcs";
import ImageDatabase from "./pages/ImageDatabase";
import CashInvoice from "./pages/CashInvoice";
import Quotation from "./pages/Quotation";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-hero">
        <div className="relative flex items-center justify-center mb-6">
          <div className="absolute w-20 h-20 rounded-full bg-gradient-to-tr from-teal-500 via-emerald-400 to-cyan-500 blur-md opacity-45 animate-pulse"></div>
          <div className="w-16 h-16 rounded-full border-3 border-transparent border-t-teal-600 border-r-emerald-500 animate-spin"></div>
          <div className="absolute w-10 h-10 rounded-full border-3 border-transparent border-b-cyan-500 border-l-teal-400 animate-[spin_1.2s_linear_infinite_reverse]"></div>
          <div className="absolute w-3 h-3 bg-teal-600 rounded-full shadow-xs animate-ping"></div>
        </div>
        <h3 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
          <span>Loading SRR Ortho Plus...</span>
        </h3>
      </div>
    );
  }
  
  if (!user) return <Navigate to="/login" replace />;
  
  return <>{children}</>;
};

const App = () => {
  useEffect(() => {
    localStorage.setItem("srrortho:theme", "light");
    document.documentElement.classList.remove("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="/saved" element={<ProtectedRoute><SavedDcs /></ProtectedRoute>} />
              <Route path="/images" element={<ProtectedRoute><ImageDatabase /></ProtectedRoute>} />
              <Route path="/cash-invoice" element={<ProtectedRoute><CashInvoice /></ProtectedRoute>} />
              <Route path="/quotation" element={<ProtectedRoute><Quotation /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
