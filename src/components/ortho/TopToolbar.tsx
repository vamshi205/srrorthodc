import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getLocalSavedDcs } from '@/lib/savedDcStorage';
import { getNotificationConfig } from '@/lib/notificationConfig';
import { getTodayBankReminders } from '@/lib/bankReminders';
import {
  Activity,
  Plus,
  Images,
  List,
  FileText,
  RefreshCw,
  Printer,
  Wrench,
  Sun,
  Moon,
  LogOut,
  Menu,
  Receipt,
  ArrowLeft,
  Building2,
  Landmark,
  ChevronDown,
  BellRing,
  IndianRupee,
} from 'lucide-react';

import { DcTrackerNotifications } from '@/components/ortho/DcTrackerNotifications';

type TopToolbarProps = {
  theme: string;
  toggleTheme: () => void;
  fetchProcedures: (force?: boolean) => void;
  loading: boolean;
  handlePrint: () => void;
  navigate: (path: string) => void;
  handleLogout: () => void;
  setDcMode: (mode: 'procedure' | 'manual') => void;
  setInitialFilterType: (type: string) => void;
  setShowProcedureSelector: (show: boolean) => void;
  setActiveProcedures: (proc: any[]) => void;
  setCollapsedProcedures: (set: Set<string>) => void;
};

