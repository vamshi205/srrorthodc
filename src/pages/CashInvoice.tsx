import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { TopToolbar } from "@/components/ortho/TopToolbar";
import { auth } from "@/firebase";
import { CheckCircle2 } from "lucide-react";
import {
  fetchCashInvoicesFromFirestore,
  saveCashInvoiceToFirestore,
  deleteCashInvoiceFromFirestore,
} from "@/services/cashInvoiceFirebaseService";
import {
  fetchUnifiedCustomers,
  saveCustomer,
  deleteCustomer,
} from "@/lib/customerStorage";

import { loadSavedDcs, transitionSavedDc } from "@/lib/savedDcStorage";

export default function CashInvoice() {
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('srrortho:theme') as 'light' | 'dark') || 'light';
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveStatusText, setSaveStatusText] = useState("");

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

  // State to hold iframe URL with query parameters passed from caller
  const [iframeSrc, setIframeSrc] = useState<string>("/cash-invoice/index.html?v=3");

  useEffect(() => {
    // Preserve any search parameters from the parent window and pass them to the iframe
    const search = window.location.search;
    if (search) {
      setIframeSrc(`/cash-invoice/index.html${search}&v=3&t=${Date.now()}`);
    } else {
      setIframeSrc(`/cash-invoice/index.html?v=3&t=${Date.now()}`);
    }

    // Pass the Google OAuth redirect hash to the iframe if present
    const parentHash = window.location.hash;
    if (parentHash && parentHash.includes("access_token")) {
      const search = window.location.search;
      setIframeSrc(`/cash-invoice/index.html${search}${search ? '&' : '?'}v=3&t=${Date.now()}${parentHash}`);
      // Clean parent URL hash so it doesn't linger in the address bar
      setTimeout(() => {
        window.history.replaceState(window.history.state, "", "/");
      }, 800);
    }

    // Skip the inner auth overlay screen in Cash Invoice Maker
    sessionStorage.setItem("im_authorized", "true");

    // Listen for postMessages from the Cash Invoice iframe to store/fetch directly in Firestore
    const handleMessage = async (event: MessageEvent) => {
      const { action, payload, requestId } = event.data || {};
      if (!action) return;

      const targetWindow = (event.source as Window) || (document.querySelector('iframe') as HTMLIFrameElement | null)?.contentWindow;

      if (action === 'FETCH_CASH_INVOICES') {
        const invoices = await fetchCashInvoicesFromFirestore();
        targetWindow?.postMessage({ action: 'FETCH_CASH_INVOICES_RESPONSE', payload: invoices, requestId }, '*');
      } else if (action === 'SAVE_CASH_INVOICE') {
        setIsSaving(true);
        setSaveProgress(25);
        setSaveStatusText(`Saving Cash Memo #${payload?.invNumber || ''}...`);

        const progTimer1 = setTimeout(() => setSaveProgress(60), 300);
        const progTimer2 = setTimeout(() => setSaveProgress(85), 650);

        const success = await saveCashInvoiceToFirestore(payload);
        if (success && payload && payload.dcNumber) {
          setSaveStatusText(`Syncing with DC #${payload.dcNumber}...`);
          try {
            const dcs = await loadSavedDcs();
            const matchingDc = dcs.find(d => d.dcNo && d.dcNo.trim().toLowerCase() === payload.dcNumber.trim().toLowerCase());
            if (matchingDc) {
              const grandTotal = parseFloat(payload.grandTotal) || 0;
              const paymentReceived = parseFloat(payload.paymentReceived) || 0;
              const actualReceivable = parseFloat(payload.actualReceivable) || 0;
              const hasHiked = actualReceivable > 0 && actualReceivable < grandTotal;
              const effectiveAmount = hasHiked ? actualReceivable : grandTotal;
              const margin = hasHiked ? Math.round((grandTotal - actualReceivable) * 100) / 100 : undefined;
              const isFullyPaid = effectiveAmount > 0 && paymentReceived >= effectiveAmount;

              if (isFullyPaid) {
                // When Cash Memo is fully paid -> move DC status to 'completed' queue
                await transitionSavedDc(matchingDc.id, {
                  toStatus: "completed",
                  action: "MOVE_CASH_TO_COMPLETED",
                  updates: {
                    invoiceRef: payload.invNumber,
                    cashAmount: effectiveAmount,
                    billedAmount: hasHiked ? grandTotal : undefined,
                    hospitalMargin: margin,
                    cashRemarks: `Linked Cash Memo ${payload.invNumber} Paid (₹${effectiveAmount}${hasHiked ? `, Hiked: ₹${grandTotal}` : ''})`,
                  },
                  meta: {
                    invoiceRef: payload.invNumber,
                    cashAmount: effectiveAmount,
                    billedAmount: hasHiked ? grandTotal : undefined,
                    hospitalMargin: margin,
                    cashRemarks: `Linked Cash Memo ${payload.invNumber} Paid (₹${effectiveAmount}${hasHiked ? `, Hiked: ₹${grandTotal}` : ''})`
                  }
                });
              } else {
                // When Cash Memo is unpaid / partial -> move DC status to 'cash' queue
                await transitionSavedDc(matchingDc.id, {
                  toStatus: "cash",
                  action: "MOVE_TO_CASH",
                  updates: {
                    invoiceRef: payload.invNumber,
                    cashAt: new Date().toISOString(),
                    cashAmount: effectiveAmount,
                    billedAmount: hasHiked ? grandTotal : undefined,
                    hospitalMargin: margin,
                    cashRemarks: `Linked Cash Memo ${payload.invNumber} (${hasHiked ? `Expected Cash: ₹${effectiveAmount}, Hiked: ₹${grandTotal}` : 'Unpaid'})`,
                  },
                  meta: {
                    invoiceRef: payload.invNumber,
                    cashAt: new Date().toISOString(),
                    cashAmount: effectiveAmount,
                    billedAmount: hasHiked ? grandTotal : undefined,
                    hospitalMargin: margin,
                    cashRemarks: `Linked Cash Memo ${payload.invNumber} (${hasHiked ? `Expected Cash: ₹${effectiveAmount}, Hiked: ₹${grandTotal}` : 'Unpaid'})`
                  }
                });
              }
            }
          } catch (err) {
            console.error("Error auto-linking cash invoice to DC:", err);
          }
        }

        clearTimeout(progTimer1);
        clearTimeout(progTimer2);
        setSaveProgress(100);
        setSaveStatusText(success ? "✓ Cash Memo Saved Successfully!" : "✕ Failed to Save");

        targetWindow?.postMessage({ action: 'SAVE_CASH_INVOICE_RESPONSE', success, requestId }, '*');

        setTimeout(() => {
          setIsSaving(false);
          setSaveProgress(0);
          if (success) {
            const fromDcTracker = sessionStorage.getItem('from_dc_tracker') === 'true';
            if (fromDcTracker) {
              sessionStorage.removeItem('from_dc_tracker');
              navigate("/saved?queue=cash");
            }
          }
        }, 750);
      } else if (action === 'DELETE_CASH_INVOICE') {
        const success = await deleteCashInvoiceFromFirestore(payload);
        targetWindow?.postMessage({ action: 'DELETE_CASH_INVOICE_RESPONSE', success, requestId }, '*');
      } else if (action === 'FETCH_CASH_CUSTOMERS') {
        const customers = await fetchUnifiedCustomers();
        targetWindow?.postMessage({ action: 'FETCH_CASH_CUSTOMERS_RESPONSE', payload: customers, requestId }, '*');
      } else if (action === 'SAVE_CASH_CUSTOMER') {
        try {
          const savedCustomer = await saveCustomer(payload);
          targetWindow?.postMessage({ action: 'SAVE_CASH_CUSTOMER_RESPONSE', success: true, payload: savedCustomer, requestId }, '*');
        } catch (err: any) {
          console.error("Error saving customer from iframe:", err);
          targetWindow?.postMessage({ action: 'SAVE_CASH_CUSTOMER_RESPONSE', success: false, error: err.message, requestId }, '*');
        }
      } else if (action === 'DELETE_CASH_CUSTOMER') {
        try {
          const success = await deleteCustomer(payload);
          targetWindow?.postMessage({ action: 'DELETE_CASH_CUSTOMER_RESPONSE', success, requestId }, '*');
        } catch (err: any) {
          console.error("Error deleting customer from iframe:", err);
          targetWindow?.postMessage({ action: 'DELETE_CASH_CUSTOMER_RESPONSE', success: false, error: err.message, requestId }, '*');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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
        
        {/* Full page canvas container matching DC module */}
        <div className="mt-2 flex-1 w-full bg-card rounded-xl border border-border shadow-md overflow-hidden relative min-h-[calc(100vh-100px)]">
          {/* Top Loading Bar for Saving Cash Invoices */}
          {isSaving && (
            <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
              {/* Animated Gradient Bar */}
              <div className="w-full h-1.5 bg-teal-100 dark:bg-teal-950 overflow-hidden shadow-sm">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 via-emerald-500 to-amber-500 transition-all duration-300 ease-out"
                  style={{ width: `${saveProgress}%` }}
                />
              </div>

              {/* Floating saving status pill */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-auto">
                <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/95 dark:bg-slate-900/95 border border-teal-500/40 shadow-xl backdrop-blur-md text-xs font-semibold text-slate-800 dark:text-slate-100 animate-in fade-in slide-in-from-top-3 duration-200">
                  {saveProgress < 100 ? (
                    <div className="w-4 h-4 rounded-full border-2 border-teal-600 border-t-transparent animate-spin shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                  <span className="truncate max-w-[280px] sm:max-w-md">{saveStatusText}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-bold shrink-0">
                    {saveProgress}%
                  </span>
                </div>
              </div>
            </div>
          )}

          <iframe
            src={iframeSrc}
            title="Cash Invoice Maker"
            className="absolute inset-0 w-full h-full border-0"
          />
        </div>
      </main>
    </div>
  );
}

