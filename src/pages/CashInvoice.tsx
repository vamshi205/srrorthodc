import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopToolbar } from "@/components/ortho/TopToolbar";
import { auth } from "@/firebase";
import {
  fetchCashInvoicesFromFirestore,
  saveCashInvoiceToFirestore,
  deleteCashInvoiceFromFirestore,
  fetchCashCustomersFromFirestore,
  saveCashCustomerToFirestore,
} from "@/services/cashInvoiceFirebaseService";

import { loadSavedDcs, transitionSavedDc } from "@/lib/savedDcStorage";

export default function CashInvoice() {
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

  const [iframeSrc, setIframeSrc] = useState(() => {
    const search = window.location.search;
    const sep = search ? '&' : '?';
    return `/cash-invoice/index.html${search}${sep}t=${Date.now()}`;
  });

  useEffect(() => {
    // Skip the inner auth overlay screen in Cash Invoice Maker
    sessionStorage.setItem("im_authorized", "true");

    // Pass the Google OAuth redirect hash to the iframe if present
    const parentHash = window.location.hash;
    if (parentHash && parentHash.includes("access_token")) {
      const search = window.location.search;
      setIframeSrc(`/cash-invoice/index.html${search}${search ? '&' : '?'}t=${Date.now()}${parentHash}`);
      // Clean parent URL hash so it doesn't linger in the address bar
      setTimeout(() => {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }, 800);
    }
    // Listen for postMessages from the Cash Invoice iframe to store/fetch directly in Firestore
    const handleMessage = async (event: MessageEvent) => {
      const { action, payload, requestId } = event.data || {};
      if (!action) return;

      const targetWindow = (event.source as Window) || (document.querySelector('iframe') as HTMLIFrameElement | null)?.contentWindow;

      if (action === 'FETCH_CASH_INVOICES') {
        const invoices = await fetchCashInvoicesFromFirestore();
        targetWindow?.postMessage({ action: 'FETCH_CASH_INVOICES_RESPONSE', payload: invoices, requestId }, '*');
      } else if (action === 'SAVE_CASH_INVOICE') {
        const success = await saveCashInvoiceToFirestore(payload);
        if (success && payload && payload.dcNumber) {
          try {
            const dcs = await loadSavedDcs();
            const matchingDc = dcs.find(d => d.dcNo && d.dcNo.trim().toLowerCase() === payload.dcNumber.trim().toLowerCase());
            if (matchingDc) {
              const grandTotal = parseFloat(payload.grandTotal) || 0;
              const paymentReceived = parseFloat(payload.paymentReceived) || 0;
              const isFullyPaid = grandTotal > 0 && paymentReceived >= grandTotal;

              if (isFullyPaid) {
                // When Cash Memo is fully paid -> move DC status to 'completed' queue
                await transitionSavedDc(matchingDc.id, {
                  toStatus: "completed",
                  action: "MOVE_CASH_TO_COMPLETED",
                  updates: {
                    invoiceRef: payload.invNumber,
                    cashAmount: grandTotal,
                    cashRemarks: `Linked Cash Memo ${payload.invNumber} Paid (₹${grandTotal})`,
                  },
                  meta: {
                    invoiceRef: payload.invNumber,
                    cashAmount: grandTotal,
                    cashRemarks: `Linked Cash Memo ${payload.invNumber} Paid (₹${grandTotal})`
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
                    cashAmount: grandTotal,
                    cashRemarks: `Linked Cash Memo ${payload.invNumber} (Unpaid)`,
                  },
                  meta: {
                    invoiceRef: payload.invNumber,
                    cashAt: new Date().toISOString(),
                    cashAmount: grandTotal,
                    cashRemarks: `Linked Cash Memo ${payload.invNumber} (Unpaid)`
                  }
                });
              }
            }
          } catch (err) {
            console.error("Error auto-linking cash invoice to DC:", err);
          }
        }
        targetWindow?.postMessage({ action: 'SAVE_CASH_INVOICE_RESPONSE', success, requestId }, '*');
        if (success) {
          const fromDcTracker = sessionStorage.getItem('from_dc_tracker') === 'true';
          if (fromDcTracker) {
            sessionStorage.removeItem('from_dc_tracker');
            navigate("/saved?queue=cash");
          }
        }
      } else if (action === 'DELETE_CASH_INVOICE') {
        const success = await deleteCashInvoiceFromFirestore(payload);
        targetWindow?.postMessage({ action: 'DELETE_CASH_INVOICE_RESPONSE', success, requestId }, '*');
      } else if (action === 'FETCH_CASH_CUSTOMERS') {
        const customers = await fetchCashCustomersFromFirestore();
        targetWindow?.postMessage({ action: 'FETCH_CASH_CUSTOMERS_RESPONSE', payload: customers, requestId }, '*');
      } else if (action === 'SAVE_CASH_CUSTOMER') {
        const success = await saveCashCustomerToFirestore(payload);
        targetWindow?.postMessage({ action: 'SAVE_CASH_CUSTOMER_RESPONSE', success, requestId }, '*');
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
        
        {/* Floating dashboard card aligned with the main toolbar */}
        <div className="mt-0 flex-1 w-full bg-card rounded-xl border border-border shadow-md overflow-hidden relative min-h-[600px]">
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
