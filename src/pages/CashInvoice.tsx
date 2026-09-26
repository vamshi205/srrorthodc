import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopToolbar } from "@/components/ortho/TopToolbar";
import { auth } from "@/firebase";
import { NativeCashInvoice } from "@/components/cash-invoice/NativeCashInvoice";

export default function CashInvoice() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('srrortho:theme') as 'light' | 'dark') || 'light';
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('srrortho:theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("srrortho:auth");
    localStorage.removeItem('srrortho:procedures_cache');
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero overflow-x-hidden flex flex-col">
      <main className="flex-grow flex flex-col px-3 sm:px-6 lg:px-8 py-3 sm:py-4 overflow-x-hidden">
        <TopToolbar
          theme={theme}
          toggleTheme={toggleTheme}
          fetchProcedures={() => {}}
          loading={false}
          handlePrint={() => {}}
          navigate={navigate}
          handleLogout={handleLogout}
          setDcMode={(mode) => navigate(`/?mode=${mode}`)}
          setInitialFilterType={() => {}}
          setShowProcedureSelector={() => {}}
          setActiveProcedures={() => {}}
          setCollapsedProcedures={() => {}}
        />

        {/* Native Cash Invoice Suite Container */}
        <div className="mt-3 flex-1 w-full min-h-[calc(100vh-100px)]">
          <NativeCashInvoice />
        </div>
      </main>
    </div>
  );
}
