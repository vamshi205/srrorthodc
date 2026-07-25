import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddProcedureForm } from '@/components/admin/AddProcedureForm';
import { TopToolbar } from '@/components/ortho/TopToolbar';
import { useProcedures } from '@/hooks/useProcedures';
import { auth } from '@/firebase';

const Admin = () => {
  const navigate = useNavigate();
  const { fetchProcedures, loading } = useProcedures();

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('srrortho:theme') as 'light' | 'dark') || 'dark';
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
    <div className="min-h-screen bg-gradient-hero overflow-x-hidden">
      <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <TopToolbar
          theme={theme}
          toggleTheme={toggleTheme}
          fetchProcedures={fetchProcedures}
          loading={loading}
          handlePrint={() => {}}
          navigate={navigate}
          handleLogout={handleLogout}
          setDcMode={(mode) => navigate(`/?mode=${mode}`)}
          setInitialFilterType={() => {}}
          setShowProcedureSelector={() => {}}
          setActiveProcedures={() => {}}
          setCollapsedProcedures={() => {}}
        />

        {/* Main Content */}
        <main className="container mx-auto py-4 sm:py-6 max-w-4xl">
          <div className="space-y-6">
            {/* Add Procedure Form */}
            <AddProcedureForm />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Admin;

