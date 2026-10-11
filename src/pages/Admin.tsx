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
import { Badge } from '@/components/ui/badge';
import { CashInvoiceAdmin } from '@/components/admin/CashInvoiceAdmin';
import Customers from '@/pages/Customers';
import { FileText, Bell, Truck, Building2, IndianRupee, Lock, ChevronRight, Database } from 'lucide-react';
import { NotificationSettingsAdmin } from '@/components/admin/NotificationSettingsAdmin';
import { DeliveryPersonnelAdmin } from '@/components/admin/DeliveryPersonnelAdmin';
import { BankAccountsAdmin } from '@/components/admin/BankAccountsAdmin';
import { downloadCompleteFirestoreBackup } from '@/services/firestoreBackupService';
import { toast } from 'sonner';

type AdminPanelType = 'dc' | 'customers' | 'cash' | 'quotation' | 'notifications' | 'personnel' | 'bank_accounts';

const Admin = () => {
  const navigate = useNavigate();
  const { fetchProcedures, loading } = useProcedures();

  const [selectedPanel, setSelectedPanel] = useState<AdminPanelType | null>(null);
  const [targetPanelToOpen, setTargetPanelToOpen] = useState<AdminPanelType | null>(null);
  const [adminAccessOpen, setAdminAccessOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [isExportingDb, setIsExportingDb] = useState(false);

  const handleDownloadBackup = async () => {
    setIsExportingDb(true);
    toast.info("Preparing full Firestore DB backup JSON download...");
    try {
      const res = await downloadCompleteFirestoreBackup();
      if (res.success) {
        toast.success(`🎉 Downloaded full Firestore DB Backup (${res.count} documents across all collections)!`);
      } else {
        toast.error("Failed to generate Firestore backup export.");
      }
    } catch (err) {
      toast.error("Backup download error");
    } finally {
      setIsExportingDb(false);
    }
  };

  const handleOpenPanelRequest = (panel: AdminPanelType) => {
    if (panel === 'customers' || isAdminAuthorized) {
      setSelectedPanel(panel);
    } else {
      setTargetPanelToOpen(panel);
      setAdminAccessOpen(true);
    }
  };

  const confirmAdminAccess = () => {
    if (adminPassword.trim() !== 'srrortho' && adminPassword.trim() !== 'admin') {
      setPasswordError('Incorrect administrator password. Please try again.');
      return;
    }
    setPasswordError('');
    setIsAdminAuthorized(true);
    if (targetPanelToOpen) {
      setSelectedPanel(targetPanelToOpen);
    }
    setAdminAccessOpen(false);
  };

  const handleBackToChoice = () => {
    setSelectedPanel(null);
  };

  const handleLockAdminSession = () => {
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

  const ADMIN_MODULES: Array<{
    id: AdminPanelType;
    title: string;
    badge: string;
    description: string;
    icon: React.ReactNode;
    iconBg: string;
  }> = [
    {
      id: 'dc',
      title: 'DC System Admin',
      badge: 'Procedures',
      description: 'Procedures, quantities, and instrument sets.',
      icon: <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />,
      iconBg: 'bg-teal-100 dark:bg-teal-950/80 border border-teal-300 dark:border-teal-800',
    },
    {
      id: 'customers',
      title: 'Customer Directory',
      badge: 'Open Access',
      description: 'Hospital profiles and clinical contacts.',
      icon: <Building2 className="w-5 h-5 text-primary" />,
      iconBg: 'bg-accent border border-primary/20',
    },
    {
      id: 'cash',
      title: 'Cash Invoice Admin',
      badge: 'Invoices',
      description: 'Price catalog and invoice defaults.',
      icon: <IndianRupee className="w-5 h-5 text-primary" />,
      iconBg: 'bg-accent border border-primary/20',
    },
    {
      id: 'quotation',
      title: 'Quotation Settings',
      badge: 'Branding',
      description: 'Company details and quotation templates.',
      icon: <FileText className="w-5 h-5 text-primary" />,
      iconBg: 'bg-accent border border-primary/20',
    },
    {
      id: 'notifications',
      title: 'Notifications & Alerts',
      badge: 'Reminders',
      description: 'Alerts, reminders, and ticker settings.',
      icon: <Bell className="w-5 h-5 text-primary" />,
      iconBg: 'bg-accent border border-primary/20',
    },
    {
      id: 'personnel',
      title: 'Delivery & Personnel',
      badge: 'Analytics',
      description: 'Delivery performance, returns, and staff.',
      icon: <Truck className="w-5 h-5 text-primary" />,
      iconBg: 'bg-accent border border-primary/20',
    },
    {
      id: 'bank_accounts',
      title: 'Bank Accounts & Treasury',
      badge: 'Treasury',
      description: 'Accounts, balances, and assignment rules.',
      icon: <Building2 className="w-5 h-5 text-primary" />,
      iconBg: 'bg-accent border border-primary/20',
    },
  ];

  const ADMIN_SECTIONS: Array<{
    title: string;
    moduleIds: AdminPanelType[];
    showBackup?: boolean;
  }> = [
    {
      title: 'Clinical & Field Operations',
      moduleIds: ['dc', 'customers', 'personnel'],
    },
    {
      title: 'Finance & Treasury',
      moduleIds: ['cash', 'quotation', 'bank_accounts'],
    },
    {
      title: 'Governance & Automation',
      moduleIds: ['notifications'],
      showBackup: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-hero overflow-x-hidden flex flex-col w-full">
      <main className="flex-grow flex flex-col w-full px-1.5 sm:px-3 lg:px-4 py-2 sm:py-2.5 overflow-x-hidden">
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

        {/* Module Switcher Bar when Authorized */}
        {isAdminAuthorized && (
          <div className="w-full mb-5 overflow-x-auto pb-1 scrollbar-none">
            <div className="flex items-center gap-1.5 min-w-max p-1.5 bg-card/90 border border-border rounded-2xl shadow-sm backdrop-blur">
              <button
                onClick={handleBackToChoice}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  !selectedPanel
                    ? 'bg-primary text-primary-foreground shadow-sm font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <span>Overview Hub</span>
              </button>
              <div className="h-4 w-px bg-border mx-1" />
              {ADMIN_MODULES.map((mod) => {
                const isActive = selectedPanel === mod.id;
                return (
                  <button
                    key={mod.id}
                    onClick={() => setSelectedPanel(mod.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-accent text-accent-foreground shadow-sm border border-primary/20 font-bold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    {mod.icon}
                    <span>{mod.title}</span>
                  </button>
                );
              })}
              <div className="h-5 w-px bg-border mx-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={handleLockAdminSession}
                className="h-8 gap-1.5 border-border text-muted-foreground hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:hover:border-rose-900 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
              >
                <Lock className="h-3.5 w-3.5" /> Lock Session
              </Button>
            </div>
          </div>
        )}

        {/* Categorized Choice Screen when no panel selected or unauthorized */}
        {(!isAdminAuthorized || !selectedPanel) && (
          <div className="w-full flex-1 space-y-6 pb-4">
            {ADMIN_SECTIONS.map((section) => {
              const modules = ADMIN_MODULES.filter((module) => section.moduleIds.includes(module.id));

              return (
                <section key={section.title} className="space-y-3">
                  <div className="flex items-center justify-between gap-3 border-b border-border pb-2.5">
                    <h2 className="text-sm font-bold tracking-tight text-foreground">{section.title}</h2>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {modules.length} {modules.length === 1 ? 'module' : 'modules'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {modules.map((module) => (
                      <button
                        key={module.id}
                        type="button"
                        onClick={() => handleOpenPanelRequest(module.id)}
                        className="group flex min-h-[148px] flex-col justify-between rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:p-5"
                      >
                        <div className="flex w-full items-center justify-between gap-3">
                          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${module.iconBg} transition-transform group-hover:scale-105`}>
                            {module.icon}
                          </span>
                          <Badge variant="secondary" className="border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {module.badge}
                          </Badge>
                        </div>
                        <div className="mt-5 flex w-full items-end justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <h3 className="text-sm font-bold text-card-foreground transition-colors group-hover:text-primary">
                              {module.title}
                            </h3>
                            <p className="text-xs leading-relaxed text-muted-foreground">{module.description}</p>
                          </div>
                          <span className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-all group-hover:border-primary/30 group-hover:bg-accent group-hover:text-primary">
                            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </div>
                      </button>
                    ))}

                    {section.showBackup && (
                      <div className="flex min-h-[148px] flex-col justify-between rounded-2xl border border-dashed border-primary/30 bg-primary/[0.035] p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-accent text-primary">
                            <Database className="h-5 w-5" />
                          </span>
                          <Badge variant="secondary" className="border-primary/15 bg-accent text-[10px] font-semibold text-accent-foreground">
                            Backup
                          </Badge>
                        </div>
                        <div className="mt-5 space-y-1">
                          <h3 className="text-sm font-bold text-card-foreground">Full Database Backup</h3>
                          <p className="text-xs text-muted-foreground">Export a JSON snapshot of all collections.</p>
                        </div>
                        <Button
                          type="button"
                          onClick={handleDownloadBackup}
                          disabled={isExportingDb}
                          size="sm"
                          className="mt-4 w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          <Database className="h-3.5 w-3.5" />
                          {isExportingDb ? 'Exporting...' : 'Export Backup'}
                        </Button>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* Password Authorization Dialog */}
        <Dialog
          open={adminAccessOpen}
          onOpenChange={(open) => {
            if (!open) {
              setTargetPanelToOpen(null);
              setAdminPassword('');
              setPasswordError('');
            }
            setAdminAccessOpen(open);
          }}
        >
          <DialogContent className="max-w-md bg-card border-border text-card-foreground rounded-2xl p-6 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2.5 text-card-foreground">
                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                Administrator Authentication
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs sm:text-sm mt-1">
                Enter the administrator password to unlock the Executive Admin Control Panel.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="admin-access-password" className="text-xs font-bold text-foreground">Admin Password</Label>
                <Input
                  id="admin-access-password"
                  type="password"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  autoFocus
                  placeholder="Enter administrator password..."
                  className="bg-background border-input text-foreground placeholder:text-muted-foreground focus:border-primary"
                  value={adminPassword}
                  onChange={(event) => {
                    setAdminPassword(event.target.value);
                    setPasswordError('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') confirmAdminAccess();
                  }}
                />
                {passwordError && <p className="text-xs font-semibold text-rose-600 mt-1">{passwordError}</p>}
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <Button
                  variant="outline"
                  className="bg-secondary hover:bg-accent border-border text-secondary-foreground rounded-xl text-xs font-semibold"
                  onClick={() => {
                    setAdminAccessOpen(false);
                    setTargetPanelToOpen(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmAdminAccess}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs shadow-xs"
                >
                  Unlock Admin Portal
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Authorized Panel Views */}
        {isAdminAuthorized && selectedPanel === 'dc' && (
          <div className="w-full py-2">
            <AddProcedureForm />
          </div>
        )}

        {selectedPanel === 'customers' && (
          <div className="w-full py-2">
            <Customers embedded />
          </div>
        )}

        {isAdminAuthorized && selectedPanel === 'cash' && (
          <div className="w-full py-2">
            <CashInvoiceAdmin />
          </div>
        )}

        {isAdminAuthorized && selectedPanel === 'quotation' && (
          <div className="w-full py-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/95 p-4 sm:p-5 rounded-2xl border border-border shadow-sm backdrop-blur-sm">
                <div className="flex items-center gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-accent border border-primary/20 text-accent-foreground flex items-center justify-center shadow-sm">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-base sm:text-lg font-bold font-sans tracking-tight text-foreground">
                      Quotation Settings &amp; Administration
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      Configure letterhead branding, company address, default quotation terms, and templates
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open("/quotation/index.html?view=settings&adminOnly=true", "_blank")}
                  className="h-9 text-xs font-semibold gap-1.5 border-border text-foreground hover:bg-muted"
                >
                  <span>Open in Full Tab ↗</span>
                </Button>
              </div>
            </div>
            
            <div className="w-full bg-card rounded-2xl border border-border shadow-sm overflow-hidden relative min-h-[700px] h-[calc(100vh-180px)]">
              <iframe
                src="/quotation/index.html?view=settings&adminOnly=true"
                title="Quotation Settings"
                className="absolute inset-0 w-full h-full border-0"
              />
            </div>
          </div>
        )}

        {isAdminAuthorized && selectedPanel === 'notifications' && (
          <div className="w-full py-2">
            <NotificationSettingsAdmin />
          </div>
        )}

        {isAdminAuthorized && selectedPanel === 'personnel' && (
          <div className="w-full py-2">
            <DeliveryPersonnelAdmin />
          </div>
        )}

        {isAdminAuthorized && selectedPanel === 'bank_accounts' && (
          <div className="w-full py-2">
            <BankAccountsAdmin />
          </div>
        )}
      </main>
    </div>
  );
};

export default Admin;
