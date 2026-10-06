import React, { useMemo, useRef, useState, useEffect } from "react";
import { SavedDc } from "@/lib/savedDcStorage";
import { CashInvoiceData } from "@/services/cashInvoiceFirebaseService";
import { IndianRupee, ChevronRight, CheckCircle2, ChevronLeft, Wallet, Clock, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getNotificationConfig, NotificationConfig } from "@/lib/notificationConfig";

interface CollectPaymentsScrollerProps {
  savedDcs: SavedDc[];
  cashInvoices?: CashInvoiceData[];
  onCollectPayment?: (dc: SavedDc) => void;
  onViewDc?: (dc: SavedDc, queue: "pending" | "returned" | "cash") => void;
}

interface PendingPaymentItem {
  id: string;
  type: "dc" | "invoice";
  partyName: string;
  identifier: string; // DC No or Invoice No
  amount: number;
  daysAging?: number;
  rawDc?: SavedDc;
}

export const CollectPaymentsScroller: React.FC<CollectPaymentsScrollerProps> = ({
  savedDcs,
  cashInvoices = [],
  onCollectPayment,
  onViewDc,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<NotificationConfig>(getNotificationConfig);

  useEffect(() => {
    const handleConfigChange = () => {
      setConfig(getNotificationConfig());
    };
    window.addEventListener("srrortho:notification_config_changed", handleConfigChange);
    window.addEventListener("storage", handleConfigChange);
    return () => {
      window.removeEventListener("srrortho:notification_config_changed", handleConfigChange);
      window.removeEventListener("storage", handleConfigChange);
    };
  }, []);

  // Collect strictly pending items from cash queue DCs and unpaid cash invoices
  const pendingItems = useMemo<PendingPaymentItem[]>(() => {
    const items: PendingPaymentItem[] = [];
    const minAmount = config.minPaymentAlertAmount || 0;

    // Fallback: Check localStorage if cashInvoices array is empty
    let effectiveInvoices = cashInvoices;
    if (!effectiveInvoices || effectiveInvoices.length === 0) {
      try {
        const localRaw = localStorage.getItem("im_saved_invoices") || localStorage.getItem("im_invoices");
        if (localRaw) {
          effectiveInvoices = JSON.parse(localRaw);
        }
      } catch {
        // ignore JSON errors
      }
    }

    // Identify already completed/cancelled DCs so their invoices are NEVER shown as pending
    const completedOrCancelledRefs = new Set<string>();
    savedDcs.forEach((d) => {
      if (d.status === "completed" || d.status === "cancelled") {
        if (d.invoiceRef) completedOrCancelledRefs.add(d.invoiceRef.trim().toLowerCase());
        if (d.dcNo) completedOrCancelledRefs.add(d.dcNo.trim().toLowerCase());
      }
    });

    // 1. Strictly Cash Queue DCs awaiting payment (status === 'cash')
    const pendingCashDcs = savedDcs.filter(
      (dc) => dc.status === "cash" && (dc.cashAmount || 0) > 0 && (dc.cashAmount || 0) >= minAmount
    );

    pendingCashDcs.forEach((dc) => {
      // If linked invoice exists and is explicitly marked paid, exclude it
      if (dc.invoiceRef) {
        const linkedInv = effectiveInvoices.find(
          (inv) => inv.invNumber?.trim().toLowerCase() === dc.invoiceRef?.trim().toLowerCase()
        );
        if (linkedInv && (linkedInv.status?.toLowerCase() === "paid" || (Number(linkedInv.paymentReceived) || 0) >= (Number(linkedInv.grandTotal) || 0))) {
          return;
        }
      }

      const cashEvent = dc.history?.find((h) => h.action === "MOVE_TO_CASH");
      const cashDate = cashEvent ? new Date(cashEvent.at) : (dc.savedAt ? new Date(dc.savedAt) : new Date());
      const daysAging = Math.max(0, Math.floor((Date.now() - cashDate.getTime()) / (1000 * 3600 * 24)));

      items.push({
        id: `dc-${dc.id}`,
        type: "dc",
        partyName: dc.hospitalName || "Hospital / Client",
        identifier: dc.dcNo ? `DC #${dc.dcNo}` : (dc.invoiceRef ? `Memo #${dc.invoiceRef}` : "DC"),
        amount: dc.cashAmount || 0,
        daysAging,
        rawDc: dc,
      });
    });

    // 2. Standalone Cash Invoices with unpaid balance
    const existingCashDcRefs = new Set<string>();
    pendingCashDcs.forEach((d) => {
      if (d.invoiceRef) existingCashDcRefs.add(d.invoiceRef.trim().toLowerCase());
      if (d.dcNo) existingCashDcRefs.add(d.dcNo.trim().toLowerCase());
    });

    effectiveInvoices.forEach((inv) => {
      const grandTotal = Number(inv.grandTotal) || 0;
      const paymentReceived = Number(inv.paymentReceived) || 0;
      const balance = grandTotal - paymentReceived;
      const isPaid =
        inv.status?.toLowerCase() === "paid" ||
        paymentReceived >= grandTotal ||
        balance <= 0;

      const invRefLower = inv.invNumber ? inv.invNumber.trim().toLowerCase() : "";
      const dcRefLower = inv.dcNumber ? inv.dcNumber.trim().toLowerCase() : "";

      const isCompletedDc =
        (invRefLower && completedOrCancelledRefs.has(invRefLower)) ||
        (dcRefLower && completedOrCancelledRefs.has(dcRefLower));

      const isAlreadyInCashDc =
        (invRefLower && existingCashDcRefs.has(invRefLower)) ||
        (dcRefLower && existingCashDcRefs.has(dcRefLower));

      if (!isPaid && !isCompletedDc && !isAlreadyInCashDc && balance > 0 && balance >= minAmount) {
        const matchedDc = savedDcs.find(
          (d) =>
            (inv.invNumber && d.invoiceRef?.trim().toLowerCase() === inv.invNumber.trim().toLowerCase()) ||
            (inv.dcNumber && d.dcNo?.trim().toLowerCase() === inv.dcNumber.trim().toLowerCase())
        );

        items.push({
          id: `inv-${inv.id || inv.invNumber}`,
          type: "invoice",
          partyName: inv.clientName || "Cash Customer",
          identifier: inv.invNumber ? `Inv #${inv.invNumber}` : (inv.dcNumber ? `DC #${inv.dcNumber}` : "Invoice"),
          amount: balance,
          rawDc: matchedDc,
        });
      }
    });

    // Sort by highest amount first
    return items.sort((a, b) => b.amount - a.amount);
  }, [savedDcs, cashInvoices, config.minPaymentAlertAmount]);

  const totalOutstanding = useMemo(() => {
    return pendingItems.reduce((acc, item) => acc + item.amount, 0);
  }, [pendingItems]);

  // TV news ticker: Each pending payment is rendered once!
  // Scrolls across from right to left, finishes completely, then restarts from right.
  const tvTickerDuration = useMemo(() => {
    return `${Math.max(16, pendingItems.length * 8)}s`;
  }, [pendingItems.length]);

  const handleScroll = (direction: "left" | "right") => {
    if (containerRef.current) {
      const offset = direction === "left" ? -220 : 220;
      containerRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  // If disabled in Admin Settings, hide the scroller completely
  if (!config.paymentReminderEnabled || !config.collectPaymentScrollerEnabled) {
    return null;
  }

  // If no pending collections, display clean all-clear badge
  if (pendingItems.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs text-xs">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="font-semibold text-emerald-800 dark:text-emerald-300">
          All Collections Cleared • ₹0 Pending
        </span>
      </div>
    );
  }

  const formatCompactCurrency = (amount: number) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2).replace(/\.00$/, "")}Cr`;
    }
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2).replace(/\.00$/, "")}L`;
    }
    if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    }
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  return (
    <div className="p-1.5 px-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md shadow-2xs flex items-center gap-3 w-full">
      {/* Left Summary Badge */}
      <Badge
        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3 py-1.5 rounded-xl shadow-2xs flex items-center gap-2 shrink-0 cursor-default"
        title={`Total Pending Collections: ₹${totalOutstanding.toLocaleString("en-IN")} across ${pendingItems.length} items`}
      >
        <Wallet className="w-4 h-4 text-emerald-100" />
        <span>Collect Payments ({pendingItems.length})</span>
      </Badge>

      {/* Scroller Container */}
      <div className="relative flex-1 min-w-0 overflow-hidden py-0.5 flex items-center group">
        {/* Left Fade */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-50 dark:from-slate-900 to-transparent pointer-events-none z-10" />

        {/* Scroll Track */}
        <div
          ref={containerRef}
          className="flex items-center overflow-hidden py-0.5 w-full"
        >
          <div
            className="animate-tv-ticker flex items-center gap-3 hover:[animation-play-state:paused]"
            style={{ animationDuration: tvTickerDuration }}
          >
            {pendingItems.map((item, idx) => (
              <React.Fragment key={item.id}>
                <div
                  onClick={() => {
                    if (item.rawDc && onViewDc) {
                      onViewDc(item.rawDc, (item.rawDc.status as any) || "cash");
                    } else if (item.rawDc && onCollectPayment) {
                      onCollectPayment(item.rawDc);
                    }
                  }}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 shadow-2xs text-left shrink-0 select-none transition-all hover:border-emerald-500 hover:shadow-xs cursor-pointer group"
                >
                  <Building2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  
                  {/* Party Name */}
                  <span
                    className="font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate max-w-[170px] group-hover:text-emerald-700 dark:group-hover:text-emerald-400 group-hover:underline"
                    title={`Click to view Track Status for ${item.partyName}`}
                  >
                    {item.partyName}
                  </span>

                  {/* Identifier */}
                  <span className="font-mono text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 shrink-0">
                    {item.identifier}
                  </span>

                  {/* Amount Pill */}
                  <span className="font-black font-mono text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 shrink-0">
                    ₹{item.amount.toLocaleString("en-IN")}
                  </span>

                  {/* Aging or Due Badge */}
                  {item.daysAging !== undefined && item.daysAging > 0 ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-200 shrink-0"
                    >
                      <Clock className="w-3 h-3 mr-1 inline" />
                      {item.daysAging}d
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 shrink-0"
                    >
                      Due
                    </Badge>
                  )}
                </div>

                {idx < pendingItems.length - 1 && (
                  <span className="text-emerald-500/40 dark:text-emerald-400/40 font-bold select-none text-xs px-0.5 shrink-0">
                    ✦
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Right Fade */}
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-50 dark:from-slate-900 to-transparent pointer-events-none z-10" />
      </div>

      {/* Manual Arrow Controls */}
      <div className="hidden xl:flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800"
          onClick={() => handleScroll("left")}
          title="Scroll Left"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800"
          onClick={() => handleScroll("right")}
          title="Scroll Right"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};


