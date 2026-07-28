import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopToolbar } from "@/components/ortho/TopToolbar";
import { auth } from "@/firebase";

export default function Quotation() {
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
      <main className="flex-grow flex flex-col px-4 sm:px-6 lg:px-8 py-4 sm:py-6 overflow-x-hidden">
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
        
        {/* Floating Quotation card aligned with the main toolbar */}
        <div className="mt-0 flex-1 w-full bg-card rounded-xl border border-border shadow-md overflow-hidden relative min-h-[700px] h-[calc(100vh-115px)]">
          <iframe
            src="/quotation/index.html"
            title="Quotation Maker"
            className="absolute inset-0 w-full h-full border-0"
          />
        </div>
      </main>
    </div>
  );
}
