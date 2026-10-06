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
import { FileText, ArrowLeft, Bell, Truck, Building2, IndianRupee, ShieldCheck, Lock, Sparkles, ChevronRight, Settings } from 'lucide-react';
import { NotificationSettingsAdmin } from '@/components/admin/NotificationSettingsAdmin';
import { DeliveryPersonnelAdmin } from '@/components/admin/DeliveryPersonnelAdmin';

type AdminPanelType = 'dc' | 'customers' | 'cash' | 'quotation' | 'notifications' | 'personnel';

const Admin = () => {
  const navigate = useNavigate();
  const { fetchProcedures, loading } = useProcedures();

  const [selectedPanel, setSelectedPanel] = useState<AdminPanelType | null>(null);
  const [targetPanelToOpen, setTargetPanelToOpen] = useState<AdminPanelType | null>(null);
  const [adminAccessOpen, setAdminAccessOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);

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
    cardBorder: string;
    cardBg: string;
    cardHover: string;
    iconBg: string;
    iconColor: string;
  }> = [
    {
      id: 'dc',
      title: 'DC System Admin',
      badge: 'Procedures',
      description: 'Add new orthopaedic procedures, customize default item quantities, and manage surgical instrument sets.',
      icon: <FileText className="w-5 h-5 text-teal-300" />,
      cardBorder: 'border-teal-500/40',
      cardBg: 'bg-teal-950/20 dark:bg-teal-950/30',
      cardHover: 'hover:border-teal-400 hover:shadow-teal-900/30',
      iconBg: 'bg-teal-600',
      iconColor: 'text-teal-400',
    },
    {
      id: 'customers',
      title: 'Customer Directory',
      badge: 'Open Access',
      description: 'Maintain hospital profiles, OT contact numbers, surgeon personal lines, and auto-deduplicate records.',
      icon: <Building2 className="w-5 h-5 text-emerald-300" />,
      cardBorder: 'border-emerald-500/40',
      cardBg: 'bg-emerald-950/20 dark:bg-emerald-950/30',
      cardHover: 'hover:border-emerald-400 hover:shadow-emerald-900/30',
      iconBg: 'bg-emerald-600',
      iconColor: 'text-emerald-400',
    },
    {
      id: 'cash',
      title: 'Cash Invoice Admin',
      badge: 'Invoices',
      description: 'Upload price catalog spreadsheets, set default bank and UPI details, and manage payment rules.',
      icon: <IndianRupee className="w-5 h-5 text-purple-300" />,
      cardBorder: 'border-purple-500/40',
      cardBg: 'bg-purple-950/20 dark:bg-purple-950/30',
      cardHover: 'hover:border-purple-400 hover:shadow-purple-900/30',
      iconBg: 'bg-purple-600',
      iconColor: 'text-purple-400',
    },
    {
      id: 'quotation',
      title: 'Quotation Settings',
      badge: 'Branding',
      description: 'Configure official letterhead details, company address, authorized signatory, and quotation templates.',
      icon: <FileText className="w-5 h-5 text-blue-300" />,
      cardBorder: 'border-blue-500/40',
      cardBg: 'bg-blue-950/20 dark:bg-blue-950/30',
      cardHover: 'hover:border-blue-400 hover:shadow-blue-900/30',
      iconBg: 'bg-blue-600',
      iconColor: 'text-blue-400',
    },
    {
      id: 'notifications',
      title: 'Notifications & Alerts',
      badge: 'Reminders',
      description: 'Customize payment reminder frequencies, return item cutoff thresholds, login popups, and live ticker bar.',
      icon: <Bell className="w-5 h-5 text-amber-300" />,
      cardBorder: 'border-amber-500/40',
      cardBg: 'bg-amber-950/20 dark:bg-amber-950/30',
      cardHover: 'hover:border-amber-400 hover:shadow-amber-900/30',
      iconBg: 'bg-amber-500 text-slate-950',
      iconColor: 'text-amber-400',
    },
    {
      id: 'personnel',
      title: 'Delivery & Personnel',
      badge: 'Analytics',
      description: 'View delivery leaderboards, item breakdowns per staff member, duplicate cleanup, and pending returns.',
      icon: <Truck className="w-5 h-5 text-sky-300" />,
      cardBorder: 'border-sky-500/40',
      cardBg: 'bg-sky-950/20 dark:bg-sky-950/30',
      cardHover: 'hover:border-sky-400 hover:shadow-sky-900/30',
      iconBg: 'bg-sky-600',
      iconColor: 'text-sky-400',
    },
  ];

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

        {/* Executive Admin Header Banner */}
        <div className="w-full mb-6 bg-slate-900/90 dark:bg-slate-950/95 border border-slate-800 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-700 text-white flex items-center justify-center shadow-lg border border-white/20 shrink-0">
              <Settings className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black font-sans tracking-tight text-white">
                  Executive Admin Portal
                </h1>
                {isAdminAuthorized ? (
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold px-2.5 py-0.5 text-xs flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Session Authorized
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold px-2.5 py-0.5 text-xs flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Protected
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Configure procedures, product catalogs, customer directories, company letterhead, reminders, and delivery logistics.
              </p>
            </div>
          </div>

          {isAdminAuthorized && (
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToChoice}
                className="h-9 text-xs font-bold gap-1.5 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
              >
                All Modules
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLockAdminSession}
                className="h-9 text-xs font-bold gap-1.5 border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-white"
              >
                <Lock className="w-3.5 h-3.5" /> Lock Session
              </Button>
            </div>
          )}
        </div>

        {/* Module Switcher Bar when Authorized */}
        {isAdminAuthorized && (
          <div className="w-full mb-6 overflow-x-auto pb-1 scrollbar-none">
            <div className="flex items-center gap-2 min-w-max p-1.5 bg-slate-900/60 border border-slate-800 rounded-xl backdrop-blur-md">
              {ADMIN_MODULES.map((mod) => {
                const isActive = selectedPanel === mod.id;
                return (
                  <button
                    key={mod.id}
                    onClick={() => setSelectedPanel(mod.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-teal-600 to-cyan-700 text-white shadow-md font-extrabold ring-1 ring-white/30'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {mod.icon}
                    <span>{mod.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Choice Screen when no panel selected or unauthorized */}
        {(!isAdminAuthorized || !selectedPanel) && (
          <div className="w-full py-2 sm:py-4 flex-1 flex flex-col justify-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 w-full">
              {ADMIN_MODULES.map((mod) => (
                <button
                  key={mod.id}
                  onClick={() => handleOpenPanelRequest(mod.id)}
                  className={`group p-5 rounded-2xl border ${mod.cardBorder} ${mod.cardBg} ${mod.cardHover} transition-all duration-200 text-left flex flex-col justify-between space-y-4 shadow-lg backdrop-blur-sm cursor-pointer relative overflow-hidden`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`w-11 h-11 rounded-xl ${mod.iconBg} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                      {mod.icon}
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-white/5 border-white/20 text-slate-300">
                      {mod.badge}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    <h3 className={`font-black text-lg text-slate-900 dark:text-slate-100 group-hover:${mod.iconColor} flex items-center justify-between`}>
                      <span>{mod.title}</span>
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {mod.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
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
          <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-white rounded-2xl p-6 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2.5 text-white">
                <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                Administrator Authentication
              </DialogTitle>
              <DialogDescription className="text-slate-300 text-sm mt-2">
                Enter the administrator password to unlock the Executive Admin Control Panel.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="admin-access-password">Admin Password</Label>
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
                  className="bg-slate-950 border-slate-800 text-white"
                  value={adminPassword}
                  onChange={(event) => {
                    setAdminPassword(event.target.value);
                    setPasswordError('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') confirmAdminAccess();
                  }}
                />
                {passwordError && <p className="text-xs font-semibold text-rose-400 mt-1">{passwordError}</p>}
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <Button
                  variant="outline"
                  className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white rounded-xl text-xs font-semibold"
                  onClick={() => {
                    setAdminAccessOpen(false);
                    setTargetPanelToOpen(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmAdminAccess}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-teal-600/30"
                >
                  Unlock Admin Portal
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Authorized Panel Views */}
        {isAdminAuthorized && selectedPanel === 'dc' && (
          <div className="w-full py-2 space-y-6">
            <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border shadow-xs">
              <Button variant="ghost" onClick={handleBackToChoice} className="gap-2 h-9">
                <ArrowLeft className="w-4 h-4" /> Back to Modules
              </Button>
              <div>
                <h1 className="text-lg font-bold font-sans tracking-tight text-foreground">
                  DC System Management
                </h1>
                <p className="text-xs text-muted-foreground">
                  Create new surgical procedures and customize default item contents.
                </p>
              </div>
            </div>
            <AddProcedureForm />
          </div>
        )}

        {selectedPanel === 'customers' && (
          <div className="w-full py-2">
            <Customers embedded onBack={handleBackToChoice} />
          </div>
        )}

        {isAdminAuthorized && selectedPanel === 'cash' && (
          <div className="w-full py-2">
            <CashInvoiceAdmin onBack={handleBackToChoice} />
          </div>
        )}

        {isAdminAuthorized && selectedPanel === 'quotation' && (
          <div className="w-full py-2 space-y-4">
            <div className="flex items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border shadow-xs">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={handleBackToChoice} className="gap-2 h-9">
                  <ArrowLeft className="w-4 h-4" /> Back to Modules
                </Button>
                <div>
                  <h1 className="text-lg font-bold font-sans tracking-tight text-foreground">
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
          <div className="w-full py-2 space-y-6">
            <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border shadow-xs">
              <Button variant="ghost" onClick={handleBackToChoice} className="gap-2 h-9">
                <ArrowLeft className="w-4 h-4" /> Back to Modules
              </Button>
              <div>
                <h1 className="text-lg font-bold font-sans tracking-tight text-foreground">
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
          <div className="w-full py-2">
            <DeliveryPersonnelAdmin onBack={handleBackToChoice} />
          </div>
        )}
      </main>
    </div>
  );
};

export default Admin;
