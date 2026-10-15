import React, { useState, useMemo, useEffect } from "react";
import { Customer, normalizeHospitalName, resolveCustomerAlias } from "@/lib/customerStorage";
import { CashInvoiceData, fetchCashInvoicesFromFirestore } from "@/services/cashInvoiceFirebaseService";
import { printCashMemo, printBatchCashMemos } from "@/lib/cashInvoicePrint";
import { printCustomerCashLedger, CustomerLedgerSummary } from "@/lib/customerLedgerPrint";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  BookOpen,
  Printer,
  Share2,
  Receipt,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Phone,
  Building2,
  FileText,
  ArrowUpDown,
  Filter,
  DollarSign,
  Info,
  Calendar,
  X,
  MapPin,
  RefreshCw,
  Eye,
  Edit,
} from "lucide-react";
import { CashInvoicePreview } from "@/components/cash-invoice/CashInvoicePreview";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface CustomerCashLedgerModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  cachedInvoices?: CashInvoiceData[];
}

export const CustomerCashLedgerModal: React.FC<CustomerCashLedgerModalProps> = ({
  customer,
  isOpen,
  onClose,
  cachedInvoices = [],
}) => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<CashInvoiceData[]>(cachedInvoices);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "due" | "paid">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [invoiceToView, setInvoiceToView] = useState<CashInvoiceData | null>(null);
  const [isPrintChoiceOpen, setIsPrintChoiceOpen] = useState(false);

  // Keep local invoices in sync with props or fetch fresh if empty
  useEffect(() => {
    if (!isOpen || !customer) return;

    if (cachedInvoices.length > 0) {
      setInvoices(cachedInvoices);
    } else {
      setIsLoading(true);
      fetchCashInvoicesFromFirestore()
        .then((data) => {
          setInvoices(data || []);
        })
        .catch((err) => {
          console.warn("Could not fetch invoices in ledger modal:", err);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, customer, cachedInvoices]);

  // Robust matching for this customer
  const customerInvoices = useMemo(() => {
    if (!customer?.name) return [];

    const targetRaw = customer.name.toLowerCase().trim();
    const targetCanonical = resolveCustomerAlias(customer.name).toLowerCase().trim();
    const targetNormalized = normalizeHospitalName(customer.name).toLowerCase().trim();

    return invoices.filter((inv) => {
      if (!inv || !inv.clientName) return false;
      const invRaw = inv.clientName.toLowerCase().trim();
      const invCanonical = resolveCustomerAlias(inv.clientName).toLowerCase().trim();
      const invNormalized = normalizeHospitalName(inv.clientName).toLowerCase().trim();

      return (
        invRaw === targetRaw ||
        invCanonical === targetCanonical ||
        invNormalized === targetNormalized ||
        (targetRaw.length > 5 && invRaw.includes(targetRaw)) ||
        (invRaw.length > 5 && targetRaw.includes(invRaw))
      );
    });
  }, [customer, invoices]);

  // Invoices that still have pending / due balance
  const pendingInvoices = useMemo(() => {
    return customerInvoices.filter((inv) => {
      const billed = Number(inv.grandTotal) || 0;
      const received = Number(inv.paymentReceived) || 0;
      return billed - received > 0;
    });
  }, [customerInvoices]);

  // Ledger summary figures
  const summary: CustomerLedgerSummary = useMemo(() => {
    let totalBilled = 0;
    let totalReceived = 0;

    customerInvoices.forEach((inv) => {
      const billed = Number(inv.grandTotal) || 0;
      const received = Number(inv.paymentReceived) || 0;
      totalBilled += billed;
      totalReceived += received;
    });

    const balanceDue = Math.max(0, totalBilled - totalReceived);

    return {
      totalBilled,
      totalReceived,
      balanceDue,
      invoiceCount: customerInvoices.length,
    };
  }, [customerInvoices]);

  // Filtered & sorted invoice list for the ledger table
  const displayInvoices = useMemo(() => {
    let result = [...customerInvoices];

    // Status filter
    if (statusFilter === "due") {
      result = result.filter((inv) => {
        const billed = Number(inv.grandTotal) || 0;
        const received = Number(inv.paymentReceived) || 0;
        return billed - received > 0;
      });
    } else if (statusFilter === "paid") {
      result = result.filter((inv) => {
        const billed = Number(inv.grandTotal) || 0;
        const received = Number(inv.paymentReceived) || 0;
        return billed > 0 && billed <= received;
      });
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((inv) => {
        const num = (inv.invNumber || "").toLowerCase();
        const dc = (inv.dcNumber || "").toLowerCase();
        const items = Array.isArray(inv.items)
          ? inv.items.map((i) => i.description || "").join(" ").toLowerCase()
          : "";
        return num.includes(q) || dc.includes(q) || items.includes(q);
      });
    }

    // Sort order
    result.sort((a, b) => {
      const dateA = a.invDate ? new Date(a.invDate).getTime() : a.savedAt || 0;
      const dateB = b.invDate ? new Date(b.invDate).getTime() : b.savedAt || 0;
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [customerInvoices, statusFilter, searchQuery, sortOrder]);

  if (!customer) return null;

  // Print full statement
  const handlePrintStatement = () => {
    setIsPrintChoiceOpen(false);
    if (customerInvoices.length === 0) {
      toast.info("No cash invoices recorded for this customer yet.");
      return;
    }
    const success = printCustomerCashLedger(customer, customerInvoices, summary);
    if (success) {
      toast.success("Printing Cash Invoice Ledger Statement (same tab)...");
    }
  };

  // Print actual invoices (all pending bills)
  const handlePrintPendingInvoices = () => {
    setIsPrintChoiceOpen(false);
    const targets = pendingInvoices.length > 0 ? pendingInvoices : customerInvoices;
    if (targets.length === 0) {
      toast.info("No cash invoices recorded for this customer to print.");
      return;
    }
    const success = printBatchCashMemos(targets);
    if (success) {
      toast.success(
        pendingInvoices.length > 0
          ? `Printing ${pendingInvoices.length} pending cash invoice${pendingInvoices.length > 1 ? "s" : ""} (same tab)...`
          : `Printing ${customerInvoices.length} cash invoice${customerInvoices.length > 1 ? "s" : ""} (same tab)...`
      );
    }
  };

  // WhatsApp share statement
  const handleWhatsAppShare = () => {
    const primaryPhone =
      customer.mobile ||
      customer.phone ||
      customer.personalNumber ||
      customer.hospitalNumber ||
      (Array.isArray(customer.contacts) && customer.contacts.length > 0
        ? customer.contacts[0].phone
        : "");

    const cleanPhone = primaryPhone.replace(/[^0-9]/g, "");

    const currentDate = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    // Top recent 5 invoices
    const recentBreakdown = displayInvoices
      .slice(0, 5)
      .map((inv) => {
        const billed = Number(inv.grandTotal) || 0;
        const received = Number(inv.paymentReceived) || 0;
        const due = Math.max(0, billed - received);
        return `• Inv #${inv.invNumber || "N/A"} (${inv.invDate || "Recent"}): Billed ₹${billed.toLocaleString("en-IN")} | Recv ₹${received.toLocaleString("en-IN")}${
          due > 0 ? ` | *Due ₹${due.toLocaleString("en-IN")}*` : " | Paid"
        }`;
      })
      .join("\n");

    const message = [
      `*SRR ORTHO PLUS*`,
      `*CASH INVOICE LEDGER STATEMENT*`,
      `Hospital / Party: *${customer.name}*`,
      `Date: ${currentDate}`,
      `-----------------------------------------`,
      `*LEDGER SUMMARY (CASH INVOICES ONLY):*`,
      `• Total Billed: ₹${summary.totalBilled.toLocaleString("en-IN")}`,
      `• Total Received: ₹${summary.totalReceived.toLocaleString("en-IN")}`,
      `• *NET BALANCE DUE: ₹${summary.balanceDue.toLocaleString("en-IN")}*`,
      `• Total Cash Invoices: ${summary.invoiceCount}`,
      `-----------------------------------------`,
      recentBreakdown ? `*RECENT CASH INVOICES:*\n${recentBreakdown}\n-----------------------------------------` : "",
      summary.balanceDue > 0
        ? `Please settle the outstanding balance at your convenience.\nPayment via UPI: *9396857455@ybl*`
        : `All recorded cash invoices are fully cleared. Thank you!`,
      `\nFor account queries, please contact: +91 9396857455\nSRR Ortho Plus, Ameerpet / Kalyan Nagar, Hyderabad.`,
    ]
      .filter(Boolean)
      .join("\n");

    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    window.open(waUrl, "_blank");
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-background border-border">
        {/* Header with clear scope distinction - No buttons in header to avoid any overlap with X close button */}
        <DialogHeader className="p-4 sm:p-5 pr-14 border-b border-border bg-slate-50/80 dark:bg-slate-900/60 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-950/80 dark:border-indigo-800 dark:text-indigo-300 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight truncate">
                  {customer.name}
                </DialogTitle>
                <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800 text-[10.5px] font-bold">
                  Cash Invoice Ledger
                </Badge>
                {summary.balanceDue > 0 ? (
                  <Badge className="bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800 text-[10.5px] font-bold">
                    Outstanding: ₹{summary.balanceDue.toLocaleString("en-IN")}
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 text-[10.5px] font-bold">
                    All Dues Cleared
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                  Scope: Tracks only Cash Invoices &amp; settlements
                </span>
                <span>•</span>
                <span>{summary.invoiceCount} cash {summary.invoiceCount === 1 ? "invoice" : "invoices"} on record</span>
                {customer.address && (
                  <>
                    <span>•</span>
                    <span className="truncate max-w-[280px]" title={customer.address}>
                      {customer.address}
                    </span>
                  </>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Explicit Scope Clarification Banner */}
          <div className="p-2.5 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/80 text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>
                <strong>Note:</strong> This ledger is strictly for <strong>Cash Invoices</strong>. Delivery Challans (DCs) and tax invoices are handled under their dedicated DC &amp; Tax Invoice workflows.
              </span>
            </div>
            {customer.phone || customer.mobile ? (
              <a
                href={`tel:${customer.phone || customer.mobile}`}
                className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 hover:underline flex items-center gap-1 shrink-0"
              >
                <Phone className="w-3 h-3" /> {customer.phone || customer.mobile}
              </a>
            ) : null}
          </div>

          {/* Top 3 KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="p-3.5 border-border bg-card/60 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Total Billed (Debits)
                </span>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-bold">Gross</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-foreground mt-1 font-mono">
                ₹{summary.totalBilled.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Across {summary.invoiceCount} cash {summary.invoiceCount === 1 ? "memo" : "memos"}
              </p>
            </Card>

            <Card className="p-3.5 border-border bg-card/60 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Payments Received (Credits)
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">Settled</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1 font-mono">
                ₹{summary.totalReceived.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {summary.totalBilled > 0
                  ? `${((summary.totalReceived / summary.totalBilled) * 100).toFixed(0)}% of total billings cleared`
                  : "No billings recorded"}
              </p>
            </Card>

            <Card
              className={`p-3.5 border shadow-2xs ${
                summary.balanceDue > 0
                  ? "bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-900"
                  : "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Net Balance Due
                </span>
                {summary.balanceDue > 0 ? (
                  <Badge variant="destructive" className="text-[9.5px] px-1.5 py-0 h-4 font-bold">
                    Pending
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-600 text-white text-[9.5px] px-1.5 py-0 h-4 font-bold">
                    Cleared
                  </Badge>
                )}
              </div>
              <div
                className={`text-xl sm:text-2xl font-black mt-1 font-mono ${
                  summary.balanceDue > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"
                }`}
              >
                ₹{summary.balanceDue.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {summary.balanceDue > 0 ? "Outstanding balance receivable" : "Account is fully settled"}
              </p>
            </Card>
          </div>

          {/* Filters & Search Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <Button
                size="sm"
                variant={statusFilter === "all" ? "default" : "outline"}
                onClick={() => setStatusFilter("all")}
                className={`h-7 text-xs font-bold ${
                  statusFilter === "all" ? "bg-indigo-600 hover:bg-indigo-700 text-white" : ""
                }`}
              >
                All Memos ({customerInvoices.length})
              </Button>
              <Button
                size="sm"
                variant={statusFilter === "due" ? "default" : "outline"}
                onClick={() => setStatusFilter("due")}
                className={`h-7 text-xs font-bold ${
                  statusFilter === "due"
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "text-red-600 hover:bg-red-50 border-red-200"
                }`}
              >
                Due Only (
                {
                  customerInvoices.filter(
                    (i) => (Number(i.grandTotal) || 0) - (Number(i.paymentReceived) || 0) > 0
                  ).length
                }
                )
              </Button>
              <Button
                size="sm"
                variant={statusFilter === "paid" ? "default" : "outline"}
                onClick={() => setStatusFilter("paid")}
                className={`h-7 text-xs font-bold ${
                  statusFilter === "paid"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                }`}
              >
                Fully Paid (
                {
                  customerInvoices.filter(
                    (i) =>
                      (Number(i.grandTotal) || 0) > 0 &&
                      (Number(i.grandTotal) || 0) <= (Number(i.paymentReceived) || 0)
                  ).length
                }
                )
              </Button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
                <Input
                  placeholder="Search invoice or DC #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
                className="h-8 text-xs font-bold gap-1 px-2 text-muted-foreground"
                title={`Sort by date: currently ${sortOrder === "newest" ? "Newest First" : "Oldest First"}`}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                {sortOrder === "newest" ? "Newest" : "Oldest"}
              </Button>
            </div>
          </div>

          {/* Invoices Ledger Table */}
          {displayInvoices.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl p-8 sm:p-12 text-center bg-muted/20">
              <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <h4 className="text-sm font-bold text-foreground">
                {customerInvoices.length === 0
                  ? `No Cash Invoices found for ${customer.name}`
                  : "No cash invoices match your filter"}
              </h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                {customerInvoices.length === 0
                  ? "This customer ledger tracks only Cash Invoices. No cash invoices have been recorded for this customer yet."
                  : "Try clearing your search query or switching filters to view all cash memos."}
              </p>
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden shadow-2xs bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-slate-50 dark:bg-slate-900/80">
                      <th className="py-2.5 px-3 text-left font-bold text-muted-foreground w-10 text-center">#</th>
                      <th className="py-2.5 px-3 text-left font-bold text-muted-foreground w-28">Date</th>
                      <th className="py-2.5 px-3 text-left font-bold text-muted-foreground w-36">Invoice #</th>
                      <th className="py-2.5 px-3 text-left font-bold text-muted-foreground w-32">DC Ref</th>
                      <th className="py-2.5 px-3 text-right font-bold text-muted-foreground w-32">Billed (₹)</th>
                      <th className="py-2.5 px-3 text-right font-bold text-muted-foreground w-32">Received (₹)</th>
                      <th className="py-2.5 px-3 text-right font-bold text-muted-foreground w-32">Balance Due (₹)</th>
                      <th className="py-2.5 px-3 text-center font-bold text-muted-foreground w-24">Status</th>
                      <th className="py-2.5 px-3 text-right font-bold text-muted-foreground w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {displayInvoices.map((inv, idx) => {
                      const grandTotal = Number(inv.grandTotal) || 0;
                      const received = Number(inv.paymentReceived) || 0;
                      const balance = Math.max(0, grandTotal - received);

                      return (
                        <tr
                          key={inv.invNumber || `inv_${idx}`}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50 transition-colors"
                        >
                          <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 text-foreground whitespace-nowrap">
                            {inv.invDate
                              ? new Date(inv.invDate).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-foreground whitespace-nowrap">
                            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11.5px] border border-slate-200 dark:border-slate-700">
                              {inv.invNumber || "—"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {inv.dcNumber ? (
                              <span className="text-teal-700 dark:text-teal-400 font-semibold font-mono">
                                {inv.dcNumber}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-foreground font-mono">
                            ₹{grandTotal.toLocaleString("en-IN")}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                            ₹{received.toLocaleString("en-IN")}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-black font-mono ${
                              balance > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"
                            }`}
                          >
                            ₹{balance.toLocaleString("en-IN")}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {balance === 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                                Paid
                              </span>
                            ) : received > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                                Partial
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800">
                                Due
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => printCashMemo(inv)}
                                className="h-6 w-6 text-slate-500 hover:text-teal-700 hover:bg-teal-50"
                                title="Print / PDF this Cash Memo"
                              >
                                <Printer className="w-3 h-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setInvoiceToView(inv)}
                                className="h-6 w-6 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50"
                                title="View Cash Invoice"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-slate-50 dark:bg-slate-900/80 font-bold">
                      <td colSpan={4} className="py-2.5 px-3 text-right uppercase text-[11px] text-muted-foreground">
                        Total ({displayInvoices.length} {displayInvoices.length === 1 ? "Memo" : "Memos"}):
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-foreground font-black">
                        ₹
                        {displayInvoices
                          .reduce((s, i) => s + (Number(i.grandTotal) || 0), 0)
                          .toLocaleString("en-IN")}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400 font-black">
                        ₹
                        {displayInvoices
                          .reduce((s, i) => s + (Number(i.paymentReceived) || 0), 0)
                          .toLocaleString("en-IN")}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-red-600 dark:text-red-400 font-black">
                        ₹
                        {displayInvoices
                          .reduce(
                            (s, i) =>
                              s +
                              Math.max(
                                0,
                                (Number(i.grandTotal) || 0) - (Number(i.paymentReceived) || 0)
                              ),
                            0
                          )
                          .toLocaleString("en-IN")}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with Actions at Bottom */}
        <div className="p-3 sm:p-4 border-t border-border bg-slate-50/90 dark:bg-slate-900/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                summary.balanceDue > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
              }`}
            ></span>
            <span className="font-medium text-foreground">
              Customer Ledger Status:{" "}
              {summary.balanceDue > 0 ? (
                <span className="font-bold text-red-600 dark:text-red-400">
                  Pending ₹{summary.balanceDue.toLocaleString("en-IN")} across cash memos
                </span>
              ) : (
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  All cash invoices are fully cleared
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 px-4 text-xs font-bold rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-xs shrink-0 whitespace-nowrap"
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={handleWhatsAppShare}
              disabled={customerInvoices.length === 0}
              className="h-9 px-4 text-xs font-bold gap-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs disabled:opacity-50 shrink-0 whitespace-nowrap"
              title="Share statement on WhatsApp"
            >
              <Share2 className="w-4 h-4 text-white shrink-0" />
              <span>WhatsApp</span>
            </Button>
            <Button
              type="button"
              onClick={() => setIsPrintChoiceOpen(true)}
              disabled={customerInvoices.length === 0}
              className="h-9 px-5 min-w-[145px] text-xs font-bold gap-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs disabled:opacity-50 shrink-0 whitespace-nowrap inline-flex items-center justify-center"
              title="Print statement or pending cash memos"
            >
              <Printer className="w-4 h-4 text-white shrink-0" />
              <span>Print Statement</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Print Options Choice Dialog */}
    <Dialog open={isPrintChoiceOpen} onOpenChange={setIsPrintChoiceOpen}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-background border-border rounded-2xl shadow-xl z-[70]">
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border bg-slate-50/80 dark:bg-slate-900/60 pr-12">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-300 flex items-center justify-center shrink-0">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Print Options
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Choose print format for {customer.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-5 space-y-3">
          {/* Option 1: Statement */}
          <button
            type="button"
            onClick={handlePrintStatement}
            className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-indigo-500 bg-white hover:bg-indigo-50/40 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-indigo-500 transition-all group flex items-start gap-3.5 shadow-2xs"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform mt-0.5">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                  1. Ledger Statement
                </span>
                <Badge variant="outline" className="text-[10px] font-semibold border-indigo-200 text-indigo-700 dark:border-indigo-800 dark:text-indigo-300">
                  Summary A4
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Single-page statement of account with total debits, credits, net pending balance due, and chronological invoice listing.
              </p>
            </div>
          </button>

          {/* Option 2: Actual Pending Invoices */}
          <button
            type="button"
            onClick={handlePrintPendingInvoices}
            disabled={customerInvoices.length === 0}
            className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-teal-500 bg-white hover:bg-teal-50/40 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-teal-500 transition-all group flex items-start gap-3.5 shadow-2xs disabled:opacity-50 disabled:pointer-events-none"
          >
            <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform mt-0.5">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm text-foreground group-hover:text-teal-700 dark:group-hover:text-teal-400">
                  2. Pending Invoices
                </span>
                <Badge className={`${pendingInvoices.length > 0 ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800" : "bg-emerald-50 text-emerald-700 border-emerald-200"} text-[10px] font-bold`}>
                  {pendingInvoices.length > 0 ? `${pendingInvoices.length} Bills Due (₹${summary.balanceDue.toLocaleString("en-IN")})` : "All Bills Paid"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Prints all {pendingInvoices.length > 0 ? `${pendingInvoices.length} pending` : "recorded"} actual cash memo invoices with item details, rates, totals, and UPI payment QR codes.
              </p>
            </div>
          </button>
        </div>

        <div className="px-4 py-3 border-t border-border bg-slate-50/70 dark:bg-slate-900/50 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPrintChoiceOpen(false)}
            className="text-xs h-8 font-semibold"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Cash Invoice Preview Modal */}
    <Dialog open={Boolean(invoiceToView)} onOpenChange={(open) => !open && setInvoiceToView(null)}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-slate-900 border-border rounded-2xl z-[60]">
        <DialogHeader className="flex flex-row items-center justify-between pb-3 pr-14 sm:pr-16 border-b border-border">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Receipt className="w-5 h-5 text-teal-700 dark:text-teal-400" />
            Cash Memo — {invoiceToView?.invNumber}
          </DialogTitle>
          <div className="flex items-center gap-2 shrink-0 sm:mr-6">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (invoiceToView) {
                  onClose();
                  navigate(`/cash-invoice?viewInv=${encodeURIComponent(invoiceToView.invNumber)}`);
                }
              }}
              className="gap-1.5 h-8 text-xs font-semibold rounded-md border-slate-300"
              title="Edit in full Cash Memo editor"
            >
              <Edit className="w-3.5 h-3.5" /> Edit Invoice
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (invoiceToView) {
                  printCashMemo(invoiceToView);
                }
              }}
              className="bg-teal-700 hover:bg-teal-800 text-white font-bold gap-1.5 h-8 text-xs rounded-md"
            >
              <Printer className="w-3.5 h-3.5" /> Print / PDF
            </Button>
          </div>
        </DialogHeader>

        {invoiceToView && (
          <div className="py-2">
            <CashInvoicePreview invoice={invoiceToView} showPrintButton={false} />
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
};

export default CustomerCashLedgerModal;
