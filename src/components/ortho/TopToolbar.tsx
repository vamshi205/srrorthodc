import React from 'react';
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
} from 'lucide-react';

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

  const isProcedureList = pathname === '/' && currentMode === 'procedure';
  const isManualDc = pathname === '/' && currentMode === 'manual';
  const isLandingScreen = pathname === '/' && !currentMode;
  const isImageDb = pathname === '/images';
  const isCashInvoice = pathname === '/cash-invoice';
  const isQuotation = pathname === '/quotation';
  const isDcTracker = pathname === '/saved';
  const isAdmin = pathname === '/admin';

  if (isLandingScreen) {
    return null;
  }

  const getNavBtnClass = (isActive: boolean) =>
    `gap-2 text-xs font-bold h-8 rounded-lg transition-all ${
      isActive
        ? 'bg-white text-sky-700 shadow-md border-2 border-white scale-[1.03]'
        : 'text-white/80 hover:bg-white/15 hover:text-white'
    }`;

  const getMobileNavClass = (isActive: boolean) =>
    `w-full justify-start gap-3 h-10 text-sm font-bold rounded-lg ${
      isActive
        ? 'bg-teal-500 text-white font-extrabold shadow-md border border-teal-400'
        : 'text-slate-200 hover:text-white hover:bg-white/10'
    }`;

  return (
    <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pb-4">
      <div className="rounded-2xl border border-white/20 dark:border-white/10 bg-gradient-to-r from-teal-600/90 via-teal-700/90 to-cyan-800/90 dark:from-slate-900/95 dark:via-teal-950/90 dark:to-slate-900/95 backdrop-blur-xl shadow-lg px-4 py-3 flex items-center justify-between gap-4 text-white">
        
        {/* Left Side: Logo & Brand */}
        <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-10 h-10 rounded-xl bg-white p-0.5 border border-white/40 flex items-center justify-center shadow-md shrink-0 overflow-hidden">
            <img src="/srr-favicon.png" alt="SRR Ortho Logo" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-lg tracking-tight text-white leading-tight truncate">
              SRR Ortho Plus Portal
            </div>
            <div className="text-xs text-teal-100/70 truncate hidden sm:block">Operations & Inventory Portal</div>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <div className="hidden lg:flex items-center gap-1.5 bg-black/10 dark:bg-white/5 p-1 rounded-xl border border-white/10">
            <Button
              variant="ghost"
              size="sm"
              className={getNavBtnClass(isProcedureList)}
              onClick={() => {
                setDcMode('procedure');
                setInitialFilterType('All');
                setShowProcedureSelector(true);
                navigate('/?mode=procedure');
              }}
            >
              <Plus className={`w-3.5 h-3.5 ${isProcedureList ? 'text-teal-800' : 'text-teal-200'}`} /> Auto DC
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className={getNavBtnClass(isManualDc)}
              onClick={() => {
                setDcMode('manual');
                setActiveProcedures([]);
                setCollapsedProcedures(new Set());
                setShowProcedureSelector(false);
                navigate('/?mode=manual');
              }}
            >
              <Plus className={`w-3.5 h-3.5 ${isManualDc ? 'text-teal-800' : 'text-teal-200'}`} /> Manual DC
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={getNavBtnClass(isImageDb)}
              onClick={() => navigate('/images')}
            >
              <Images className={`w-3.5 h-3.5 ${isImageDb ? 'text-teal-800' : 'text-teal-200'}`} /> Image DB
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={getNavBtnClass(isCashInvoice)}
              onClick={() => navigate('/cash-invoice')}
            >
              <Receipt className={`w-3.5 h-3.5 ${isCashInvoice ? 'text-teal-800' : 'text-teal-200'}`} /> Cash Invoice
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={getNavBtnClass(isQuotation)}
              onClick={() => navigate('/quotation')}
            >
              <FileText className={`w-3.5 h-3.5 ${isQuotation ? 'text-sky-700' : 'text-teal-200'}`} /> Quotation
            </Button>

            {/* DC Tracker - Unique Amber Glow Badge */}
            <Button
              variant="ghost"
              size="sm"
              className={`gap-2 text-xs font-extrabold h-8 rounded-lg transition-all border ${
                isDcTracker
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-400/30 scale-[1.05]'
                  : 'bg-amber-400/20 text-amber-200 border-amber-300/40 hover:bg-amber-400/30 hover:text-amber-100 shadow-sm'
              }`}
              onClick={() => navigate('/saved')}
            >
              <List className={`w-3.5 h-3.5 ${isDcTracker ? 'text-slate-950' : 'text-amber-300'}`} /> DC Tracker
            </Button>
          </div>

          {/* Right Side: Quick Actions & Utilities */}
          <div className="flex items-center gap-2">
            {/* Refresh Data - only on procedure list or manual DC */}
            {(isProcedureList || isManualDc) && (
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:flex text-white hover:bg-white/15 hover:text-white h-9 px-3 gap-1.5 text-xs font-medium border border-white/10"
                onClick={() => fetchProcedures(true)}
                disabled={loading}
                title="Refresh Procedures"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-teal-200 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden md:inline">{loading ? 'Refreshing...' : 'Refresh'}</span>
              </Button>
            )}

            {/* Print Action */}
            {(isProcedureList || isManualDc) && (
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:flex text-white hover:bg-white/15 hover:text-white h-9 px-3 gap-1.5 text-xs font-medium border border-white/10"
                onClick={handlePrint}
                title="Print Challan"
              >
                <Printer className="w-3.5 h-3.5 text-teal-200" />
                <span className="hidden md:inline">Print</span>
              </Button>
            )}
          <Button
            variant="ghost"
            size="icon"
            className={`h-9 w-9 text-amber-300 hover:text-white hover:bg-white/15 border border-white/10 rounded-lg transition-all ${
              isAdmin ? 'bg-white/20 border-white/40 scale-105' : ''
            }`}
            onClick={() => navigate('/admin')}
            title="Admin Panel"
          >
            <Wrench className="w-4 h-4 text-amber-300" />
          </Button>

          {/* Logout Button */}
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:flex text-rose-200 hover:text-white hover:bg-rose-500/20 border border-rose-400/20 h-9 px-3 gap-1.5 text-xs font-medium"
            onClick={handleLogout}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </Button>

          {/* Mobile Drawer Navigation Menu */}
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/15 border border-white/10 rounded-lg">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="p-5 border-l border-white/10 bg-slate-900/95 text-white backdrop-blur-2xl">
                <SheetHeader className="text-left border-b border-white/10 pb-4">
                  <SheetTitle className="text-white font-display text-lg flex items-center gap-2.5">
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
                        <Images className="w-4 h-4 text-teal-400" /> Image Database
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button
                        variant="ghost"
                        className={getMobileNavClass(isCashInvoice)}
                        onClick={() => navigate('/cash-invoice')}
                      >
                        <Receipt className="w-4 h-4 text-teal-400" /> Cash Invoice
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
                      <Button variant="ghost" className="w-full justify-start gap-3 text-rose-300 hover:text-white hover:bg-rose-500/20 h-10 text-sm font-medium" onClick={handleLogout}>
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
    </div>
  );
};
