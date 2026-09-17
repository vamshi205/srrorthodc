import React, { useMemo, useRef, useState, useEffect } from "react";
import { SavedDc } from "@/lib/savedDcStorage";
import { CashInvoiceData } from "@/services/cashInvoiceFirebaseService";
import { IndianRupee, ChevronRight, CheckCircle2, ChevronLeft, Wallet, Clock } from "lucide-react";
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
}

export const CollectPaymentsScroller: React.FC<CollectPaymentsScrollerProps> = ({
  savedDcs,
  cashInvoices = [],
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
        items.push({
          id: `inv-${inv.id || inv.invNumber}`,
          type: "invoice",
          partyName: inv.clientName || "Cash Customer",
          identifier: inv.invNumber ? `Inv #${inv.invNumber}` : (inv.dcNumber ? `DC #${inv.dcNumber}` : "Invoice"),
          amount: balance,
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

  return (
    <div className="flex items-center gap-2 min-w-0 flex-1 max-w-full lg:max-w-2xl xl:max-w-3xl">
      {/* Summary Badge - Purely Informational */}
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-emerald-500/15 to-teal-500/15 dark:from-amber-500/20 dark:to-teal-500/20 border border-amber-400/40 dark:border-amber-500/30 text-xs shrink-0 shadow-xs">
        <div className="w-5 h-5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold">
          <IndianRupee className="w-3 h-3" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
            Collect Payments
          </span>
          <span className="text-xs font-black text-slate-900 dark:text-slate-100">
            ₹{totalOutstanding.toLocaleString("en-IN")}{" "}
            <span className="text-[10px] font-normal text-muted-foreground">
              ({pendingItems.length})
            </span>
          </span>
        </div>
      </div>

      {/* Scroller Container */}
      <div className="relative flex-1 min-w-0 overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 shadow-xs py-1 px-1 flex items-center group">
        {/* Left Fade */}
        <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white dark:from-slate-900 to-transparent pointer-events-none z-10" />

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
                  className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-gradient-to-r from-white to-amber-50/50 dark:from-slate-800 dark:to-amber-950/20 shadow-xs text-left shrink-0 select-none transition-all hover:border-amber-400 hover:shadow-sm"
                >
                  {/* Party Name & Identifier */}
                  <div className="max-w-[150px] sm:max-w-[190px] truncate leading-tight">
                    <span className="font-bold text-[11px] sm:text-xs text-slate-900 dark:text-slate-100 block truncate">
                      {item.partyName}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono">
                      {item.identifier}
                    </span>
                  </div>

                  {/* Amount Pill */}
                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/15 dark:bg-emerald-500/25 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-extrabold text-[11px] sm:text-xs shrink-0">
                    <span>₹{item.amount.toLocaleString("en-IN")}</span>
                  </div>

                  {/* Aging or Due Badge */}
                  {item.daysAging !== undefined && item.daysAging > 0 ? (
                    <Badge
                      variant="outline"
                      className="text-[9px] h-4.5 px-1 py-0 border-amber-300 dark:border-amber-700 bg-amber-100/60 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 shrink-0 font-medium"
                    >
                      <Clock className="w-2.5 h-2.5 mr-0.5 inline" />
                      {item.daysAging}d
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[9px] h-4.5 px-1 py-0 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 shrink-0 font-medium"
                    >
                      Due
                    </Badge>
                  )}
                </div>

                {idx < pendingItems.length - 1 && (
                  <span className="text-amber-500/60 dark:text-amber-400/60 font-bold select-none text-xs px-0.5 shrink-0">
                    ✦
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Right Fade */}
        <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white dark:from-slate-900 to-transparent pointer-events-none z-10" />
      </div>

      {/* Manual Arrow Controls (Visible on desktop) */}
      <div className="hidden xl:flex items-center gap-0.5 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          onClick={() => handleScroll("left")}
          title="Scroll Left"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          onClick={() => handleScroll("right")}
          title="Scroll Right"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};


