import React, { useState, useMemo } from "react";
import {
  BankTransaction,
  BankAccount,
  ExpenseCategory,
  saveBankTransactionToFirestore,
} from "@/services/bankAccountFirebaseService";
import {
  getDeliveryTeamPersonnelNames,
  normalizePersonnelName,
} from "@/lib/personnelStorage";
import {
  runAutoExpenseTagRules,
  predictExpenseTag,
  ExpenseTagSuggestion,
} from "@/lib/autoExpenseTagEngine";
import {
  Sparkles,
  Tag,
  UserCheck,
  CheckCircle2,
  Fuel,
  Utensils,
  Car,
  Wrench,
  BadgeIndianRupee,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Calendar,
  Building2,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  AlertTriangle,
  MapPin,
  Navigation,
  Mail,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface ExpenseTaggingTabProps {
  transactions: BankTransaction[];
  accounts: BankAccount[];
  onRefresh: () => void;
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Fuel / Petrol",
  "Food / Meals",
  "Travel / Vehicle",
  "Salary / Advance",
  "Vehicle Maintenance",
  "Spot Payout / Allowance",
  "Other Operational Expense",
];

export const ExpenseTaggingTab: React.FC<ExpenseTaggingTabProps> = ({
  transactions,
  accounts,
  onRefresh,
}) => {
  const [selectedPersonnel, setSelectedPersonnel] = useState<string>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "tagged" | "untagged">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Map<string, ExpenseTagSuggestion>>(new Map());

  // Default Bank Account to 1538 account
  const defaultAccId = useMemo(() => {
    const acc1538 = accounts.find((a) =>
      a.accountNumber?.includes("1538") || a.accountName?.includes("1538") || a.id.includes("1538")
    );
    return acc1538?.id || accounts.find((a) => a.isDefault)?.id || accounts[0]?.id || "";
  }, [accounts]);

  const [selectedAccountId, setSelectedAccountId] = useState<string>(defaultAccId);
  const [dateRangeFilter, setDateRangeFilter] = useState<"today" | "week" | "month" | "all">("today");

  // Always force 1538 account and 'today' filter whenever tab is loaded/mounted
  React.useEffect(() => {
    if (defaultAccId) {
      setSelectedAccountId(defaultAccId);
    }
    setDateRangeFilter("today");
  }, [defaultAccId]);

  const handleAccountChange = (newAccId: string) => {
    const isTarget1538 = newAccId === defaultAccId || newAccId.includes("1538");
    if (!isTarget1538) {
      toast.warning("Caution: Daily UPI delivery expenses are primarily tracked from HDFC 1538 Account!", {
        description: "Showing debits for selected account. Be sure to verify statement before tagging.",
        duration: 4500,
      });
    }
    setSelectedAccountId(newAccId);
  };

  const selectedAccountObj = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId),
    [accounts, selectedAccountId]
  );

  const is1538 = useMemo(() => {
    if (!selectedAccountObj) return false;
    const num = selectedAccountObj.accountNumber || "";
    const name = selectedAccountObj.accountName || "";
    const id = selectedAccountObj.id || "";
    return num.includes("1538") || name.includes("1538") || id.includes("1538");
  }, [selectedAccountObj]);

  // Manual Spot Expense Dialog state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualAccountId, setManualAccountId] = useState(defaultAccId);
  const [manualAmount, setManualAmount] = useState("");
  const [manualPersonnel, setManualPersonnel] = useState("");
  const [manualCategory, setManualCategory] = useState<ExpenseCategory>("Fuel / Petrol");
  const [manualNotes, setManualNotes] = useState("");

  // Travel Route & Purpose Modal State
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [editingTxForRoute, setEditingTxForRoute] = useState<BankTransaction | null>(null);
  const [routeFrom, setRouteFrom] = useState("SRR Warehouse (Kalyan Nagar)");
  const [routeTo, setRouteTo] = useState("");
  const [routeDistance, setRouteDistance] = useState("");
  const [routePurpose, setRoutePurpose] = useState("");

  // Email Alert Details Modal State
  const [viewEmailTx, setViewEmailTx] = useState<BankTransaction | null>(null);

  const handleOpenRouteModal = (tx: BankTransaction) => {
    setEditingTxForRoute(tx);
    setRouteFrom(tx.travelFromLocation || "SRR Warehouse (Kalyan Nagar)");
    setRouteTo(tx.travelToLocation || "");
    setRouteDistance(tx.travelDistanceKm ? String(tx.travelDistanceKm) : "");
    setRoutePurpose(tx.travelPurposeNote || "");
    setIsRouteModalOpen(true);
  };

  const handleSaveTravelRoute = async () => {
    if (!editingTxForRoute) return;
    setIsSaving(true);
    try {
      const distNum = parseFloat(routeDistance);
      const updated: BankTransaction = {
        ...editingTxForRoute,
        travelFromLocation: routeFrom.trim() || "SRR Warehouse (Kalyan Nagar)",
        travelToLocation: routeTo.trim(),
        travelDistanceKm: !isNaN(distNum) && distNum > 0 ? distNum : undefined,
        travelPurposeNote: routePurpose.trim(),
        isExpenseTagged: true,
        taggedAt: new Date().toISOString(),
      };
      await saveBankTransactionToFirestore(updated, false);
      toast.success(`Saved Travel Route (${routeFrom} ➔ ${routeTo || 'Destination'}${distNum ? `, ${distNum} km` : ''}) for ${editingTxForRoute.expensePersonnelName || 'Executive'}`);
      setIsRouteModalOpen(false);
      setEditingTxForRoute(null);
      onRefresh();
    } catch (err) {
      toast.error("Failed to save travel route details");
    } finally {
      setIsSaving(false);
    }
  };

  const [personnelNames, setPersonnelNames] = useState<string[]>(getDeliveryTeamPersonnelNames);

  React.useEffect(() => {
    const handleUpdate = () => {
      setPersonnelNames(getDeliveryTeamPersonnelNames());
    };
    window.addEventListener("srrortho:personnel_updated", handleUpdate);
    return () => window.removeEventListener("srrortho:personnel_updated", handleUpdate);
  }, []);

  // Filter for Debit Transactions (Restricted to selected Bank Account, defaulting to 1538)
  const debitTransactions = useMemo(() => {
    return transactions.filter(
      (t) => t.type === "debit" && (!selectedAccountId || t.accountId === selectedAccountId)
    );
  }, [transactions, selectedAccountId]);

  // Auto-compute AI Suggestions across all debit transactions (incorporating historical records)
  const liveSuggestionsMap = useMemo(() => {
    return runAutoExpenseTagRules(transactions);
  }, [transactions]);

  // Run AI Engine manually (to trigger toast feedback)
  const handleRunAiEngine = () => {
    setAiSuggestions(liveSuggestionsMap);
    toast.success(`🤖 AI Pattern Engine scanned ${debitTransactions.length} debits & found ${liveSuggestionsMap.size} suggestions!`);
  };

  // Batch Apply All AI Suggestions
  const handleBatchApplyAi = async () => {
    if (aiSuggestions.size === 0) {
      toast.info("Run AI Auto-Tag Engine first to generate suggestions.");
      return;
    }

    setIsSaving(true);
    let count = 0;
    try {
      for (const [txId, suggestion] of aiSuggestions.entries()) {
        const tx = debitTransactions.find((t) => t.id === txId);
        if (tx && !tx.isExpenseTagged) {
          const updated: BankTransaction = {
            ...tx,
            expensePersonnelName: suggestion.suggestedPersonnelName || tx.expensePersonnelName || "Standard Dispatch",
            expenseCategory: suggestion.suggestedCategory,
            isExpenseTagged: true,
            taggedAt: new Date().toISOString(),
            autoTagConfidence: suggestion.confidenceScore,
          };
          await saveBankTransactionToFirestore(updated, false);
          count++;
        }
      }
      toast.success(`🎉 Auto-tagged ${count} debit transactions with AI!`);
      onRefresh();
    } catch (err) {
      toast.error("Failed to batch save AI tags.");
    } finally {
      setIsSaving(false);
    }
  };

  // Single Transaction Quick Tag Handler
  const handleTagTransaction = async (
    tx: BankTransaction,
    personnelName: string,
    category: ExpenseCategory
  ) => {
    try {
      if (personnelName === "__UNTAGGED__") {
        const updated: BankTransaction = {
          ...tx,
          expensePersonnelName: undefined,
          isExpenseTagged: false,
          taggedAt: undefined,
        };
        await saveBankTransactionToFirestore(updated, false);
        toast.info(`Reset transaction ₹${tx.amount.toLocaleString("en-IN")} to Untagged`);
        onRefresh();
        return;
      }

      const cleanName = normalizePersonnelName(personnelName) || personnelName;
      const updated: BankTransaction = {
        ...tx,
        expensePersonnelName: cleanName,
        expenseCategory: category,
        isExpenseTagged: true,
        taggedAt: new Date().toISOString(),
      };
      await saveBankTransactionToFirestore(updated, false);
      toast.success(`Tagged ₹${tx.amount.toLocaleString("en-IN")} → ${cleanName} (${category})`);
      onRefresh();
    } catch (err) {
      toast.error("Failed to update expense tag.");
    }
  };

  // Record Manual Spot Expense
  const handleSaveManualExpense = async () => {
    const amt = parseFloat(manualAmount);
    if (!manualAmount || isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid expense amount");
      return;
    }
    if (!manualPersonnel.trim()) {
      toast.error("Please select or enter a delivery person");
      return;
    }

    setIsSaving(true);
    try {
      const targetAcc = accounts.find((a) => a.id === manualAccountId) || accounts[0];
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const newTx: BankTransaction = {
        id: `tx_expense_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        accountId: targetAcc.id,
        type: "debit",
        amount: amt,
        date: dateStr,
        time: timeStr,
        category: manualCategory,
        description: `Spot Expense Payout: ${manualPersonnel} (${manualCategory})`,
        referenceNumber: `EXP-${Date.now().toString().slice(-6)}`,
        expensePersonnelName: normalizePersonnelName(manualPersonnel) || manualPersonnel,
        expenseCategory: manualCategory,
        expenseNotes: manualNotes.trim(),
        isExpenseTagged: true,
        taggedAt: now.toISOString(),
        createdSource: "manual",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveBankTransactionToFirestore(newTx, false);
      toast.success(`Recorded ₹${amt.toLocaleString("en-IN")} spot expense for ${manualPersonnel}!`);
      setIsManualModalOpen(false);
      setManualAmount("");
      setManualNotes("");
      onRefresh();
    } catch (err) {
      toast.error("Failed to save spot expense");
    } finally {
      setIsSaving(false);
    }
  };

  // Export Filtered Expense Debits to Excel / CSV
  const handleExportExcel = () => {
    if (filteredDebits.length === 0) {
      toast.info("No expense transactions to export.");
      return;
    }

    const headers = [
      "Date",
      "Time",
      "Account",
      "Description / Payee",
      "Reference #",
      "Debit Amount (INR)",
      "Tagged Executive",
      "Expense Category",
      "Route From",
      "Route To",
      "Distance (km)",
      "Status",
    ];

    const rows = filteredDebits.map((tx) => {
      const acc = accounts.find((a) => a.id === tx.accountId);
      return [
        `"${tx.date}"`,
        `"${tx.time || ""}"`,
        `"${acc?.accountName || tx.accountId || ""}"`,
        `"${(tx.description || "").replace(/"/g, '""')}"`,
        `"${tx.referenceNumber || ""}"`,
        tx.amount || 0,
        `"${tx.expensePersonnelName || "Untagged"}"`,
        `"${tx.expenseCategory || ""}"`,
        `"${tx.travelFromLocation || ""}"`,
        `"${tx.travelToLocation || ""}"`,
        tx.travelDistanceKm || "",
        `"${tx.isExpenseTagged ? "Tagged" : "Untagged"}"`,
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Expense_Report_${dateRangeFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Exported ${filteredDebits.length} expense transactions to Excel CSV!`);
  };

  // Filtered Debit Transactions List
  const filteredDebits = useMemo(() => {
    return debitTransactions.filter((tx) => {
      // Date Range Filter
      if (dateRangeFilter !== "all") {
        const [y, m, d] = (tx.date || "").split("-").map(Number);
        const txDate = y && m && d ? new Date(y, m - 1, d) : new Date(tx.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (dateRangeFilter === "today") {
          if (txDate.toDateString() !== today.toDateString()) return false;
        } else if (dateRangeFilter === "week") {
          const weekAgo = new Date(today);
          weekAgo.setDate(today.getDate() - 7);
          if (txDate < weekAgo) return false;
        } else if (dateRangeFilter === "month") {
          const monthAgo = new Date(today);
          monthAgo.setDate(today.getDate() - 30);
          if (txDate < monthAgo) return false;
        }
      }

      // Personnel Filter
      if (selectedPersonnel !== "all") {
        if (selectedPersonnel === "untagged") {
          if (tx.isExpenseTagged) return false;
        } else {
          const txPerson = (tx.expensePersonnelName || "").toLowerCase();
          if (txPerson !== selectedPersonnel.toLowerCase()) return false;
        }
      }

      // Status Filter
      if (statusFilter === "tagged" && !tx.isExpenseTagged) return false;
      if (statusFilter === "untagged" && tx.isExpenseTagged) return false;

      // Category Filter
      if (selectedCategoryFilter !== "all" && tx.expenseCategory !== selectedCategoryFilter) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const desc = (tx.description || "").toLowerCase();
        const ref = (tx.referenceNumber || "").toLowerCase();
        const person = (tx.expensePersonnelName || "").toLowerCase();
        const cat = (tx.expenseCategory || "").toLowerCase();
        return desc.includes(q) || ref.includes(q) || person.includes(q) || cat.includes(q);
      }

      return true;
    });
  }, [debitTransactions, dateRangeFilter, selectedPersonnel, statusFilter, selectedCategoryFilter, searchQuery]);

  // Expense Stats Breakdown (Dynamically calculated based on filtered debits)
  const stats = useMemo(() => {
    let totalTaggedExpense = 0;
    let totalUntaggedAmount = 0;
    let taggedCount = 0;
    let untaggedCount = 0;

    const personTotalsMap = new Map<string, number>();

    filteredDebits.forEach((t) => {
      if (t.isExpenseTagged) {
        totalTaggedExpense += t.amount || 0;
        taggedCount++;

        const pName = t.expensePersonnelName || "Other";
        personTotalsMap.set(pName, (personTotalsMap.get(pName) || 0) + t.amount);
      } else {
        totalUntaggedAmount += t.amount || 0;
        untaggedCount++;
      }
    });

    let topPerson = "None";
    let topPersonAmount = 0;
    for (const [pName, amt] of personTotalsMap.entries()) {
      if (amt > topPersonAmount) {
        topPersonAmount = amt;
        topPerson = pName;
      }
    }

    return {
      totalTaggedExpense,
      totalUntaggedAmount,
      taggedCount,
      untaggedCount,
      topPerson,
      topPersonAmount,
    };
  }, [filteredDebits]);

  return (
    <div className="space-y-4 font-sans text-foreground">
      {/* 1. Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border shadow-xs bg-card rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-300 flex items-center justify-center shrink-0">
            <BadgeIndianRupee className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Tagged Expenses
            </div>
            <div className="text-lg font-mono font-extrabold text-teal-700 dark:text-teal-400">
              ₹{stats.totalTaggedExpense.toLocaleString("en-IN")}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {stats.taggedCount} debits tagged to delivery personnel
            </div>
          </div>
        </Card>

        <Card className="border-border shadow-xs bg-card rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 flex items-center justify-center shrink-0">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Untagged Debits
            </div>
            <div className="text-lg font-mono font-extrabold text-amber-600 dark:text-amber-400">
              ₹{stats.totalUntaggedAmount.toLocaleString("en-IN")}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {stats.untaggedCount} pending debit transactions
            </div>
          </div>
        </Card>

        <Card className="border-border shadow-xs bg-card rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Top Delivery Executive
            </div>
            <div className="text-sm font-bold text-foreground truncate max-w-[140px]">
              {stats.topPerson}
            </div>
            <div className="text-[10px] text-emerald-600 font-mono font-semibold mt-0.5">
              ₹{stats.topPersonAmount.toLocaleString("en-IN")} total
            </div>
          </div>
        </Card>

        <Card className="border-border shadow-xs bg-card rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              AI Match Engine
            </div>
            <div className="text-sm font-bold text-foreground">
              {aiSuggestions.size} Auto Suggestions
            </div>
            <div className="text-[10px] text-purple-600 font-semibold mt-0.5">
              Pattern matching active
            </div>
          </div>
        </Card>
      </div>

      {/* 2. Action Bar & Filter Toolbar */}
      <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
        {/* Search Bar & Account Selector */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search payee, fuel, narration, UTR #..."
              className="pl-9 text-xs h-9 rounded-md w-full"
            />
          </div>

          <Select value={selectedAccountId} onValueChange={handleAccountChange}>
            <SelectTrigger className="h-9 text-xs font-semibold w-auto min-w-[160px] rounded-md">
              <Building2 className="w-3.5 h-3.5 mr-1 text-teal-600" />
              <SelectValue placeholder="Select Account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id} className="text-xs font-medium">
                  {acc.accountName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Filter Pills & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {/* Date Range Selector Pills */}
          <div className="flex items-center gap-0.5 bg-muted/60 p-1 rounded-lg border border-border text-xs">
            <button
              onClick={() => setDateRangeFilter("today")}
              className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors ${
                dateRangeFilter === "today"
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDateRangeFilter("week")}
              className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors ${
                dateRangeFilter === "week"
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setDateRangeFilter("month")}
              className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors ${
                dateRangeFilter === "month"
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setDateRangeFilter("all")}
              className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors ${
                dateRangeFilter === "all"
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Time
            </button>
          </div>

          {/* Action Buttons */}
          <Button
            size="sm"
            onClick={handleRunAiEngine}
            className="h-9 px-3 text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-md shadow-xs gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-200 animate-pulse" />
            <span>Run AI Auto-Tag</span>
          </Button>

          {aiSuggestions.size > 0 && (
            <Button
              size="sm"
              onClick={handleBatchApplyAi}
              disabled={isSaving}
              className="h-9 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-xs gap-1.5"
            >
              {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              <span>Apply {aiSuggestions.size} AI Tags</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => setIsManualModalOpen(true)}
            className="h-9 px-3 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-md shadow-xs gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Record Spot Expense
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportExcel}
            className="h-9 px-3 text-xs font-bold border-slate-300 text-slate-700 dark:text-slate-200 hover:bg-slate-100 rounded-md gap-1.5"
            title="Download active expenses as Excel CSV report"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </Button>
        </div>
      </div>

      {/* 3. Delivery Personnel & Category Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        {/* Executive Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground font-semibold mr-1">Personnel:</span>
          <Button
            size="sm"
            variant={selectedPersonnel === "all" ? "default" : "outline"}
            onClick={() => setSelectedPersonnel("all")}
            className={`h-7 px-2.5 text-xs font-semibold rounded-md ${
              selectedPersonnel === "all" ? "bg-teal-700 text-white hover:bg-teal-800" : ""
            }`}
          >
            All Executives
          </Button>
          <Button
            size="sm"
            variant={selectedPersonnel === "untagged" ? "default" : "outline"}
            onClick={() => setSelectedPersonnel("untagged")}
            className={`h-7 px-2.5 text-xs font-semibold rounded-md ${
              selectedPersonnel === "untagged"
                ? "bg-amber-600 text-white hover:bg-amber-700"
                : "text-amber-800 hover:bg-amber-50"
            }`}
          >
            Untagged ({stats.untaggedCount})
          </Button>
          {personnelNames.map((pName) => (
            <Button
              key={pName}
              size="sm"
              variant={selectedPersonnel === pName ? "default" : "outline"}
              onClick={() => setSelectedPersonnel(pName)}
              className={`h-7 px-2.5 text-xs font-semibold rounded-md ${
                selectedPersonnel === pName ? "bg-teal-700 text-white hover:bg-teal-800" : ""
              }`}
            >
              {pName}
            </Button>
          ))}
        </div>

        {/* Category Filter Dropdown */}
        <div className="flex items-center gap-2">
          <Select
            value={selectedCategoryFilter}
            onValueChange={(v) => setSelectedCategoryFilter(v)}
          >
            <SelectTrigger className="h-7 text-xs w-auto min-w-[150px] rounded-md font-semibold">
              <SelectValue placeholder="All Expense Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Expense Categories</SelectItem>
              {EXPENSE_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat} className="text-xs">
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 4. Debit Transactions Queue Table */}
      <Card className="border-border shadow-sm overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Account</th>
                <th className="p-3 text-left">Payee / Narration / UTR</th>
                <th className="p-3 text-right">Debit Amount (₹)</th>
                <th className="p-3 text-left">Delivery Executive Tag</th>
                <th className="p-3 text-left">Expense Category</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredDebits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No debit transactions found matching the filter.
                  </td>
                </tr>
              ) : (
                filteredDebits.map((tx) => {
                  const acc = accounts.find((a) => a.id === tx.accountId);
                  const suggestion = aiSuggestions.get(tx.id) || liveSuggestionsMap.get(tx.id);
                  // ONLY use saved expensePersonnelName for actual tagged status. Untagged stays empty until user confirms.
                  const currentPersonnel = tx.expensePersonnelName || "";
                  const currentCategory = tx.expenseCategory || suggestion?.suggestedCategory || "Fuel / Petrol";

                  const isUntagged = !tx.isExpenseTagged && !currentPersonnel;

                  return (
                    <tr
                      key={tx.id}
                      className={`transition-colors hover:bg-muted/30 ${
                        isUntagged
                          ? "bg-[radial-gradient(#f59e0b_0.75px,transparent_0.75px)] [background-size:8px_8px] bg-amber-50/40 dark:bg-amber-950/20"
                          : "hover:bg-muted/20"
                      }`}
                    >
                      {/* Date */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-bold text-foreground">
                          {new Date(tx.date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                        {tx.time && <div className="text-[10px] text-muted-foreground">{tx.time}</div>}
                      </td>

                      {/* Account */}
                      <td className="p-3 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
                        {acc?.accountName || "Bank Account"}
                      </td>

                      {/* Narration */}
                      <td className="p-3 max-w-xs sm:max-w-md">
                        <div className="font-medium text-foreground leading-snug">
                          {tx.description}
                        </div>
                        {tx.referenceNumber && (
                          <div className="mt-0.5 text-[10px] font-mono text-muted-foreground">
                            Ref: {tx.referenceNumber}
                          </div>
                        )}

                        {/* Delivery Exec Match & Route Badge */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {/* Saved Tag vs Recommendation Prompt */}
                          {tx.isExpenseTagged && currentPersonnel ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-md">
                              <UserCheck className="w-3 h-3 text-emerald-600" />
                              <span>Tagged to <strong>{currentPersonnel}</strong></span>
                            </span>
                          ) : suggestion?.suggestedPersonnelName ? (
                            <button
                              onClick={() => handleTagTransaction(tx, suggestion.suggestedPersonnelName!, currentCategory)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-900 dark:text-purple-200 bg-purple-50 dark:bg-purple-950/70 border border-purple-300 dark:border-purple-700 px-2 py-0.5 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-colors"
                              title="Click to apply recommended person"
                            >
                              <Sparkles className="w-3 h-3 text-purple-600 animate-pulse" />
                              <span>Recommendation: <strong>{suggestion.suggestedPersonnelName}</strong></span>
                              <span className="text-[9px] bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-100 px-1 rounded font-normal">Apply</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-md">
                              <span>Untagged - Select Person</span>
                            </span>
                          )}

                          {/* Route & Purpose Justification Action / Badge */}
                          {tx.travelFromLocation || tx.travelToLocation || tx.travelDistanceKm ? (
                            <button
                              onClick={() => handleOpenRouteModal(tx)}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-800 px-2 py-0.5 rounded-md hover:bg-teal-100"
                              title="Click to edit travel route details"
                            >
                              <MapPin className="w-3 h-3 text-teal-600" />
                              <span>
                                {tx.travelFromLocation || "SRR Warehouse"} ➔ {tx.travelToLocation || "Hospital"}
                                {tx.travelDistanceKm ? ` (${tx.travelDistanceKm} km)` : ''}
                              </span>
                            </button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenRouteModal(tx)}
                              className="h-6 px-2 text-[10px] font-semibold text-teal-700 hover:text-teal-900 hover:bg-teal-50 gap-1 rounded-md"
                            >
                              <MapPin className="w-3 h-3" /> Add Route
                            </Button>
                          )}
                        </div>
                      </td>

                      {/* Debit Amount */}
                      <td className="p-3 text-right whitespace-nowrap font-mono font-bold text-sm text-rose-600 dark:text-rose-400">
                        -₹{tx.amount.toLocaleString("en-IN")}
                      </td>

                      {/* Delivery Executive Dropdown Selector */}
                      <td className="p-3 whitespace-nowrap">
                        <Select
                          value={currentPersonnel}
                          onValueChange={(val) => handleTagTransaction(tx, val, currentCategory)}
                        >
                          <SelectTrigger className={`h-8 text-xs font-semibold w-full min-w-[160px] rounded-md ${
                            currentPersonnel 
                              ? "bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 font-bold"
                              : "bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                          }`}>
                            <SelectValue placeholder="Select Delivery Exec">
                              {currentPersonnel ? (
                                <span className="font-bold text-emerald-900 dark:text-emerald-200">
                                  {currentPersonnel}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">Select Exec...</span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__UNTAGGED__" className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                              ❌ Reset to Untagged
                            </SelectItem>
                            <SelectItem value="Standard Dispatch" className="text-xs text-teal-800 dark:text-teal-300 font-bold border-b border-border pb-1 mb-1">
                              📦 Standard Dispatch (General Operations)
                            </SelectItem>
                            {personnelNames
                              .filter((p) => p !== "Standard Dispatch")
                              .map((pName) => (
                                <SelectItem key={pName} value={pName} className="text-xs">
                                  {pName}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Category Selector */}
                      <td className="p-3 whitespace-nowrap">
                        <Select
                          value={currentCategory}
                          onValueChange={(val: any) => handleTagTransaction(tx, currentPersonnel || personnelNames[0] || "Standard Dispatch", val)}
                        >
                          <SelectTrigger className="h-8 text-xs font-semibold w-full min-w-[160px] bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded-md">
                            <SelectValue placeholder="Select Category" />
                          </SelectTrigger>
                          <SelectContent>
                            {EXPENSE_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat} className="text-xs">
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Status & Email Alert Action */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {tx.isExpenseTagged ? (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 text-[10px] font-bold rounded-md gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Tagged
                            </Badge>
                          ) : suggestion ? (
                            <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 text-[10px] font-bold rounded-md gap-1">
                              <Sparkles className="w-3 h-3" /> AI Suggested
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-300 rounded-md">
                              Untagged
                            </Badge>
                          )}

                          {/* Email Alert Icon Button */}
                          <button
                            type="button"
                            onClick={() => setViewEmailTx(tx)}
                            className="p-1 rounded-md text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:text-teal-300 dark:hover:bg-teal-900 border border-teal-200 dark:border-teal-800 transition-colors"
                            title="View Email & Bank Verification Details"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Travel Route & Purpose Modal */}
      <Dialog open={isRouteModalOpen} onOpenChange={setIsRouteModalOpen}>
        <DialogContent className="w-[94vw] max-w-[94vw] sm:max-w-md p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 gap-0">
          <DialogHeader className="p-5 bg-teal-50 dark:bg-teal-950/40 border-b border-teal-200/80 dark:border-teal-900/40">
            <DialogTitle className="text-base font-bold text-teal-950 dark:text-teal-100 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-teal-600" />
              <span>Log Travel Route &amp; Transfer Justification</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-teal-800 dark:text-teal-300 mt-0.5">
              Specify where the delivery person travelled (From ➔ To) and the trip purpose for ₹{editingTxForRoute?.amount?.toLocaleString("en-IN")}.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4 text-xs">
            <div>
              <Label className="text-xs font-semibold">From Location (Start Point)</Label>
              <Input
                value={routeFrom}
                onChange={(e) => setRouteFrom(e.target.value)}
                placeholder="e.g. SRR Kalyan Nagar Office"
                className="mt-1 h-9 text-xs rounded-xl"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">To Location (Destination Hospital / Location)</Label>
              <Input
                value={routeTo}
                onChange={(e) => setRouteTo(e.target.value)}
                placeholder="e.g. NIMS Hospital, Panjagutta"
                className="mt-1 h-9 text-xs rounded-xl"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Travel Distance in Kilometers (Km)</Label>
              <Input
                type="number"
                step="0.1"
                value={routeDistance}
                onChange={(e) => setRouteDistance(e.target.value)}
                placeholder="e.g. 18.5"
                className="mt-1 h-9 text-xs rounded-xl"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Quick Purpose / Justification Note</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
                {[
                  "Emergency Implant Delivery",
                  "Instrument Tray Return",
                  "Regular Fuel Allowance",
                  "Multiple Hospital Trips",
                  "Counter Cash Deposit",
                ].map((pill) => (
                  <button
                    key={pill}
                    type="button"
                    onClick={() => setRoutePurpose(pill)}
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                      routePurpose === pill
                        ? "bg-teal-700 text-white border-teal-700"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {pill}
                  </button>
                ))}
              </div>
              <Textarea
                value={routePurpose}
                onChange={(e) => setRoutePurpose(e.target.value)}
                placeholder="e.g. Travelled to NIMS for Knee set delivery + Tray return pickup..."
                className="text-xs rounded-xl resize-none"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsRouteModalOpen(false)}
              disabled={isSaving}
              className="h-9 text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTravelRoute}
              disabled={isSaving}
              className="h-9 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs"
            >
              {isSaving ? "Saving..." : "Save Route & Justification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Spot Expense Payout Modal */}
      <Dialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen}>
        <DialogContent className="w-[94vw] max-w-[94vw] sm:max-w-md p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 gap-0">
          <DialogHeader className="p-5 bg-teal-50 dark:bg-teal-950/40 border-b border-teal-200/80 dark:border-teal-900/40">
            <DialogTitle className="text-base font-bold text-teal-950 dark:text-teal-100 flex items-center gap-2">
              <Plus className="w-4 h-4 text-teal-600" />
              <span>Record Spot Expense Payout</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-teal-800 dark:text-teal-300 mt-0.5">
              Record a spot cash/bank expense paid directly to a delivery executive.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4 text-xs">
            <div>
              <Label className="text-xs font-semibold">Target Account</Label>
              <Select value={manualAccountId} onValueChange={setManualAccountId}>
                <SelectTrigger className="mt-1 h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select Bank Account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-xs">
                      {a.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Expense Amount (₹) *</Label>
              <Input
                type="number"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder="e.g. 500"
                className="mt-1 h-9 text-xs rounded-xl"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Delivery Person *</Label>
              <Select value={manualPersonnel} onValueChange={setManualPersonnel}>
                <SelectTrigger className="mt-1 h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select Delivery Executive" />
                </SelectTrigger>
                <SelectContent>
                  {personnelNames.map((pName) => (
                    <SelectItem key={pName} value={pName} className="text-xs">
                      {pName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Expense Category</Label>
              <Select value={manualCategory} onValueChange={(val: any) => setManualCategory(val)}>
                <SelectTrigger className="mt-1 h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-xs">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Notes / Purpose (Optional)</Label>
              <Textarea
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                placeholder="e.g. Emergency fuel fill-up for NIMS hospital delivery..."
                className="mt-1 text-xs rounded-xl resize-none"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsManualModalOpen(false)}
              disabled={isSaving}
              className="h-9 text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveManualExpense}
              disabled={isSaving}
              className="h-9 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs"
            >
              {isSaving ? "Saving..." : "Record Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bank Email Content Modal (Matched 100% to BankAccountsView) */}
      <Dialog open={Boolean(viewEmailTx)} onOpenChange={(open) => !open && setViewEmailTx(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto p-5">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <Mail className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Email Content</span>
              </DialogTitle>
              {viewEmailTx && (
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                  -₹{viewEmailTx.amount?.toLocaleString("en-IN")}
                </span>
              )}
            </div>
            {viewEmailTx?.emailSubject && (
              <DialogDescription className="text-xs font-semibold text-slate-700 dark:text-slate-300 pt-1 text-left">
                Subject: {viewEmailTx.emailSubject}
              </DialogDescription>
            )}
          </DialogHeader>

          {viewEmailTx && (
            <div className="space-y-3 pt-2">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                {viewEmailTx.rawEmailBody
                  ? viewEmailTx.rawEmailBody
                      .replace(/<https?:\/\/[^>]+>/gi, "")
                      .replace(/\n{3,}/g, "\n\n")
                      .trim()
                  : viewEmailTx.rawAlert || viewEmailTx.description}
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewEmailTx(null)}
              className="h-8 text-xs rounded-xl border-slate-300"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
