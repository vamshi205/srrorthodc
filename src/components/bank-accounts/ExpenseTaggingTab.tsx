import React, { useState, useMemo } from "react";
import {
  BankTransaction,
  BankAccount,
  ExpenseCategory,
  saveBankTransactionToFirestore,
  LedgerDisplayConfig,
  getLedgerDisplayConfig,
  build6569TransactionRankMap,
  is6569TransactionLocked,
  isAccount6569Identifier,
} from "@/services/bankAccountFirebaseService";
import {
  getDeliveryTeamPersonnelNames,
  normalizePersonnelName,
} from "@/lib/personnelStorage";
import {
  runAutoExpenseTagRules,
  predictExpenseTag,
  ExpenseTagSuggestion,
  parseTransactionDate,
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
  Lock,
  FileText,
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
  onUpdateTransaction?: (tx: BankTransaction) => void;
  is6569Unlocked?: boolean;
  onUnlock6569?: () => void;
  ledgerConfig?: LedgerDisplayConfig;
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

const isAccount6569 = (accIdentifier?: string | BankAccount | null, accs?: BankAccount[]): boolean => {
  return isAccount6569Identifier(accIdentifier, accs);
};

export const ExpenseTaggingTab: React.FC<ExpenseTaggingTabProps> = ({
  transactions,
  accounts,
  onRefresh,
  onUpdateTransaction,
  is6569Unlocked = false,
  onUnlock6569,
  ledgerConfig,
}) => {
  const activeConfig = useMemo(() => ledgerConfig || getLedgerDisplayConfig(), [ledgerConfig]);
  const rankMap = useMemo(() => build6569TransactionRankMap(transactions, accounts), [transactions, accounts]);
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

  const [selectedAccountId, setSelectedAccountId] = useState<string>(defaultAccId || "");
  const [dateRangeFilter, setDateRangeFilter] = useState<"today" | "week" | "month" | "all">("today");

  // Force default 1538 account selection whenever defaultAccId loads or updates
  React.useEffect(() => {
    if (defaultAccId) {
      setSelectedAccountId(defaultAccId);
    }
  }, [defaultAccId]);

  const handleAccountChange = (newAccId: string) => {
    const isTarget1538 = newAccId === defaultAccId || newAccId.includes("1538");
    const isTarget6569 = isAccount6569(newAccId, accounts);
    if (isTarget6569) {
      // Switch date range to all time so user immediately sees their configured 6569 debits
      setDateRangeFilter("all");
    } else if (!isTarget1538 && newAccId !== "all") {
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
  const [routeRemarks, setRouteRemarks] = useState("");

  // Remarks Modal State
  const [isRemarksModalOpen, setIsRemarksModalOpen] = useState(false);
  const [editingTxForRemarks, setEditingTxForRemarks] = useState<BankTransaction | null>(null);
  const [remarksInput, setRemarksInput] = useState("");
  const [isSavingRemarks, setIsSavingRemarks] = useState(false);

  // Email Alert Details Modal State
  const [viewEmailTx, setViewEmailTx] = useState<BankTransaction | null>(null);

  const handleOpenRouteModal = (tx: BankTransaction) => {
    setEditingTxForRoute(tx);
    setRouteFrom(tx.travelFromLocation || "SRR Warehouse (Kalyan Nagar)");
    setRouteTo(tx.travelToLocation || "");
    setRouteDistance(tx.travelDistanceKm ? String(tx.travelDistanceKm) : "");
    setRoutePurpose(tx.travelPurposeNote || "");
    setRouteRemarks(tx.remarks || tx.expenseNotes || "");
    setIsRouteModalOpen(true);
  };

  const handleSaveTravelRoute = async () => {
    if (!editingTxForRoute) return;
    setIsSaving(true);
    try {
      const distNum = parseFloat(routeDistance);
      const cleanRemarks = routeRemarks.trim();
      const updated: BankTransaction = {
        ...editingTxForRoute,
        travelFromLocation: routeFrom.trim() || "SRR Warehouse (Kalyan Nagar)",
        travelToLocation: routeTo.trim(),
        travelDistanceKm: !isNaN(distNum) && distNum > 0 ? distNum : undefined,
        travelPurposeNote: routePurpose.trim() || undefined,
        remarks: cleanRemarks || editingTxForRoute.remarks || editingTxForRoute.expenseNotes || undefined,
        expenseNotes: cleanRemarks || editingTxForRoute.expenseNotes || editingTxForRoute.remarks || undefined,
        isExpenseTagged: true,
        taggedAt: editingTxForRoute.taggedAt || new Date().toISOString(),
        updatedAt: Date.now(),
      };
      await saveBankTransactionToFirestore(updated, false);
      if (onUpdateTransaction) {
        onUpdateTransaction(updated);
      }
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

  const handleOpenRemarksModal = (tx: BankTransaction) => {
    setEditingTxForRemarks(tx);
    setRemarksInput(tx.remarks || tx.expenseNotes || "");
    setIsRemarksModalOpen(true);
  };

  const handleSaveRemarks = async () => {
    if (!editingTxForRemarks) return;
    setIsSavingRemarks(true);
    try {
      const cleanRemarks = remarksInput.trim();
      const updated: BankTransaction = {
        ...editingTxForRemarks,
        remarks: cleanRemarks || undefined,
        expenseNotes: cleanRemarks || undefined,
        isExpenseTagged: Boolean(cleanRemarks || editingTxForRemarks.expensePersonnelName || editingTxForRemarks.travelFromLocation),
        taggedAt: editingTxForRemarks.taggedAt || new Date().toISOString(),
        updatedAt: Date.now(),
      };
      await saveBankTransactionToFirestore(updated, false);
      if (onUpdateTransaction) {
        onUpdateTransaction(updated);
      }
      toast.success(cleanRemarks ? `Saved remarks: "${cleanRemarks}"` : "Remarks cleared");
      setIsRemarksModalOpen(false);
      setEditingTxForRemarks(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to save remarks");
    } finally {
      setIsSavingRemarks(false);
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

  // Filter for Debit Transactions (Defaulted to HDFC 1538 Account or All Accounts)
  const debitTransactions = useMemo(() => {
    const selectedObj = accounts.find((a) => a.id === selectedAccountId);
    const isTarget1538 =
      selectedAccountId.includes("1538") ||
      selectedObj?.accountNumber?.includes("1538") ||
      selectedObj?.accountName?.includes("1538");
    const isTarget6569 = isAccount6569(selectedAccountId, accounts);

    return transactions.filter((t) => {
      const isDebit =
        t.type === "debit" ||
        (t.type as string)?.toLowerCase() === "debit" ||
        (t.amount > 0 && Boolean(t.expenseCategory));

      const isTx1538 = t.accountSuffix === "1538" || (t.accountId && t.accountId.includes("1538"));
      const isTx6569 =
        isAccount6569(t.accountId, accounts) ||
        t.accountSuffix === "6569" ||
        (t.description && t.description.includes("6569"));

      const matchesAccount =
        !selectedAccountId ||
        selectedAccountId === "all" ||
        t.accountId === selectedAccountId ||
        (isTarget1538 && isTx1538) ||
        (isTarget6569 && isTx6569);

      return isDebit && matchesAccount;
    });
  }, [transactions, selectedAccountId, accounts]);

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
        remarks: manualNotes.trim() || undefined,
        expenseNotes: manualNotes.trim() || undefined,
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
      const isLocked = is6569TransactionLocked(tx, activeConfig, rankMap, is6569Unlocked, accounts);
      const acc = accounts.find((a) => a.id === tx.accountId);
      if (isLocked) {
        return [
          `"${tx.date}"`,
          `""`,
          `"${acc?.accountName || tx.accountId || "HDFC 6569"}"`,
          `"[LOCKED BY ADMIN CONFIG]"`,
          `""`,
          0,
          `"[LOCKED]"`,
          `"[LOCKED]"`,
          `""`,
          `""`,
          "",
          `"Locked"`,
        ];
      }
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
        const txDate = parseTransactionDate(tx.date);
        if (isNaN(txDate.getTime())) return false;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const compareDate = new Date(txDate);
        compareDate.setHours(0, 0, 0, 0);

        if (dateRangeFilter === "today") {
          if (compareDate.getTime() !== today.getTime()) return false;
        } else if (dateRangeFilter === "week") {
          const weekAgo = new Date(today);
          weekAgo.setDate(today.getDate() - 7);
          if (compareDate < weekAgo) return false;
        } else if (dateRangeFilter === "month") {
          const monthAgo = new Date(today);
          monthAgo.setDate(today.getDate() - 30);
          if (compareDate < monthAgo) return false;
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
      const isLocked = is6569TransactionLocked(t, activeConfig, rankMap, is6569Unlocked, accounts);
      if (isLocked) return;

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
  }, [filteredDebits, activeConfig, rankMap, is6569Unlocked, accounts]);

  return (
    <div className="space-y-4 font-sans text-foreground">
      {/* Streamlined Toolbar & Action Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-2 bg-card p-2 sm:p-2.5 rounded-xl border border-border shadow-xs">
        {/* Left Side: Search Input */}
        <div className="relative flex-1 min-w-0 lg:max-w-xs xl:max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search payee, fuel, narration, UTR #..."
            className="pl-8 text-xs h-8 rounded-md w-full"
          />
        </div>

        {/* Right Side: Date Range Selector & Action Buttons */}
        <div className="flex items-center justify-between lg:justify-end gap-1.5 sm:gap-2">
          {/* Date Range Selector */}
          <div className="inline-flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-md border border-border text-xs shrink-0">
            <button
              onClick={() => setDateRangeFilter("all")}
              className={`px-1.5 sm:px-2 py-1 rounded-sm font-semibold text-[11px] transition-colors ${
                dateRangeFilter === "all"
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="sm:hidden">All</span>
              <span className="hidden sm:inline">All Time</span>
            </button>
            <button
              onClick={() => setDateRangeFilter("today")}
              className={`px-1.5 sm:px-2 py-1 rounded-sm font-semibold text-[11px] transition-colors ${
                dateRangeFilter === "today"
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDateRangeFilter("week")}
              className={`px-1.5 sm:px-2 py-1 rounded-sm font-semibold text-[11px] transition-colors ${
                dateRangeFilter === "week"
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="sm:hidden">Week</span>
              <span className="hidden sm:inline">This Week</span>
            </button>
            <button
              onClick={() => setDateRangeFilter("month")}
              className={`px-1.5 sm:px-2 py-1 rounded-sm font-semibold text-[11px] transition-colors ${
                dateRangeFilter === "month"
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="sm:hidden">Month</span>
              <span className="hidden sm:inline">This Month</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              onClick={handleRunAiEngine}
              className="h-8 w-8 p-0 md:w-auto md:px-2.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-md gap-1 shrink-0"
              title="AI Auto-Tag Expenses"
              aria-label="AI Auto-Tag Expenses"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden md:inline">AI Auto-Tag</span>
            </Button>

            <Button
              size="sm"
              onClick={() => setIsManualModalOpen(true)}
              className="h-8 w-8 p-0 md:w-auto md:px-2.5 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-md gap-1 shrink-0"
              title="Spot Expense (Add Manual Expense)"
              aria-label="Spot Expense"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Spot Expense</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleExportExcel}
              className="h-8 w-8 p-0 border-border rounded-md hover:bg-muted transition-colors flex items-center justify-center shrink-0"
              title="Export to CSV"
              aria-label="Export to CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Executive Filter Pills & Dropdowns */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[11px] text-muted-foreground font-semibold mr-1">Personnel:</span>
          <Button
            size="sm"
            variant={selectedPersonnel === "all" ? "default" : "outline"}
            onClick={() => setSelectedPersonnel("all")}
            className={`h-6 px-2 text-[11px] font-semibold rounded-md ${
              selectedPersonnel === "all" ? "bg-teal-700 text-white hover:bg-teal-800" : ""
            }`}
          >
            All Executives
          </Button>
          <Button
            size="sm"
            variant={selectedPersonnel === "untagged" ? "default" : "outline"}
            onClick={() => setSelectedPersonnel("untagged")}
            className={`h-6 px-2 text-[11px] font-semibold rounded-md ${
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
              className={`h-6 px-2 text-[11px] font-semibold rounded-md ${
                selectedPersonnel === pName ? "bg-teal-700 text-white hover:bg-teal-800" : ""
              }`}
            >
              {pName}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto shrink-0">
          {/* Bank Account Selection Dropdown */}
          <Select value={selectedAccountId} onValueChange={handleAccountChange}>
            <SelectTrigger className="h-6 text-[11px] flex-1 sm:flex-initial sm:w-auto min-w-[130px] rounded-md font-semibold border-teal-300 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200">
              <Building2 className="w-3 h-3 mr-1 text-teal-600 shrink-0" />
              <SelectValue placeholder="All Accounts" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((acc) => {
                const is1538Acc = acc.accountNumber?.includes("1538") || acc.accountName?.includes("1538") || acc.id.includes("1538");
                const is6569Acc = isAccount6569(acc);
                return (
                  <SelectItem key={acc.id} value={acc.id} className="text-[11px] font-medium">
                    {is1538Acc ? `⭐ ${acc.accountName}` : is6569Acc ? `🏢 ${acc.accountName}` : acc.accountName}
                  </SelectItem>
                );
              })}
              <SelectItem value="all" className="text-[11px] font-bold text-teal-800 dark:text-teal-300 border-t border-border mt-1 pt-1">
                🏦 All Bank Accounts
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Expense Category Dropdown */}
          <Select
            value={selectedCategoryFilter}
            onValueChange={(v) => setSelectedCategoryFilter(v)}
          >
            <SelectTrigger className="h-6 text-[11px] flex-1 sm:flex-initial sm:w-auto min-w-[130px] rounded-md font-semibold">
              <SelectValue placeholder="All Expense Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-[11px]">All Expense Categories</SelectItem>
              {EXPENSE_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat} className="text-[11px]">
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 6569 Account Config Status Banner */}
      {isAccount6569(selectedAccountId, accounts) && (
        <div className="p-3 bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl flex items-center justify-between gap-3 text-xs font-semibold text-teal-950 dark:text-teal-200 shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
            <span>
              HDFC Main (6569): Showing {is6569Unlocked ? "all debits (session unlocked)" : `unlocked debits per admin configuration (${activeConfig.unlockRule === 'count' ? `Latest ${activeConfig.customLimit || activeConfig.defaultLimit || 10} Txns` : 'Configured Window'})`}. {!is6569Unlocked && "Older debits are blurred below."}
            </span>
          </div>
          {onUnlock6569 && !is6569Unlocked && (
            <Button
              size="sm"
              onClick={onUnlock6569}
              className="h-7 px-3 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-md shrink-0 gap-1 cursor-pointer"
            >
              <Lock className="w-3 h-3" /> Unlock All (6569)
            </Button>
          )}
        </div>
      )}

      {/* 4. Debit Transactions Queue Table */}
      {/* Desktop Table View */}
      <div className="hidden md:block">
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
                  const isRowLocked = is6569TransactionLocked(tx, activeConfig, rankMap, is6569Unlocked, accounts);

                  if (isRowLocked) {
                    return (
                      <tr key={tx.id} className="bg-amber-50/20 hover:bg-amber-50/40 border-l-2 border-l-amber-400 transition-colors">
                        <td className="p-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-slate-400 filter blur-[3.5px] select-none">
                              {new Date(tx.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                            <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-800 border-amber-300 font-bold px-1.5 py-0 flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5 text-amber-600" /> Locked
                            </Badge>
                          </div>
                        </td>
                        <td className="p-3 whitespace-nowrap font-medium text-slate-500">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100/70 border border-amber-300 px-2 py-0.5 rounded-md">
                            {acc?.accountName || "SRR Ortho Main (6569)"}
                          </span>
                        </td>
                        <td className="p-3 max-w-xs sm:max-w-md">
                          <div className="filter blur-[4px] select-none text-slate-400 text-xs font-mono">
                            HDFC Bank Statement Protected ••••••••••••••••••
                          </div>
                          <div className="text-[10px] text-amber-700/80 mt-0.5 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Protected by 6569 ledger rule</span>
                          </div>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <span className="font-mono font-bold text-xs text-slate-400 filter blur-[4px] select-none">
                            ₹••••••••
                          </span>
                        </td>
                        <td colSpan={2} className="p-3 text-slate-400 text-[11px] italic">
                          Older debit transaction beyond unlocked window
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {onUnlock6569 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={onUnlock6569}
                              className="h-7 text-xs px-2.5 font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-300 rounded-md cursor-pointer gap-1"
                            >
                              <Lock className="w-3 h-3 text-amber-600" /> Unlock
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  }

                  const suggestion = aiSuggestions.get(tx.id) || liveSuggestionsMap.get(tx.id);
                  // ONLY use saved expensePersonnelName for actual tagged status. Untagged stays empty until user confirms.
                  const currentPersonnel = tx.expensePersonnelName || "";
                  const currentCategory = tx.expenseCategory || suggestion?.suggestedCategory || "Fuel / Petrol";

                  const isUntagged = !tx.isExpenseTagged && !currentPersonnel;

                  return (
                    <tr
                      key={tx.id}
                      className={`transition-colors ${
                        isUntagged
                          ? "bg-amber-500/5 dark:bg-amber-500/10 border-l-2 border-l-amber-500 hover:bg-amber-500/10 dark:hover:bg-amber-500/15"
                          : "hover:bg-muted/30"
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
                              type="button"
                              onClick={() => handleOpenRouteModal(tx)}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-800 px-2 py-0.5 rounded-md hover:bg-teal-100"
                              title="Click to edit travel route details"
                            >
                              <MapPin className="w-3 h-3 text-teal-600 shrink-0" />
                              <span>
                                {tx.travelFromLocation || "SRR Warehouse"} ➔ {tx.travelToLocation || "Hospital"}
                                {tx.travelDistanceKm ? ` (${tx.travelDistanceKm} km)` : ''}
                              </span>
                            </button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              type="button"
                              onClick={() => handleOpenRouteModal(tx)}
                              className="h-6 px-2 text-[10px] font-semibold text-teal-700 hover:text-teal-900 hover:bg-teal-50 gap-1 rounded-md"
                            >
                              <MapPin className="w-3 h-3" /> Add Route
                            </Button>
                          )}

                          {/* Remarks Action / Badge (Next to Add Route) */}
                          {tx.remarks || tx.expenseNotes ? (
                            <button
                              type="button"
                              onClick={() => handleOpenRemarksModal(tx)}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-md hover:bg-amber-100 max-w-[220px]"
                              title={`Remarks: ${tx.remarks || tx.expenseNotes} (Click to edit)`}
                            >
                              <FileText className="w-3 h-3 text-amber-600 shrink-0" />
                              <span className="truncate">{tx.remarks || tx.expenseNotes}</span>
                            </button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              type="button"
                              onClick={() => handleOpenRemarksModal(tx)}
                              className="h-6 px-2 text-[10px] font-semibold text-amber-700 hover:text-amber-900 hover:bg-amber-50 gap-1 rounded-md"
                              title="Add remarks / expense notes"
                            >
                              <FileText className="w-3 h-3" /> Add Remarks
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
    </div>

      {/* Mobile Debit Expense Cards View */}
      <div className="md:hidden space-y-2.5">
        {filteredDebits.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground border-border rounded-xl">
            No debit transactions found matching the filter.
          </Card>
        ) : (
          filteredDebits.map((tx) => {
            const acc = accounts.find((a) => a.id === tx.accountId);
            const isRowLocked = is6569TransactionLocked(tx, activeConfig, rankMap, is6569Unlocked, accounts);

            if (isRowLocked) {
              return (
                <Card key={tx.id} className="p-3.5 bg-amber-50/30 dark:bg-amber-950/20 border border-amber-300/80 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-400 filter blur-[3.5px] select-none">
                      {new Date(tx.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                    <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-800 border-amber-300 font-bold px-1.5 py-0 flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5 text-amber-600" /> Locked (6569)
                    </Badge>
                  </div>
                  <div className="filter blur-[4px] select-none text-slate-400 text-xs font-mono">
                    HDFC Bank Statement Protected ••••••••••••••••••
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-amber-200/60">
                    <span className="font-mono font-bold text-sm text-slate-400 filter blur-[4px] select-none">
                      ₹••••••••
                    </span>
                    {onUnlock6569 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onUnlock6569}
                        className="h-7 text-xs px-2.5 font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-300 rounded-md gap-1"
                      >
                        <Lock className="w-3 h-3 text-amber-600" /> Unlock
                      </Button>
                    )}
                  </div>
                </Card>
              );
            }

            const suggestion = aiSuggestions.get(tx.id) || liveSuggestionsMap.get(tx.id);
            const currentPersonnel = tx.expensePersonnelName || "";
            const currentCategory = tx.expenseCategory || suggestion?.suggestedCategory || "Fuel / Petrol";
            const isUntagged = !tx.isExpenseTagged && !currentPersonnel;

            return (
              <Card
                key={tx.id}
                className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                  isUntagged
                    ? "border-amber-300 bg-amber-50/30 dark:bg-amber-950/10 shadow-2xs"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs"
                }`}
              >
                {/* Top Row: Date, Account & Amount */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-foreground">
                        {new Date(tx.date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      {tx.time && <span className="text-[10px] text-muted-foreground">{tx.time}</span>}
                    </div>
                    <div className="mt-1">
                      <span className="inline-flex items-center text-[11px] font-bold text-teal-900 dark:text-teal-200 bg-teal-50/80 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 px-1.5 py-0.5 rounded">
                        <Building2 className="w-3 h-3 mr-1 text-teal-600" />
                        {acc?.accountName || "Bank Account"}
                      </span>
                    </div>
                  </div>

                  {/* Debit Amount */}
                  <div className="text-right shrink-0">
                    <div className="font-mono font-black text-base text-rose-600 dark:text-rose-400">
                      -₹{tx.amount.toLocaleString("en-IN")}
                    </div>
                    <div className="mt-0.5">
                      {tx.isExpenseTagged ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[9px] font-bold px-1.5 py-0">
                          Tagged
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-800 border-amber-300 px-1.5 py-0">
                          Untagged
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Narration & Ref */}
                <div className="text-xs font-medium text-foreground leading-snug break-words">
                  {tx.description}
                  {tx.referenceNumber && (
                    <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                      Ref: {tx.referenceNumber}
                    </div>
                  )}
                </div>

                {/* Badges / Recommendation / Route */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  {tx.isExpenseTagged && currentPersonnel ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded">
                      <UserCheck className="w-3 h-3 text-emerald-600" />
                      <span>{currentPersonnel}</span>
                    </span>
                  ) : suggestion?.suggestedPersonnelName ? (
                    <button
                      type="button"
                      onClick={() => handleTagTransaction(tx, suggestion.suggestedPersonnelName!, currentCategory)}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-900 dark:text-purple-200 bg-purple-50 dark:bg-purple-950/70 border border-purple-300 dark:border-purple-700 px-2 py-0.5 rounded hover:bg-purple-100"
                    >
                      <Sparkles className="w-3 h-3 text-purple-600 animate-pulse" />
                      <span>Suggest: {suggestion.suggestedPersonnelName}</span>
                    </button>
                  ) : null}

                  {tx.travelFromLocation || tx.travelToLocation || tx.travelDistanceKm ? (
                    <button
                      type="button"
                      onClick={() => handleOpenRouteModal(tx)}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-800 px-2 py-0.5 rounded hover:bg-teal-100"
                    >
                      <MapPin className="w-3 h-3 text-teal-600 shrink-0" />
                      <span>
                        {tx.travelFromLocation || "SRR Warehouse"} ➔ {tx.travelToLocation || "Hospital"}
                        {tx.travelDistanceKm ? ` (${tx.travelDistanceKm} km)` : ''}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenRouteModal(tx)}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200"
                    >
                      <MapPin className="w-3 h-3" /> Log Route
                    </button>
                  )}

                  {/* Remarks Action / Badge (Next to Route) */}
                  {tx.remarks || tx.expenseNotes ? (
                    <button
                      type="button"
                      onClick={() => handleOpenRemarksModal(tx)}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded hover:bg-amber-100 max-w-[140px]"
                      title={`Remarks: ${tx.remarks || tx.expenseNotes} (Click to edit)`}
                    >
                      <FileText className="w-3 h-3 text-amber-600 shrink-0" />
                      <span className="truncate">{tx.remarks || tx.expenseNotes}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenRemarksModal(tx)}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200"
                    >
                      <FileText className="w-3 h-3" /> Add Remarks
                    </button>
                  )}
                </div>

                {/* Delivery Executive & Category Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border">
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">Executive:</span>
                    <Select
                      value={currentPersonnel}
                      onValueChange={(val) => handleTagTransaction(tx, val, currentCategory)}
                    >
                      <SelectTrigger className={`h-8 text-xs font-semibold w-full rounded-md ${
                        currentPersonnel 
                          ? "bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 font-bold"
                          : "bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                      }`}>
                        <SelectValue placeholder="Select Exec">
                          {currentPersonnel || <span className="text-slate-400 italic">Select Exec...</span>}
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
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">Category:</span>
                    <Select
                      value={currentCategory}
                      onValueChange={(val: any) => handleTagTransaction(tx, currentPersonnel || personnelNames[0] || "Standard Dispatch", val)}
                    >
                      <SelectTrigger className="h-8 text-xs font-semibold w-full bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded-md">
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
                </div>

                {/* Email Verification Action */}
                <div className="pt-1.5 flex items-center justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setViewEmailTx(tx)}
                    className="h-6 px-2 text-[11px] text-teal-700 hover:text-teal-900 hover:bg-teal-50 gap-1 rounded"
                  >
                    <Mail className="w-3.5 h-3.5" /> View Alert Details
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

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

            <div>
              <Label className="text-xs font-semibold">Remarks / Expense Notes (Optional)</Label>
              <Input
                value={routeRemarks}
                onChange={(e) => setRouteRemarks(e.target.value)}
                placeholder="e.g. Fuel for Yashoda delivery / Urgent trip"
                className="mt-1 h-9 text-xs rounded-xl"
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

      {/* Transaction Remarks & Notes Modal */}
      <Dialog open={isRemarksModalOpen} onOpenChange={setIsRemarksModalOpen}>
        <DialogContent className="w-[94vw] max-w-[94vw] sm:max-w-md p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 gap-0">
          <DialogHeader className="p-5 bg-amber-50/80 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-900/40">
            <DialogTitle className="text-base font-bold text-amber-950 dark:text-amber-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-600" />
              <span>Transaction Remarks &amp; Expense Notes</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
              Add or update remarks for ₹{editingTxForRemarks?.amount?.toLocaleString("en-IN")} (Ref: {editingTxForRemarks?.referenceNumber || editingTxForRemarks?.id}). These remarks sync seamlessly with the Ledger.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4 text-xs">
            {/* Context Summary */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-[11px] space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Date: <span className="font-semibold text-foreground">{editingTxForRemarks?.date}</span></span>
                <span>Amount: <span className="font-mono font-bold text-rose-600 dark:text-rose-400">-₹{editingTxForRemarks?.amount?.toLocaleString("en-IN")}</span></span>
              </div>
              <div className="text-muted-foreground truncate">
                Desc: <span className="text-foreground font-medium">{editingTxForRemarks?.description}</span>
              </div>
              {editingTxForRemarks?.expensePersonnelName && (
                <div className="text-muted-foreground">
                  Executive: <span className="text-emerald-700 dark:text-emerald-400 font-bold">{editingTxForRemarks.expensePersonnelName}</span>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold">Remarks / Expense Notes</Label>
                {remarksInput && (
                  <button
                    type="button"
                    onClick={() => setRemarksInput("")}
                    className="text-[10px] text-muted-foreground hover:text-rose-600 underline"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Quick Pills */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {[
                  "Fuel for delivery",
                  "Lunch / Food allowance",
                  "Urgent OT Implant drop",
                  "Tray Return pickup",
                  "Vehicle repair & puncture",
                  "Toll / Parking charges",
                  "Cash Advance",
                ].map((pill) => (
                  <button
                    key={pill}
                    type="button"
                    onClick={() => setRemarksInput(pill)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border transition-colors ${
                      remarksInput === pill
                        ? "bg-amber-600 text-white border-amber-600"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                    }`}
                  >
                    {pill}
                  </button>
                ))}
              </div>

              <Textarea
                value={remarksInput}
                onChange={(e) => setRemarksInput(e.target.value)}
                placeholder="Enter remarks or note for this transaction..."
                className="text-xs rounded-xl resize-none font-medium"
                rows={3}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsRemarksModalOpen(false)}
              disabled={isSavingRemarks}
              className="h-9 text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveRemarks}
              disabled={isSavingRemarks}
              className="h-9 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs"
            >
              {isSavingRemarks ? "Saving..." : "Save Remarks"}
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
