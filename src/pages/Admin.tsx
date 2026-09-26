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
import { FileText, Receipt, ArrowLeft, Bell, Truck } from 'lucide-react';
import { NotificationSettingsAdmin } from '@/components/admin/NotificationSettingsAdmin';
import { DeliveryPersonnelAdmin } from '@/components/admin/DeliveryPersonnelAdmin';

const Admin = () => {
  const navigate = useNavigate();
  const { fetchProcedures, loading } = useProcedures();

  const [selectedPanel, setSelectedPanel] = useState<'dc' | 'cash' | 'quotation' | 'notifications' | 'personnel' | null>(null);
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
    <div className="min-h-screen bg-gradient-hero overflow-x-hidden flex flex-col">
      <main className="flex-grow flex flex-col w-full px-3 sm:px-6 lg:px-8 py-3 sm:py-4 overflow-x-hidden">
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
          <div className="w-full py-6 sm:py-8 flex-1 flex flex-col justify-center">
            <div className="text-center space-y-2 mb-8">
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Admin Control Panel
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
                Select an administration portal to configure procedures, product catalogs, company profiles, notifications, or delivery analytics.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-5 w-full">
              {/* Card 1: DC Admin Panel */}
              <button
                onClick={() => {
                  setSelectedPanel('dc');
                  setAdminAccessOpen(true);
                }}
                className="group p-5 rounded-2xl border-2 border-teal-500/40 bg-teal-500/5 hover:bg-teal-500/10 hover:border-teal-500 transition-all duration-200 text-left flex flex-col justify-between space-y-5 shadow-md"
              >
                <div className="w-11 h-11 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400">
                    DC System Admin
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Add new orthopaedic procedures, customize item quantities, and manage surgical instruments.
                  </p>
                </div>
              </button>

              {/* Card 2: Cash Invoice Admin Panel */}
              <button
                onClick={() => {
                  setSelectedPanel('cash');
                  setAdminAccessOpen(true);
                }}
                className="group p-5 rounded-2xl border-2 border-purple-500/40 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500 transition-all duration-200 text-left flex flex-col justify-between space-y-5 shadow-md"
              >
                <div className="w-11 h-11 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <Receipt className="w-5 h-5" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                    Cash Invoice Admin
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Upload price catalog spreadsheets, set default bank and UPI details, and manage customer directories.
                  </p>
                </div>
              </button>

              {/* Card 3: Quotation Admin & Settings Panel */}
              <button
                onClick={() => {
                  setSelectedPanel('quotation');
                  setAdminAccessOpen(true);
                }}
                className="group p-5 rounded-2xl border-2 border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500 transition-all duration-200 text-left flex flex-col justify-between space-y-5 shadow-md"
              >
                <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    Quotation Settings
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Configure official company letterhead details, authorized signatory, and quotation templates.
                  </p>
                </div>
              </button>

              {/* Card 4: Notifications & Reminders Admin */}
              <button
                onClick={() => {
                  setSelectedPanel('notifications');
                  setAdminAccessOpen(true);
                }}
                className="group p-5 rounded-2xl border-2 border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500 transition-all duration-200 text-left flex flex-col justify-between space-y-5 shadow-md"
              >
                <div className="w-11 h-11 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform font-black">
                  <Bell className="w-5 h-5 text-slate-950" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                    Notifications &amp; Reminders
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Customize payment reminder frequencies, return item cutoff thresholds, popups, and ticker bar.
                  </p>
                </div>
              </button>

              {/* Card 5: Delivery & Personnel Analytics */}
              <button
                onClick={() => {
                  setSelectedPanel('personnel');
                  setAdminAccessOpen(true);
                }}
                className="group p-5 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500 transition-all duration-200 text-left flex flex-col justify-between space-y-5 shadow-md"
              >
                <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform font-black">
                  <Truck className="w-5 h-5" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                    Delivery &amp; Personnel Analytics
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Leaderboards, item breakdowns by person, duplicate deduplication, and pending returns.
                  </p>
                </div>
              </button>
            </div>
          </div>
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
                Enter the administrator password to open the {
                  selectedPanel === 'dc'
                    ? 'DC System'
                    : selectedPanel === 'cash'
                    ? 'Cash Invoice'
                    : selectedPanel === 'quotation'
                    ? 'Quotation Settings'
                    : selectedPanel === 'notifications'
                    ? 'Notifications & Reminders'
                    : 'Delivery & Personnel Analytics'
                } Admin panel.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Label htmlFor="admin-access-password">Password</Label>
              <Input
                id="admin-access-password"
                type="password"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                data-form-type="other"
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

        {/* Panel Rendering once authorized - Full Page Width */}
        {isAdminAuthorized && selectedPanel === 'dc' && (
          <div className="w-full py-2 sm:py-4 space-y-6">
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
        )}

        {isAdminAuthorized && selectedPanel === 'cash' && (
          <div className="w-full py-2 sm:py-4">
            <CashInvoiceAdmin onBack={handleBackToChoice} />
          </div>
        )}

        {isAdminAuthorized && selectedPanel === 'quotation' && (
          <div className="w-full py-2 sm:py-4 space-y-4">
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
        )}

        {isAdminAuthorized && selectedPanel === 'notifications' && (
          <div className="w-full py-2 sm:py-4 space-y-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={handleBackToChoice} className="gap-2 h-9">
                <ArrowLeft className="w-4 h-4" /> Back to Choice
              </Button>
              <div>
                <h1 className="text-xl font-display font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  Notifications &amp; Alerts Settings
                </h1>
                <p className="text-xs text-muted-foreground">
                  Customize interval timers, return cutoff days, first login popups, and live payment ticker.
                </p>
              </div>
            </div>
            <NotificationSettingsAdmin />
          </div>
        )}

        {isAdminAuthorized && selectedPanel === 'personnel' && (
          <div className="w-full py-2 sm:py-4">
            <DeliveryPersonnelAdmin onBack={handleBackToChoice} />
          </div>
        )}
      </main>
    </div>
  );
};

export default Admin;
