import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Bell,
  BellRing,
  Wallet,
  RotateCcw,
  Receipt,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  ExternalLink,
  Volume2,
  VolumeX,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SavedDc } from "@/lib/savedDcStorage";
import {
  saveCashInvoiceToFirestore,
  type CashInvoiceData,
} from "@/services/cashInvoiceFirebaseService";
import {
  getNotificationConfig,
  saveNotificationConfig,
  type NotificationConfig,
} from "@/lib/notificationConfig";
import { useToast } from "@/hooks/use-toast";
import { logReminderAction } from "@/lib/notificationAudit";

interface DcTrackerNotificationsProps {
  savedDcs: SavedDc[];
  cashInvoices?: CashInvoiceData[];
  onCollectPayment: (dc: SavedDc) => void;
  onRecordReturn: (dc: SavedDc) => void;
  onViewDc: (dc: SavedDc, queue: "pending" | "returned" | "cash") => void;
}

const STORAGE_KEYS = {
  LAST_PAYMENT_REMINDER: "srrortho_last_payment_reminder_ts",
  LAST_RETURN_REMINDER_DATE: "srrortho_last_return_reminder_date",
  LAST_LOGIN_POPUP_DATE: "srrortho_last_login_popup_date",
  SEEN_LOGIN_POPUP_SESSION: "srrortho_seen_login_popup",
  SNOOZED_UNTIL: "srrortho_reminder_snoozed_until",
};

