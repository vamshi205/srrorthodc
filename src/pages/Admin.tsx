import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { 
  FileText, 
  Bell, 
  Truck, 
  Building2, 
  IndianRupee, 
  Lock, 
  Unlock, 
  Database,
  KeyRound,
  Eye,
  EyeOff,
  Menu,
  X,
  DownloadCloud,
  CheckCircle2,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { NotificationSettingsAdmin } from '@/components/admin/NotificationSettingsAdmin';
import { DeliveryPersonnelAdmin } from '@/components/admin/DeliveryPersonnelAdmin';
import { BankAccountsAdmin } from '@/components/admin/BankAccountsAdmin';
import { downloadCompleteFirestoreBackup } from '@/services/firestoreBackupService';
import { toast } from 'sonner';

type AdminPanelType = 
  | 'customers'
  | 'dc' 
  | 'personnel'
  | 'cash' 
  | 'bank_accounts'
  | 'quotation' 
  | 'notifications' 
  | 'backup';

interface AdminNavGroup {
  name: string;
  items: Array<{
    id: AdminPanelType;
    title: string;
    description: string;
    requiresAdmin: boolean;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}

const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    name: 'Clinical & Field Operations',
    items: [
      {
        id: 'customers',
        title: 'Customer Directory',
        description: 'Hospitals, contacts & departments',
        requiresAdmin: false, // Open access: No password required!
        icon: Building2,
      },
      {
        id: 'dc',
        title: 'DC System Admin',
        description: 'Procedures, sets & quantities',
        requiresAdmin: true,
        icon: FileText,
      },
      {
        id: 'personnel',
        title: 'Delivery & Personnel',
        description: 'Field staff, delivery & stats',
        requiresAdmin: true,
        icon: Truck,
      },
    ],
  },
  {
    name: 'Finance & Treasury',
    items: [
      {
        id: 'cash',
        title: 'Cash Invoice Admin',
        description: 'Pricing catalog & invoice defaults',
        requiresAdmin: true,
        icon: IndianRupee,
      },
      {
        id: 'bank_accounts',
        title: 'Bank Accounts & Treasury',
        description: 'Accounts, balances & cash queues',
        requiresAdmin: true,
        icon: Building2,
      },
      {
        id: 'quotation',
        title: 'Quotation Settings',
        description: 'Letterhead, branding & terms',
        requiresAdmin: true,
        icon: FileText,
      },
    ],
  },
  {
    name: 'System & Governance',
    items: [
      {
        id: 'notifications',
        title: 'Notifications & Alerts',
        description: 'Reminders, interval & sound',
        requiresAdmin: true,
        icon: Bell,
      },
      {
        id: 'backup',
        title: 'Database Backup',
        description: 'Export complete Firestore snapshot',
        requiresAdmin: true,
        icon: Database,
      },
    ],
  },
];