export const TopToolbar: React.FC<TopToolbarProps> = ({
  theme,
  toggleTheme,
  fetchProcedures,
  loading,
  handlePrint,
  navigate,
  handleLogout,
  setDcMode,
  setInitialFilterType,
  setShowProcedureSelector,
  setActiveProcedures,
  setCollapsedProcedures,
}) => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const currentMode = searchParams.get('mode');
  const pathname = location.pathname;

  const [remindersCount, setRemindersCount] = useState<number>(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);

  useEffect(() => {
    const updateReminders = () => {
      try {
        const dcs = getLocalSavedDcs();
        const config = getNotificationConfig();

        let count = 0;

        // 1. Payment reminders
        if (config.paymentReminderEnabled) {
          const minAmount = config.minPaymentAlertAmount || 0;
          const cashDcs = dcs.filter((dc) => dc.status === 'cash' && (dc.cashAmount || 0) >= minAmount && (dc.cashAmount || 0) > 0);
          count += cashDcs.length;
        }

        // 2. Return reminders
        if (config.returnReminderEnabled) {
          const cutoff = config.returnCutoffDays || 2;
          const pendingDcs = dcs.filter((dc) => {
            if (dc.status !== 'pending') return false;
            const start = new Date(dc.savedAt);
            const end = dc.returnedAt ? new Date(dc.returnedAt) : new Date();
            const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            return Math.max(0, diff) >= cutoff;
          });
          count += pendingDcs.length;
        }

        // 3. Invoice reminders
        if (config.invoiceReminderEnabled) {
          const returnedDcs = dcs.filter((dc) => dc.status === 'returned');
          count += returnedDcs.length;
        }

        // 4. Bank Account reminders (Today's untagged debits & unmapped credits for 1538 account)
        const bankReminders = getTodayBankReminders();
        count += bankReminders.count;

        setRemindersCount(count);
      } catch {
        setRemindersCount(0);
      }
    };

    updateReminders();

    const handleUpdate = () => updateReminders();

    window.addEventListener('srrortho:saved_dcs_updated', handleUpdate);
    window.addEventListener('srrortho:notification_config_changed', handleUpdate);
    window.addEventListener('srrortho:cash_invoice_updated', handleUpdate);
    window.addEventListener('srrortho:bank_transactions_updated', handleUpdate);
    window.addEventListener('popstate', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('srrortho:saved_dcs_updated', handleUpdate);
      window.removeEventListener('srrortho:notification_config_changed', handleUpdate);
      window.removeEventListener('srrortho:cash_invoice_updated', handleUpdate);
      window.removeEventListener('srrortho:bank_transactions_updated', handleUpdate);
      window.removeEventListener('popstate', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [location.pathname, location.search]);

  const isProcedureList = pathname === '/' && currentMode === 'procedure';
  const isManualDc = pathname === '/' && currentMode === 'manual';
  const isLandingScreen = pathname === '/' && !currentMode;
  const isImageDb = pathname === '/images';
  const isCashInvoice = pathname === '/cash-invoice';
  const isBankAccounts = pathname === '/bank-accounts';
  const isCustomers = pathname === '/customers';
  const isQuotation = pathname === '/quotation';
  const isDcTracker = pathname === '/saved';
  const isAdmin = pathname === '/admin';

  if (isLandingScreen) {
    return null;
  }

  const getNavBtnClass = (isActive: boolean) =>
    `gap-1.5 text-xs font-bold h-8 px-2.5 rounded-lg transition-all ${
      isActive
        ? 'bg-white text-teal-900 shadow-md font-extrabold border border-white'
        : 'text-teal-50/90 hover:bg-white/15 hover:text-white font-bold'
    }`;

  const getMobileNavClass = (isActive: boolean) =>
    `w-full justify-start gap-3 h-10 text-sm font-bold rounded-lg ${
      isActive
        ? 'bg-white text-teal-900 font-extrabold shadow-md'
        : 'text-slate-300 hover:text-white hover:bg-white/10'
    }`;

  return (
    <header className="sticky top-0 z-30 w-full mb-2.5">
      <div className="w-full h-14 sm:h-16 rounded-2xl border border-white/20 dark:border-teal-500/30 bg-gradient-to-r from-teal-700 via-teal-800 to-cyan-900 dark:from-slate-950 dark:via-teal-950 dark:to-slate-950 backdrop-blur-xl shadow-lg px-3 sm:px-4 flex items-center justify-between gap-2.5 sm:gap-3 text-white select-none">
        
        {/* Left Side: Back button, Logo & Brand */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              if (pathname === '/cash-invoice' && searchParams.get('tab') && searchParams.get('tab') !== 'editor') {
                navigate('/cash-invoice');
                return;
              }
              navigate(-1);
            }}
            className="h-8 sm:h-9 px-2 sm:px-2.5 rounded-lg sm:rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center gap-1 border border-white/20 shadow-xs transition-all active:scale-95 shrink-0"
            title="Go Back to Previous Screen"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
            <span className="hidden sm:inline">Back</span>
          </Button>

          <div className="flex items-center gap-2.5 min-w-0 cursor-pointer" onClick={() => navigate('/')} title="Return to Dashboard Home">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white p-0.5 border border-white/30 flex items-center justify-center shadow-md shrink-0 overflow-hidden">
              <img src="/srr-favicon.png" alt="SRR Ortho Logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0 hidden md:block">
              <div className="font-sans font-black text-base sm:text-lg tracking-tight text-white leading-tight truncate">
                SRR Ortho Plus
              </div>
              <div className="text-[11px] text-teal-100/80 font-semibold truncate">Operations Portal</div>
            </div>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <div className="hidden lg:flex items-center gap-1.5 min-w-0">
            {/* Single DC Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={getNavBtnClass(isProcedureList || isManualDc)}
                >
                  <Plus className={`w-3.5 h-3.5 ${isProcedureList || isManualDc ? 'text-teal-900' : 'text-teal-200'}`} />
                  <span>DC</span>
                  <ChevronDown className="w-3 h-3 ml-0.5 opacity-80" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-2xl rounded-xl z-50 p-1.5 min-w-[210px]">
                <DropdownMenuItem
                  className="gap-3 p-2 rounded-lg cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-950/60 text-slate-800 dark:text-slate-100 font-semibold"
                  onClick={() => {
                    setDcMode('procedure');
                    setInitialFilterType('All');
                    setShowProcedureSelector(true);
                    navigate('/?mode=procedure');
                  }}
                >
                  <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 flex items-center justify-center shrink-0">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-extrabold text-xs text-slate-900 dark:text-slate-100">Auto DC</div>
                    <div className="text-[10.5px] text-slate-500 font-normal">Template-based generator</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-slate-100 dark:bg-slate-800" />
                <DropdownMenuItem
                  className="gap-3 p-2 rounded-lg cursor-pointer hover:bg-cyan-50 dark:hover:bg-cyan-950/60 text-slate-800 dark:text-slate-100 font-semibold"
                  onClick={() => {
                    setDcMode('manual');
                    setActiveProcedures([]);
                    setCollapsedProcedures(new Set());
                    setShowProcedureSelector(false);
                    navigate('/?mode=manual');
                  }}
                >
                  <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 flex items-center justify-center shrink-0">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-extrabold text-xs text-slate-900 dark:text-slate-100">Manual DC</div>
                    <div className="text-[10.5px] text-slate-500 font-normal">Custom blank DC entry</div>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="sm"
              className={getNavBtnClass(isImageDb)}
              onClick={() => navigate('/images')}
            >
              <Images className={`w-3.5 h-3.5 ${isImageDb ? 'text-teal-900' : 'text-teal-200'}`} /> Packing
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={getNavBtnClass(isCashInvoice)}
              onClick={() => navigate('/cash-invoice')}
            >
              <IndianRupee className={`w-3.5 h-3.5 ${isCashInvoice ? 'text-teal-900' : 'text-teal-200'}`} /> Cash Invoice
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={getNavBtnClass(isBankAccounts)}
              onClick={() => navigate('/bank-accounts')}
            >
              <Landmark className={`w-3.5 h-3.5 ${isBankAccounts ? 'text-teal-900' : 'text-teal-200'}`} /> Bank Accounts
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={getNavBtnClass(isCustomers)}
              onClick={() => navigate('/customers')}
            >
              <Building2 className={`w-3.5 h-3.5 ${isCustomers ? 'text-teal-900' : 'text-teal-200'}`} /> Customers
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={getNavBtnClass(isQuotation)}
              onClick={() => navigate('/quotation')}
            >
              <FileText className={`w-3.5 h-3.5 ${isQuotation ? 'text-teal-900' : 'text-teal-200'}`} /> Quotation
            </Button>

            {/* DC Tracker Button - Distinct Amber Pill */}
            <Button
              variant="ghost"
              size="sm"
              className={`gap-1.5 text-xs font-black h-8 px-3 rounded-lg transition-all border shadow-sm ${
                isDcTracker
                  ? 'bg-amber-400 text-slate-950 border-white font-black scale-105'
                  : 'bg-amber-400/20 text-amber-200 border-amber-300/40 hover:bg-amber-400/35 hover:text-white'
              }`}
              onClick={() => navigate('/saved')}
            >
              <List className={`w-3.5 h-3.5 ${isDcTracker ? 'text-slate-950' : 'text-amber-300'}`} /> DC Tracker
            </Button>
          </div>

          {/* Right Side: Quick Actions & Utilities */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Refresh Data on DC routes */}
            {(isProcedureList || isManualDc) && (
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:flex text-teal-50 hover:bg-white/15 hover:text-white h-8 px-2.5 gap-1.5 text-xs font-semibold border border-white/20 rounded-lg bg-white/10"
                onClick={() => fetchProcedures(true)}
                disabled={loading}
                title="Refresh Procedures"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-teal-200 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden xl:inline">{loading ? '...' : 'Refresh'}</span>
              </Button>
            )}

            {/* Print Action on DC routes */}
            {(isProcedureList || isManualDc) && (
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:flex text-teal-50 hover:bg-white/15 hover:text-white h-8 px-2.5 gap-1.5 text-xs font-semibold border border-white/20 rounded-lg bg-white/10"
                onClick={handlePrint}
                title="Print Challan"
              >
                <Printer className="w-3.5 h-3.5 text-teal-200" />
                <span className="hidden xl:inline">Print</span>
              </Button>
            )}

            {/* Reminders & Notifications Icon Button with Live Badge */}
            <Button
              variant="ghost"
              size="icon"
              className="relative h-8 w-8 text-amber-200 bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/40 rounded-lg transition-all"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('srrortho:preview_login_popup'));
              }}
              title={`View Reminders & Notifications${remindersCount > 0 ? ` (${remindersCount} active)` : ''}`}
            >
              <BellRing className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              {remindersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border border-rose-400 shadow-md ring-2 ring-teal-900 animate-bounce">
                  {remindersCount > 99 ? '99+' : remindersCount}
                </span>
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 text-teal-50 hover:bg-white/20 border border-white/20 rounded-lg transition-all ${
                isAdmin ? 'bg-white/30 text-white font-bold' : 'bg-white/10'
              }`}
              onClick={() => navigate('/admin')}
              title="Admin Panel"
            >
              <Wrench className="w-3.5 h-3.5 text-teal-100" />
            </Button>

            {/* Logout Icon Button */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:flex h-8 w-8 text-rose-200 hover:bg-rose-500/25 hover:text-white border border-rose-400/30 bg-rose-500/10 rounded-lg transition-all"
              onClick={() => setShowLogoutConfirm(true)}
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-300" />
            </Button>

            {/* Mobile Drawer Navigation Menu */}
            <div className="lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 border border-white/20 rounded-lg bg-white/10">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="p-5 border-l border-white/10 bg-slate-900/95 text-white backdrop-blur-2xl">
                  <SheetHeader className="text-left border-b border-white/10 pb-4">
                    <SheetTitle className="text-white font-sans text-lg flex items-center gap-2.5">
                      <img src="/srr-favicon.png" alt="SRR Ortho Logo" className="w-6 h-6 object-contain rounded-full bg-white p-0.5" />
                      <span>SRR Ortho Plus Portal Menu</span>
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-6">
                    {/* Navigation Group */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-teal-400/80 px-1">Navigation</div>
                      <SheetClose asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-3 h-10 text-sm font-bold rounded-lg text-slate-200 hover:text-white hover:bg-white/10 border border-white/15"
                          onClick={() => {
                            if (pathname === '/cash-invoice' && searchParams.get('tab') && searchParams.get('tab') !== 'editor') {
                              navigate('/cash-invoice');
                            return;
                          }
                          navigate(-1);
                        }}
                      >
                        <ArrowLeft className="w-4 h-4 text-sky-400" /> Go Back
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button
                        variant="ghost"
                        className={getMobileNavClass(isProcedureList)}
                        onClick={() => {
                          setDcMode('procedure');
                          setInitialFilterType('All');
                          setShowProcedureSelector(true);
                          navigate('/?mode=procedure');
                        }}
                      >
                        <Plus className="w-4 h-4 text-teal-400" /> Auto DC
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button
                        variant="ghost"
                        className={getMobileNavClass(isManualDc)}
                        onClick={() => {
                          setDcMode('manual');
                          setActiveProcedures([]);
                          setCollapsedProcedures(new Set());
                          setShowProcedureSelector(false);
                          navigate('/?mode=manual');
                        }}
                      >
                        <Plus className="w-4 h-4 text-cyan-400" /> Manual DC
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button
                        variant="ghost"
                        className={getMobileNavClass(isQuotation)}
                        onClick={() => navigate('/quotation')}
                      >
                        <FileText className="w-4 h-4 text-teal-400" /> Create Quotation
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button
                        variant="ghost"
                        className={getMobileNavClass(isImageDb)}
                        onClick={() => navigate('/images')}
                      >
                        <Images className="w-4 h-4 text-teal-400" /> Packing
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button
                        variant="ghost"
                        className={getMobileNavClass(isCashInvoice)}
                        onClick={() => navigate('/cash-invoice')}
                      >
                        <IndianRupee className="w-4 h-4 text-teal-400" /> Cash Invoice
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button
                        variant="ghost"
                        className={getMobileNavClass(isBankAccounts)}
                        onClick={() => navigate('/bank-accounts')}
                      >
                        <Landmark className="w-4 h-4 text-teal-400" /> Bank Accounts
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button
                        variant="ghost"
                        className={getMobileNavClass(isCustomers)}
                        onClick={() => navigate('/customers')}
                      >
                        <Building2 className="w-4 h-4 text-emerald-400" /> Customers & Hospitals
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button
                        variant="ghost"
                        className={`w-full justify-start gap-3 h-10 text-sm font-extrabold rounded-lg border ${
                          isDcTracker
                            ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md ring-2 ring-amber-400/40'
                            : 'bg-amber-400/15 text-amber-300 border-amber-300/30 hover:bg-amber-400/25'
                        }`}
                        onClick={() => navigate('/saved')}
                      >
                        <List className={`w-4 h-4 ${isDcTracker ? 'text-slate-950' : 'text-amber-300'}`} /> DC Tracker
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button
                        variant="ghost"
                        className={getMobileNavClass(isAdmin)}
                        onClick={() => navigate('/admin')}
                      >
                        <Wrench className="w-4 h-4 text-amber-400" /> Admin Panel
                      </Button>
                    </SheetClose>
                  </div>

                  {/* Actions Group */}
                  <div className="space-y-2 pt-4 border-t border-white/10">
                    <div className="text-xs font-bold uppercase tracking-wider text-teal-400/80 px-1">Actions</div>
                    <SheetClose asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 text-slate-200 hover:text-white hover:bg-white/10 h-10 text-sm font-medium"
                        onClick={() => fetchProcedures(true)}
                        disabled={loading}
                      >
                        <RefreshCw className={`w-4 h-4 text-teal-400 ${loading ? 'animate-spin' : ''}`} /> Refresh Data
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button variant="ghost" className="w-full justify-start gap-3 text-slate-200 hover:text-white hover:bg-white/10 h-10 text-sm font-medium" onClick={handlePrint}>
                        <Printer className="w-4 h-4 text-cyan-400" /> Print Delivery Challan
                      </Button>
                    </SheetClose>
                  </div>

                  {/* Logout Action */}
                  <div className="pt-4 border-t border-white/10">
                    <SheetClose asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 text-rose-300 hover:text-white hover:bg-rose-500/20 h-10 text-sm font-medium"
                        onClick={() => setShowLogoutConfirm(true)}
                      >
                        <LogOut className="w-4 h-4" /> Logout
                      </Button>
                    </SheetClose>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-6 shadow-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold flex items-center gap-2.5 text-white">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              Confirm Logout
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300 text-sm mt-2 leading-relaxed">
              Are you sure you want to log out of SRR Ortho Plus? Any unsaved changes in progress will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex items-center gap-3">
            <AlertDialogCancel className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 font-semibold rounded-xl px-4 py-2 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowLogoutConfirm(false);
                handleLogout();
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-lg shadow-rose-600/30 px-4 py-2 text-xs"
            >
              Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Global Reminders Host mounted on all modules */}
      <DcTrackerNotifications />
    </header>
  );
};