export const DcTrackerNotifications: React.FC<DcTrackerNotificationsProps> = ({
  savedDcs,
  cashInvoices = [],
  onCollectPayment,
  onRecordReturn,
  onViewDc,
}) => {
  const { toast } = useToast();
  const [config, setConfig] = useState<NotificationConfig>(getNotificationConfig);
  const [isOpen, setIsOpen] = useState(false);
  const [loginPopupOpen, setLoginPopupOpen] = useState(false);
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
  const [showBannerSnooze, setShowBannerSnooze] = useState(false);
  const [showPopoverSnooze, setShowPopoverSnooze] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "payments" | "returns" | "invoices">("all");
  const [activeBanner, setActiveBanner] = useState<{
    type: "payment" | "return" | "combined";
    title: string;
    message: string;
    paymentCount?: number;
    paymentTotal?: number;
    returnCount?: number;
  } | null>(null);

  const handleSnoozeOption = (option: "15m" | "1h" | "tomorrow") => {
    let snoozeUntil = 0;
    let label = "";
    let actionType: "SNOOZE_15M" | "SNOOZE_1H" | "SNOOZE_TOMORROW" = "SNOOZE_15M";

    if (option === "15m") {
      snoozeUntil = Date.now() + 15 * 60 * 1000;
      label = "15 minutes";
      actionType = "SNOOZE_15M";
    } else if (option === "1h") {
      snoozeUntil = Date.now() + 60 * 60 * 1000;
      label = "1 hour";
      actionType = "SNOOZE_1H";
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      snoozeUntil = tomorrow.getTime();
      label = "tomorrow morning (9:00 AM)";
      actionType = "SNOOZE_TOMORROW";
    }

    localStorage.setItem(STORAGE_KEYS.SNOOZED_UNTIL, String(snoozeUntil));

    const partySummary =
      paymentReminders.dcs.map((d) => `${d.hospitalName} (₹${d.cashAmount || 0})`).join(", ") ||
      "None";

    logReminderAction({
      action: actionType,
      label: `Snoozed for ${label}`,
      details: `User snoozed pending action reminder for ${label}. Snapshot: ₹${paymentReminders.totalAmount.toLocaleString(
        "en-IN"
      )} pending from ${paymentReminders.totalCount} parties (${partySummary}), and ${
        returnReminders.count
      } sets awaiting return.`,
      pendingAmount: paymentReminders.totalAmount,
      partiesCount: paymentReminders.totalCount,
      returnCount: returnReminders.count,
    });

    setLoginPopupOpen(false);
    setShowSnoozeOptions(false);
    setShowBannerSnooze(false);
    setShowPopoverSnooze(false);
    setActiveBanner(null);
    setIsOpen(false);

    toast({
      title: "Reminder Snoozed",
      description: `We'll remind you again in ${label}.`,
    });
  };

  const [cashInvoicePaymentModal, setCashInvoicePaymentModal] = useState<{
    open: boolean;
    invoice: CashInvoiceData | null;
    amount: string;
    remarks: string;
    isSaving: boolean;
  }>({
    open: false,
    invoice: null,
    amount: "",
    remarks: "",
    isSaving: false,
  });

  const handleRecordCashInvoicePayment = (inv: CashInvoiceData) => {
    const matchedDc = inv.dcNumber
      ? savedDcs.find(
          (d) => d.dcNo && d.dcNo.trim().toLowerCase() === inv.dcNumber!.trim().toLowerCase()
        )
      : null;

    if (matchedDc) {
      setIsOpen(false);
      setLoginPopupOpen(false);
      onCollectPayment(matchedDc);
      return;
    }

    const balance = (inv.grandTotal || 0) - (inv.paymentReceived || 0);
    setCashInvoicePaymentModal({
      open: true,
      invoice: inv,
      amount: String(balance > 0 ? balance : inv.grandTotal || 0),
      remarks: "",
      isSaving: false,
    });
    setIsOpen(false);
    setLoginPopupOpen(false);
  };

  const confirmCashInvoicePayment = async () => {
    if (!cashInvoicePaymentModal.invoice) return;
    const inv = cashInvoicePaymentModal.invoice;
    const paidAmt = parseFloat(cashInvoicePaymentModal.amount) || 0;
    if (paidAmt <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount.",
        variant: "destructive",
      });
      return;
    }

    setCashInvoicePaymentModal((prev) => ({ ...prev, isSaving: true }));
    const newTotalReceived = (inv.paymentReceived || 0) + paidAmt;
    const isFullyPaid = newTotalReceived >= (inv.grandTotal || 0);

    const updatedInv: CashInvoiceData = {
      ...inv,
      paymentReceived: newTotalReceived,
      status: isFullyPaid ? "paid" : "partial",
      paidAt: new Date().toISOString(),
      remarks: cashInvoicePaymentModal.remarks.trim() || inv.remarks || `Payment of ₹${paidAmt} recorded`,
    };

    try {
      await saveCashInvoiceToFirestore(updatedInv);
      logReminderAction({
        action: "COLLECT_CLICK",
        label: `Cash Invoice Payment: ₹${paidAmt.toLocaleString("en-IN")}`,
        details: `Recorded payment of ₹${paidAmt.toLocaleString("en-IN")} for ${inv.clientName} (Invoice #${inv.invNumber}). Status is now ${updatedInv.status}.`,
        pendingAmount: Math.max(0, (inv.grandTotal || 0) - newTotalReceived),
        partiesCount: 1,
        returnCount: 0,
      });

      toast({
        title: "Payment Recorded",
        description: `Recorded ₹${paidAmt.toLocaleString("en-IN")} for ${inv.clientName} (Invoice #${inv.invNumber}).`,
      });

      setCashInvoicePaymentModal({ open: false, invoice: null, amount: "", remarks: "", isSaving: false });
      window.dispatchEvent(new CustomEvent("srrortho:cash_invoice_updated", { detail: updatedInv }));
    } catch (err) {
      toast({
        title: "Failed to Record Payment",
        description: "Could not save to Firestore.",
        variant: "destructive",
      });
      setCashInvoicePaymentModal((prev) => ({ ...prev, isSaving: false }));
    }
  };

  // Sync with Admin settings and check test_popup query param
  useEffect(() => {
    const handleConfigChange = () => {
      setConfig(getNotificationConfig());
    };
    const handlePreviewPopup = () => {
      setLoginPopupOpen(true);
    };
    window.addEventListener("srrortho:notification_config_changed", handleConfigChange);
    window.addEventListener("srrortho:preview_login_popup", handlePreviewPopup);

    const params = new URLSearchParams(window.location.search);
    if (params.get("test_popup") === "1") {
      setLoginPopupOpen(true);
      params.delete("test_popup");
      const cleanUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : "");
      window.history.replaceState({}, "", cleanUrl);
    }

    return () => {
      window.removeEventListener("srrortho:notification_config_changed", handleConfigChange);
      window.removeEventListener("srrortho:preview_login_popup", handlePreviewPopup);
    };
  }, []);

  // Sound chime using Web Audio API
  const playChime = () => {
    if (!config.soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // Audio might require user interaction first
    }
  };

  const toggleSound = () => {
    const nextConfig = { ...config, soundEnabled: !config.soundEnabled };
    setConfig(nextConfig);
    saveNotificationConfig(nextConfig);
  };

  // Days pending calculation
  const getDaysPending = (dc: SavedDc) => {
    const start = new Date(dc.savedAt);
    const end = dc.returnedAt ? new Date(dc.returnedAt) : new Date();
    const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  // Total quantity calculation
  const getTotalQty = (dc: SavedDc) =>
    dc.items.reduce((total, item) => total + item.sizes.reduce((sum, size) => sum + size.qty, 0), 0);

  // 1. Payment Reminders (High Weightage)
  const paymentReminders = useMemo(() => {
    if (!config.paymentReminderEnabled) {
      return { dcs: [], invoices: [], totalCount: 0, totalAmount: 0 };
    }

    const minAmount = config.minPaymentAlertAmount || 0;

    const cashQueueDcs = savedDcs.filter(
      (dc) => dc.status === "cash" && (dc.cashAmount || 0) >= minAmount && (dc.cashAmount || 0) > 0
    );

    const existingCashDcRefs = new Set(
      cashQueueDcs.map((d) => d.invoiceRef || d.dcNo).filter(Boolean)
    );

    const pendingInvoices = cashInvoices.filter((inv) => {
      const balance = (inv.grandTotal || 0) - (inv.paymentReceived || 0);
      const isPaid = inv.status?.toLowerCase() === "paid" || balance <= 0;
      const meetsMin = balance >= minAmount;
      const isAlreadyInDc = existingCashDcRefs.has(inv.invNumber) || existingCashDcRefs.has(inv.dcNumber);
      return !isPaid && meetsMin && !isAlreadyInDc;
    });

    return {
      dcs: cashQueueDcs,
      invoices: pendingInvoices,
      totalCount: cashQueueDcs.length + pendingInvoices.length,
      totalAmount:
        cashQueueDcs.reduce((acc, d) => acc + (d.cashAmount || 0), 0) +
        pendingInvoices.reduce(
          (acc, inv) => acc + ((inv.grandTotal || 0) - (inv.paymentReceived || 0)),
          0
        ),
    };
  }, [savedDcs, cashInvoices, config.paymentReminderEnabled, config.minPaymentAlertAmount]);

  // 2. Return Items Reminders (Admin configured Cutoff Days, default 2)
  const returnReminders = useMemo(() => {
    if (!config.returnReminderEnabled) {
      return { dcs: [], count: 0, overdueCount: 0 };
    }

    const cutoff = config.returnCutoffDays || 2;
    const urgentDays = config.returnUrgentDays || 3;

    const pendingDcs = savedDcs.filter((dc) => {
      if (dc.status !== "pending") return false;
      const days = getDaysPending(dc);
      return days >= cutoff;
    });

    pendingDcs.sort((a, b) => getDaysPending(b) - getDaysPending(a));

    return {
      dcs: pendingDcs,
      count: pendingDcs.length,
      overdueCount: pendingDcs.filter((dc) => getDaysPending(dc) >= urgentDays).length,
    };
  }, [savedDcs, config.returnReminderEnabled, config.returnCutoffDays, config.returnUrgentDays]);

  // 3. Invoice Reminders
  const invoiceReminders = useMemo(() => {
    const returnedDcs = savedDcs.filter((dc) => dc.status === "returned");
    return {
      dcs: returnedDcs,
      count: returnedDcs.length,
    };
  }, [savedDcs]);

  const totalActionCount =
    paymentReminders.totalCount + returnReminders.count + invoiceReminders.count;

  // First Login Reminder Popup Check
  useEffect(() => {
    if (savedDcs.length === 0) return;
    if (!config.firstLoginPopupEnabled) return;

    const todayDateStr = new Date().toISOString().slice(0, 10);
    const lastLoginPopupDate = localStorage.getItem(STORAGE_KEYS.LAST_LOGIN_POPUP_DATE);
    const seenSession = sessionStorage.getItem(STORAGE_KEYS.SEEN_LOGIN_POPUP_SESSION);

    if (lastLoginPopupDate !== todayDateStr && !seenSession) {
      const hasPendingPayments = config.firstLoginIncludePayments && paymentReminders.totalCount > 0;
      const hasPendingReturns = config.firstLoginIncludeReturns && returnReminders.count > 0;
      const hasPendingInvoices = config.firstLoginIncludeInvoices && invoiceReminders.count > 0;

      if (hasPendingPayments || hasPendingReturns || hasPendingInvoices) {
        const timer = setTimeout(() => {
          setLoginPopupOpen(true);
          localStorage.setItem(STORAGE_KEYS.LAST_LOGIN_POPUP_DATE, todayDateStr);
          sessionStorage.setItem(STORAGE_KEYS.SEEN_LOGIN_POPUP_SESSION, "true");
          logReminderAction({
            action: "POPUP_SHOWN",
            label: "First Login Reminder Shown",
            details: `Displayed login reminder with ₹${paymentReminders.totalAmount.toLocaleString(
              "en-IN"
            )} pending from ${paymentReminders.totalCount} parties and ${
              returnReminders.count
            } overdue return sets.`,
            pendingAmount: paymentReminders.totalAmount,
            partiesCount: paymentReminders.totalCount,
            returnCount: returnReminders.count,
          });
          if (config.soundEnabled) playChime();
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [
    savedDcs.length,
    config.firstLoginPopupEnabled,
    config.firstLoginIncludePayments,
    config.firstLoginIncludeReturns,
    config.firstLoginIncludeInvoices,
    config.soundEnabled,
    paymentReminders.totalCount,
    returnReminders.count,
    invoiceReminders.count,
  ]);

  // Periodic Reminder Checker (Admin configured interval, default 4 hours)
  useEffect(() => {
    if (savedDcs.length === 0) return;

    const intervalMs = (config.paymentIntervalHours || 4) * 60 * 60 * 1000;

    const checkReminders = () => {
      const snoozedUntil = Number(localStorage.getItem(STORAGE_KEYS.SNOOZED_UNTIL) || 0);
      if (Date.now() < snoozedUntil) return;

      const now = Date.now();
      const todayDateStr = new Date().toISOString().slice(0, 10);

      const lastPaymentReminder = Number(
        localStorage.getItem(STORAGE_KEYS.LAST_PAYMENT_REMINDER) || 0
      );
      const lastReturnReminderDate = localStorage.getItem(STORAGE_KEYS.LAST_RETURN_REMINDER_DATE);

      const isPaymentDue = now - lastPaymentReminder >= intervalMs;
      const isReturnDue = lastReturnReminderDate !== todayDateStr;

      let triggered = false;

      // Case 1: Payment reminder
      if (isPaymentDue && paymentReminders.totalCount > 0 && config.paymentReminderEnabled) {
        localStorage.setItem(STORAGE_KEYS.LAST_PAYMENT_REMINDER, String(now));
        const firstParty = paymentReminders.dcs[0]?.hospitalName || paymentReminders.invoices[0]?.clientName || "Party";
        const others = paymentReminders.totalCount - 1;
        const partyLabel = others > 0 ? `${firstParty} (+${others} more)` : firstParty;

        setActiveBanner({
          type: "payment",
          title: "Payment Collection Reminder",
          message: `Pending from: ${partyLabel} — ₹${paymentReminders.totalAmount.toLocaleString("en-IN")}`,
          paymentCount: paymentReminders.totalCount,
          paymentTotal: paymentReminders.totalAmount,
        });
        playChime();
        triggered = true;
      }

      // Case 2: Daily morning/login return reminder
      if (!triggered && isReturnDue && returnReminders.count > 0 && config.returnReminderEnabled) {
        localStorage.setItem(STORAGE_KEYS.LAST_RETURN_REMINDER_DATE, todayDateStr);
        const firstHospital = returnReminders.dcs[0]?.hospitalName || "Hospital";
        const others = returnReminders.count - 1;
        const hospitalLabel = others > 0 ? `${firstHospital} (+${others} more)` : firstHospital;

        setActiveBanner({
          type: "return",
          title: `Items Return Reminder (≥ ${config.returnCutoffDays} Days)`,
          message: `Awaiting return from: ${hospitalLabel} (${returnReminders.count} set${
            returnReminders.count > 1 ? "s" : ""
          })`,
          returnCount: returnReminders.count,
        });
        playChime();
      }
    };

    const initialTimer = setTimeout(checkReminders, 2500);
    const periodicTimer = setInterval(checkReminders, 5 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(periodicTimer);
    };
  }, [
    savedDcs.length,
    paymentReminders,
    returnReminders,
    config.paymentIntervalHours,
    config.paymentReminderEnabled,
    config.returnReminderEnabled,
    config.returnCutoffDays,
  ]);

  // Auto dismiss toast banner based on admin config
  useEffect(() => {
    if (!activeBanner) return;
    const dismissSeconds = config.bannerAutoDismissSeconds;
    if (dismissSeconds && dismissSeconds > 0) {
      const timer = setTimeout(() => {
        setActiveBanner(null);
      }, dismissSeconds * 1000);
      return () => clearTimeout(timer);
    }
  }, [activeBanner, config.bannerAutoDismissSeconds]);

  return (
    <>
      {/* 1. FIRST LOGIN / MORNING WELCOME REMINDER MODAL */}
      <Dialog open={loginPopupOpen} onOpenChange={setLoginPopupOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg p-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-amber-300 dark:border-amber-900/60 shadow-2xl bg-white dark:bg-slate-950 z-[100] max-h-[90vh] flex flex-col [&>button]:hidden">
          {/* Modal Header */}
          <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-teal-800 p-4 sm:p-5 text-slate-950 relative overflow-hidden shrink-0">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between gap-3 relative z-20">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-slate-950 text-amber-400 flex items-center justify-center shadow-lg font-black shrink-0">
                  <BellRing className="w-6 h-6 animate-bounce" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-900/80 bg-white/20 px-2 py-0.5 rounded-full inline-block mb-1">
                    First Login Reminder
                  </span>
                  <DialogTitle className="text-lg sm:text-xl font-display font-extrabold text-white tracking-tight leading-snug">
                    Pending Collections &amp; Operations Alert
                  </DialogTitle>
                  <DialogDescription className="text-xs text-amber-100/90 leading-relaxed mt-0.5">
                    Welcome back! Here are the parties and items requiring your follow-up today.
                  </DialogDescription>
                </div>
              </div>

              {/* Dedicated Mobile & Desktop Close Cross Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLoginPopupOpen(false);
                  logReminderAction({
                    action: "DISMISSED",
                    label: "Popup Closed via Header Cross",
                    details: "User clicked close button on first login reminder popup",
                    pendingAmount: paymentReminders.totalAmount,
                    partiesCount: paymentReminders.totalCount,
                    returnCount: returnReminders.count,
                  });
                }}
                className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-xl bg-black/30 hover:bg-black/50 active:scale-90 text-white flex items-center justify-center transition-all cursor-pointer shadow-md border border-white/25 shrink-0 touch-manipulation z-30"
                aria-label="Close popup"
                title="Close"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Card 1: Pending Payments */}
            {paymentReminders.totalCount > 0 && config.firstLoginIncludePayments && (
              <div className="p-4 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/20 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                        Collect Pending Payments
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                        Total Pending: ₹{paymentReminders.totalAmount.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-600 text-white text-xs font-black">
                    {paymentReminders.totalCount} {paymentReminders.totalCount === 1 ? "Party" : "Parties"}
                  </Badge>
                </div>

                {/* Prominent list of parties pending payment */}
                <div className="space-y-2 pt-1">
                  {paymentReminders.dcs.map((dc) => (
                    <div
                      key={`popup-pay-${dc.id}`}
                      className="p-3 rounded-xl border border-emerald-300/70 dark:border-emerald-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-400">
                          Party:
                        </div>
                        <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {dc.hospitalName}
                        </div>
                        {dc.invoiceRef && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Cash Memo #{dc.invoiceRef}
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                        <div className="text-base font-black text-rose-600 dark:text-rose-400">
                          ₹{(dc.cashAmount || 0).toLocaleString("en-IN")}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setLoginPopupOpen(false);
                            onCollectPayment(dc);
                          }}
                          className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-2.5 shadow-xs gap-1"
                        >
                          <Wallet className="w-3 h-3" /> Collect
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Cash Invoices Pending */}
                  {paymentReminders.invoices.map((inv) => {
                    const balance = (inv.grandTotal || 0) - (inv.paymentReceived || 0);
                    return (
                      <div
                        key={`popup-inv-${inv.invNumber}`}
                        className="p-3 rounded-xl border border-sky-300/70 dark:border-sky-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] uppercase font-bold tracking-wider text-sky-600 dark:text-sky-400">
                            Party:
                          </div>
                          <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate">
                            {inv.clientName}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Invoice #{inv.invNumber}
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="text-right">
                            <div className="text-base font-black text-rose-600 dark:text-rose-400">
                              ₹{balance.toLocaleString("en-IN")}
                            </div>
                            <span className="text-[10px] text-slate-500">Balance</span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleRecordCashInvoicePayment(inv)}
                            className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-2.5 shadow-xs gap-1"
                          >
                            <Wallet className="w-3 h-3" /> Collect
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Card 2: Items Return (≥ Cutoff Days) */}
            {returnReminders.count > 0 && config.firstLoginIncludeReturns && (
              <div className="p-4 rounded-2xl border-2 border-cyan-500/40 bg-cyan-50/60 dark:bg-cyan-950/20 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-cyan-600 text-white flex items-center justify-center font-bold shrink-0">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                        Get Items Back (≥ {config.returnCutoffDays} Days Out)
                      </h4>
                      <p className="text-xs text-cyan-700 dark:text-cyan-400 font-semibold">
                        {returnReminders.count} dispatched surgery sets waiting for return
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-cyan-600 text-white text-xs font-black">
                    {returnReminders.count} Sets
                  </Badge>
                </div>

                <div className="space-y-2 pt-1">
                  {returnReminders.dcs.map((dc) => {
                    const days = getDaysPending(dc);
                    const isOverdue = days >= (config.returnUrgentDays || 3);
                    const totalQty = getTotalQty(dc);

                    return (
                      <div
                        key={`popup-ret-${dc.id}`}
                        className="p-3 rounded-xl border border-cyan-300/70 dark:border-cyan-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                            Awaiting return from:
                          </div>
                          <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate">
                            {dc.hospitalName}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="font-medium text-slate-700 dark:text-slate-300">DC #{dc.dcNo}</span>
                            {dc.doctorName && <span>• Dr. {dc.doctorName}</span>}
                            <span>• {totalQty} items</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                          <Badge
                            className={`text-[10px] font-black ${
                              isOverdue
                                ? "bg-rose-600 text-white"
                                : "bg-amber-500 text-slate-950 font-bold"
                            }`}
                          >
                            {days} Days Out {isOverdue ? "• Urgent" : ""}
                          </Badge>
                          <Button
                            size="sm"
                            onClick={() => {
                              setLoginPopupOpen(false);
                              onRecordReturn(dc);
                            }}
                            className="h-7 text-xs bg-cyan-700 hover:bg-cyan-800 text-white font-bold px-2.5 shadow-xs gap-1"
                          >
                            <RotateCcw className="w-3 h-3" /> Return
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* If all caught up */}
            {paymentReminders.totalCount === 0 && returnReminders.count === 0 && (
              <div className="py-6 text-center text-slate-500">
                <CheckCircle2 className="w-12 h-12 text-teal-600 mx-auto mb-2" />
                <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                  Great news! No overdue collections or returns.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
            {/* Dismiss & Remind Later options */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLoginPopupOpen(false);
                  logReminderAction({
                    action: "DISMISSED",
                    label: "Popup Dismissed via Footer",
                    details: "User clicked Dismiss button on first login reminder popup",
                    pendingAmount: paymentReminders.totalAmount,
                    partiesCount: paymentReminders.totalCount,
                    returnCount: returnReminders.count,
                  });
                }}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Dismiss
              </Button>
              {!showSnoozeOptions ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSnoozeOptions(true)}
                  className="text-xs text-slate-700 dark:text-slate-300 border-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 gap-1.5 flex-1 sm:flex-initial"
                >
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Remind Later...
                </Button>
              ) : null}
            </div>
            {showSnoozeOptions && (
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-200/80 dark:bg-slate-800 p-1.5 rounded-xl animate-in fade-in duration-200 w-full sm:w-auto">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 px-1">
                  Remind in:
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSnoozeOption("15m")}
                  className="h-7 text-xs bg-white dark:bg-slate-700 shadow-xs font-bold px-2.5 hover:bg-teal-50 hover:text-teal-800 border border-slate-300/60"
                >
                  ⏱️ 15 Mins
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSnoozeOption("1h")}
                  className="h-7 text-xs bg-white dark:bg-slate-700 shadow-xs font-bold px-2.5 hover:bg-teal-50 hover:text-teal-800 border border-slate-300/60"
                >
                  ⏳ 1 Hour
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSnoozeOption("tomorrow")}
                  className="h-7 text-xs bg-white dark:bg-slate-700 shadow-xs font-bold px-2.5 hover:bg-teal-50 hover:text-teal-800 border border-slate-300/60"
                >
                  📅 Tomorrow
                </Button>
              </div>
            )}

            {paymentReminders.totalCount > 0 ? (
              <Button
                size="sm"
                onClick={() => {
                  setLoginPopupOpen(false);
                  const firstParty =
                    paymentReminders.dcs[0]?.hospitalName ||
                    paymentReminders.invoices[0]?.clientName ||
                    "Party";
                  logReminderAction({
                    action: "COLLECT_CLICK",
                    label: `Collect from ${firstParty} Clicked`,
                    details: `Initiated payment collection of ₹${paymentReminders.totalAmount.toLocaleString(
                      "en-IN"
                    )}`,
                    pendingAmount: paymentReminders.totalAmount,
                    partiesCount: paymentReminders.totalCount,
                    returnCount: returnReminders.count,
                  });
                  if (paymentReminders.dcs.length > 0) {
                    onCollectPayment(paymentReminders.dcs[0]);
                  } else if (paymentReminders.invoices.length > 0) {
                    handleRecordCashInvoicePayment(paymentReminders.invoices[0]);
                  }
                }}
                className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md gap-1.5 w-full sm:w-auto ml-auto"
              >
                <Wallet className="w-3.5 h-3.5" />
                {paymentReminders.totalCount === 1
                  ? `Collect from ${
                      paymentReminders.dcs[0]?.hospitalName ||
                      paymentReminders.invoices[0]?.clientName ||
                      "Party"
                    } (₹${paymentReminders.totalAmount.toLocaleString("en-IN")})`
                  : `Collect from ${
                      paymentReminders.dcs[0]?.hospitalName ||
                      paymentReminders.invoices[0]?.clientName ||
                      "Party"
                    } (+${paymentReminders.totalCount - 1} more)`}
              </Button>
            ) : returnReminders.count > 0 ? (
              <Button
                size="sm"
                onClick={() => {
                  setLoginPopupOpen(false);
                  const targetDc = returnReminders.dcs[0];
                  logReminderAction({
                    action: "RETURN_CLICK",
                    label: `Return from ${targetDc?.hospitalName || "Hospital"} Clicked`,
                    details: `Initiated return recording for DC #${targetDc?.dcNo}`,
                    pendingAmount: paymentReminders.totalAmount,
                    partiesCount: paymentReminders.totalCount,
                    returnCount: returnReminders.count,
                  });
                  if (targetDc) {
                    onRecordReturn(targetDc);
                  }
                }}
                className="text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white shadow-md gap-1.5 w-full sm:w-auto ml-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {returnReminders.count === 1
                  ? `Record Return (${returnReminders.dcs[0]?.hospitalName || "Hospital"})`
                  : `Record Return Sets (${returnReminders.count})`}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. FLOATING RECURRING REMINDER BANNER */}
      {activeBanner && (
        <div className="fixed top-14 sm:top-20 left-3 right-3 sm:left-auto sm:right-4 z-50 sm:max-w-md sm:w-full animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto">
          <div className="rounded-2xl border-2 border-amber-500/40 bg-slate-950/95 text-white shadow-2xl p-3.5 sm:p-4 backdrop-blur-xl ring-1 ring-white/10">
            <div className="flex items-start justify-between gap-2.5 sm:gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
                  <BellRing className="w-5 h-5 animate-bounce" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs sm:text-sm text-amber-200 tracking-tight truncate">
                    {activeBanner.title}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 leading-relaxed break-words">
                    {activeBanner.message}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveBanner(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3.5 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {activeBanner.type === "payment"
                  ? `Every ${config.paymentIntervalHours || 4} Hours`
                  : "Daily Alert"}
              </span>

              {!showBannerSnooze ? (
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowBannerSnooze(true)}
                    className="h-7 text-xs text-slate-300 hover:text-white hover:bg-white/10 px-2.5 gap-1"
                  >
                    <Clock className="w-3 h-3 text-slate-400" />
                    Remind Later...
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setActiveBanner(null);
                      setIsOpen(true);
                      if (activeBanner.type === "payment") setActiveTab("payments");
                      else if (activeBanner.type === "return") setActiveTab("returns");
                    }}
                    className="h-7 text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold px-3 shadow-md"
                  >
                    View Details
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-1 bg-white/10 p-1 rounded-xl">
                  <span className="text-[10px] text-amber-200 font-black uppercase tracking-wider px-1">
                    Remind in:
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSnoozeOption("15m")}
                    className="h-6 text-[11px] text-white bg-white/10 hover:bg-white/20 px-2 font-bold"
                  >
                    ⏱️ 15m
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSnoozeOption("1h")}
                    className="h-6 text-[11px] text-white bg-white/10 hover:bg-white/20 px-2 font-bold"
                  >
                    ⏳ 1h
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSnoozeOption("tomorrow")}
                    className="h-6 text-[11px] text-white bg-white/10 hover:bg-white/20 px-2 font-bold"
                  >
                    📅 Tomorrow
                  </Button>
                  <button
                    onClick={() => setShowBannerSnooze(false)}
                    className="text-slate-400 hover:text-white px-1 text-xs"
                    title="Cancel"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. NOTIFICATION BELL TRIGGER & POPOVER PANEL */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            className={`relative h-9 px-3.5 gap-2 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 border ${
              totalActionCount > 0
                ? "bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold border-amber-300/40 shadow-amber-500/25"
                : "bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-teal-800 dark:text-teal-200 border-teal-300/70 dark:border-teal-800 font-bold"
            }`}
            title="DC Tracker Reminders & Notifications"
          >
            <div className="relative flex items-center justify-center">
              {totalActionCount > 0 ? (
                <BellRing className="w-4 h-4 text-amber-100 fill-amber-300/40 animate-pulse" />
              ) : (
                <Bell className="w-4 h-4 text-teal-600 dark:text-teal-400 fill-teal-500/20" />
              )}
              {totalActionCount > 0 && (
                <span className="absolute -top-2 -right-2.5 flex h-4 min-w-[18px] px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white shadow-md ring-2 ring-white dark:ring-slate-900 animate-bounce">
                  {totalActionCount}
                </span>
              )}
            </div>
            <span className="tracking-tight">Reminders</span>
            {totalActionCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-white text-[10px] font-black leading-tight">
                {totalActionCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="w-[94vw] sm:w-[460px] max-w-[460px] p-0 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl z-[90] overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3.5 bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      Tracker Reminders
                    </h3>
                    {totalActionCount > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300">
                        {totalActionCount} pending
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Follow-ups, returns &amp; cash invoices
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSound}
                  className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                  title={config.soundEnabled ? "Mute Reminder Sounds" : "Enable Reminder Sounds"}
                >
                  {config.soundEnabled ? (
                    <Volume2 className="w-3.5 h-3.5" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-rose-500" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Subtle Metric Badges */}
            <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-800 text-xs">
              <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-lg px-2.5 py-1.5 shadow-2xs">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">Collect</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 truncate block">
                  ₹{paymentReminders.totalAmount.toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-slate-400">
                  {paymentReminders.totalCount} {paymentReminders.totalCount === 1 ? "party" : "parties"}
                </span>
              </div>

              <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-lg px-2.5 py-1.5 shadow-2xs">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">Returns</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 block">
                  {returnReminders.count} <span className="text-[11px] font-normal text-slate-500">sets</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  ≥ {config.returnCutoffDays || 2}d out
                </span>
              </div>

              <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-lg px-2.5 py-1.5 shadow-2xs">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">Invoices</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 block">
                  {invoiceReminders.count} <span className="text-[11px] font-normal text-slate-500">pending</span>
                </span>
                <span className="text-[10px] text-slate-400">Awaiting cash</span>
              </div>
            </div>
          </div>

          {/* Body Tabs */}
          <Tabs
            defaultValue="all"
            value={activeTab}
            onValueChange={(val: any) => setActiveTab(val)}
            className="w-full"
          >
            <div className="px-3 pt-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
              <TabsList className="w-full grid grid-cols-4 h-8 bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                <TabsTrigger value="all" className="text-[10px] sm:text-[11px] font-semibold py-1 px-1">
                  All ({totalActionCount})
                </TabsTrigger>
                <TabsTrigger value="payments" className="text-[10px] sm:text-[11px] font-semibold py-1 px-1">
                  Pay ({paymentReminders.totalCount})
                </TabsTrigger>
                <TabsTrigger value="returns" className="text-[10px] sm:text-[11px] font-semibold py-1 px-1">
                  Ret ({returnReminders.count})
                </TabsTrigger>
                <TabsTrigger value="invoices" className="text-[10px] sm:text-[11px] font-semibold py-1 px-1">
                  Inv ({invoiceReminders.count})
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="max-h-[380px] overflow-y-auto p-3 space-y-2.5">
              {totalActionCount === 0 && (
                <div className="py-12 text-center text-slate-400">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-teal-500 mb-2" />
                  <p className="font-bold text-sm text-slate-700 dark:text-slate-200">
                    All Caught Up!
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    No pending payments, overdue item returns, or waiting invoices.
                  </p>
                </div>
              )}

              {/* Payments Tab / Section */}
              {(activeTab === "all" || activeTab === "payments") &&
                paymentReminders.dcs.map((dc) => (
                  <div
                    key={`pay-${dc.id}`}
                    className="p-3 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 hover:border-amber-300 transition-all flex flex-col gap-2 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                            Payment Due
                          </span>
                          <Badge variant="outline" className="text-[10px] h-4 border-amber-300 bg-amber-100/50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                            Every {config.paymentIntervalHours || 4}h
                          </Badge>
                        </div>
                        <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate mt-0.5">
                          {dc.hospitalName}
                        </h4>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          DC #{dc.dcNo} {dc.invoiceRef ? `• Memo #${dc.invoiceRef}` : ""}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-black text-rose-600 dark:text-rose-400">
                          ₹{(dc.cashAmount || 0).toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10px] text-slate-500">Pending</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-amber-200/50 dark:border-amber-900/40 gap-2">
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          onViewDc(dc, "cash");
                        }}
                        className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
                      >
                        View in Queue →
                      </button>

                      <Button
                        size="sm"
                        onClick={() => {
                          setIsOpen(false);
                          onCollectPayment(dc);
                        }}
                        className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 shadow-xs gap-1"
                      >
                        <Wallet className="w-3 h-3" />
                        Record Payment
                      </Button>
                    </div>
                  </div>
                ))}

              {/* Standalone Firestore Pending Invoices */}
              {(activeTab === "all" || activeTab === "payments" || activeTab === "invoices") &&
                paymentReminders.invoices.map((inv) => {
                  const balance = (inv.grandTotal || 0) - (inv.paymentReceived || 0);
                  return (
                    <div
                      key={`inv-${inv.invNumber}`}
                      className="p-3 rounded-xl border border-sky-200/80 dark:border-sky-900/40 bg-sky-50/50 dark:bg-sky-950/20 hover:border-sky-300 transition-all flex flex-col gap-2 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-sky-500" />
                            <span className="text-[11px] font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wide">
                              Cash Invoice Pending
                            </span>
                          </div>
                          <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate mt-0.5">
                            {inv.clientName}
                          </h4>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Invoice #{inv.invNumber} {inv.dcNumber ? `• DC #${inv.dcNumber}` : ""}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm font-black text-rose-600 dark:text-rose-400">
                            ₹{balance.toLocaleString("en-IN")}
                          </div>
                          <div className="text-[10px] text-slate-500">Balance</div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between pt-2 border-t border-sky-200/60 dark:border-sky-900/40 gap-2">
                        <a
                          href={`/cash-invoice?viewInv=${encodeURIComponent(inv.invNumber)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-sky-700 hover:text-sky-900 dark:text-sky-400 dark:hover:text-sky-200 font-medium inline-flex items-center gap-1"
                        >
                          Open Invoice <ArrowRight className="w-3 h-3" />
                        </a>

                        <Button
                          size="sm"
                          onClick={() => handleRecordCashInvoicePayment(inv)}
                          className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 shadow-xs gap-1"
                        >
                          <Wallet className="w-3 h-3" />
                          Record Payment
                        </Button>
                      </div>
                    </div>
                  );
                })}

              {/* Item Returns Tab / Section */}
              {(activeTab === "all" || activeTab === "returns") &&
                returnReminders.dcs.map((dc) => {
                  const days = getDaysPending(dc);
                  const isOverdue = days >= (config.returnUrgentDays || 3);
                  const totalQty = getTotalQty(dc);

                  return (
                    <div
                      key={`ret-${dc.id}`}
                      className={`p-3 rounded-xl border transition-all flex flex-col gap-2 shadow-xs ${
                        isOverdue
                          ? "border-rose-300 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20"
                          : "border-amber-200 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/15"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              className={`text-[10px] h-4 font-black ${
                                isOverdue
                                  ? "bg-rose-600 text-white"
                                  : "bg-amber-500 text-slate-950 font-bold"
                              }`}
                            >
                              {days} Days Out {isOverdue ? "• Urgent" : "• Cutoff Crossed"}
                            </Badge>
                            <span className="text-[10px] text-slate-500">
                              {totalQty} item{totalQty > 1 ? "s" : ""}
                            </span>
                          </div>
                          <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate mt-1">
                            {dc.hospitalName}
                          </h4>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            DC #{dc.dcNo} {dc.doctorName ? `• Dr. ${dc.doctorName}` : ""}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="text-[10px] font-semibold text-slate-500 block">
                            Daily Alert
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 gap-2">
                        <button
                          onClick={() => {
                            setIsOpen(false);
                            onViewDc(dc, "pending");
                          }}
                          className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
                        >
                          View DC Details →
                        </button>

                        <Button
                          size="sm"
                          onClick={() => {
                            setIsOpen(false);
                            onRecordReturn(dc);
                          }}
                          className="h-7 text-xs bg-cyan-700 hover:bg-cyan-800 text-white font-bold px-3 shadow-xs gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Record Return
                        </Button>
                      </div>
                    </div>
                  );
                })}

              {/* Invoices Tab / Section */}
              {(activeTab === "all" || activeTab === "invoices") &&
                invoiceReminders.dcs.map((dc) => (
                  <div
                    key={`inv-dc-${dc.id}`}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:border-teal-300 transition-all flex flex-col gap-2 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] h-4 border-slate-300 text-slate-700 dark:text-slate-300">
                            Items Returned
                          </Badge>
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                            Awaiting Cash Memo / Invoice
                          </span>
                        </div>
                        <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate mt-1">
                          {dc.hospitalName}
                        </h4>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          DC #{dc.dcNo} {dc.returnedBy ? `• Ret by ${dc.returnedBy}` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 gap-2">
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          onViewDc(dc, "returned");
                        }}
                        className="text-[11px] text-teal-600 dark:text-teal-400 font-bold hover:underline"
                      >
                        Open in Returned Queue →
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {/* Footer */}
            <div className="bg-slate-100 dark:bg-slate-900/90 px-3 py-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1 text-[10px] sm:text-[11px]">
                <Clock className="w-3 h-3 text-teal-600 shrink-0" />
                <span className="truncate">Pay: {config.paymentIntervalHours || 4}h • Ret: ≥{config.returnCutoffDays || 2}d</span>
              </span>

              <div className="flex items-center gap-1.5 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsOpen(false);
                    setLoginPopupOpen(true);
                  }}
                  className="h-6 text-[10px] font-bold text-amber-800 dark:text-amber-300 border-amber-300/80 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 px-2 gap-1"
                >
                  <Sparkles className="w-3 h-3 text-amber-500 shrink-0" /> Test Popup
                </Button>

                {!showPopoverSnooze ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPopoverSnooze(true)}
                    className="h-6 text-[10px] text-slate-600 dark:text-slate-300 px-2 hover:bg-white dark:hover:bg-slate-800 gap-1"
                  >
                    <Clock className="w-3 h-3 text-slate-400" /> Remind Later
                  </Button>
                ) : (
                  <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-lg">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSnoozeOption("15m")}
                      className="h-5 text-[9px] font-bold px-1.5 bg-white dark:bg-slate-700 hover:bg-teal-50 hover:text-teal-900 border border-slate-300/40"
                    >
                      15m
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSnoozeOption("1h")}
                      className="h-5 text-[9px] font-bold px-1.5 bg-white dark:bg-slate-700 hover:bg-teal-50 hover:text-teal-900 border border-slate-300/40"
                    >
                      1h
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSnoozeOption("tomorrow")}
                      className="h-5 text-[9px] font-bold px-1.5 bg-white dark:bg-slate-700 hover:bg-teal-50 hover:text-teal-900 border border-slate-300/40"
                    >
                      Tomorrow
                    </Button>
                    <button
                      onClick={() => setShowPopoverSnooze(false)}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-white px-1 text-[10px]"
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Tabs>
        </PopoverContent>
      </Popover>

      {/* Standalone Cash Invoice Payment Modal */}
      <Dialog
        open={cashInvoicePaymentModal.open}
        onOpenChange={(open) => {
          if (!open && !cashInvoicePaymentModal.isSaving) {
            setCashInvoicePaymentModal((prev) => ({ ...prev, open: false, invoice: null }));
          }
        }}
      >
        <DialogContent className="max-w-md p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Wallet className="w-5 h-5 text-emerald-600" />
              Record Cash Invoice Payment
            </DialogTitle>
            <DialogDescription>
              {cashInvoicePaymentModal.invoice && (
                <div className="mt-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                  <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {cashInvoicePaymentModal.invoice.clientName}
                  </div>
                  <div className="text-slate-500">
                    Invoice #{cashInvoicePaymentModal.invoice.invNumber}
                    {cashInvoicePaymentModal.invoice.dcNumber
                      ? ` • DC #${cashInvoicePaymentModal.invoice.dcNumber}`
                      : ""}
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                    <span>Grand Total: ₹{cashInvoicePaymentModal.invoice.grandTotal?.toLocaleString("en-IN") || 0}</span>
                    <span>Received: ₹{cashInvoicePaymentModal.invoice.paymentReceived?.toLocaleString("en-IN") || 0}</span>
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ci-payment-amount" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Payment Amount Received (₹)
              </Label>
              <Input
                id="ci-payment-amount"
                type="number"
                min="1"
                placeholder="Enter amount"
                value={cashInvoicePaymentModal.amount}
                onChange={(e) =>
                  setCashInvoicePaymentModal((prev) => ({ ...prev, amount: e.target.value }))
                }
                className="font-bold text-base"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ci-payment-remarks" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Remarks / Mode (Optional)
              </Label>
              <Input
                id="ci-payment-remarks"
                placeholder="e.g. Cash, UPI / GPay, Cheque"
                value={cashInvoicePaymentModal.remarks}
                onChange={(e) =>
                  setCashInvoicePaymentModal((prev) => ({ ...prev, remarks: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() =>
                setCashInvoicePaymentModal((prev) => ({ ...prev, open: false, invoice: null }))
              }
              disabled={cashInvoicePaymentModal.isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmCashInvoicePayment}
              disabled={cashInvoicePaymentModal.isSaving}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1.5"
            >
              {cashInvoicePaymentModal.isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