const Admin = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { fetchProcedures, loading } = useProcedures();

  // Read initial tab from query param or default to 'customers' (open access)
  const initialTab = (searchParams.get('tab') as AdminPanelType) || 'customers';
  const [selectedPanel, setSelectedPanel] = useState<AdminPanelType>(initialTab);

  // Check if session is already unlocked
  const [isAdminAuthorized, setIsAdminAuthorized] = useState<boolean>(() => {
    return sessionStorage.getItem('srrortho:admin_authorized') === 'true';
  });

  const [adminPassword, setAdminPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminAccessModalOpen, setAdminAccessModalOpen] = useState(false);
  const [isExportingDb, setIsExportingDb] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Sidebar hidden/collapsed state (persisted to localStorage)
  const [isSidebarHidden, setIsSidebarHidden] = useState<boolean>(() => {
    return localStorage.getItem('srrortho:admin_sidebar_hidden') === 'true';
  });

  const toggleSidebarHidden = () => {
    setIsSidebarHidden((prev) => {
      const next = !prev;
      localStorage.setItem('srrortho:admin_sidebar_hidden', String(next));
      return next;
    });
  };

  // Synchronize tab in URL when panel changes
  useEffect(() => {
    if (selectedPanel) {
      setSearchParams({ tab: selectedPanel }, { replace: true });
    }
  }, [selectedPanel, setSearchParams]);

  const currentModule = ADMIN_NAV_GROUPS.flatMap((g) => g.items).find((m) => m.id === selectedPanel);
  const isSelectedLocked = Boolean(currentModule?.requiresAdmin && !isAdminAuthorized);

  const confirmAdminAccess = () => {
    const trimmed = adminPassword.trim();
    if (trimmed !== 'srrortho' && trimmed !== 'admin') {
      setPasswordError('Incorrect administrator password. Please try again.');
      return;
    }
    setPasswordError('');
    setIsAdminAuthorized(true);
    sessionStorage.setItem('srrortho:admin_authorized', 'true');
    setAdminAccessModalOpen(false);
    setAdminPassword('');
    toast.success('Admin privileges unlocked for this session');
  };

  const handleLockAdminSession = () => {
    setIsAdminAuthorized(false);
    sessionStorage.removeItem('srrortho:admin_authorized');
    setAdminPassword('');
    toast.info('Admin session locked');
  };

  const handleDownloadBackup = async () => {
    setIsExportingDb(true);
    toast.info('Preparing complete Firestore DB backup JSON download...');
    try {
      const res = await downloadCompleteFirestoreBackup();
      if (res.success) {
        toast.success(`🎉 Downloaded complete Firestore DB Backup (${res.count} documents)!`);
      } else {
        toast.error('Failed to generate Firestore backup export.');
      }
    } catch {
      toast.error('Backup download error');
    } finally {
      setIsExportingDb(false);
    }
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
    localStorage.removeItem('srrortho:auth');
    localStorage.removeItem('srrortho:procedures_cache');
    sessionStorage.removeItem('srrortho:admin_authorized');
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSelectPanel = (panelId: AdminPanelType) => {
    setSelectedPanel(panelId);
    setMobileSidebarOpen(false);
    setPasswordError('');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col w-full text-slate-900 dark:text-slate-100">
      {/* Top Application Toolbar */}
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

      {/* Main Admin Section with Dedicated Sidebar */}
      <div className="flex-1 flex flex-col md:flex-row w-full max-w-[1920px] mx-auto overflow-hidden">
        {/* ========================================================================= */}
        {/* Mobile Header Bar (Visible on small screens only)                        */}
        {/* ========================================================================= */}
        <div className="md:hidden flex items-center justify-between p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              className="h-8 w-8 p-0"
            >
              {mobileSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
            <span className="text-xs font-bold truncate">
              {currentModule?.title || 'Admin Section'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {isAdminAuthorized ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Unlocked
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setAdminAccessModalOpen(true)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 cursor-pointer"
              >
                <Lock className="w-3 h-3 text-amber-600" /> Unlock
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Admin Left Sidebar (Visible only in Admin Section)                         */}
        {/* ========================================================================= */}
        <aside
          className={`
            fixed md:static inset-y-0 left-0 z-40 w-72 md:w-68 lg:w-72 bg-slate-100/70 dark:bg-slate-900/90 border-r border-slate-200/90 dark:border-slate-800 flex flex-col shrink-0 transition-all duration-200 ease-in-out shadow-lg md:shadow-none
            ${isSidebarHidden ? 'md:hidden' : 'md:flex'}
            ${mobileSidebarOpen ? 'translate-x-0 flex' : '-translate-x-full md:translate-x-0 hidden md:flex'}
          `}
        >
          {/* Sidebar Header */}
          <div className="p-3.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-100/90 dark:bg-slate-900/95">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-teal-600 dark:bg-teal-500 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                ⚙️
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 leading-tight">
                  Settings &amp; Tools
                </div>
                <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  Admin
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {isAdminAuthorized ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLockAdminSession}
                  className="h-7 px-2 text-[10.5px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg gap-1 cursor-pointer"
                  title="Lock Admin Session"
                >
                  <Lock className="w-3 h-3" /> Lock
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAdminAccessModalOpen(true)}
                  className="h-7 px-2 text-[10.5px] font-bold text-teal-700 hover:text-teal-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-lg gap-1 cursor-pointer"
                  title="Unlock Admin Session"
                >
                  <KeyRound className="w-3 h-3" /> Unlock
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileSidebarOpen(false)}
                className="md:hidden h-7 w-7 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Session Security Banner */}
          <div className="px-3 py-1.5 bg-slate-200/50 dark:bg-slate-950/70 border-b border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-400">
              <span className={`w-2 h-2 rounded-full ${isAdminAuthorized ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {isAdminAuthorized ? 'Full Admin Access' : 'Restricted Access'}
            </span>
            <span className="text-[10px] text-slate-400">
              {isAdminAuthorized ? 'Session Active' : 'Password Required'}
            </span>
          </div>

          {/* Sidebar Nav Items List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {ADMIN_NAV_GROUPS.map((group) => (
              <div key={group.name} className="space-y-1">
                <div className="px-2.5 pt-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {group.name}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isSelected = selectedPanel === item.id;
                    const isLocked = item.requiresAdmin && !isAdminAuthorized;
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectPanel(item.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-teal-700 text-white font-bold shadow-xs'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white font-medium hover:shadow-xs'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-bold leading-tight">
                              {item.title}
                            </div>
                            <div
                              className={`truncate text-[10px] ${
                                isSelected ? 'text-teal-100' : 'text-slate-400'
                              }`}
                            >
                              {item.description}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 ml-1.5 flex items-center">
                          {item.requiresAdmin ? (
                            isLocked ? (
                              <Lock
                                className={`w-3 h-3 ${
                                  isSelected ? 'text-teal-200' : 'text-amber-500'
                                }`}
                                title="Requires Admin Password"
                              />
                            ) : (
                              <CheckCircle2
                                className={`w-3 h-3 ${
                                  isSelected ? 'text-teal-200' : 'text-emerald-500'
                                }`}
                                title="Unlocked"
                              />
                            )
                          ) : (
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              }`}
                            >
                              Open
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar Footer with Quick Actions */}
          <div className="p-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900/95 flex items-center justify-between text-xs shrink-0">
            <button
              type="button"
              onClick={() => handleSelectPanel('backup')}
              className="text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-teal-600" />
              <span>DB Backup</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-[11px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              Back to Portal
            </button>
          </div>
        </aside>

        {/* Backdrop for mobile sidebar */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-30 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* ========================================================================= */}
        {/* Main Content Area (Right)                                                 */}
        {/* ========================================================================= */}
        <main className="flex-1 min-w-0 flex flex-col overflow-y-auto p-3 sm:p-4 lg:p-5 bg-white dark:bg-slate-950">
          {/* Header Bar for Selected Module */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Desktop Show/Hide Sidebar Toggle Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSidebarHidden}
                  className={`hidden md:inline-flex h-7 px-2.5 text-xs font-bold gap-1.5 rounded-lg border transition-all cursor-pointer shadow-xs ${
                    isSidebarHidden
                      ? 'bg-teal-50 hover:bg-teal-100 text-teal-800 dark:bg-teal-950 dark:hover:bg-teal-900 dark:text-teal-200 border-teal-300 dark:border-teal-700'
                      : 'bg-white hover:bg-slate-100 text-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800'
                  }`}
                  title={isSidebarHidden ? 'Show Navigation Sidebar' : 'Hide Navigation Sidebar'}
                >
                  {isSidebarHidden ? (
                    <>
                      <PanelLeftOpen className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      <span>Show Sidebar</span>
                    </>
                  ) : (
                    <>
                      <PanelLeftClose className="w-3.5 h-3.5 text-slate-500" />
                      <span>Hide Sidebar</span>
                    </>
                  )}
                </Button>

                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  {currentModule?.title || 'Admin Section'}
                </h2>
                {currentModule?.requiresAdmin ? (
                  isAdminAuthorized ? (
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 text-[10px] font-bold gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Admin Authorized
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 text-[10px] font-bold gap-1">
                      <Lock className="w-2.5 h-2.5" /> Password Protected
                    </Badge>
                  )
                ) : (
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 text-[10px] font-bold">
                    Open Access
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {currentModule?.description}
              </p>
            </div>

            {/* Quick Context Action for Quotation */}
            {selectedPanel === 'quotation' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('/quotation/index.html?view=settings&adminOnly=true', '_blank')}
                className="h-8 text-xs font-bold gap-1.5 border-slate-300 dark:border-slate-700 self-start sm:self-auto cursor-pointer"
              >
                <span>Full Tab</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          {/* ========================================================================= */}
          {/* Password Authorization In-Page Gate (If option requires admin and locked) */}
          {/* ========================================================================= */}
          {isSelectedLocked ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center min-h-[460px]">
              <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-300 shadow-sm mb-4">
                <Lock className="w-8 h-8" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                Administrator Authentication Required
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mt-1 mb-6">
                <strong>{currentModule?.title}</strong> contains critical business settings and controls. Enter the administrator password to view and manage this section.
              </p>

              <div className="w-full max-w-sm bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-left">
                <div className="space-y-1.5">
                  <Label htmlFor="gate-admin-password" className="text-xs font-bold text-slate-900 dark:text-slate-200">
                    Administrator Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="gate-admin-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="off"
                      autoFocus
                      placeholder="Enter administrator password..."
                      value={adminPassword}
                      onChange={(e) => {
                        setAdminPassword(e.target.value);
                        setPasswordError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmAdminAccess();
                      }}
                      className="pr-10 h-10 text-xs bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordError && (
                    <p className="text-xs font-semibold text-rose-600 mt-1">{passwordError}</p>
                  )}
                </div>

                <Button
                  type="button"
                  onClick={confirmAdminAccess}
                  className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold h-10 text-xs rounded-xl shadow-xs gap-2 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  Unlock {currentModule?.title}
                </Button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPanel('customers')}
                className="mt-6 text-xs text-slate-500 hover:text-teal-700 dark:hover:text-teal-400 font-semibold underline cursor-pointer"
              >
                ← Switch to Customer Directory (Open Access)
              </button>
            </div>
          ) : (
            /* ========================================================================= */
            /* Panel Content Views (Rendered directly if authorized or open access)     */
            /* ========================================================================= */
            <div className="flex-1 w-full">
              {/* 1. Customer Directory (Open Access - shows directly!) */}
              {selectedPanel === 'customers' && (
                <div className="w-full">
                  <Customers embedded />
                </div>
              )}

              {/* 2. DC System Admin */}
              {selectedPanel === 'dc' && (
                <div className="w-full">
                  <AddProcedureForm />
                </div>
              )}

              {/* 3. Delivery & Personnel */}
              {selectedPanel === 'personnel' && (
                <div className="w-full">
                  <DeliveryPersonnelAdmin />
                </div>
              )}

              {/* 4. Cash Invoice Admin */}
              {selectedPanel === 'cash' && (
                <div className="w-full">
                  <CashInvoiceAdmin />
                </div>
              )}

              {/* 5. Bank Accounts & Treasury */}
              {selectedPanel === 'bank_accounts' && (
                <div className="w-full">
                  <BankAccountsAdmin />
                </div>
              )}

              {/* 6. Quotation Settings */}
              {selectedPanel === 'quotation' && (
                <div className="w-full space-y-3">
                  <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative min-h-[700px] h-[calc(100vh-210px)]">
                    <iframe
                      src="/quotation/index.html?view=settings&adminOnly=true"
                      title="Quotation Settings"
                      className="absolute inset-0 w-full h-full border-0"
                    />
                  </div>
                </div>
              )}

              {/* 7. Notifications & Alerts */}
              {selectedPanel === 'notifications' && (
                <div className="w-full">
                  <NotificationSettingsAdmin />
                </div>
              )}

              {/* 8. Database Backup */}
              {selectedPanel === 'backup' && (
                <div className="w-full space-y-4">
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-300 shrink-0">
                        <Database className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                          Full Database Backup &amp; Disaster Recovery
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Download a complete, offline JSON snapshot of all Firestore database collections for business continuity and audits.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Collections Included
                        </div>
                        <div className="text-sm font-black text-slate-800 dark:text-slate-200 mt-1">
                          All Collections
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          DCs, Cash Invoices, Customers, Accounts, Personnel, Quotations
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Format
                        </div>
                        <div className="text-sm font-black text-slate-800 dark:text-slate-200 mt-1">
                          Standard JSON (.json)
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Human-readable, timestamped data export
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Storage &amp; Privacy
                        </div>
                        <div className="text-sm font-black text-slate-800 dark:text-slate-200 mt-1">
                          Direct to Local PC
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Saved directly to your browser download folder
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center gap-3">
                      <Button
                        type="button"
                        onClick={handleDownloadBackup}
                        disabled={isExportingDb}
                        className="bg-teal-700 hover:bg-teal-800 text-white font-bold h-10 px-5 gap-2 text-xs rounded-xl shadow-xs cursor-pointer"
                      >
                        <DownloadCloud className="w-4 h-4" />
                        {isExportingDb ? 'Exporting Firestore DB...' : 'Download Complete Backup JSON'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Standalone Admin Access Modal (Can be invoked from header "Unlock" button) */}
      <Dialog
        open={adminAccessModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAdminPassword('');
            setPasswordError('');
          }
          setAdminAccessModalOpen(open);
        }}
      >
        <DialogContent className="max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              Administrator Authentication
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              Enter the administrator password to unlock all admin control panels for this session.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="modal-admin-password" className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Admin Password
              </Label>
              <div className="relative">
                <Input
                  id="modal-admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="off"
                  autoFocus
                  placeholder="Enter administrator password..."
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    setPasswordError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmAdminAccess();
                  }}
                  className="pr-10 h-10 text-xs bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordError && (
                <p className="text-xs font-semibold text-rose-600 mt-1">{passwordError}</p>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                className="border-slate-300 dark:border-slate-700 text-xs font-semibold rounded-xl"
                onClick={() => setAdminAccessModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmAdminAccess}
                className="bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-xs shadow-xs"
              >
                Unlock Admin Portal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
