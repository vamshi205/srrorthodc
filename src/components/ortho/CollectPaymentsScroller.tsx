import React, { useMemo, useRef } from "react";
import { SavedDc } from "@/lib/savedDcStorage";
import { CashInvoiceData } from "@/services/cashInvoiceFirebaseService";
import { IndianRupee, ChevronRight, CheckCircle2, ChevronLeft, ArrowRight, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getNotificationConfig, NotificationConfig } from "@/lib/notificationConfig";

interface CollectPaymentsScrollerProps {
  savedDcs: SavedDc[];
  cashInvoices?: CashInvoiceData[];
  onCollectPayment: (dc: SavedDc) => void;
  onViewDc?: (dc: SavedDc, queue: "pending" | "returned" | "cash") => void;
}

interface PendingPaymentItem {
  id: string;
  type: "dc" | "invoice";
  partyName: string;
  identifier: string; // DC No or Invoice No
  amount: number;
  dc?: SavedDc;
  invoice?: CashInvoiceData;
  daysAging?: number;
}

export const CollectPaymentsScroller: React.FC<CollectPaymentsScrollerProps> = ({
  savedDcs,
  cashInvoices = [],
  onCollectPayment,
  onViewDc,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = React.useState<NotificationConfig>(getNotificationConfig);

  React.useEffect(() => {
    const handleConfigChange = () => {
      setConfig(getNotificationConfig());
    };
    window.addEventListener("srrortho:notification_config_changed", handleConfigChange);
    return () => {
      window.removeEventListener("srrortho:notification_config_changed", handleConfigChange);
    };
  }, []);

  // Collect all pending items from both cash queue DCs and pending cash invoices
  const pendingItems = useMemo<PendingPaymentItem[]>(() => {
    const items: PendingPaymentItem[] = [];

    // 1. Cash Queue DCs with positive cashAmount
    const cashDcs = savedDcs.filter(
      (dc) => dc.status === "cash" && (dc.cashAmount || 0) > 0
    );

    cashDcs.forEach((dc) => {
      const cashEvent = dc.history?.find((h) => h.action === "MOVE_TO_CASH");
      const cashDate = cashEvent ? new Date(cashEvent.at) : (dc.savedAt ? new Date(dc.savedAt) : new Date());
      const daysAging = Math.max(0, Math.floor((Date.now() - cashDate.getTime()) / (1000 * 3600 * 24)));

      items.push({
        id: `dc-${dc.id}`,
        type: "dc",
        partyName: dc.hospitalName || "Hospital / Client",
        identifier: dc.dcNo ? `DC #${dc.dcNo}` : (dc.invoiceRef ? `Memo #${dc.invoiceRef}` : "DC"),
        amount: dc.cashAmount || 0,
        dc,
        daysAging,
      });
    });

    // 2. Standalone Cash Invoices with unpaid balance
    const existingCashDcRefs = new Set(
      cashDcs.map((d) => d.invoiceRef || d.dcNo).filter(Boolean)
    );

    cashInvoices.forEach((inv) => {
      const balance = (inv.grandTotal || 0) - (inv.paymentReceived || 0);
      const isPaid = inv.status?.toLowerCase() === "paid" || balance <= 0;
      const isAlreadyInDc =
        (inv.invNumber && existingCashDcRefs.has(inv.invNumber)) ||
        (inv.dcNumber && existingCashDcRefs.has(inv.dcNumber));

      if (!isPaid && !isAlreadyInDc && balance > 0) {
        items.push({
          id: `inv-${inv.id || inv.invNumber}`,
          type: "invoice",
          partyName: inv.clientName || "Cash Customer",
          identifier: inv.invNumber ? `Inv #${inv.invNumber}` : (inv.dcNumber ? `DC #${inv.dcNumber}` : "Invoice"),
          amount: balance,
          invoice: inv,
        });
      }
    });

    // Sort by highest amount first
    return items.sort((a, b) => b.amount - a.amount);
  }, [savedDcs, cashInvoices]);

  const totalOutstanding = useMemo(() => {
    return pendingItems.reduce((acc, item) => acc + item.amount, 0);
  }, [pendingItems]);

  const handleItemClick = (item: PendingPaymentItem) => {
    if (item.type === "dc" && item.dc) {
      onCollectPayment(item.dc);
    } else if (item.type === "invoice" && item.invoice) {
      // If there's an associated DC in savedDcs, open its payment dialog
      const matchingDc = savedDcs.find(
        (d) =>
          (d.invoiceRef && d.invoiceRef === item.invoice?.invNumber) ||
          (d.dcNo && d.dcNo === item.invoice?.dcNumber)
      );
      if (matchingDc) {
        onCollectPayment(matchingDc);
      } else {
        // Direct event or message
        window.dispatchEvent(
          new CustomEvent("srrortho:open_cash_invoice_payment", {
            detail: item.invoice,
          })
        );
      }
    }
  };

  const handleScroll = (direction: "left" | "right") => {
    if (containerRef.current) {
      const offset = direction === "left" ? -220 : 220;
      containerRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  // If payment reminders are disabled in Admin, hide the scroller completely
  if (!config.paymentReminderEnabled) {
    return null;
  }

  // If no pending collections
  if (pendingItems.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs text-xs">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="font-semibold text-emerald-800 dark:text-emerald-300">
          All Collections Cleared • ₹0 Pending
        </span>
      </div>
    );
  }

  // Duplicate items array once for continuous marquee loop
  const marqueeItems = pendingItems.length >= 3 ? [...pendingItems, ...pendingItems] : pendingItems;

  return (
    <div className="flex items-center gap-2 min-w-0 flex-1 max-w-full lg:max-w-2xl xl:max-w-3xl">
      {/* Summary Badge Trigger */}
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
        <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-white dark:from-slate-900 to-transparent pointer-events-none z-10" />

        {/* Scroll Track */}
        <div
          ref={containerRef}
          className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5 px-2"
          style={{ scrollBehavior: "smooth" }}
        >
          <div className="animate-ticker flex items-center gap-2 hover:[animation-play-state:paused]">
            {marqueeItems.map((item, idx) => (
              <button
                key={`${item.id}-${idx}`}
                onClick={() => handleItemClick(item)}
                className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-gradient-to-r from-white to-amber-50/50 dark:from-slate-800 dark:to-amber-950/20 hover:border-amber-400 hover:from-amber-100/60 dark:hover:border-amber-400/80 shadow-xs hover:shadow-md transition-all text-left shrink-0 active:scale-95 group/card cursor-pointer"
                title={`Click to record payment for ${item.partyName} (₹${item.amount.toLocaleString("en-IN")})`}
              >
                {/* Party Name & DC/Memo */}
                <div className="max-w-[130px] sm:max-w-[160px] truncate leading-tight">
                  <span className="font-bold text-[11px] sm:text-xs text-slate-900 dark:text-slate-100 block truncate group-hover/card:text-teal-700 dark:group-hover/card:text-teal-300">
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

                {/* Quick Action Button */}
                <div className="flex items-center justify-center w-5 h-5 rounded-md bg-amber-500 text-slate-950 shadow-xs group-hover/card:bg-amber-600 group-hover/card:text-white transition-colors shrink-0 font-bold text-[10px]">
                  <ArrowRight className="w-3 h-3 group-hover/card:translate-x-0.5 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Fade */}
        <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-white dark:from-slate-900 to-transparent pointer-events-none z-10" />
      </div>

      {/* Manual Arrow Controls (Visible on hover/desktop) */}
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
