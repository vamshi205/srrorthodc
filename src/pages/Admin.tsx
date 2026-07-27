import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddProcedureForm } from '@/components/admin/AddProcedureForm';
import { TopToolbar } from '@/components/ortho/TopToolbar';
import { useProcedures } from '@/hooks/useProcedures';
import { auth } from '@/firebase';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CashInvoiceAdmin } from '@/components/admin/CashInvoiceAdmin';
import { FileText, Receipt, ArrowLeft } from 'lucide-react';

const Admin = () => {
  const navigate = useNavigate();
  const { fetchProcedures, loading } = useProcedures();

  const [selectedPanel, setSelectedPanel] = useState<'dc' | 'cash' | 'quotation' | null>(null);
  const [adminAccessOpen, setAdminAccessOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);

  const confirmAdminAccess = () => {
    if (adminPassword.trim() !== 'srrortho') {
      setPasswordError('Incorrect password. Please try again.');
      return;
    }
    setPasswordError('');
    setIsAdminAuthorized(true);
    setAdminAccessOpen(false);
  };

  const handleBackToChoice = () => {
    setIsAdminAuthorized(false);
    setSelectedPanel(null);
    setAdminPassword('');
  };

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

        {/* Choice Screen when not authorized */}
        {!isAdminAuthorized && (
          <main className="container mx-auto max-w-5xl py-12">
            <div className="text-center space-y-3 mb-10">
              <h1 className="text-3xl font-display font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Admin Control Panel
              </h1>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Select an administration portal to configure procedures, product catalogs, default company profiles, or cloud sync back-ends.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Card 1: DC Admin Panel */}
              <button
                onClick={() => {
                  setSelectedPanel('dc');
                  setAdminAccessOpen(true);
                }}
                className="group p-6 rounded-2xl border-2 border-teal-500/40 bg-teal-500/5 hover:bg-teal-500/10 hover:border-teal-500 transition-all duration-200 text-left flex flex-col justify-between space-y-6 shadow-md"
              >
                <div className="w-12 h-12 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400">
                    DC System Admin
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Add new orthopaedic procedures, customize item quantities, and manage the list of surgical instruments.
                  </p>
                </div>
              </button>

              {/* Card 2: Cash Invoice Admin Panel */}
              <button
                onClick={() => {
                  setSelectedPanel('cash');
                  setAdminAccessOpen(true);
                }}
                className="group p-6 rounded-2xl border-2 border-purple-500/40 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500 transition-all duration-200 text-left flex flex-col justify-between space-y-6 shadow-md"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <Receipt className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                    Cash Invoice Admin
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Upload price catalog spreadsheets, set default bank and UPI details, manage invoice templates, and configure cloud backups.
                  </p>
                </div>
              </button>

              {/* Card 3: Quotation Admin & Settings Panel */}
              <button
                onClick={() => {
                  setSelectedPanel('quotation');
                  setAdminAccessOpen(true);
                }}
                className="group p-6 rounded-2xl border-2 border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500 transition-all duration-200 text-left flex flex-col justify-between space-y-6 shadow-md"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    Quotation Settings
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Configure official company letterhead details, authorized signatory, default terms &amp; conditions, and quotation templates.
                  </p>
                </div>
              </button>
            </div>
          </main>
        )}

        {/* Password Authorization Dialog */}
        <Dialog
          open={adminAccessOpen}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedPanel(null);
              setAdminPassword('');
              setPasswordError('');
            }
            setAdminAccessOpen(open);
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Admin Access</DialogTitle>
              <DialogDescription>
                Enter the administrator password to open the {selectedPanel === 'dc' ? 'DC System' : selectedPanel === 'cash' ? 'Cash Invoice' : 'Quotation Settings'} Admin panel.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Label htmlFor="admin-access-password">Password</Label>
              <Input
                id="admin-access-password"
                type="password"
                autoFocus
                value={adminPassword}
                onChange={(event) => {
                  setAdminPassword(event.target.value);
                  setPasswordError('');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') confirmAdminAccess();
                }}
              />
              {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => { setAdminAccessOpen(false); setSelectedPanel(null); }}>Cancel</Button>
                <Button onClick={confirmAdminAccess}>Enter Admin Panel</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Panel Rendering once authorized */}
        {isAdminAuthorized && selectedPanel === 'dc' && (
          <main className="container mx-auto max-w-4xl py-4 sm:py-6">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={handleBackToChoice} className="gap-2 h-9">
                  <ArrowLeft className="w-4 h-4" /> Back to Choice
                </Button>
                <div>
                  <h1 className="text-xl font-display font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                    DC System Management
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Create new surgical procedures and customize their default item contents.
                  </p>
                </div>
              </div>
              <AddProcedureForm />
            </div>
          </main>
        )}

        {isAdminAuthorized && selectedPanel === 'cash' && (
          <CashInvoiceAdmin onBack={handleBackToChoice} />
        )}

        {isAdminAuthorized && selectedPanel === 'quotation' && (
          <main className="container mx-auto max-w-6xl py-4 sm:py-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" onClick={handleBackToChoice} className="gap-2 h-9">
                    <ArrowLeft className="w-4 h-4" /> Back to Choice
                  </Button>
                  <div>
                    <h1 className="text-xl font-display font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                      Quotation Settings &amp; Administration
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      Configure letterhead branding, company address, default quotation terms, and templates.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="w-full bg-card rounded-xl border border-border shadow-md overflow-hidden relative min-h-[700px] h-[calc(100vh-180px)]">
                <iframe
                  src="/quotation/index.html?view=settings&adminOnly=true"
                  title="Quotation Settings"
                  className="absolute inset-0 w-full h-full border-0"
                />
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  );
};

export default Admin;
