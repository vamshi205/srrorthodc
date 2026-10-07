import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Papa from 'papaparse';
import {
  BankAccount,
  BankTransaction,
  fetchBankAccountsFromFirestore,
  saveBankAccountToFirestore,
  deleteBankAccountFromFirestore,
  fetchBankTransactionsFromFirestore,
  saveBankTransactionToFirestore,
  deleteBankTransactionFromFirestore,
  clearAllBankTransactionsFromFirestore,
  clearAllBankDataAndAccountsFromFirestore,
  linkBankTransactionToCashInvoice,
  unlinkBankTransactionFromCashInvoice,
  importBatchBankTransactions,
  subscribeToBankTransactions,
  revertMatchingDcToCashQueue,
  recordCashPaymentToCashInHand,
} from '@/services/bankAccountFirebaseService';
import {
  CashInvoiceData,
  fetchCashInvoicesFromFirestore,
} from '@/services/cashInvoiceFirebaseService';
import { CashInvoicePreview } from '@/components/cash-invoice/CashInvoicePreview';
import { printCashMemo } from '@/lib/cashInvoicePrint';
import {
  parseMultipleHdfcEmailAlerts,
  extractHdfcNarration,
  ParsedHdfcEmailResult,
} from '@/services/gmailConnectorService';
import { loadSavedDcs, SavedDc, transitionSavedDc } from '@/lib/savedDcStorage';
import { PersonnelSelect } from '@/components/ortho/PersonnelSelect';
import { ExpenseTaggingTab } from './ExpenseTaggingTab';
import { DailyExpenseTab } from './DailyExpenseTab';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Landmark,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Search,
  Receipt,
  FileText,
  Filter,
  Download,
  Trash2,
  Edit,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  CreditCard,
  Layers,
  ArrowRightLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Sparkles,
  Tag,
  ExternalLink,
  ChevronRight,
  Eye,
  Check,
  MoreVertical,
  Printer,
  X,
  Info,
  RotateCcw,
  Link2,
  Unlink,
  Upload,
  FileSpreadsheet,
  Mail,
  Zap,
  Banknote,
  Stethoscope,
  User,
  UserCheck,
  Loader2,
} from 'lucide-react';

const COMMON_BANKS = [
  'HDFC Bank',
  'State Bank of India (SBI)',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Punjab National Bank',
  'Bank of Baroda',
  'Canara Bank',
  'Union Bank of India',
  'IndusInd Bank',
  'Yes Bank',
  'Cash In Hand',
  'Other Bank',
];

const CREDIT_CATEGORIES = [
  'Invoice Collection',
  'Hospital Advance Payment',
  'Direct Patient Billing',
  'Cash Counter Deposit',
  'Doctor Consultation Fee',
  'Bank Interest',
  'Transfer In',
  'Capital Infusion',
  'Other Credit',
];

const DEBIT_CATEGORIES = [
  'Vendor / Implant Supplier',
  'Staff Salary & Incentives',
  'Logistics & Courier Delivery',
  'Hospital Rent & Maintenance',
  'Fuel & Vehicle Expenses',
  'Electricity & Utility Bills',
  'Surgical Instrument Purchase',
  'Taxes & GST Payment',
  'Bank Charges & Fees',
  'Cash Withdrawal for Counter',
  'Transfer Out',
  'Office Stationery & Misc',
  'Other Debit',
];

function convertDcToCashInvoiceObj(dc: SavedDc, cashInvoicesList: CashInvoiceData[]): CashInvoiceData {
  const existing = cashInvoicesList.find(
    (inv) =>
      (inv.dcNumber && inv.dcNumber.toString().trim() === dc.dcNo.toString().trim()) ||
      (inv.invNumber && (inv.invNumber === dc.invoiceRef || inv.invNumber === `DC #${dc.dcNo}`))
  );
  if (existing) {
    return existing;
  }

  const items: CashInvoiceData['items'] = [];
  if (Array.isArray(dc.items)) {
    dc.items.forEach((item) => {
      if (Array.isArray(item.sizes) && item.sizes.length > 0) {
        item.sizes.forEach((sz) => {
          items.push({
            description: `${dc.materialType || 'SS'} ${item.name}`,
            size: sz.size,
            subDescription: item.procedure ? `Procedure: ${item.procedure}` : undefined,
            qty: Number(sz.qty) || 1,
            rate: Number(sz.rate) || 0,
            amount: (Number(sz.qty) || 1) * (Number(sz.rate) || 0),
          });
        });
      } else {
        items.push({
          description: `${dc.materialType || 'SS'} ${item.name}`,
          subDescription: item.procedure ? `Procedure: ${item.procedure}` : undefined,
          qty: 1,
          rate: 0,
          amount: 0,
        });
      }
    });
  }

  const grandTotal = Number(dc.cashAmount) || 0;

  return {
    invNumber: dc.invoiceRef || `DC #${dc.dcNo}`,
    dcNumber: dc.dcNo,
    invDate: dc.savedAt
      ? new Date(dc.savedAt).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    clientName: dc.hospitalName || 'Cash Customer',
    clientAddress: dc.doctorName ? `Doctor: ${dc.doctorName}` : undefined,
    items:
      items.length > 0
        ? items
        : [{ description: `Delivery Challan DC #${dc.dcNo}`, qty: 1, rate: grandTotal, amount: grandTotal }],
    subtotal: grandTotal,
    discount: 0,
    grandTotal: grandTotal,
    paymentReceived: 0,
    status: 'unpaid',
    savedAt: typeof dc.savedAt === 'number' ? dc.savedAt : Date.now(),
    remarks: dc.remarks,
  };
}

export const BankAccountsView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Navigation tab with URL synchronization
  const tabFromUrl = (searchParams.get("tab") as "ledger" | "unlinked" | "linked" | "import" | "accounts" | "expense_tag" | "daily_expense") || "ledger";
  const [activeTab, setActiveTabState] = useState<"ledger" | "unlinked" | "linked" | "import" | "accounts" | "expense_tag" | "daily_expense">(tabFromUrl);

  useEffect(() => {
    const t = searchParams.get("tab") as "ledger" | "unlinked" | "linked" | "import" | "accounts" | "expense_tag" | "daily_expense";
    if (t === "unlinked" || t === "linked" || t === "import" || t === "accounts" || t === "expense_tag" || t === "daily_expense") {
      setActiveTabState(t);
    } else {
      setActiveTabState("ledger");
    }
  }, [searchParams]);

  const setActiveTab = (newTab: "ledger" | "unlinked" | "linked" | "import" | "accounts" | "expense_tag" | "daily_expense") => {
    setActiveTabState(newTab);
    const newParams = new URLSearchParams(searchParams);
    if (newTab === "ledger") {
      newParams.delete("tab");
    } else {
      newParams.set("tab", newTab);
    }
    setSearchParams(newParams);
  };

  // State
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [cashInvoices, setCashInvoices] = useState<CashInvoiceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');

  // Ledger Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'credit' | 'debit' | 'unlinked' | 'linked' | 'cash_memo_income'>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modals
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [txTypeToOpen, setTxTypeToOpen] = useState<'credit' | 'debit'>('credit');
  const [editingTx, setEditingTx] = useState<BankTransaction | null>(null);

  // Link Transaction Modal State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [targetTransactionForLink, setTargetTransactionForLink] = useState<BankTransaction | null>(null);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [autoUpdateInvoicePayment, setAutoUpdateInvoicePayment] = useState(true);

  // DC Tracker Cash Queue State
  const [savedDcs, setSavedDcs] = useState<SavedDc[]>([]);
  const [viewingDcDetails, setViewingDcDetails] = useState<SavedDc | null>(null);
  const [viewingCashInvoiceModal, setViewingCashInvoiceModal] = useState<CashInvoiceData | null>(null);

  const viewingDcAsCashInvoice = useMemo<CashInvoiceData | null>(() => {
    if (!viewingDcDetails) return null;
    return convertDcToCashInvoiceObj(viewingDcDetails, cashInvoices);
  }, [viewingDcDetails, cashInvoices]);

  const handleViewCandidateInvoice = (inv: CashInvoiceData) => {
    if (inv.dcNumber) {
      const matchingDc = savedDcs.find(
        (d) => d.dcNo.toString().trim() === inv.dcNumber?.toString().trim()
      );
      if (matchingDc) {
        setViewingCashInvoiceModal(convertDcToCashInvoiceObj(matchingDc, cashInvoices));
        return;
      }
    }
    setViewingCashInvoiceModal(inv);
  };
  const [settlingDc, setSettlingDc] = useState<SavedDc | null>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('');
  const [paymentRemarksInput, setPaymentRemarksInput] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer'>('cash');
  const [paymentCollectedBy, setPaymentCollectedBy] = useState<string>('');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [selectedCreditTxId, setSelectedCreditTxId] = useState<string>('');
  const [isSettling, setIsSettling] = useState<boolean>(false);

  // Inter-Account Transfer State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferFromAccountId, setTransferFromAccountId] = useState<string>('');
  const [transferToAccountId, setTransferToAccountId] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferRef, setTransferRef] = useState<string>('');
  const [transferNote, setTransferNote] = useState<string>('');

  // Invoice Details Preview Popup
  const [previewInvoice, setPreviewInvoice] = useState<CashInvoiceData | null>(null);

  // Sheet / CSV Paste Ingestion State
  const [importAccountId, setImportAccountId] = useState<string>('');
  const [pastedSheetText, setPastedSheetText] = useState<string>('');
  const [parsedPreviewRows, setParsedPreviewRows] = useState<Partial<BankTransaction>[]>([]);

  // Live Multi-Account HDFC Email Parser State
  const [pastedEmailText, setPastedEmailText] = useState<string>('');
  const [parsedEmailResults, setParsedEmailResults] = useState<ParsedHdfcEmailResult[]>([]);

  // Email & Transaction Details Verification Modal State
  const [viewingTxDetails, setViewingTxDetails] = useState<BankTransaction | null>(null);

  // Google Apps Script Live Web App Connector State
  const [appsScriptUrl, setAppsScriptUrl] = useState<string>(() => {
    return localStorage.getItem('srrortho:apps_script_url') || '';
  });
  const [syncingScript, setSyncingScript] = useState<boolean>(false);
  const [isClearingAll, setIsClearingAll] = useState<boolean>(false);
  const [gmailSyncTargetAccountId, setGmailSyncTargetAccountId] = useState<string>('auto');
  const [isAutoAssigning, setIsAutoAssigning] = useState<boolean>(false);
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState<boolean>(() => {
    return localStorage.getItem('srrortho:auto_sync_live') === 'true';
  });
  const [lastAutoSyncTime, setLastAutoSyncTime] = useState<number | null>(null);

  // Account Form State
  const [accountForm, setAccountForm] = useState({
    accountName: '',
    bankName: 'HDFC Bank',
    accountNumber: '',
    ifscCode: '',
    branch: '',
    accountType: 'current' as BankAccount['accountType'],
    upiId: '',
    openingBalance: 0,
    notes: '',
  });

  // Transaction Form State
  const [txForm, setTxForm] = useState({
    accountId: '',
    type: 'credit' as 'credit' | 'debit',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    time: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
    category: 'Invoice Collection',
    description: '',
    referenceNumber: '',
    linkToInvoice: false,
    selectedInvoiceId: '',
    autoUpdateInvoice: true,
  });

  const [fetchLimit, setFetchLimit] = useState<number>(150);

  // Load Data (Single fast query for first 150 transactions)
  const loadAllData = async (showToast: boolean = false, overrideLimit?: number) => {
    setLoading(true);
    const limitToUse = overrideLimit || fetchLimit;
    try {
      const [accs, txs, invs] = await Promise.all([
        fetchBankAccountsFromFirestore(),
        fetchBankTransactionsFromFirestore(undefined, limitToUse),
        fetchCashInvoicesFromFirestore(),
      ]);
      setAccounts(accs);
      setTransactions(txs);
      setCashInvoices(invs);

      if (accs.length > 0 && !importAccountId) {
        setImportAccountId(accs[0].id);
      }
      if (showToast) {
        toast.success(`Loaded ${txs.length} transactions!`);
      }
    } catch (err) {
      console.error('Error loading bank data:', err);
      toast.error('Failed to load bank data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();

    // Attach Real-time Firestore Listener
    // Automatically pushes any new transaction directly into the UI without page refresh!
    const unsubscribe = subscribeToBankTransactions(
      (realtimeTxs) => {
        if (realtimeTxs && realtimeTxs.length > 0) {
          setTransactions(realtimeTxs);
        }
      },
      (err) => console.warn('Real-time listener warning:', err),
      fetchLimit
    );

    return () => unsubscribe();
  }, [fetchLimit]);

  // Load DC Tracker Saved DCs for Cash Queue integration
  useEffect(() => {
    const fetchDcs = async () => {
      try {
        const dcs = await loadSavedDcs();
        setSavedDcs(dcs);
      } catch (err) {
        console.error('Error loading saved DCs in BankAccountsView:', err);
      }
    };
    fetchDcs();

    const handleDcUpdate = (e: Event) => {
      const customEvt = e as CustomEvent<SavedDc[]>;
      if (customEvt.detail) {
        setSavedDcs(customEvt.detail);
      }
    };

    window.addEventListener('srrortho:saved_dcs_updated', handleDcUpdate);
    return () => window.removeEventListener('srrortho:saved_dcs_updated', handleDcUpdate);
  }, []);

  const cashQueueDcs = useMemo(() => {
    return savedDcs.filter((d) => d.status === 'cash');
  }, [savedDcs]);

  const cashQueueTotalAmount = useMemo(() => {
    return cashQueueDcs.reduce((acc, d) => acc + (d.cashAmount || 0), 0);
  }, [cashQueueDcs]);

  // Compute live balances per account
  const accountBalances = useMemo(() => {
    const balances: Record<
      string,
      {
        balance: number;
        totalCredits: number;
        totalDebits: number;
        creditCount: number;
        debitCount: number;
        latestAlertBalance?: number;
        latestAlertDate?: string;
      }
    > = {};

    accounts.forEach((acc) => {
      balances[acc.id] = {
        balance: Number(acc.openingBalance) || 0,
        totalCredits: 0,
        totalDebits: 0,
        creditCount: 0,
        debitCount: 0,
      };
    });

    // Sort descending to find the newest stated alert balance from HDFC emails
    const sortedDesc = [...transactions].sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    sortedDesc.forEach((tx) => {
      if (balances[tx.accountId] && tx.availableBalance !== undefined && balances[tx.accountId].latestAlertBalance === undefined) {
        balances[tx.accountId].latestAlertBalance = tx.availableBalance;
        balances[tx.accountId].latestAlertDate = tx.date;
      }
    });

    transactions.forEach((tx) => {
      if (balances[tx.accountId]) {
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'credit') {
          balances[tx.accountId].balance += amt;
          balances[tx.accountId].totalCredits += amt;
          balances[tx.accountId].creditCount += 1;
        } else {
          balances[tx.accountId].balance -= amt;
          balances[tx.accountId].totalDebits += amt;
          balances[tx.accountId].debitCount += 1;
        }
      }
    });

    return balances;
  }, [accounts, transactions]);

  // Precompute continuous running balances for all transactions chronologically
  const transactionRunningBalances = useMemo(() => {
    const runningMap = new Map<string, number>();

    const txByAccount: Record<string, BankTransaction[]> = {};
    accounts.forEach((acc) => {
      txByAccount[acc.id] = [];
    });

    transactions.forEach((tx) => {
      if (!txByAccount[tx.accountId]) {
        txByAccount[tx.accountId] = [];
      }
      txByAccount[tx.accountId].push(tx);
    });

    Object.keys(txByAccount).forEach((accId) => {
      const acc = accounts.find((a) => a.id === accId);
      let running = Number(acc?.openingBalance) || 0;

      const sortedAsc = [...txByAccount[accId]].sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date);
        if (dateCmp !== 0) return dateCmp;
        const timeA = a.time || '00:00';
        const timeB = b.time || '00:00';
        const timeCmp = timeA.localeCompare(timeB);
        if (timeCmp !== 0) return timeCmp;
        return (a.createdAt || 0) - (b.createdAt || 0);
      });

      sortedAsc.forEach((tx) => {
        if (tx.type === 'credit') {
          running += Number(tx.amount) || 0;
        } else {
          running -= Number(tx.amount) || 0;
        }
        runningMap.set(tx.id, running);
      });
    });

    return runningMap;
  }, [accounts, transactions]);

  // Overall KPIs
  const overallSummary = useMemo(() => {
    let totalNetBalance = 0;
    let totalCredits = 0;
    let totalDebits = 0;
    let creditCount = 0;
    let debitCount = 0;
    let unlinkedCreditCount = 0;

    accounts.forEach((acc) => {
      const stats = accountBalances[acc.id];
      if (stats) {
        totalNetBalance += stats.balance;
        totalCredits += stats.totalCredits;
        totalDebits += stats.totalDebits;
        creditCount += stats.creditCount;
        debitCount += stats.debitCount;
      } else {
        totalNetBalance += Number(acc.openingBalance) || 0;
      }
    });

    transactions.forEach((tx) => {
      if (tx.type === 'credit' && !tx.linkedInvoiceNumber && !tx.linkedInvoiceId) {
        unlinkedCreditCount++;
      }
    });

    return {
      totalNetBalance,
      totalCredits,
      totalDebits,
      creditCount,
      debitCount,
      unlinkedCreditCount,
      totalTransactions: transactions.length,
    };
  }, [accounts, accountBalances, transactions]);

  // Unlinked Credit Transactions
  const unlinkedCreditTransactions = useMemo(() => {
    return transactions.filter(
      (tx) => tx.type === 'credit' && !tx.linkedInvoiceNumber && !tx.linkedInvoiceId
    );
  }, [transactions]);

  // Linked / Reconciled Credit Transactions
  const linkedCreditTransactions = useMemo(() => {
    return transactions.filter(
      (tx) => tx.type === 'credit' && Boolean(tx.linkedInvoiceNumber || tx.linkedInvoiceId)
    );
  }, [transactions]);

  // Sorted Executive Bank Accounts (1538 ALWAYS FIRST on far left)
  const sortedBankAccounts = useMemo(() => {
    const accs = accounts.filter((a) => a.accountType !== "cash_in_hand");
    accs.sort((a, b) => {
      const aSuffix = a.accountNumber ? a.accountNumber.slice(-4) : (a.accountName.match(/\d{4}/)?.[0] || "");
      const bSuffix = b.accountNumber ? b.accountNumber.slice(-4) : (b.accountName.match(/\d{4}/)?.[0] || "");
      if (aSuffix === "1538" || a.id.includes("1538")) return -1;
      if (bSuffix === "1538" || b.id.includes("1538")) return 1;
      return 0;
    });
    return accs;
  }, [accounts]);

  const availableBankCredits = useMemo(() => {
    return transactions.filter((t) => t.type === "credit" && !t.linkedInvoiceNumber && !t.linkedInvoiceId);
  }, [transactions]);

  const filteredBankCredits = useMemo(() => {
    if (!selectedBankAccountId || selectedBankAccountId === "all") {
      return availableBankCredits;
    }
    return availableBankCredits.filter((t) => t.accountId === selectedBankAccountId);
  }, [availableBankCredits, selectedBankAccountId]);

  const handleOpenSettleDcModal = (dc: SavedDc) => {
    setSettlingDc(dc);
    setPaymentAmountInput(dc.cashAmount ? String(dc.cashAmount) : "");
    setPaymentRemarksInput("");
    setPaymentMethod("cash");
    setPaymentCollectedBy("");
    setSelectedBankAccountId(sortedBankAccounts[0]?.id || "");
    setSelectedCreditTxId("");
  };

  // Filtered Ledger Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (selectedAccountId !== 'all' && tx.accountId !== selectedAccountId) {
        return false;
      }
      if (typeFilter === 'credit' && tx.type !== 'credit') return false;
      if (typeFilter === 'debit' && tx.type !== 'debit') return false;
      if (typeFilter === 'cash_memo_income' && tx.type !== 'credit') return false;
      if (typeFilter === 'unlinked' && (tx.type !== 'credit' || tx.linkedInvoiceNumber || tx.linkedInvoiceId)) return false;
      if (typeFilter === 'linked' && (!tx.linkedInvoiceNumber && !tx.linkedInvoiceId)) return false;
      if (categoryFilter !== 'all' && tx.category !== categoryFilter) return false;

      if (dateRangeFilter !== 'all') {
        const [y, m, d] = (tx.date || '').split('-').map(Number);
        const txDate = y && m && d ? new Date(y, m - 1, d) : new Date(tx.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (dateRangeFilter === 'today') {
          if (txDate.toDateString() !== today.toDateString()) return false;
        } else if (dateRangeFilter === 'week') {
          const weekAgo = new Date(today);
          weekAgo.setDate(today.getDate() - 7);
          if (txDate < weekAgo) return false;
        } else if (dateRangeFilter === 'month') {
          const monthAgo = new Date(today);
          monthAgo.setDate(today.getDate() - 30);
          if (txDate < monthAgo) return false;
        }
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const narrationMatch = (tx.description || '').toLowerCase().includes(query);
        const refMatch = (tx.referenceNumber || '').toLowerCase().includes(query);
        const customerMatch = (tx.linkedCustomerName || '').toLowerCase().includes(query);
        const invMatch = (tx.linkedInvoiceNumber || '').toLowerCase().includes(query);
        const categoryMatch = (tx.category || '').toLowerCase().includes(query);
        const amountMatch = (tx.amount || '').toString().includes(query);
        const acc = accounts.find((a) => a.id === tx.accountId);
        const bankMatch = acc ? acc.accountName.toLowerCase().includes(query) || acc.bankName.toLowerCase().includes(query) : false;

        return narrationMatch || refMatch || customerMatch || invMatch || categoryMatch || amountMatch || bankMatch;
      }

      return true;
    });
  }, [transactions, selectedAccountId, typeFilter, categoryFilter, dateRangeFilter, searchQuery, accounts]);

  // Smart Matching Invoices for the Link Modal
  const candidateInvoicesForLink = useMemo(() => {
    // 1. Collect all invoice numbers & DC numbers currently linked to OTHER bank transactions
    const alreadyLinkedInvNumbers = new Set<string>();
    transactions.forEach((tx) => {
      // Don't exclude the invoice currently linked to this target transaction (so user can see "Currently Linked")
      if (targetTransactionForLink && tx.id === targetTransactionForLink.id) return;
      if (tx.linkedInvoiceNumber) {
        alreadyLinkedInvNumbers.add(tx.linkedInvoiceNumber.toLowerCase().trim());
      }
      if (tx.linkedInvoiceId) {
        alreadyLinkedInvNumbers.add(tx.linkedInvoiceId.toLowerCase().trim());
      }
    });

    // 2. Map Cash Queue DCs (only active cash status DCs that aren't already linked)
    const dcAsInvoices: CashInvoiceData[] = cashQueueDcs
      .filter((dc) => {
        const dcKey = `dc #${dc.dcNo}`.toLowerCase();
        if (alreadyLinkedInvNumbers.has(dcKey) || alreadyLinkedInvNumbers.has(dc.dcNo.toLowerCase())) {
          return false;
        }
        if (dc.status === 'completed' || dc.status === 'cancelled') {
          return false;
        }
        return true;
      })
      .map((dc) => ({
        invNumber: `DC #${dc.dcNo}`,
        dcNumber: dc.dcNo,
        clientName: dc.hospitalName,
        grandTotal: dc.cashAmount || 0,
        paymentReceived: 0,
        invDate: dc.savedAt,
        status: 'unpaid',
        notes: `Doctor: ${dc.doctorName || 'N/A'}, Items: ${dc.items.length}`,
      }));

    // 3. Filter cashInvoices to exclude already paid / already linked invoices
    const filteredCashInvoices = cashInvoices.filter((inv) => {
      const invNumLower = (inv.invNumber || '').toLowerCase().trim();
      const dcNumLower = (inv.dcNumber || '').toLowerCase().trim();

      // If currently linked to this target transaction, keep it so it shows "Currently Linked"
      if (
        targetTransactionForLink &&
        (targetTransactionForLink.linkedInvoiceNumber?.toLowerCase().trim() === invNumLower ||
          targetTransactionForLink.linkedInvoiceId?.toLowerCase().trim() === invNumLower)
      ) {
        return true;
      }

      // Exclude if already linked to another bank transaction
      if (alreadyLinkedInvNumbers.has(invNumLower) || (dcNumLower && alreadyLinkedInvNumbers.has(dcNumLower))) {
        return false;
      }

      // Exclude if status is paid / Paid
      if (inv.status === 'paid' || inv.status === 'Paid') {
        return false;
      }

      // Exclude if fully paid
      const grandTotal = Number(inv.grandTotal) || 0;
      const paymentReceived = Number(inv.paymentReceived) || 0;
      if (grandTotal > 0 && paymentReceived >= grandTotal) {
        return false;
      }

      // Exclude if matching DC is completed in DC Tracker
      if (inv.dcNumber) {
        const matchingDc = savedDcs.find((d) => d.dcNo === inv.dcNumber);
        if (matchingDc && (matchingDc.status === 'completed' || matchingDc.status === 'cancelled')) {
          return false;
        }
      }

      return true;
    });

    // 4. Collect DC numbers covered by filteredCashInvoices to prevent duplicate rows
    const coveredDcNumbers = new Set<string>();
    filteredCashInvoices.forEach((inv) => {
      if (inv.dcNumber) {
        coveredDcNumbers.add(inv.dcNumber.toLowerCase().trim());
      }
      const extractedDc = (inv.invNumber || '').replace(/^DC\s*#?\s*/i, '').toLowerCase().trim();
      if (extractedDc && extractedDc !== inv.invNumber?.toLowerCase().trim()) {
        coveredDcNumbers.add(extractedDc);
      }
    });

    // 5. Only include dcAsInvoices if not already represented by a Cash Invoice
    const uniqueDcAsInvoices = dcAsInvoices.filter((dcInv) => {
      if (!dcInv.dcNumber) return true;
      const cleanDcNo = dcInv.dcNumber.toLowerCase().trim();
      return !coveredDcNumbers.has(cleanDcNo);
    });

    const allCandidates = [...filteredCashInvoices, ...uniqueDcAsInvoices];
    if (!targetTransactionForLink) return allCandidates;

    const txAmount = Number(targetTransactionForLink.amount) || 0;
    const txDesc = (targetTransactionForLink.description || '').toLowerCase();
    const query = invoiceSearchQuery.toLowerCase().trim();

    return allCandidates
      .sort((a, b) => {
        const aDue = Math.max(0, Number(a.grandTotal || 0) - Number(a.paymentReceived || 0));
        const bDue = Math.max(0, Number(b.grandTotal || 0) - Number(b.paymentReceived || 0));

        const aExactAmount = aDue === txAmount || Number(a.grandTotal || 0) === txAmount ? 1 : 0;
        const bExactAmount = bDue === txAmount || Number(b.grandTotal || 0) === txAmount ? 1 : 0;

        const aNameMatch = (a.clientName || '').toLowerCase().split(' ').some((w) => w.length > 3 && txDesc.includes(w)) ? 1 : 0;
        const bNameMatch = (b.clientName || '').toLowerCase().split(' ').some((w) => w.length > 3 && txDesc.includes(w)) ? 1 : 0;

        const aScore = aExactAmount * 3 + aNameMatch * 2;
        const bScore = bExactAmount * 3 + bNameMatch * 2;

        return bScore - aScore;
      })
      .filter((inv) => {
        if (!query) return true;
        const matchNum = (inv.invNumber || '').toLowerCase().includes(query);
        const matchDc = (inv.dcNumber || '').toLowerCase().includes(query);
        const matchClient = (inv.clientName || '').toLowerCase().includes(query);
        return matchNum || matchDc || matchClient;
      });
  }, [cashInvoices, cashQueueDcs, savedDcs, transactions, targetTransactionForLink, invoiceSearchQuery]);

  // Smart Match Engine: Match a Cash Queue DC with an Unlinked Bank Credit Transaction
  const findSuggestedBankTransactionForDc = useCallback(
    (dc: SavedDc) => {
      const dcAmount = dc.cashAmount || 0;
      if (dcAmount <= 0) return null;

      const hospTokens = (dc.hospitalName || '')
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !['hospital', 'hospitals', 'clinic', 'nursing', 'home', 'dr', 'doctor'].includes(w));

      const docTokens = (dc.doctorName || '')
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !['dr', 'doctor'].includes(w));

      let bestTx: BankTransaction | null = null;
      let maxScore = 0;
      let bestReason = '';

      for (const tx of unlinkedCreditTransactions) {
        if (tx.type !== 'credit') continue;

        const txAmount = Number(tx.amount) || 0;
        const descLower = (tx.description || '').toLowerCase();
        const refLower = (tx.referenceNumber || '').toLowerCase();
        const fullTxText = `${descLower} ${refLower}`;

        const isExactAmount = Math.abs(txAmount - dcAmount) < 0.01;
        if (!isExactAmount && Math.abs(txAmount - dcAmount) > 5) continue;

        let score = 0;
        const reasons: string[] = [];

        if (isExactAmount) {
          score += 5;
          reasons.push(`Exact Amount ₹${dcAmount.toLocaleString('en-IN')}`);
        }

        const matchedHospWord = hospTokens.find((word) => fullTxText.includes(word));
        if (matchedHospWord) {
          score += 4;
          reasons.push(`Hospital "${matchedHospWord}"`);
        }

        const matchedDocWord = docTokens.find((word) => fullTxText.includes(word));
        if (matchedDocWord) {
          score += 3;
          reasons.push(`Doctor "${matchedDocWord}"`);
        }

        if (score > maxScore && score >= 5) {
          maxScore = score;
          bestTx = tx;
          bestReason = reasons.join(' • ');
        }
      }

      if (bestTx) {
        return { transaction: bestTx, score: maxScore, reason: bestReason };
      }
      return null;
    },
    [unlinkedCreditTransactions]
  );

  const handleMatchAndLinkDcToTransaction = async (dc: SavedDc, tx: BankTransaction) => {
    try {
      await transitionSavedDc(dc.id, {
        toStatus: 'completed',
        action: 'MOVE_CASH_TO_COMPLETED',
        updates: {
          paidAt: new Date().toISOString(),
          paymentMethod: 'bank_transfer',
        },
      });

      const mockInvoice: CashInvoiceData = {
        invNumber: `DC #${dc.dcNo}`,
        dcNumber: dc.dcNo,
        clientName: dc.hospitalName,
        grandTotal: dc.cashAmount || 0,
        paymentReceived: dc.cashAmount || 0,
        invDate: dc.savedAt,
        status: 'paid',
      };

      await linkBankTransactionToCashInvoice(tx.id, mockInvoice, true);

      toast.success(
        `⚡ DC #${dc.dcNo} (${dc.hospitalName}) matched & linked with Bank Credit ₹${tx.amount.toLocaleString(
          'en-IN'
        )}!`
      );
      loadAllData();
    } catch (err) {
      console.error('Error linking DC to transaction:', err);
      toast.error('Failed to link DC to bank transaction');
    }
  };

  const handleAutoMatchAllCashQueue = async () => {
    let matchedCount = 0;
    for (const dc of cashQueueDcs) {
      const match = findSuggestedBankTransactionForDc(dc);
      if (match) {
        await handleMatchAndLinkDcToTransaction(dc, match.transaction);
        matchedCount++;
      }
    }
    if (matchedCount > 0) {
      toast.success(`⚡ Successfully auto-matched & reconciled ${matchedCount} Cash Queue DCs!`);
    } else {
      toast.info('No auto-matches found for current Cash Queue DCs.');
    }
  };

  // Account Operations
  const handleOpenAddAccount = () => {
    setEditingAccount(null);
    setAccountForm({
      accountName: '',
      bankName: 'HDFC Bank',
      accountNumber: '',
      ifscCode: '',
      branch: '',
      accountType: 'current',
      upiId: '',
      openingBalance: 0,
      notes: '',
    });
    setIsAddAccountOpen(true);
  };

  const handleOpenEditAccount = (acc: BankAccount) => {
    setEditingAccount(acc);
    setAccountForm({
      accountName: acc.accountName,
      bankName: acc.bankName,
      accountNumber: acc.accountNumber,
      ifscCode: acc.ifscCode,
      branch: acc.branch,
      accountType: acc.accountType,
      upiId: acc.upiId || '',
      openingBalance: acc.openingBalance || 0,
      notes: acc.notes || '',
    });
    setIsAddAccountOpen(true);
  };

  const handleSaveAccount = async () => {
    if (!accountForm.accountName.trim()) {
      toast.error('Please enter an account name');
      return;
    }
    if (!accountForm.accountNumber.trim()) {
      toast.error('Please enter an account number');
      return;
    }

    const accountToSave: BankAccount = {
      id: editingAccount ? editingAccount.id : `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      accountName: accountForm.accountName.trim(),
      bankName: accountForm.bankName.trim(),
      accountNumber: accountForm.accountNumber.trim(),
      ifscCode: accountForm.ifscCode.trim().toUpperCase(),
      branch: accountForm.branch.trim(),
      accountType: accountForm.accountType,
      upiId: accountForm.upiId.trim(),
      openingBalance: Number(accountForm.openingBalance) || 0,
      notes: accountForm.notes.trim(),
      createdAt: editingAccount ? editingAccount.createdAt : Date.now(),
      updatedAt: Date.now(),
    };

    const success = await saveBankAccountToFirestore(accountToSave);
    if (success) {
      toast.success(editingAccount ? 'Bank account updated!' : 'New bank account created!');
      setIsAddAccountOpen(false);

      // Auto-tag matching transactions to this account
      const cleanNum = accountToSave.accountNumber.replace(/[^0-9]/g, '');
      const cleanSuffix = cleanNum.slice(-4);
      if (cleanSuffix) {
        const txsToUpdate: BankTransaction[] = [];
        for (const tx of transactions) {
          const content = `${tx.description || ''} ${tx.rawAlert || ''} ${tx.referenceNumber || ''} ${tx.rawEmailBody || ''} ${tx.emailSubject || ''}`;
          const isMatch =
            tx.accountSuffix === cleanSuffix ||
            content.includes(cleanSuffix) ||
            (cleanSuffix === '1538' && (content.includes('1538') || /vyapar|upi|chq/i.test(content))) ||
            (cleanSuffix === '6569' && (content.includes('6569') || /neft|hospital/i.test(content)));

          if (isMatch && tx.accountId !== accountToSave.id) {
            txsToUpdate.push({
              ...tx,
              accountId: accountToSave.id,
              accountSuffix: tx.accountSuffix || cleanSuffix,
              updatedAt: Date.now(),
            });
          }
        }

        if (txsToUpdate.length > 0) {
          await importBatchBankTransactions(txsToUpdate);
          toast.success(`⚡ Automatically tagged ${txsToUpdate.length} transactions to "${accountToSave.accountName}"!`);
        }
      }

      loadAllData();
    } else {
      toast.error('Failed to save bank account');
    }
  };

  const handleDeleteAccount = async (acc: BankAccount) => {
    if (confirm(`Are you sure you want to delete "${acc.accountName}" and all associated records?`)) {
      const success = await deleteBankAccountFromFirestore(acc.id);
      if (success) {
        toast.success(`Account "${acc.accountName}" removed`);
        if (selectedAccountId === acc.id) {
          setSelectedAccountId('all');
        }
        loadAllData();
      } else {
        toast.error('Failed to delete bank account');
      }
    }
  };

  // Transaction Operations
  const handleOpenAddTx = (type: 'credit' | 'debit' = 'credit', defaultAccId?: string) => {
    setEditingTx(null);
    setTxTypeToOpen(type);
    const targetAccId = defaultAccId || (selectedAccountId !== 'all' ? selectedAccountId : accounts[0]?.id || '');

    setTxForm({
      accountId: targetAccId,
      type: type,
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      time: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
      category: type === 'credit' ? 'Invoice Collection' : 'Vendor / Implant Supplier',
      description: '',
      referenceNumber: '',
      linkToInvoice: false,
      selectedInvoiceId: '',
      autoUpdateInvoice: true,
    });
    setIsAddTxOpen(true);
  };

  const handleOpenEditTx = (tx: BankTransaction) => {
    setEditingTx(tx);
    setTxTypeToOpen(tx.type);
    setTxForm({
      accountId: tx.accountId,
      type: tx.type,
      amount: tx.amount,
      date: tx.date,
      time: tx.time || '',
      category: tx.category,
      description: tx.description,
      referenceNumber: tx.referenceNumber || '',
      linkToInvoice: Boolean(tx.linkedInvoiceNumber || tx.linkedInvoiceId),
      selectedInvoiceId: tx.linkedInvoiceNumber || tx.linkedInvoiceId || '',
      autoUpdateInvoice: false,
    });
    setIsAddTxOpen(true);
  };

  const handleSaveTransaction = async () => {
    if (!txForm.accountId) {
      toast.error('Please select a bank account');
      return;
    }
    if (!txForm.amount || Number(txForm.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    let linkedInv: CashInvoiceData | undefined;
    if (txForm.type === 'credit' && txForm.linkToInvoice && txForm.selectedInvoiceId) {
      linkedInv = cashInvoices.find(
        (inv) =>
          inv.invNumber === txForm.selectedInvoiceId ||
          inv.invNumber?.replace(/\//g, '_') === txForm.selectedInvoiceId
      );
    }

    const txToSave: BankTransaction = {
      id: editingTx ? editingTx.id : `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      accountId: txForm.accountId,
      type: txForm.type,
      amount: Number(txForm.amount),
      date: txForm.date,
      time: txForm.time,
      category: txForm.category,
      description: txForm.description.trim() || (linkedInv ? `Payment for Invoice ${linkedInv.invNumber} (${linkedInv.clientName})` : `${txForm.type === 'credit' ? 'Credit' : 'Debit'} transaction`),
      referenceNumber: txForm.referenceNumber.trim(),
      linkedInvoiceId: linkedInv?.invNumber ? linkedInv.invNumber.replace(/\//g, '_') : undefined,
      linkedInvoiceNumber: linkedInv?.invNumber,
      linkedCustomerName: linkedInv?.clientName,
      linkedHospital: linkedInv?.clientName,
      createdSource: linkedInv ? 'cash_invoice_link' : 'manual',
      createdAt: editingTx ? editingTx.createdAt : Date.now(),
      updatedAt: Date.now(),
    };

    const res = await saveBankTransactionToFirestore(txToSave, txForm.autoUpdateInvoice);
    if (res.success) {
      toast.success(res.updatedInvoice ? `Transaction saved & Invoice ${res.updatedInvoice.invNumber} updated!` : 'Transaction saved successfully!');
      setIsAddTxOpen(false);
      loadAllData();
    } else {
      toast.error('Failed to record transaction');
    }
  };

  const revertDcStatusOnUnlink = async (tx: BankTransaction) => {
    const invRef = tx.linkedInvoiceNumber || tx.linkedInvoiceId || '';
    const cleanDcNo = invRef.replace(/^DC\s*#?\s*/i, '').trim().toLowerCase();
    const txRefNo = (tx.referenceNumber || '').trim().toLowerCase();

    const dcs = savedDcs.length ? savedDcs : await loadSavedDcs();
    const matchingDc = dcs.find((d) => {
      const dDcNo = (d.dcNo || '').replace(/^DC\s*#?\s*/i, '').trim().toLowerCase();
      const dInvRef = (d.invoiceRef || '').trim().toLowerCase();
      const dUtr = ((d as any).utrNo || '').trim().toLowerCase();
      const dId = (d.id || '').trim().toLowerCase();

      if (invRef && (dId === invRef.toLowerCase() || dInvRef === invRef.toLowerCase() || dInvRef.replace(/\//g, '_') === invRef.toLowerCase())) {
        return true;
      }
      if (cleanDcNo && (dDcNo === cleanDcNo || d.dcNo?.toLowerCase() === cleanDcNo)) {
        return true;
      }
      if (txRefNo && dUtr && txRefNo === dUtr) {
        return true;
      }
      return false;
    });

    if (matchingDc && (matchingDc.status === 'completed' || matchingDc.status === 'cash')) {
      try {
        await transitionSavedDc(matchingDc.id, {
          toStatus: 'cash',
          action: 'MOVE_TO_CASH',
          updates: {
            paidAt: undefined,
            paymentMethod: undefined,
            bankAccountId: undefined,
            bankName: undefined,
            accountNumber: undefined,
            utrNo: undefined,
          },
          clear: ['paidAt', 'paymentMethod', 'bankAccountId', 'bankName', 'accountNumber', 'utrNo'],
        });
        toast.info(`⚡ DC #${matchingDc.dcNo} moved back to Cash Queue as Unpaid.`);
      } catch (e) {
        console.error('Failed to move DC back to Cash Queue on unlink/delete:', e);
      }
    } else {
      await revertMatchingDcToCashQueue(tx);
    }
  };

  const handleDeleteTransaction = async (tx: BankTransaction) => {
    const hasInvoice = Boolean(tx.linkedInvoiceNumber || tx.linkedInvoiceId);
    let revert = false;
    if (hasInvoice && tx.type === 'credit') {
      revert = confirm(`This transaction is linked to Cash Invoice "${tx.linkedInvoiceNumber}". Deduct ₹${tx.amount.toLocaleString('en-IN')} from the invoice paid total and move matching DC back to Cash Queue?`);
    } else if (!confirm(`Delete this ${tx.type} entry of ₹${tx.amount.toLocaleString('en-IN')}?`)) {
      return;
    }

    if (tx.type === 'credit') {
      await revertDcStatusOnUnlink(tx);
    }

    const success = await deleteBankTransactionFromFirestore(tx.id, revert, tx);
    if (success) {
      toast.success('Transaction deleted');
      loadAllData();
    } else {
      toast.error('Failed to delete transaction');
    }
  };

  const handleClearAllTransactions = async () => {
    if (
      !window.confirm(
        '⚠️ Are you sure you want to delete ALL bank transactions? This will reset the ledger completely so you can fetch a fresh clean batch of emails.'
      )
    ) {
      return;
    }

    setIsClearingAll(true);
    try {
      const res = await clearAllBankTransactionsFromFirestore();
      if (res.success) {
        toast.success(`🗑️ Successfully deleted ${res.count} transactions. Ledger is now reset.`);
        loadAllData(true);
      } else {
        toast.error('Failed to delete bank transactions.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error clearing bank transactions');
    } finally {
      setIsClearingAll(false);
    }
  };

  const handleWipeAllBankDataAndAccounts = async () => {
    if (
      !window.confirm(
        '⚠️ CRITICAL: Are you sure you want to delete ALL Bank Accounts AND all Transactions? This will give you a completely blank treasury database so you can add your accounts and transactions from scratch.'
      )
    ) {
      return;
    }

    setIsClearingAll(true);
    try {
      const res = await clearAllBankDataAndAccountsFromFirestore();
      if (res.success) {
        toast.success(`🗑️ Wiped ${res.accCount} accounts and ${res.txCount} transactions. Blank slate ready!`);
        setSelectedAccountId('all');
        loadAllData(true);
      } else {
        toast.error('Failed to wipe bank data');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error wiping bank data');
    } finally {
      setIsClearingAll(false);
    }
  };

  /**
   * Helper: Matches an account suffix (e.g. 1538 or 6569) or alert text to configured bank accounts
   */
  const matchAccountForSuffix = (suffix?: string, targetAccountId?: string, txContent?: string): BankAccount | undefined => {
    if (targetAccountId && targetAccountId !== 'auto') {
      const explicitAcc = accounts.find((a) => a.id === targetAccountId);
      if (explicitAcc) return explicitAcc;
    }

    if (!accounts || accounts.length === 0) return undefined;

    let cleanSuffix = suffix ? suffix.trim() : '';

    // Strict priority check for known account numbers in alert text (Supports X, XX, XXX, **** prefixes)
    if (txContent) {
      if (/[*xX]*6569\b/i.test(txContent) || /6569\b/.test(txContent)) {
        cleanSuffix = '6569';
      } else if (/[*xX]*1538\b/i.test(txContent) || /1538\b/.test(txContent)) {
        cleanSuffix = '1538';
      }
    }

    if (cleanSuffix === '1538') {
      const savingsMatch = accounts.find(
        (a) =>
          a.accountNumber.includes('1538') ||
          a.accountName.includes('1538') ||
          a.accountType === 'savings' ||
          a.accountName.toLowerCase().includes('savings') ||
          a.accountName.toLowerCase().includes('upi')
      );
      if (savingsMatch) return savingsMatch;
    }

    if (cleanSuffix === '6569') {
      const mainMatch = accounts.find(
        (a) =>
          a.accountNumber.includes('6569') ||
          a.accountName.includes('6569') ||
          a.accountType === 'current' ||
          a.accountName.toLowerCase().includes('main') ||
          a.accountName.toLowerCase().includes('current') ||
          a.accountName.toLowerCase().includes('ortho')
      );
      if (mainMatch) return mainMatch;
    }

    if (cleanSuffix) {
      // 1. Check account number match
      const numMatch = accounts.find((acc) => {
        const cleanNum = acc.accountNumber.replace(/[^0-9]/g, '');
        return cleanNum.endsWith(cleanSuffix) || cleanNum.includes(cleanSuffix);
      });
      if (numMatch) return numMatch;

      // 2. Check account name containing the suffix digits
      const nameMatch = accounts.find((acc) => acc.accountName.includes(cleanSuffix));
      if (nameMatch) return nameMatch;
    }

    // Fallback: Default account or first available account
    return accounts.find((a) => a.isDefault) || accounts[0];
  };

  /**
   * Re-assigns a single transaction's bank account in Firestore
   */
  const handleChangeTxAccount = async (tx: BankTransaction, newAccountId: string) => {
    if (tx.accountId === newAccountId) return;
    const targetAcc = accounts.find((a) => a.id === newAccountId);
    const updatedTx: BankTransaction = {
      ...tx,
      accountId: newAccountId,
      updatedAt: Date.now(),
    };

    const success = await saveBankTransactionToFirestore(updatedTx, false);
    if (success) {
      toast.success(`Attached transaction to "${targetAcc?.accountName || 'Bank Account'}"`);
      loadAllData();
    } else {
      toast.error('Failed to change bank account');
    }
  };

  /**
   * 1-Click Auto-Assign: Re-routes and attaches all transactions in database to matching bank accounts
   */
  const handleAutoAssignTransactionsToAccounts = async () => {
    if (accounts.length === 0) {
      toast.error('Please add your bank accounts first in the Accounts tab.');
      return;
    }

    if (transactions.length === 0) {
      toast.info('No transactions found to assign.');
      return;
    }

    setIsAutoAssigning(true);
    try {
      let changedCount = 0;
      const txsToUpdate: BankTransaction[] = [];

      for (const tx of transactions) {
        const fullAlertText = `${tx.rawEmailBody || ''} ${tx.rawAlert || ''} ${tx.description || ''} ${tx.referenceNumber || ''} ${tx.emailSubject || ''}`;
        const matched = matchAccountForSuffix(tx.accountSuffix, undefined, fullAlertText);
        const cleanDesc = extractHdfcNarration(tx.rawEmailBody || tx.rawAlert || tx.description, tx.type === 'credit', tx.description);

        const accountChanged = matched && tx.accountId !== matched.id;
        const descriptionChanged = cleanDesc && cleanDesc !== tx.description && (!tx.description || /inform\s+you|writing\s+to|HDFC Bank Credit Alert|HDFC Bank Debit Alert/i.test(tx.description));

        if (accountChanged || descriptionChanged) {
          txsToUpdate.push({
            ...tx,
            accountId: matched ? matched.id : tx.accountId,
            accountSuffix: tx.accountSuffix || (/1538/.test(fullAlertText) ? '1538' : /6569/.test(fullAlertText) ? '6569' : undefined),
            description: cleanDesc || tx.description,
            updatedAt: Date.now(),
          });
          changedCount++;
        }
      }

      if (txsToUpdate.length === 0) {
        toast.info('All transactions are already properly tagged with clean sender narrations!');
        return;
      }

      const res = await importBatchBankTransactions(txsToUpdate);
      if (res.success) {
        toast.success(`⚡ Successfully updated and cleaned ${changedCount} transactions!`);
        loadAllData();
      } else {
        toast.error('Failed to update transactions.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error auto-assigning bank accounts');
    } finally {
      setIsAutoAssigning(false);
    }
  };

  // ---------------------------------------------------------------------------
  // LINK BANK TRANSACTION DIRECTLY TO A CASH INVOICE
  // ---------------------------------------------------------------------------
  const handleOpenLinkModal = (tx: BankTransaction) => {
    setTargetTransactionForLink(tx);
    setInvoiceSearchQuery('');
    setAutoUpdateInvoicePayment(true);
    setIsLinkModalOpen(true);
  };

  const handleConfirmLinkToInvoice = async (inv: CashInvoiceData) => {
    if (!targetTransactionForLink) return;

    // Look up target bank account details for auto-filling
    const targetBankAcc = accounts.find((a) => a.id === targetTransactionForLink.accountId);
    const utrNo = targetTransactionForLink.referenceNumber || targetTransactionForLink.id;

    // Look for matching DC in DC Tracker (by dcNumber, invNumber, or invoiceRef)
    const cleanDcNo = inv.dcNumber || inv.invNumber.replace(/^DC\s*#?\s*/i, '');
    const matchingDc = savedDcs.find(
      (d) =>
        (cleanDcNo && d.dcNo === cleanDcNo) ||
        (d.invoiceRef && d.invoiceRef === inv.invNumber)
    );

    if (matchingDc) {
      try {
        await transitionSavedDc(matchingDc.id, {
          toStatus: 'completed',
          action: 'MOVE_CASH_TO_COMPLETED',
          updates: {
            paidAt: new Date().toISOString(),
            paymentMethod: 'bank_transfer',
            bankAccountId: targetBankAcc?.id,
            bankName: targetBankAcc?.bankName || targetBankAcc?.accountName || 'Bank Account',
            accountNumber: targetBankAcc?.accountNumber || '',
            utrNo: utrNo,
            cashAmount: targetTransactionForLink.amount || matchingDc.cashAmount,
          },
        });
      } catch (e) {
        console.error('Failed to transition DC to completed on link:', e);
      }
    }

    const res = await linkBankTransactionToCashInvoice(
      targetTransactionForLink.id,
      inv,
      autoUpdateInvoicePayment
    );

    if (res.success) {
      toast.success(
        `⚡ Linked ${inv.invNumber}! Auto-filled UTR (${utrNo}) & Bank Account (${targetBankAcc?.accountName || 'Bank'}). DC moved to Completed.`
      );
      setIsLinkModalOpen(false);
      setTargetTransactionForLink(null);
      loadAllData();
    } else {
      toast.error('Failed to link transaction to invoice');
    }
  };

  const handleConfirmSettleDc = async () => {
    if (!settlingDc) return;
    const paidAmount = parseFloat(paymentAmountInput) || (settlingDc.cashAmount || 0);

    if (paymentMethod === "cash" && !paymentCollectedBy.trim()) {
      toast.error("Please specify who collected the cash payment.");
      return;
    }

    const matchedBankTx = paymentMethod === "bank_transfer" && selectedCreditTxId !== "not_found"
      ? unlinkedCreditTransactions.find((t) => t.id === selectedCreditTxId)
      : null;

    const hasHiked = settlingDc.billedAmount && settlingDc.billedAmount > paidAmount;
    const margin = hasHiked ? Math.round((settlingDc.billedAmount! - paidAmount) * 100) / 100 : settlingDc.hospitalMargin;
    const methodLabel = paymentMethod === "cash" ? "Cash" : "Bank Transfer";
    const collectedInfo = paymentMethod === "cash" && paymentCollectedBy.trim()
      ? ` • Collected by ${paymentCollectedBy.trim()}`
      : matchedBankTx?.referenceNumber
      ? ` • Linked to Ref: ${matchedBankTx.referenceNumber}`
      : "";
    const defaultRemark = hasHiked
      ? `Paid ₹${paidAmount.toLocaleString('en-IN')} via ${methodLabel}${collectedInfo} (Hiked Bill ₹${settlingDc.billedAmount!.toLocaleString('en-IN')}, Hospital Cut ₹${margin!.toLocaleString('en-IN')})`
      : `Paid ₹${paidAmount.toLocaleString('en-IN')} via ${methodLabel}${collectedInfo}`;
    const finalRemarks = paymentRemarksInput.trim()
      ? `${paymentRemarksInput.trim()} (${methodLabel}${collectedInfo})`
      : defaultRemark;

    setIsSettling(true);
    try {
      const bankAccountId = matchedBankTx?.accountId;
      const bankName = matchedBankTx?.description || "Bank Account";
      const utrNo = matchedBankTx?.referenceNumber || matchedBankTx?.id;

      await transitionSavedDc(settlingDc.id, {
        toStatus: 'completed',
        action: 'MOVE_CASH_TO_COMPLETED',
        updates: {
          cashAmount: paidAmount,
          hospitalMargin: margin,
          paidAt: new Date().toISOString(),
          paymentMethod,
          collectedBy: paymentMethod === "cash" ? paymentCollectedBy.trim() : undefined,
          cashRemarks: finalRemarks,
          ...(matchedBankTx ? { bankAccountId, bankName, utrNo } : {})
        },
        meta: {
          paidAt: new Date().toISOString(),
          paidAmount,
          paymentMethod,
          collectedBy: paymentMethod === "cash" ? paymentCollectedBy.trim() : undefined,
          billedAmount: settlingDc.billedAmount,
          hospitalMargin: margin,
          remarks: finalRemarks,
          ...(matchedBankTx ? { bankAccountId, utrNo } : {})
        }
      });

      if (paymentMethod === 'cash') {
        try {
          await recordCashPaymentToCashInHand(
            settlingDc,
            paidAmount,
            paymentCollectedBy.trim() || 'Counter Desk',
            `DC #${settlingDc.dcNo} Cash Memo Settled`
          );
        } catch (e) {
          console.error("Failed to record cash transaction in Cash In Hand account:", e);
        }
      } else if (matchedBankTx) {
        try {
          await saveBankTransactionToFirestore({
            ...matchedBankTx,
            linkedInvoiceNumber: settlingDc.invoiceRef || `DC #${settlingDc.dcNo}`,
            linkedInvoiceId: settlingDc.id,
            linkedCustomerName: settlingDc.hospitalName,
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.error("Failed to link bank transaction:", e);
        }
      }

      toast.success(`DC #${settlingDc.dcNo} Cash Memo settled & moved to Completed!`);
      setSettlingDc(null);
      loadAllData();
    } catch (error) {
      console.error('Failed to settle DC:', error);
      toast.error('Failed to settle DC');
    } finally {
      setIsSettling(false);
    }
  };

  const handleUnlinkTransaction = async (tx: BankTransaction) => {
    if (!confirm(`Unlink Invoice "${tx.linkedInvoiceNumber}" from this bank transaction? This will move the DC back to Cash Queue as unpaid.`)) return;

    await revertDcStatusOnUnlink(tx);

    const success = await unlinkBankTransactionFromCashInvoice(tx.id, true);
    if (success) {
      toast.success(`Transaction unlinked from Invoice ${tx.linkedInvoiceNumber}`);
      loadAllData();
    } else {
      toast.error('Failed to unlink transaction');
    }
  };

  // ---------------------------------------------------------------------------
  // SHEET / CSV PARSER FOR STATEMENT IMPORT
  // ---------------------------------------------------------------------------
  const handleParseSheetOrCsv = (rawText: string) => {
    setPastedSheetText(rawText);
    if (!rawText.trim()) {
      setParsedPreviewRows([]);
      return;
    }

    try {
      const parsed = Papa.parse(rawText.trim(), {
        header: false,
        skipEmptyLines: true,
      });

      const rows = parsed.data as string[][];
      const parsedTransactions: Partial<BankTransaction>[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 2) continue;

        // Skip header lines
        const firstCell = String(row[0] || '').toLowerCase();
        if (firstCell.includes('date') || firstCell.includes('txn') || firstCell.includes('narration')) {
          continue;
        }

        let dateStr = new Date().toISOString().split('T')[0];
        let narration = '';
        let refNo = '';
        let creditAmt = 0;
        let debitAmt = 0;

        // Smart column heuristics
        row.forEach((col, cIdx) => {
          const val = String(col || '').trim();
          const cleanNum = parseFloat(val.replace(/,/g, '').replace(/₹/g, '').replace(/cr/gi, '').replace(/dr/gi, ''));

          // Check if looks like a date (e.g. 29/09/2026 or 2026-09-29 or 29-Sep-2026)
          if (cIdx === 0 || (!narration && (val.includes('/') || val.includes('-')) && !isNaN(Date.parse(val)))) {
            const parsedD = new Date(val);
            if (!isNaN(parsedD.getTime())) {
              dateStr = parsedD.toISOString().split('T')[0];
              return;
            }
          }

          // Check if looks like UTR / Ref
          if (val.length >= 8 && (val.toUpperCase().startsWith('UTR') || val.toUpperCase().startsWith('UPI') || /^\d{10,}$/.test(val))) {
            if (!refNo) refNo = val;
          }

          // Numeric amounts
          if (!isNaN(cleanNum) && cleanNum > 0) {
            if (val.toLowerCase().includes('cr') || cIdx === 4 || (!creditAmt && cIdx >= 2)) {
              creditAmt = cleanNum;
            } else if (val.toLowerCase().includes('dr') || cIdx === 3) {
              debitAmt = cleanNum;
            } else if (!creditAmt) {
              creditAmt = cleanNum;
            }
          } else if (val.length > 3 && !narration) {
            narration = val;
          }
        });

        if (!narration && row.length > 1) {
          narration = row[1] || 'Bank Transaction';
        }

        const isCredit = creditAmt > 0 || debitAmt === 0;
        const amount = isCredit ? (creditAmt || 100) : debitAmt;

        parsedTransactions.push({
          id: `tx_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}`,
          accountId: importAccountId || accounts[0]?.id || '',
          type: isCredit ? 'credit' : 'debit',
          amount: amount,
          date: dateStr,
          time: '12:00',
          category: isCredit ? 'Invoice Collection' : 'Other Debit',
          description: narration,
          referenceNumber: refNo || `REF-${Date.now().toString().slice(-6)}`,
          createdAt: Date.now() - (rows.length - i) * 1000,
          updatedAt: Date.now(),
        });
      }

      setParsedPreviewRows(parsedTransactions);
    } catch (e) {
      console.error('Error parsing sheet text:', e);
      toast.error('Could not parse sheet rows. Please verify format.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleParseSheetOrCsv(text);
      toast.success(`Loaded file: ${file.name}`);
    };
    reader.readAsText(file);
  };

  const handleImportParsedRows = async () => {
    if (parsedPreviewRows.length === 0) {
      toast.error('No rows to import');
      return;
    }

    const targetAcc = accounts.find((a) => a.id === importAccountId) || accounts[0];
    if (!targetAcc) {
      toast.error('Please configure at least one bank account first');
      return;
    }

    const txsToSave: BankTransaction[] = parsedPreviewRows.map((r, i) => ({
      id: r.id || `tx_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
      accountId: targetAcc.id,
      type: r.type || 'credit',
      amount: Number(r.amount) || 0,
      date: r.date || new Date().toISOString().split('T')[0],
      time: r.time || '12:00',
      category: r.category || (r.type === 'credit' ? 'Invoice Collection' : 'Other Debit'),
      description: r.description || 'Imported Transaction',
      referenceNumber: r.referenceNumber || '',
      createdSource: 'manual',
      createdAt: Date.now() + i,
      updatedAt: Date.now() + i,
    }));

    const res = await importBatchBankTransactions(txsToSave);
    if (res.success) {
      toast.success(`Successfully imported ${res.count} bank transactions into ${targetAcc.accountName}!`);
      setPastedSheetText('');
      setParsedPreviewRows([]);
      setActiveTab('ledger');
      loadAllData();
    } else {
      toast.error('Failed to import bank transactions');
    }
  };

  const handleParseHdfcEmails = (text: string) => {
    setPastedEmailText(text);
    if (!text.trim()) {
      setParsedEmailResults([]);
      return;
    }
    const results = parseMultipleHdfcEmailAlerts(text, accounts);
    setParsedEmailResults(results);
  };

  const handleImportParsedEmails = async () => {
    if (parsedEmailResults.length === 0) {
      toast.error('No parsed email transactions to import');
      return;
    }

    const txsToSave: BankTransaction[] = parsedEmailResults.map((r, i) => {
      const acc = r.matchedAccount || accounts.find((a) => a.bankName.toLowerCase().includes('hdfc')) || accounts[0];
      return {
        id: `tx_email_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        accountId: acc.id,
        type: r.type,
        amount: r.amount,
        date: r.date,
        time: r.time,
        category: r.type === 'credit' ? 'Invoice Collection' : 'Other Debit',
        description: r.narration,
        referenceNumber: r.referenceNumber,
        createdSource: 'gmail_connector',
        createdAt: Date.now() + i,
        updatedAt: Date.now() + i,
      };
    });

    const res = await importBatchBankTransactions(txsToSave);
    if (res.success) {
      toast.success(`Successfully imported ${res.count} transactions from HDFC alert emails!`);
      setPastedEmailText('');
      setParsedEmailResults([]);
      setActiveTab('ledger');
      loadAllData();
    } else {
      toast.error('Failed to import email transactions');
    }
  };

  const fetchJsonpOrDirect = async (url: string): Promise<any> => {
    let cleanUrl = url.trim();
    if (cleanUrl.endsWith('/edit')) {
      cleanUrl = cleanUrl.replace(/\/edit.*$/, '/exec');
    }

    try {
      const res = await fetch(cleanUrl, { redirect: 'follow' });
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          if (data && Array.isArray(data.transactions)) return data;
        } catch {
          // JSONP response or redirect
        }
      }
    } catch (e) {
      console.warn('Direct fetch failed, trying JSONP fallback...', e);
    }

    // JSONP Fallback
    return new Promise((resolve, reject) => {
      const callbackName = `jsonp_hdfc_${Date.now()}`;
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Request timed out after 30 seconds. Please ensure the Apps Script Web App is deployed with "Anyone" access.'));
      }, 30000);

      const cleanup = () => {
        clearTimeout(timeout);
        delete (window as any)[callbackName];
        const script = document.getElementById(callbackName);
        if (script) script.remove();
      };

      (window as any)[callbackName] = (data: any) => {
        cleanup();
        resolve(data);
      };

      const separator = cleanUrl.includes('?') ? '&' : '?';
      const script = document.createElement('script');
      script.id = callbackName;
      script.src = `${cleanUrl}${separator}callback=${callbackName}&_t=${Date.now()}`;
      script.onerror = () => {
        cleanup();
        reject(new Error('Failed to load response from Google Apps Script. Check that deployment URL ends with /exec and "Who has access" is set to "Anyone".'));
      };
      document.body.appendChild(script);
    });
  };

  const handleSyncFromAppsScript = async (silent: boolean = false) => {
    if (!appsScriptUrl.trim()) {
      if (!silent) toast.error('Please enter your Google Apps Script Web App URL');
      return;
    }

    if (!silent) setSyncingScript(true);
    try {
      localStorage.setItem('srrortho:apps_script_url', appsScriptUrl.trim());
      const data = await fetchJsonpOrDirect(appsScriptUrl.trim());

      if (data && Array.isArray(data.transactions)) {
        const rawTxs = data.transactions;
        setLastAutoSyncTime(Date.now());
        if (rawTxs.length === 0) {
          if (!silent) toast.info('No transactions found under label:HDFC-Bank');
          return;
        }

        const txsToSave: BankTransaction[] = rawTxs.map((r: any, i: number) => {
          const content = `${r.description || ''} ${r.rawEmailBody || ''} ${r.emailSubject || ''} ${r.referenceNumber || ''}`;
          const matchedAcc = matchAccountForSuffix(r.accountSuffix, gmailSyncTargetAccountId, content);

          return {
            id: r.id || `tx_script_${Date.now()}_${i}`,
            accountId: matchedAcc ? matchedAcc.id : (accounts[0]?.id || ''),
            type: r.type || 'credit',
            amount: Number(r.amount) || 0,
            date: r.date || new Date().toISOString().split('T')[0],
            time: r.time || '12:00',
            category: r.category || (r.type === 'credit' ? 'Invoice Collection' : 'Other Debit'),
            description: r.description || 'HDFC Bank Alert',
            referenceNumber: r.referenceNumber || '',
            accountSuffix: r.accountSuffix || '',
            availableBalance: r.availableBalance !== undefined && r.availableBalance !== null ? Number(r.availableBalance) : undefined,
            emailSubject: r.emailSubject || '',
            rawEmailBody: r.rawEmailBody || '',
            createdSource: 'gmail_connector',
            createdAt: Number(r.createdAt) || Date.now() + i,
            updatedAt: Date.now() + i,
          };
        });

        const res = await importBatchBankTransactions(txsToSave);
        if (res.success) {
          if (!silent) {
            toast.success(`🎉 Successfully synced ${res.count} transactions from your HDFC Gmail!`);
            setActiveTab('ledger');
          }
          loadAllData(false);
        } else if (!silent) {
          toast.error('Failed to save imported transactions to database.');
        }
      } else if (!silent) {
        toast.error('Unexpected response from Google Apps Script. Please verify the Web App deployment.');
      }
    } catch (err: any) {
      if (!silent) {
        console.error('Apps Script Sync Error:', err);
        toast.error(
          'Failed to fetch from Google Apps Script. Check deployment URL and permissions.'
        );
      }
    } finally {
      if (!silent) setSyncingScript(false);
    }
  };

  // Live Background Auto-Sync Interval (Polls immediately on mount + every 30s when enabled)
  useEffect(() => {
    if (!isAutoSyncEnabled || !appsScriptUrl.trim()) return;

    // Immediately fetch new emails on app open / page reload to catch up on missed transactions
    handleSyncFromAppsScript(true);

    const intervalId = setInterval(() => {
      handleSyncFromAppsScript(true);
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, [isAutoSyncEnabled, appsScriptUrl, gmailSyncTargetAccountId, accounts.length]);




  // Inter-Account Transfer Flow
  const handleOpenTransferModal = () => {
    if (accounts.length < 2) {
      toast.error('You need at least 2 bank accounts to perform a fund transfer.');
      return;
    }
    setTransferFromAccountId(accounts[0].id);
    setTransferToAccountId(accounts[1].id);
    setTransferAmount(0);
    setTransferRef(`TRF-${Date.now().toString().slice(-6)}`);
    setTransferNote('');
    setIsTransferModalOpen(true);
  };

  const handleExecuteTransfer = async () => {
    if (!transferFromAccountId || !transferToAccountId) {
      toast.error('Please select both source and target bank accounts');
      return;
    }
    if (transferFromAccountId === transferToAccountId) {
      toast.error('Source and target accounts must be different');
      return;
    }
    if (!transferAmount || transferAmount <= 0) {
      toast.error('Please enter a valid transfer amount');
      return;
    }

    const fromAcc = accounts.find((a) => a.id === transferFromAccountId);
    const toAcc = accounts.find((a) => a.id === transferToAccountId);
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const sharedRef = transferRef || `TRF-${Date.now().toString().slice(-6)}`;

    const debitTx: BankTransaction = {
      id: `tx_${Date.now()}_1`,
      accountId: transferFromAccountId,
      type: 'debit',
      amount: Number(transferAmount),
      date: dateStr,
      time: timeStr,
      category: 'Transfer Out',
      description: transferNote.trim() || `Transfer to ${toAcc?.accountName || 'Bank'}`,
      referenceNumber: sharedRef,
      transferTargetAccountId: transferToAccountId,
      createdSource: 'transfer',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const creditTx: BankTransaction = {
      id: `tx_${Date.now()}_2`,
      accountId: transferToAccountId,
      type: 'credit',
      amount: Number(transferAmount),
      date: dateStr,
      time: timeStr,
      category: 'Transfer In',
      description: transferNote.trim() || `Transfer from ${fromAcc?.accountName || 'Bank'}`,
      referenceNumber: sharedRef,
      transferTargetAccountId: transferFromAccountId,
      createdSource: 'transfer',
      createdAt: Date.now() + 1,
      updatedAt: Date.now() + 1,
    };

    const res1 = await saveBankTransactionToFirestore(debitTx, false);
    const res2 = await saveBankTransactionToFirestore(creditTx, false);

    if (res1.success && res2.success) {
      toast.success(`₹${transferAmount.toLocaleString('en-IN')} transferred between accounts!`);
      setIsTransferModalOpen(false);
      loadAllData();
    } else {
      toast.error('Error recording transfer');
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      toast.error('No transactions to export');
      return;
    }

    const headers = [
      'Date',
      'Time',
      'Account Name',
      'Bank',
      'Type',
      'Amount (INR)',
      'Category',
      'Narration / Description',
      'Reference / UTR Number',
      'Linked Cash Invoice',
      'Linked Customer / Hospital',
    ];

    const rows = filteredTransactions.map((tx) => {
      const acc = accounts.find((a) => a.id === tx.accountId);
      return [
        `"${tx.date}"`,
        `"${tx.time || ''}"`,
        `"${acc?.accountName || ''}"`,
        `"${acc?.bankName || ''}"`,
        `"${tx.type.toUpperCase()}"`,
        tx.amount,
        `"${tx.category}"`,
        `"${(tx.description || '').replace(/"/g, '""')}"`,
        `"${tx.referenceNumber || ''}"`,
        `"${tx.linkedInvoiceNumber || ''}"`,
        `"${(tx.linkedCustomerName || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `SRR_Bank_Transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Statement exported to CSV!');
  };

  return (
    <div className="w-full flex-1 flex flex-col space-y-4 font-sans text-foreground">
      {/* Top Header matching Cash Invoice Suite */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-700 flex items-center justify-center text-teal-800 dark:text-teal-200 shadow-sm shrink-0">
            <Landmark className="w-5 h-5 text-teal-700 dark:text-teal-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold font-sans text-foreground tracking-tight">
                Bank Accounts &amp; Treasury
              </h1>
              <Badge variant="outline" className="bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300 border-teal-300 text-[11px] font-bold rounded-full">
                Statement Matcher
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live bank transactions ledger and Cash Invoice matching.
            </p>
          </div>
        </div>

        {/* Tab Switcher - Auto-sized Flex Layout to Prevent Text & White Card Overlap */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full sm:w-auto">
            <TabsList className="flex items-center w-full sm:w-auto min-w-max h-10 rounded-lg p-1 bg-muted/60 border border-border gap-1">
              <TabsTrigger 
                value="ledger" 
                className="text-xs font-semibold gap-1.5 px-3 h-8 rounded-md transition-all whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5" /> Ledger ({transactions.length})
              </TabsTrigger>
              <TabsTrigger 
                value="unlinked" 
                className="text-xs font-semibold gap-1.5 px-3 h-8 rounded-md transition-all whitespace-nowrap"
              >
                <Link2 className="w-3.5 h-3.5" /> Unlinked Cash Transactions ({overallSummary.unlinkedCreditCount})
              </TabsTrigger>
              <TabsTrigger 
                value="linked" 
                className="text-xs font-semibold gap-1.5 px-3 h-8 rounded-md transition-all whitespace-nowrap"
              >
                <Receipt className="w-3.5 h-3.5" /> Linked ({linkedCreditTransactions.length})
              </TabsTrigger>
              <TabsTrigger 
                value="accounts" 
                className="text-xs font-semibold gap-1.5 px-3 h-8 rounded-md transition-all whitespace-nowrap"
              >
                <Building2 className="w-3.5 h-3.5" /> Accounts ({accounts.length})
              </TabsTrigger>
              <TabsTrigger 
                value="expense_tag" 
                className="text-xs font-semibold gap-1.5 px-3 h-8 rounded-md transition-all whitespace-nowrap"
              >
                <Tag className="w-3.5 h-3.5" /> Auto Expense Tag
              </TabsTrigger>
              <TabsTrigger 
                value="daily_expense" 
                className="text-xs font-semibold gap-1.5 px-3 h-8 rounded-md transition-all whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5" /> Daily Expense Analytics
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MAIN TRANSACTIONS LEDGER                                           */}
      {/* ========================================================================= */}
      {activeTab === "ledger" && (
        <div className="space-y-3">
          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
            {/* Search Input */}
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search narration, UTR #, invoice, customer..."
                className="pl-9 text-xs h-9 rounded-md"
              />
            </div>

            {/* Account Selector, Add Account & Actions */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="h-8 text-xs font-semibold w-auto min-w-[170px] rounded-md">
                  <SelectValue placeholder="All Bank Accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Bank Accounts</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                size="sm"
                onClick={handleOpenAddAccount}
                className="h-8 px-3 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-md shadow-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Account
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => loadAllData(true)}
                className="h-8 px-3 text-xs text-muted-foreground rounded-md gap-1"
                title="Refresh Ledger"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-600' : ''}`} /> Refresh
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleExportCSV}
                className="h-8 px-3 text-xs text-muted-foreground rounded-md gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Button>
            </div>
          </div>

          {/* Filter Pills Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground font-semibold mr-1">Filter:</span>
              <Button
                size="sm"
                variant={typeFilter === "all" ? "default" : "outline"}
                onClick={() => setTypeFilter("all")}
                className={`h-7 px-2.5 text-xs font-semibold rounded-md ${typeFilter === "all" ? "bg-teal-700 text-white hover:bg-teal-800" : ""}`}
              >
                All ({transactions.length})
              </Button>
              <Button
                size="sm"
                variant={typeFilter === "unlinked" ? "default" : "outline"}
                onClick={() => setTypeFilter("unlinked")}
                className={`h-7 px-2.5 text-xs font-semibold rounded-md ${typeFilter === "unlinked" ? "bg-amber-600 text-white hover:bg-amber-700" : "text-amber-800 hover:bg-amber-50"}`}
              >
                <Link2 className="w-3 h-3 mr-1" /> Unlinked ({overallSummary.unlinkedCreditCount})
              </Button>
              <Button
                size="sm"
                variant={typeFilter === "linked" ? "default" : "outline"}
                onClick={() => setTypeFilter("linked")}
                className={`h-7 px-2.5 text-xs font-semibold rounded-md ${typeFilter === "linked" ? "bg-teal-700 text-white hover:bg-teal-800" : "text-teal-800 hover:bg-teal-50"}`}
              >
                <Receipt className="w-3 h-3 mr-1" /> Linked
              </Button>
              <Button
                size="sm"
                variant={typeFilter === "credit" ? "default" : "outline"}
                onClick={() => setTypeFilter("credit")}
                className={`h-7 px-2.5 text-xs font-semibold rounded-md ${typeFilter === "credit" ? "bg-emerald-700 text-white hover:bg-emerald-800" : "text-emerald-700 hover:bg-emerald-50"}`}
              >
                <ArrowDownLeft className="w-3 h-3 mr-1" /> Credits
              </Button>
              <Button
                size="sm"
                variant={typeFilter === "debit" ? "default" : "outline"}
                onClick={() => setTypeFilter("debit")}
                className={`h-7 px-2.5 text-xs font-semibold rounded-md ${typeFilter === "debit" ? "bg-rose-700 text-white hover:bg-rose-800" : "text-rose-700 hover:bg-rose-50"}`}
              >
                <ArrowUpRight className="w-3 h-3 mr-1" /> Debits
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Select value={dateRangeFilter} onValueChange={(val: any) => setDateRangeFilter(val)}>
                <SelectTrigger className="h-7 text-xs w-auto min-w-[110px] rounded-md">
                  <Calendar className="w-3 h-3 mr-1 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Past 7 Days</SelectItem>
                  <SelectItem value="month">Past 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Main Ledger Table */}
          <Card className="border-border shadow-sm overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Account</th>
                    <th className="p-3 text-center">Type</th>
                    <th className="p-3 text-left">Bank Narration / UTR</th>
                    <th className="p-3 text-left">Linked Cash Invoice</th>
                    <th className="p-3 text-right">Amount (₹)</th>
                    <th className="p-3 text-right">Account Balance</th>
                    <th className="p-3 text-right">Invoice Link &amp; Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        No bank transactions found matching filter.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const acc = accounts.find((a) => a.id === tx.accountId);
                      const isCredit = tx.type === 'credit';
                      const isLinked = Boolean(tx.linkedInvoiceNumber || tx.linkedInvoiceId);
                      const runningBal = transactionRunningBalances.get(tx.id);

                      return (
                        <tr key={tx.id} className="hover:bg-muted/20">
                          {/* Date */}
                          <td className="p-3 whitespace-nowrap">
                            <div className="font-bold text-foreground">
                              {new Date(tx.date).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </div>
                            {tx.time && (
                              <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3" /> {tx.time}
                              </div>
                            )}
                          </td>

                          {/* Account Selector Dropdown */}
                          <td className="p-3 whitespace-nowrap">
                            <div className="flex flex-col gap-1 min-w-[145px]">
                              <Select
                                value={tx.accountId || (accounts[0]?.id || '')}
                                onValueChange={(newAccId) => handleChangeTxAccount(tx, newAccId)}
                              >
                                <SelectTrigger className="h-7 text-[11px] font-semibold bg-teal-50/70 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 border-teal-300 dark:border-teal-800 rounded-md px-2 py-0.5">
                                  <SelectValue placeholder="Select Account">
                                    {acc ? (
                                      <span className="truncate max-w-[120px] inline-block font-semibold">
                                        {acc.accountName}
                                      </span>
                                    ) : (
                                      <span className="text-amber-700 font-medium italic">⚠️ Select Account</span>
                                    )}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {accounts.map((a) => (
                                    <SelectItem key={a.id} value={a.id} className="text-xs">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-semibold">{a.accountName}</span>
                                        {a.accountNumber && (
                                          <span className="text-[10px] text-muted-foreground font-mono">
                                            (..{a.accountNumber.replace(/[^0-9]/g, '').slice(-4)})
                                          </span>
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {tx.accountSuffix && (
                                <span className="text-[10px] font-mono text-muted-foreground pl-0.5">
                                  Alert A/c: **{tx.accountSuffix}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Type */}
                          <td className="p-3 text-center whitespace-nowrap">
                            <Badge
                              className={`text-[10px] font-bold rounded-md ${
                                isCredit
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300'
                              }`}
                            >
                              {isCredit ? '+ Credit' : '- Debit'}
                            </Badge>
                          </td>

                          {/* Narration & Reference # */}
                          <td className="p-3 max-w-xs sm:max-w-md">
                            <div className="font-medium text-foreground leading-snug">
                              {tx.description && !/inform\s+you|writing\s+to/i.test(tx.description) && !tx.description.startsWith('Deposit: inform')
                                ? tx.description
                                : extractHdfcNarration(tx.rawEmailBody || tx.rawAlert || tx.description, tx.type === 'credit', tx.description)}
                            </div>
                            {tx.referenceNumber && (
                              <div className="mt-0.5 text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                                <span>Ref:</span>
                                <span className="font-semibold text-foreground bg-muted/60 px-1 rounded">{tx.referenceNumber}</span>
                              </div>
                            )}
                          </td>

                          {/* Linked Invoice Info */}
                          <td className="p-3 whitespace-nowrap">
                            {isLinked ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => {
                                    const matchingInv = cashInvoices.find(
                                      (inv) =>
                                        inv.invNumber === tx.linkedInvoiceNumber ||
                                        inv.invNumber?.replace(/\//g, '_') === tx.linkedInvoiceId
                                    );
                                    if (matchingInv) {
                                      setPreviewInvoice(matchingInv);
                                    } else {
                                      toast.info(`Linked Invoice: ${tx.linkedInvoiceNumber}`);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-50 text-teal-900 border border-teal-300 hover:bg-teal-100 shadow-2xs"
                                >
                                  <Receipt className="w-3 h-3 text-teal-700" />
                                  <span>{tx.linkedInvoiceNumber}</span>
                                  <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                                </button>
                                {tx.linkedCustomerName && (
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[130px]">
                                    &bull; {tx.linkedCustomerName}
                                  </span>
                                )}
                              </div>
                            ) : isCredit ? (
                              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-300 rounded-md">
                                Unlinked Credit
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-[10px]">Expense / Payout</span>
                            )}
                          </td>

                          {/* Amount */}
                          <td className="p-3 text-right whitespace-nowrap">
                            <div
                              className={`font-mono font-bold text-sm ${
                                isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {isCredit ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                            </div>
                          </td>

                          {/* Account Balance (Stated Alert Bal vs Running Ledger Bal) */}
                          <td className="p-3 text-right whitespace-nowrap">
                            {tx.availableBalance !== undefined ? (
                              <div>
                                <div className="font-mono font-bold text-xs text-teal-700 dark:text-teal-300">
                                  ₹{tx.availableBalance.toLocaleString('en-IN')}
                                </div>
                                <div className="text-[9px] text-teal-600 dark:text-teal-400 font-semibold inline-flex items-center gap-0.5">
                                  ⚡ Alert Stated
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="font-mono text-xs text-foreground font-medium">
                                  ₹{(runningBal !== undefined ? runningBal : 0).toLocaleString('en-IN')}
                                </div>
                                <div className="text-[9px] text-muted-foreground">
                                  Ledger Running
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Direct Link & Actions */}
                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {isCredit && !isLinked && (
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenLinkModal(tx)}
                                  className="h-7 px-2.5 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-md shadow-xs"
                                >
                                  <Link2 className="w-3.5 h-3.5 mr-1" /> Link Invoice
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setViewingTxDetails(tx)}
                                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-teal-700 hover:bg-teal-50/50 rounded-md"
                                title="View Email & Verification Details"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1 text-teal-600" />
                                <span>View Email</span>
                              </Button>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground">
                                    <MoreVertical className="w-3.5 h-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setViewingTxDetails(tx)}>
                                    <Eye className="w-3.5 h-3.5 mr-2 text-teal-600" /> View Full Email &amp; Details
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />

                                  {isCredit && (
                                    <DropdownMenuItem onClick={() => handleOpenLinkModal(tx)}>
                                      <Link2 className="w-3.5 h-3.5 mr-2 text-teal-700" />
                                      {isLinked ? 'Change Linked Invoice' : 'Link Cash Invoice'}
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => handleOpenEditTx(tx)}>
                                    <Edit className="w-3.5 h-3.5 mr-2" /> Edit Transaction
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDeleteTransaction(tx)} className="text-rose-600">
                                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Transaction
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
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
      )}

      {/* ========================================================================= */}
      {/* TAB 2: UNLINKED CASH QUEUE TRANSACTIONS                                   */}
      {/* ========================================================================= */}
      {activeTab === "unlinked" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-amber-500/10 p-3.5 rounded-xl border border-amber-500/30">
            <div>
              <h2 className="font-sans font-bold text-sm text-amber-950 dark:text-amber-200 flex items-center gap-2">
                <Receipt className="w-4.5 h-4.5 text-amber-600" />
                <span>Unlinked Cash Queue Transactions ({cashQueueDcs.length})</span>
              </h2>
              <p className="text-xs text-amber-900/80 dark:text-amber-300/80">
                Active delivery memos from DC Tracker Cash Queue awaiting bank deposit matching or cash settlement.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {(() => {
                const autoMatchCount = cashQueueDcs.filter((dc) => findSuggestedBankTransactionForDc(dc) !== null).length;
                if (autoMatchCount === 0) return null;
                return (
                  <Button
                    size="sm"
                    onClick={handleAutoMatchAllCashQueue}
                    className="h-8 px-3 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5 animate-pulse" />
                    Auto-Match All ({autoMatchCount} Pairs Found)
                  </Button>
                );
              })()}
              <div className="text-right">
                <div className="text-xs font-semibold text-amber-900/70 dark:text-amber-300/70">Total Cash Pending</div>
                <div className="text-base sm:text-lg font-black font-mono text-amber-700 dark:text-amber-400">
                  ₹{cashQueueTotalAmount.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>

          {/* Primary Table: DC Tracker Cash Queue Transactions */}
          <Card className="border-border shadow-sm overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">DC #</th>
                    <th className="p-3 text-left">Hospital / Doctor / Bank Match</th>
                    <th className="p-3 text-left">Items Breakdown</th>
                    <th className="p-3 text-right">Cash Amount</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cashQueueDcs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        <span className="font-bold text-foreground">No pending items in Cash Queue!</span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          All Cash Queue delivery challans have been settled and completed.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    cashQueueDcs.map((dc) => {
                      const matchedTxInfo = findSuggestedBankTransactionForDc(dc);
                      const acc = matchedTxInfo ? accounts.find((a) => a.id === matchedTxInfo.transaction.accountId) : null;

                      return (
                        <tr key={dc.id} className="hover:bg-muted/20">
                          <td className="p-3 whitespace-nowrap font-medium">
                            {new Date(dc.savedAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            <Badge variant="outline" className="text-[11px] font-mono bg-blue-50 text-blue-900 border-blue-300 font-bold rounded-md">
                              DC #{dc.dcNo}
                            </Badge>
                          </td>

                          <td className="p-3 max-w-md">
                            <div className="font-bold text-foreground">{dc.hospitalName}</div>
                            {dc.doctorName && (
                              <div className="text-[11px] text-muted-foreground">Dr. {dc.doctorName}</div>
                            )}
                            {dc.remarks && (
                              <div className="text-[10px] text-muted-foreground/80 truncate italic">{dc.remarks}</div>
                            )}

                            {matchedTxInfo && (
                              <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-900 dark:text-emerald-200 font-bold">
                                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>
                                      Bank Deposit Match: +₹{matchedTxInfo.transaction.amount.toLocaleString('en-IN')}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-emerald-800/80 dark:text-emerald-300/80 font-medium">
                                    Account: {acc?.accountName || 'Bank Account'} • ({matchedTxInfo.reason})
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleMatchAndLinkDcToTransaction(dc, matchedTxInfo.transaction)}
                                  className="h-6 px-2.5 text-[11px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded shrink-0 shadow-xs cursor-pointer"
                                >
                                  ⚡ 1-Click Match &amp; Link
                                </Button>
                              </div>
                            )}
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {dc.items?.length || 0} items
                            </span>
                          </td>

                          <td className="p-3 text-right whitespace-nowrap font-mono font-bold text-sm text-amber-700 dark:text-amber-400">
                            ₹{(dc.cashAmount || 0).toLocaleString('en-IN')}
                          </td>

                          <td className="p-3 text-center whitespace-nowrap">
                            <Badge className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                              Cash Queue
                            </Badge>
                          </td>

                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setViewingDcDetails(dc)}
                                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-teal-700 rounded-md"
                                title="View DC Details"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1 text-teal-600" />
                                <span>View</span>
                              </Button>

                              <Button
                                size="sm"
                                onClick={() => handleOpenSettleDcModal(dc)}
                                className="h-7 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-xs"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Record Payment
                              </Button>
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
      )}

      {/* ========================================================================= */}
      {/* TAB: LINKED / RECONCILED TRANSACTIONS                                     */}
      {/* ========================================================================= */}
      {activeTab === "linked" && (
        <div className="space-y-3.5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card p-3.5 rounded-xl border border-border shadow-sm">
            <div>
              <h3 className="font-sans font-bold text-sm text-foreground flex items-center gap-2">
                <Receipt className="w-4 h-4 text-teal-700" />
                <span>Reconciled &amp; Linked Transactions ({linkedCreditTransactions.length})</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bank deposits linked directly to Cash Memos or Delivery Challans. Unlinking a transaction will move the DC back to Cash Queue as unpaid.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 block">Total Linked Value</span>
                <span className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-400">
                  ₹{linkedCreditTransactions.reduce((acc, t) => acc + (t.amount || 0), 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          <Card className="border-border shadow-sm rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground font-bold border-b border-border">
                  <tr>
                    <th className="p-3">Date &amp; Time</th>
                    <th className="p-3">Bank Account</th>
                    <th className="p-3">Linked Invoice / DC Ref</th>
                    <th className="p-3">Customer / Hospital</th>
                    <th className="p-3">Reference / UTR #</th>
                    <th className="p-3 text-right">Amount (+₹)</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {linkedCreditTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No linked bank transactions found yet. Use the "Unlinked" tab to match deposits with Cash Memos.
                      </td>
                    </tr>
                  ) : (
                    linkedCreditTransactions.map((tx) => {
                      const acc = accounts.find((a) => a.id === tx.accountId);
                      const invRef = tx.linkedInvoiceNumber || tx.linkedInvoiceId || 'Linked Invoice';

                      return (
                        <tr key={tx.id} className="hover:bg-muted/30">
                          <td className="p-3 whitespace-nowrap">
                            <div className="font-medium text-foreground">{tx.date}</div>
                            {tx.time && <div className="text-[10px] text-muted-foreground">{tx.time}</div>}
                          </td>

                          <td className="p-3 whitespace-nowrap font-medium">
                            <div className="flex items-center gap-1.5 text-foreground">
                              <Landmark className="w-3.5 h-3.5 text-teal-600" />
                              <span>{acc?.accountName || 'Bank Account'}</span>
                            </div>
                            {acc?.accountNumber && (
                              <div className="text-[10px] font-mono text-muted-foreground">
                                {acc.accountNumber}
                              </div>
                            )}
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            <Badge className="bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200 border-teal-300 font-mono font-bold text-[11px]">
                              {invRef}
                            </Badge>
                          </td>

                          <td className="p-3 font-medium">
                            <div className="text-foreground">{tx.linkedCustomerName || tx.linkedHospital || 'N/A'}</div>
                          </td>

                          <td className="p-3 whitespace-nowrap font-mono">
                            {tx.referenceNumber ? (
                              <div className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded border border-border">
                                <span>{tx.referenceNumber}</span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(tx.referenceNumber || '');
                                    toast.success('Copied UTR to clipboard!');
                                  }}
                                  className="text-muted-foreground hover:text-foreground cursor-pointer text-xs"
                                  title="Copy UTR"
                                >
                                  📋
                                </button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </td>

                          <td className="p-3 text-right whitespace-nowrap font-mono font-bold text-sm text-emerald-600">
                            +₹{(tx.amount || 0).toLocaleString('en-IN')}
                          </td>

                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setViewingTxDetails(tx)}
                                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-teal-700 rounded-md"
                                title="View Email Details"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1 text-teal-600" /> View
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenLinkModal(tx)}
                                className="h-7 px-2.5 text-xs text-teal-800 bg-teal-50 hover:bg-teal-100 border-teal-300 rounded-md font-semibold"
                                title="Change linked invoice"
                              >
                                <Link2 className="w-3.5 h-3.5 mr-1 text-teal-700" /> Change
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUnlinkTransaction(tx)}
                                className="h-7 px-2 text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200 rounded-md font-semibold"
                                title="Unlink transaction and move matching DC back to Cash Queue"
                              >
                                <Unlink className="w-3.5 h-3.5 mr-1 text-rose-600" /> Unlink
                              </Button>
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
      )}

      {/* ========================================================================= */}
      {/* TAB 3: IMPORT SHEET / STATEMENT / GMAIL CONNECTOR                         */}
      {/* ========================================================================= */}
      {activeTab === "import" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left 2 Cols: Paste / Upload Form */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="border-border shadow-sm rounded-xl">
                <CardHeader className="p-4 pb-3 bg-muted/30 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-teal-700" />
                      <CardTitle className="text-sm font-bold">Paste Google Sheets / Excel Rows</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".csv, .txt, .tsv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-7 text-xs"
                      >
                        <Upload className="w-3.5 h-3.5 mr-1" /> Upload CSV
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground mb-1 block">
                        Target Bank Account *
                      </Label>
                      <Select value={importAccountId} onValueChange={setImportAccountId}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Choose Account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.accountName} ({acc.bankName})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground mb-1 block">
                        Expected Columns (Auto-detected)
                      </Label>
                      <div className="text-[11px] text-muted-foreground pt-1.5">
                        <code>Date | Narration | Ref # | Deposit / Credit Amount</code>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      Paste Tabular Rows from Sheet:
                    </Label>
                    <Textarea
                      rows={5}
                      value={pastedSheetText}
                      onChange={(e) => handleParseSheetOrCsv(e.target.value)}
                      placeholder="e.g.&#10;29/09/2026	UPI/526718291024/Sri Ram Hospital	UTR92837418	52500&#10;29/09/2026	IMPS/Mithra Kiran Hospital	REF2617	9100&#10;23/09/2026	NEFT/Lalitha Hospital	UTR7058	20500"
                      className="text-xs font-mono"
                    />
                  </div>

                  {parsedPreviewRows.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-teal-700 dark:text-teal-400">
                          Parsed Preview ({parsedPreviewRows.length} Rows Ready):
                        </span>
                        <Button
                          size="sm"
                          onClick={handleImportParsedRows}
                          className="h-8 px-4 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-md shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" /> Confirm &amp; Add to Ledger
                        </Button>
                      </div>

                      <div className="max-h-56 overflow-y-auto border border-border rounded-lg">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/60 text-muted-foreground font-semibold">
                            <tr>
                              <th className="p-2 text-left">Date</th>
                              <th className="p-2 text-left">Narration</th>
                              <th className="p-2 text-left">Ref #</th>
                              <th className="p-2 text-center">Type</th>
                              <th className="p-2 text-right">Amount (₹)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {parsedPreviewRows.map((r, idx) => (
                              <tr key={idx}>
                                <td className="p-2 whitespace-nowrap">{r.date}</td>
                                <td className="p-2 max-w-[200px] truncate">{r.description}</td>
                                <td className="p-2 font-mono text-[11px]">{r.referenceNumber || '-'}</td>
                                <td className="p-2 text-center">
                                  <Badge className={r.type === 'credit' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}>
                                    {r.type}
                                  </Badge>
                                </td>
                                <td className="p-2 text-right font-mono font-bold">
                                  ₹{(r.amount || 0).toLocaleString('en-IN')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Live Multi-Account HDFC Email Alert Parser & Connector */}
            <div className="space-y-4">
              {/* Card 1: 1-Click Google Apps Script Webhook / URL Sync */}
              <Card className="border-teal-300 dark:border-teal-800 shadow-sm rounded-xl bg-teal-50/30 dark:bg-teal-950/20">
                <CardHeader className="p-4 pb-3 bg-teal-100/50 dark:bg-teal-900/30 border-b border-teal-200 dark:border-teal-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                      <CardTitle className="text-sm font-bold text-teal-900 dark:text-teal-200">
                        1-Click Live Gmail Sync (Google Script)
                      </CardTitle>
                    </div>
                    <Badge className="bg-teal-700 text-white text-[10px] font-bold">
                      Direct Connector
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-teal-800/80 dark:text-teal-300/80">
                    Paste your Google Apps Script Web App URL once to automatically pull and route all transactions into your bank ledger.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
                    <div>
                      <Label className="text-xs font-semibold text-foreground mb-1 block">
                        Target Bank Account for Sync:
                      </Label>
                      <Select
                        value={gmailSyncTargetAccountId}
                        onValueChange={setGmailSyncTargetAccountId}
                      >
                        <SelectTrigger className="h-9 text-xs bg-background border-teal-300 dark:border-teal-800">
                          <SelectValue placeholder="Select Target Account" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto" className="text-xs font-semibold text-teal-700">
                            ⚡ Auto-Detect by A/c Suffix (1538 → Savings, 6569 → Main)
                          </SelectItem>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id} className="text-xs">
                              {a.accountName} {a.accountNumber ? `(..${a.accountNumber.replace(/[^0-9]/g, '').slice(-4)})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isAutoAssigning || transactions.length === 0}
                        onClick={handleAutoAssignTransactionsToAccounts}
                        className="h-9 text-xs font-semibold text-teal-800 bg-teal-50 border-teal-300 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-200 shadow-2xs"
                        title="Re-attach all currently loaded transactions to your bank accounts"
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
                        {isAutoAssigning ? 'Attaching...' : 'Auto-Attach Existing Transactions'}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-foreground mb-1 block">
                      Google Apps Script Web App URL:
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="url"
                        value={appsScriptUrl}
                        onChange={(e) => setAppsScriptUrl(e.target.value)}
                        placeholder="https://script.google.com/macros/s/.../exec"
                        className="h-9 text-xs font-mono bg-background"
                      />
                      <Button
                        size="sm"
                        disabled={syncingScript || !appsScriptUrl.trim()}
                        onClick={() => handleSyncFromAppsScript(false)}
                        className="h-9 px-4 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white shrink-0 shadow-xs"
                      >
                        {syncingScript ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            Syncing Newest 200...
                          </>
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5 mr-1.5" />
                            Fetch &amp; Sync Now (Newest 200)
                          </>
                        )}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isClearingAll || transactions.length === 0}
                        onClick={handleClearAllTransactions}
                        className="h-9 px-3 text-xs font-semibold text-rose-700 bg-rose-50/70 border-rose-200 hover:bg-rose-100 hover:text-rose-800 shrink-0 shadow-2xs"
                        title="Delete all current transactions to do a fresh sync"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-600" />
                        {isClearingAll ? 'Clearing...' : 'Delete All Entries'}
                      </Button>
                    </div>

                    {/* Instant Auto-Trigger Switch */}
                    <div className="mt-3 p-2.5 bg-background rounded-lg border border-teal-200 dark:border-teal-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${isAutoSyncEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
                        <div>
                          <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <span>⚡ Live Auto-Trigger (Every 30s)</span>
                            {isAutoSyncEnabled && (
                              <Badge className="bg-emerald-600 text-white text-[9px] px-1.5 py-0 h-4">
                                Active &amp; Watching
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {isAutoSyncEnabled
                              ? `Silently polling incoming emails. Last synced: ${lastAutoSyncTime ? new Date(lastAutoSyncTime).toLocaleTimeString() : 'Just now'}`
                              : 'Automatically pulls newly arrived HDFC emails every 30 seconds while this tab is open.'}
                          </p>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant={isAutoSyncEnabled ? 'default' : 'outline'}
                        onClick={() => {
                          const nextState = !isAutoSyncEnabled;
                          setIsAutoSyncEnabled(nextState);
                          localStorage.setItem('srrortho:auto_sync_live', String(nextState));
                          if (nextState) {
                            toast.success('⚡ Live Auto-Trigger enabled! Watching for new emails every 30s.');
                            handleSyncFromAppsScript(true);
                          } else {
                            toast.info('Live Auto-Trigger paused.');
                          }
                        }}
                        className={`h-7 px-3 text-xs font-bold rounded-md ${
                          isAutoSyncEnabled
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                            : 'border-teal-300 text-teal-700 hover:bg-teal-50'
                        }`}
                      >
                        {isAutoSyncEnabled ? '✓ Auto-Sync ON' : 'Turn ON Auto-Sync'}
                      </Button>
                    </div>

                    <p className="text-[11px] text-muted-foreground mt-2">
                      Fetches the <strong>newest 200 transactions</strong> from <code>label:HDFC-Bank</code> and extracts transactions, UTRs, real senders, and balances.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Manual Email Text / Alert Paste Parser */}
              <Card className="border-border shadow-sm rounded-xl bg-card">
                <CardHeader className="p-4 pb-3 bg-muted/30 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-teal-700" />
                      <CardTitle className="text-sm font-bold">Paste Raw Alert Text or JSON</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-teal-50 text-teal-700 border-teal-200">
                      Multi-HDFC Support
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Paste email alert text or JSON from execution logs. Automatically routes to the matching HDFC account.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-xs">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      Paste Raw Alert Text or Execution Log JSON:
                    </Label>
                    <Textarea
                      rows={4}
                      value={pastedEmailText}
                      onChange={(e) => handleParseHdfcEmails(e.target.value)}
                      placeholder="e.g.&#10;HDFC Bank: Rs 52,500.00 credited to a/c **5678 on 29-SEP-26 by UPI-SRI RAM HOSP-UTR92837418&#10;&#10;Or paste JSON: [{ &quot;amount&quot;: 52500, &quot;accountSuffix&quot;: &quot;5678&quot; ... }]"
                      className="text-xs font-mono"
                    />
                  </div>

                  {parsedEmailResults.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-teal-700 dark:text-teal-400">
                          {parsedEmailResults.length} Alert{parsedEmailResults.length > 1 ? 's' : ''} Detected:
                        </span>
                        <Button
                          size="sm"
                          onClick={handleImportParsedEmails}
                          className="h-7 px-3 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-md shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" /> Import {parsedEmailResults.length} to Ledger
                        </Button>
                      </div>

                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {parsedEmailResults.map((res, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg border border-border bg-muted/30 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm text-foreground">
                                ₹{res.amount.toLocaleString('en-IN')}
                              </span>
                              <Badge className={res.type === 'credit' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}>
                                {res.type.toUpperCase()}
                              </Badge>
                            </div>

                            <div className="text-[11px] flex items-center justify-between text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Landmark className="w-3 h-3 text-teal-700" />
                                <strong className="text-foreground">
                                  {res.matchedAccount
                                    ? res.matchedAccount.accountName
                                    : res.accountSuffix
                                    ? `HDFC Account (ending **${res.accountSuffix})`
                                    : 'Default HDFC Account'}
                                </strong>
                              </span>
                              <span>{res.date}</span>
                            </div>

                            <div className="text-[11px] text-muted-foreground truncate">
                              {res.narration}
                            </div>
                            <div className="text-[10px] font-mono text-muted-foreground">
                              Ref: {res.referenceNumber}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 text-[11px] text-muted-foreground space-y-1 border-t border-border">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>How Multi-Account HDFC Matching Works:</span>
                    </div>
                    <p className="leading-relaxed pl-5 text-[11px]">
                      HDFC email alerts include your masked account number (e.g. <code>**5678</code> or <code>ending in 1234</code>). The parser checks the last 4 digits against all your configured HDFC bank accounts in the <strong>Accounts</strong> tab to route transactions to the exact account automatically.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: BANK ACCOUNTS CONFIGURATION                                        */}
      {/* ========================================================================= */}
      {activeTab === "accounts" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
            <div>
              <h2 className="font-sans font-bold text-sm text-foreground">
                Configured Bank Accounts &amp; Cash Counters ({accounts.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Manage bank accounts used for collections, transfers, and expense withdrawals.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Option buttons commented out as requested
              <Button
                size="sm"
                variant="outline"
                disabled={isClearingAll || (accounts.length === 0 && transactions.length === 0)}
                onClick={handleWipeAllBankDataAndAccounts}
                className="h-8 px-3 text-xs font-semibold text-rose-700 bg-rose-50/70 border-rose-200 hover:bg-rose-100 rounded-md"
                title="Completely delete all accounts and transactions (Clean slate)"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-600" />
                {isClearingAll ? 'Wiping...' : 'Wipe All Bank Data & Accounts'}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const mainAcc: BankAccount = {
                    id: 'acc_hdfc_main_6569',
                    accountName: 'SRR Ortho Main (6569)',
                    bankName: 'HDFC Bank',
                    accountNumber: '50200000006569',
                    ifscCode: 'HDFC0001234',
                    branch: 'Kalyan Nagar, Hyderabad',
                    accountType: 'current',
                    upiId: 'srrmain@hdfcbank',
                    openingBalance: 0,
                    colorTheme: 'teal',
                    isDefault: true,
                    notes: 'Primary Business Current Account for Hospital Collections & Supplier NEFTs',
                    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
                    updatedAt: Date.now(),
                  };
                  const savingsAcc: BankAccount = {
                    id: 'acc_hdfc_savings_1538',
                    accountName: 'SRR Savings / UPI (1538)',
                    bankName: 'HDFC Bank',
                    accountNumber: '50100000001538',
                    ifscCode: 'HDFC0001234',
                    branch: 'Kalyan Nagar, Hyderabad',
                    accountType: 'savings',
                    upiId: '9396857455@hdfcbank',
                    openingBalance: 0,
                    colorTheme: 'blue',
                    isDefault: false,
                    notes: 'Savings & UPI Operations Account',
                    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
                    updatedAt: Date.now(),
                  };
                  await saveBankAccountToFirestore(mainAcc);
                  await saveBankAccountToFirestore(savingsAcc);
                  toast.success('⚡ Restored HDFC Main (6569) & Savings (1538) accounts!');
                  loadAllData(true);
                }}
                className="h-8 px-2.5 text-xs font-semibold text-teal-700 bg-teal-50 border-teal-300 hover:bg-teal-100 rounded-md"
                title="Create or restore standard HDFC 6569 (Current) and 1538 (Savings) accounts"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1 text-teal-600" /> + Add 6569 &amp; 1538 Accounts
              </Button>
              */}

              <Button
                size="sm"
                onClick={handleOpenAddAccount}
                className="h-8 px-3 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-md shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Bank Account
              </Button>
            </div>
          </div>

          {accounts.length === 0 ? (
            <Card className="border-dashed border-2 border-border p-8 text-center rounded-2xl bg-card">
              <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center mx-auto mb-3">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-foreground font-sans">Treasury Is Completely Blank</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                No bank accounts exist in your database. Click below to add your accounts (e.g., <strong>Main Current A/c (6569)</strong>, <strong>Savings A/c (1538)</strong>, or <strong>Petty Cash</strong>) with their opening balances.
              </p>
              <Button
                onClick={handleOpenAddAccount}
                className="bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> + Add Your First Bank Account
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => {
              const stats = accountBalances[acc.id] || { balance: acc.openingBalance || 0, totalCredits: 0, totalDebits: 0, creditCount: 0, debitCount: 0 };

              return (
                <Card key={acc.id} className="border-border shadow-sm rounded-xl overflow-hidden">
                  <CardHeader className="p-4 pb-3 bg-muted/30 border-b border-border">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold">
                          {acc.accountType === 'cash_in_hand' ? <Wallet className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}
                        </div>
                        <div>
                          <CardTitle className="text-sm font-bold">{acc.accountName}</CardTitle>
                          <CardDescription className="text-xs text-muted-foreground">{acc.bankName}</CardDescription>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenAddTx('credit', acc.id)}>
                            <ArrowDownLeft className="w-3.5 h-3.5 mr-2 text-emerald-600" /> Record Credit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenAddTx('debit', acc.id)}>
                            <ArrowUpRight className="w-3.5 h-3.5 mr-2 text-rose-600" /> Record Debit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleOpenEditAccount(acc)}>
                            <Edit className="w-3.5 h-3.5 mr-2" /> Edit Account
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteAccount(acc)} className="text-rose-600">
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Account
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 space-y-3">
                    <div className="text-xs space-y-1">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Account Number:</span>
                        <span className="font-mono font-bold text-foreground">
                          {acc.accountNumber.length > 8
                            ? `•••• •••• ${acc.accountNumber.slice(-4)}`
                            : acc.accountNumber}
                        </span>
                      </div>
                      {acc.ifscCode && acc.ifscCode !== 'CASH' && (
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>IFSC Code:</span>
                          <span className="font-mono font-medium text-foreground">{acc.ifscCode}</span>
                        </div>
                      )}
                      {acc.branch && (
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Branch:</span>
                          <span className="text-foreground">{acc.branch}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-border flex items-end justify-between">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Ledger Balance
                        </div>
                        <div className="text-lg font-black font-sans font-mono text-teal-700 dark:text-teal-400 mt-0.5">
                          ₹{stats.balance.toLocaleString("en-IN")}
                        </div>
                        {stats.latestAlertBalance !== undefined && (
                          <div className="text-[10px] font-semibold text-teal-800 dark:text-teal-300 font-mono mt-0.5 flex items-center gap-1">
                            <span>⚡ Bank Stated: ₹{stats.latestAlertBalance.toLocaleString('en-IN')}</span>
                            {stats.latestAlertDate && (
                              <span className="text-muted-foreground font-sans text-[9px]">({stats.latestAlertDate})</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenAddTx('credit', acc.id)}
                          className="h-7 text-xs px-2 text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 rounded-md"
                        >
                          + Deposit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenAddTx('debit', acc.id)}
                          className="h-7 text-xs px-2 text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100 rounded-md"
                        >
                          - Payout
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: AUTO EXPENSE TAGGING                                               */}
      {/* ========================================================================= */}
      {activeTab === "expense_tag" && (
        <ExpenseTaggingTab
          transactions={transactions}
          accounts={accounts}
          onRefresh={() => loadAllData(true)}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 6: DAILY EXPENSE ANALYTICS                                            */}
      {/* ========================================================================= */}
      {activeTab === "daily_expense" && (
        <DailyExpenseTab
          transactions={transactions}
          accounts={accounts}
          onRefresh={() => loadAllData(true)}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: LINK BANK CREDIT DIRECTLY TO A CASH INVOICE                        */}
      {/* ========================================================================= */}
      <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-sans text-base text-teal-800 dark:text-teal-300">
              <Link2 className="w-5 h-5 text-teal-700" />
              <span>Link Bank Credit to Cash Invoice</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select the cash invoice that corresponds to this bank deposit to reconcile and update payment status.
            </DialogDescription>
          </DialogHeader>

          {targetTransactionForLink && (
            <div className="space-y-3.5 py-2">
              {/* Active Bank Transaction Info Banner */}
              <div className="p-3.5 bg-teal-50/80 dark:bg-teal-950/40 rounded-xl border border-teal-200 dark:border-teal-800 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div>
                  <div className="text-[10px] uppercase font-bold text-teal-700 dark:text-teal-300 tracking-wider">
                    Bank Transaction Details
                  </div>
                  <div className="font-bold text-sm text-foreground mt-0.5">
                    {targetTransactionForLink.description}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                    <span>Date: {targetTransactionForLink.date}</span>
                    {targetTransactionForLink.referenceNumber && (
                      <span>&bull; Ref: <code className="font-mono font-bold text-foreground">{targetTransactionForLink.referenceNumber}</code></span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Deposit Amount</div>
                  <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                    +₹{targetTransactionForLink.amount.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Auto-update switch */}
              <div className="flex items-center justify-between p-2.5 bg-muted/40 rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <Switch
                    id="auto-update-inv"
                    checked={autoUpdateInvoicePayment}
                    onCheckedChange={setAutoUpdateInvoicePayment}
                  />
                  <Label htmlFor="auto-update-inv" className="text-xs font-semibold cursor-pointer">
                    Auto-update Cash Invoice Paid Balance to ₹{targetTransactionForLink.amount.toLocaleString('en-IN')} &amp; mark status
                  </Label>
                </div>
              </div>

              {/* Invoices List with Search */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Select Matching Cash Invoice:
                  </Label>
                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type="search"
                      value={invoiceSearchQuery}
                      onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                      placeholder="Search invoice #, hospital..."
                      className="pl-8 text-xs h-8 rounded-md"
                    />
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto border border-border rounded-xl">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/60 text-muted-foreground font-semibold sticky top-0">
                      <tr>
                        <th className="p-2.5 text-left">Invoice # / DC</th>
                        <th className="p-2.5 text-left">Customer / Hospital</th>
                        <th className="p-2.5 text-right">Billed Amount</th>
                        <th className="p-2.5 text-right">Pending Balance</th>
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {candidateInvoicesForLink.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-muted-foreground">
                            No cash invoices match your search.
                          </td>
                        </tr>
                      ) : (
                        candidateInvoicesForLink.map((inv) => {
                          const grandTotal = Number(inv.grandTotal) || 0;
                          const paid = Number(inv.paymentReceived) || 0;
                          const due = Math.max(0, grandTotal - paid);
                          const isExactMatch = due === targetTransactionForLink.amount || grandTotal === targetTransactionForLink.amount;
                          const isCurrentLinked = targetTransactionForLink.linkedInvoiceNumber === inv.invNumber;

                          return (
                            <tr key={inv.invNumber} className={`hover:bg-muted/30 ${isExactMatch ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''}`}>
                              <td className="p-2.5 font-mono">
                                <div className="font-bold text-foreground flex items-center gap-1.5">
                                  <span>{inv.invNumber}</span>
                                  {inv.invNumber.startsWith('DC #') && (
                                    <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-300 text-[9px] py-0 px-1 font-bold">
                                      ⚡ Cash Queue DC
                                    </Badge>
                                  )}
                                  {isExactMatch && (
                                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-[9px] py-0 px-1 font-bold">
                                      Match
                                    </Badge>
                                  )}
                                </div>
                                {inv.dcNumber && !inv.invNumber.startsWith('DC #') && (
                                  <span className="text-[10px] text-teal-700">DC #{inv.dcNumber}</span>
                                )}
                              </td>

                              <td className="p-2.5 font-medium">
                                <div className="text-foreground">{inv.clientName}</div>
                                <div className="text-[10px] text-muted-foreground">{inv.invDate}</div>
                              </td>

                              <td className="p-2.5 text-right font-mono">
                                ₹{grandTotal.toLocaleString('en-IN')}
                              </td>

                              <td className="p-2.5 text-right font-mono font-bold text-amber-700 dark:text-amber-400">
                                ₹{due.toLocaleString('en-IN')}
                              </td>

                              <td className="p-2.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleViewCandidateInvoice(inv)}
                                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-teal-700 rounded-md border-slate-300"
                                    title="View Invoice Details"
                                  >
                                    <Eye className="w-3.5 h-3.5 mr-1 text-teal-600" />
                                    <span>View</span>
                                  </Button>

                                  {isCurrentLinked ? (
                                    <Badge className="bg-teal-700 text-white text-[10px]">
                                      Currently Linked
                                    </Badge>
                                  ) : (
                                    <Button
                                      size="sm"
                                      onClick={() => handleConfirmLinkToInvoice(inv)}
                                      className="h-7 px-3 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-md shadow-xs"
                                    >
                                      Link This Invoice
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsLinkModalOpen(false)} className="h-8 text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CASH INVOICE DOCUMENT PREVIEW MODAL */}
      <Dialog open={!!viewingCashInvoiceModal} onOpenChange={(open) => !open && setViewingCashInvoiceModal(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-900 border-border rounded-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Receipt className="w-5 h-5 text-teal-700 dark:text-teal-400" />
              <span>Cash Memo — {viewingCashInvoiceModal?.invNumber}</span>
            </DialogTitle>
            <div className="flex items-center gap-2 pr-6 sm:pr-0">
              {viewingCashInvoiceModal && (
                <Button
                  size="sm"
                  onClick={() => printCashMemo(viewingCashInvoiceModal)}
                  className="bg-teal-700 hover:bg-teal-800 text-white font-bold gap-1.5 h-8 text-xs rounded-md"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / PDF
                </Button>
              )}
            </div>
          </DialogHeader>

          {viewingCashInvoiceModal && (
            <div className="py-2">
              <CashInvoicePreview
                invoice={viewingCashInvoiceModal}
                onPrint={() => printCashMemo(viewingCashInvoiceModal)}
                showPrintButton={false}
              />
            </div>
          )}

          <DialogFooter className="pt-3 border-t border-border mt-2">
            <Button variant="outline" size="sm" onClick={() => setViewingCashInvoiceModal(null)} className="h-8 text-xs rounded-md">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT BANK ACCOUNT                                            */}
      {/* ========================================================================= */}
      <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-sans text-base">
              <Landmark className="w-5 h-5 text-teal-700" />
              <span>{editingAccount ? 'Edit Bank Account' : 'Add New Bank Account'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure bank details for bookkeeping, ledger balancing, and payment receipts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Account Display Name *</Label>
              <Input
                placeholder="e.g. Primary HDFC Current, Petty Cash Counter"
                value={accountForm.accountName}
                onChange={(e) => setAccountForm({ ...accountForm, accountName: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Bank Name *</Label>
                <Select
                  value={accountForm.bankName}
                  onValueChange={(val) => setAccountForm({ ...accountForm, bankName: val })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select Bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_BANKS.map((bank) => (
                      <SelectItem key={bank} value={bank}>
                        {bank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Account Type</Label>
                <Select
                  value={accountForm.accountType}
                  onValueChange={(val: any) => setAccountForm({ ...accountForm, accountType: val })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current Account</SelectItem>
                    <SelectItem value="savings">Savings Account</SelectItem>
                    <SelectItem value="od_cc">OD / CC Limit</SelectItem>
                    <SelectItem value="cash_in_hand">Cash In Hand</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Account Number *</Label>
                <Input
                  placeholder="e.g. 5010023456789"
                  value={accountForm.accountNumber}
                  onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value })}
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1 block">IFSC Code</Label>
                <Input
                  placeholder="e.g. HDFC0001234"
                  value={accountForm.ifscCode}
                  onChange={(e) => setAccountForm({ ...accountForm, ifscCode: e.target.value.toUpperCase() })}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Branch Name</Label>
                <Input
                  placeholder="e.g. Siddarth Nagar, Hyderabad"
                  value={accountForm.branch}
                  onChange={(e) => setAccountForm({ ...accountForm, branch: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Opening Balance (₹)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={accountForm.openingBalance}
                  onChange={(e) => setAccountForm({ ...accountForm, openingBalance: parseFloat(e.target.value) || 0 })}
                  className="h-9 text-xs font-semibold font-mono"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Notes / Purpose</Label>
              <Input
                placeholder="Optional notes regarding this bank account"
                value={accountForm.notes}
                onChange={(e) => setAccountForm({ ...accountForm, notes: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAddAccountOpen(false)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveAccount} className="h-8 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white">
              {editingAccount ? 'Save Changes' : 'Create Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT TRANSACTION                                             */}
      {/* ========================================================================= */}
      <Dialog open={isAddTxOpen} onOpenChange={setIsAddTxOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-sans text-base">
              {txForm.type === 'credit' ? (
                <div className="flex items-center gap-2 text-emerald-700">
                  <ArrowDownLeft className="w-5 h-5" />
                  <span>Record Credit (+ Inflow)</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-rose-700">
                  <ArrowUpRight className="w-5 h-5" />
                  <span>Record Debit (- Outflow)</span>
                </div>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Enter payment details to update your bank account ledger.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-center p-1 bg-muted rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setTxForm({
                    ...txForm,
                    type: 'credit',
                    category: 'Invoice Collection',
                  });
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-all ${
                  txForm.type === 'credit' ? 'bg-emerald-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" /> Credit (+ Inflow)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTxForm({
                    ...txForm,
                    type: 'debit',
                    category: 'Vendor / Implant Supplier',
                    linkToInvoice: false,
                  });
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-all ${
                  txForm.type === 'debit' ? 'bg-rose-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" /> Debit (- Outflow)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Bank Account *</Label>
                <Select
                  value={txForm.accountId}
                  onValueChange={(val) => setTxForm({ ...txForm, accountId: val })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select Account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.accountName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Amount (₹) *</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={txForm.amount || ''}
                  onChange={(e) => setTxForm({ ...txForm, amount: parseFloat(e.target.value) || 0 })}
                  className="h-9 text-xs font-bold font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Date *</Label>
                <Input
                  type="date"
                  value={txForm.date}
                  onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Time</Label>
                <Input
                  type="time"
                  value={txForm.time}
                  onChange={(e) => setTxForm({ ...txForm, time: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Category *</Label>
                <Select
                  value={txForm.category}
                  onValueChange={(val) => setTxForm({ ...txForm, category: val })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(txForm.type === 'credit' ? CREDIT_CATEGORIES : DEBIT_CATEGORIES).map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Ref / UTR / Cheque #</Label>
                <Input
                  placeholder="e.g. UTR92837418, CHQ-1049"
                  value={txForm.referenceNumber}
                  onChange={(e) => setTxForm({ ...txForm, referenceNumber: e.target.value })}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Narration / Description</Label>
              <Input
                placeholder="e.g. Apollo Hospital payment, Implant dispatch, Courier charges"
                value={txForm.description}
                onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAddTxOpen(false)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveTransaction}
              className={`h-8 text-xs font-bold text-white ${
                txForm.type === 'credit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {editingTx ? 'Update Entry' : `Record ${txForm.type === 'credit' ? 'Credit' : 'Debit'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: INTER-ACCOUNT FUND TRANSFER                                        */}
      {/* ========================================================================= */}
      <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-sans text-base text-indigo-900 dark:text-indigo-300">
              <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
              <span>Transfer Between Bank Accounts</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Shift funds between your operating bank accounts or counter cash.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1 block">From Account (Debit) *</Label>
              <Select value={transferFromAccountId} onValueChange={setTransferFromAccountId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.accountName} (Bal: ₹{(accountBalances[acc.id]?.balance || 0).toLocaleString('en-IN')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1 block">To Account (Credit) *</Label>
              <Select value={transferToAccountId} onValueChange={setTransferToAccountId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((acc) => acc.id !== transferFromAccountId)
                    .map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.accountName} (Bal: ₹{(accountBalances[acc.id]?.balance || 0).toLocaleString('en-IN')})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Transfer Amount (₹) *</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={transferAmount || ''}
                  onChange={(e) => setTransferAmount(parseFloat(e.target.value) || 0)}
                  className="h-9 text-xs font-bold font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Transfer Ref #</Label>
                <Input
                  value={transferRef}
                  onChange={(e) => setTransferRef(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Narration / Note</Label>
              <Input
                placeholder="e.g. Counter cash deposit to HDFC"
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsTransferModalOpen(false)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleExecuteTransfer} className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-xs">
              Execute Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: LINKED INVOICE PREVIEW POPUP                                       */}
      {/* ========================================================================= */}
      <Dialog open={Boolean(previewInvoice)} onOpenChange={(open) => !open && setPreviewInvoice(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between font-sans text-base">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-teal-700" />
                <span>Invoice {previewInvoice?.invNumber}</span>
              </div>
              <Badge className="bg-teal-50 text-teal-800 border-teal-200">
                {previewInvoice?.status || 'Active'}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {previewInvoice && (
            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-xl border border-border">
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Customer / Hospital</span>
                  <div className="font-bold text-foreground mt-0.5">{previewInvoice.clientName}</div>
                  {previewInvoice.clientMobile && <div className="text-muted-foreground mt-0.5">{previewInvoice.clientMobile}</div>}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Invoice Date</span>
                  <div className="font-bold text-foreground mt-0.5">{previewInvoice.invDate}</div>
                  {previewInvoice.dcNumber && <div className="text-muted-foreground mt-0.5">DC: {previewInvoice.dcNumber}</div>}
                </div>
              </div>

              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 text-muted-foreground font-bold">
                    <tr>
                      <th className="p-2">Item Description</th>
                      <th className="p-2 text-center">Qty</th>
                      <th className="p-2 text-right">Rate</th>
                      <th className="p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(previewInvoice.items || previewInvoice.invoiceItems || []).map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-medium">{it.description || 'Item'} {it.size ? `(${it.size})` : ''}</td>
                        <td className="p-2 text-center">{it.qty}</td>
                        <td className="p-2 text-right">₹{(Number(it.rate) || 0).toLocaleString('en-IN')}</td>
                        <td className="p-2 text-right font-semibold">₹{(Number(it.amount) || Number(it.qty) * Number(it.rate) || 0).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-teal-50/70 dark:bg-teal-950/40 rounded-xl border border-teal-200/70 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-teal-800 dark:text-teal-300">Billed: ₹{Number(previewInvoice.grandTotal || 0).toLocaleString('en-IN')}</span>
                  <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    Paid: ₹{Number(previewInvoice.paymentReceived || 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setPreviewInvoice(null);
                    navigate('/cash-invoice');
                  }}
                  className="h-8 px-3 text-xs bg-teal-700 text-white rounded-md"
                >
                  Open in Invoice Suite &rarr;
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: EMAIL & TRANSACTION VERIFICATION DETAILS                          */}
      {/* ========================================================================= */}
      {/* MODAL: EMAIL CONTENT */}
      <Dialog open={Boolean(viewingTxDetails)} onOpenChange={(open) => !open && setViewingTxDetails(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto p-5">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Email Content</span>
              </DialogTitle>
              {viewingTxDetails && (
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  +₹{viewingTxDetails.amount?.toLocaleString('en-IN')}
                </span>
              )}
            </div>
            {viewingTxDetails?.emailSubject && (
              <DialogDescription className="text-xs font-semibold text-slate-700 dark:text-slate-300 pt-1 text-left">
                Subject: {viewingTxDetails.emailSubject}
              </DialogDescription>
            )}
          </DialogHeader>

          {viewingTxDetails && (
            <div className="space-y-3 pt-2">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                {viewingTxDetails.rawEmailBody
                  ? viewingTxDetails.rawEmailBody
                      .replace(/<https?:\/\/[^>]+>/gi, '')
                      .replace(/\n{3,}/g, '\n\n')
                      .trim()
                  : viewingTxDetails.rawAlert || viewingTxDetails.description}
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewingTxDetails(null)}
              className="h-8 text-xs rounded-xl border-slate-300"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cash Memo / DC Document Preview Modal */}
      <Dialog open={!!viewingDcDetails} onOpenChange={(open) => !open && setViewingDcDetails(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-900 border-border rounded-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Receipt className="w-5 h-5 text-teal-700 dark:text-teal-400" />
              <span>Cash Memo — {viewingDcAsCashInvoice?.invNumber || `DC #${viewingDcDetails?.dcNo}`}</span>
            </DialogTitle>
            <div className="flex items-center gap-2 pr-6 sm:pr-0">
              {viewingDcAsCashInvoice && (
                <Button
                  size="sm"
                  onClick={() => printCashMemo(viewingDcAsCashInvoice)}
                  className="bg-teal-700 hover:bg-teal-800 text-white font-bold gap-1.5 h-8 text-xs rounded-md"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / PDF
                </Button>
              )}
            </div>
          </DialogHeader>

          {viewingDcAsCashInvoice && (
            <div className="py-2">
              <CashInvoicePreview
                invoice={viewingDcAsCashInvoice}
                onPrint={() => printCashMemo(viewingDcAsCashInvoice)}
                showPrintButton={false}
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border mt-2">
            {viewingDcDetails && (
              <Button
                size="sm"
                onClick={() => {
                  const dc = viewingDcDetails;
                  setViewingDcDetails(null);
                  setSettlingDc(dc);
                }}
                className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-xs mr-auto"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Record Payment
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setViewingDcDetails(null)} className="h-8 text-xs rounded-md">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settle Cash DC Payment Modal (Full 2-Column DC Tracker & Cash Invoice Parity) */}
      <Dialog
        open={!!settlingDc}
        onOpenChange={(open) => {
          if (!open) {
            setSettlingDc(null);
            setPaymentAmountInput("");
            setPaymentRemarksInput("");
            setPaymentMethod("cash");
            setPaymentCollectedBy("");
            setSelectedBankAccountId("");
            setSelectedCreditTxId("");
          }
        }}
      >
        <DialogContent 
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="sm:max-w-4xl lg:max-w-5xl w-full p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 gap-0"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Record Payment Collection</DialogTitle>
            <DialogDescription>
              Record payment settlement for DC #{settlingDc?.dcNo}.
            </DialogDescription>
          </DialogHeader>

          {/* 1. TOP HEADER */}
          <div className="bg-slate-50/80 dark:bg-slate-850 border-b border-slate-200/80 dark:border-slate-800 px-5 py-4">
            <div className="flex items-start justify-between gap-3 pr-6">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                    DC #{settlingDc?.dcNo}
                  </span>
                  {settlingDc?.invoiceRef && (
                    <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      Memo #{settlingDc.invoiceRef}
                    </span>
                  )}
                  <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Awaiting Settlement
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  Record Cash / Payment — DC #{settlingDc?.dcNo}
                </h3>
                <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400 mt-1 flex-wrap">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {settlingDc?.hospitalName || "Hospital Record"}
                  </span>
                  {settlingDc?.doctorName && (
                    <span className="flex items-center gap-1">
                      <Stethoscope className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Dr. {settlingDc.doctorName}
                    </span>
                  )}
                  {settlingDc?.patientName && (
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      Pt: {settlingDc.patientName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2. BODY CONTENT (2-COLUMN RESPONSIVE LAYOUT) */}
          {settlingDc && (
            <div className="p-5 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* LEFT COLUMN: RECEIVABLE DETAILS & PAYMENT INPUTS */}
                <div className={`${paymentMethod === "bank_transfer" ? "lg:col-span-5" : "lg:col-span-12 max-w-xl mx-auto w-full"} space-y-4 flex flex-col justify-between`}>
                  {/* Financial Receivable Banner */}
                  {Boolean(settlingDc.billedAmount && settlingDc.billedAmount > (settlingDc.cashAmount || 0)) ? (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5 text-amber-600" />
                          Hiked Bill Settlement
                        </span>
                        <span className="text-[10px] bg-amber-200/70 dark:bg-amber-900/60 px-2 py-0.5 rounded-full font-bold text-amber-900 dark:text-amber-200">
                          Margin Deducted
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-amber-200/60 dark:border-amber-900/30">
                        <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-lg border border-amber-100 dark:border-amber-900/30 text-center">
                          <span className="block text-[10px] text-slate-500 uppercase font-semibold">Printed Bill</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            ₹{settlingDc.billedAmount?.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-lg border border-amber-100 dark:border-amber-900/30 text-center">
                          <span className="block text-[10px] text-amber-700 dark:text-amber-400 uppercase font-semibold">Hospital Cut</span>
                          <span className="font-bold text-amber-800 dark:text-amber-300">
                            -₹{(settlingDc.hospitalMargin || (settlingDc.billedAmount! - (settlingDc.cashAmount || 0))).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200 dark:border-emerald-900/30 text-center">
                          <span className="block text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold">Net Due</span>
                          <span className="font-black text-emerald-800 dark:text-emerald-300">
                            ₹{(settlingDc.cashAmount || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/60 p-3.5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                          Outstanding Receivable
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          Total payment expected for this cash invoice
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                          ₹{(settlingDc.cashAmount || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Payment Mode Selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Payment Mode *
                    </Label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("cash")}
                        className={`flex items-center justify-center gap-2 h-10 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          paymentMethod === "cash"
                            ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 shadow-xs"
                            : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        }`}
                      >
                        <Banknote className={`w-4 h-4 shrink-0 ${paymentMethod === "cash" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`} />
                        <span>Cash Payment</span>
                        {paymentMethod === "cash" && <Check className="w-3.5 h-3.5 ml-auto text-emerald-600" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("bank_transfer")}
                        className={`flex items-center justify-center gap-2 h-10 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          paymentMethod === "bank_transfer"
                            ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20 shadow-xs"
                            : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        }`}
                      >
                        <Landmark className={`w-4 h-4 shrink-0 ${paymentMethod === "bank_transfer" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`} />
                        <span>Bank Transfer / UPI</span>
                        {paymentMethod === "bank_transfer" && <Check className="w-3.5 h-3.5 ml-auto text-indigo-600" />}
                      </button>
                    </div>
                  </div>

                  {/* Target Bank Account Selection (Only when Bank Transfer is active) */}
                  {paymentMethod === "bank_transfer" && (
                    <div className="space-y-1.5 pt-1">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Select Target Bank Account:
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        {sortedBankAccounts.map((acc) => {
                          const isSelected = selectedBankAccountId === acc.id;
                          const accSuffix = acc.accountNumber ? acc.accountNumber.slice(-4) : (acc.accountName.match(/\d{4}/)?.[0] || "");
                          const bankTitle = acc.bankName || acc.accountName.split("(")[0].trim();
                          return (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => setSelectedBankAccountId(acc.id)}
                              className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                isSelected
                                  ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20 shadow-xs"
                                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                              }`}
                            >
                              <span className="font-bold flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                {bankTitle}
                              </span>
                              {accSuffix && (
                                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                  ({accSuffix})
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Cash Collector Selection (Only when Cash is selected) */}
                  {paymentMethod === "cash" && (
                    <div className="space-y-2.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-emerald-600" />
                          Who Collected the Cash? *
                        </Label>
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-200">
                          ⚡ Cash In Hand Treasury
                        </span>
                      </div>
                      <PersonnelSelect
                        value={paymentCollectedBy}
                        onChange={setPaymentCollectedBy}
                        placeholder="Select or type collector name..."
                        showQuickPicks={false}
                      />
                      {/* Clean Quick Picks */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-[11px] font-medium text-slate-400 mr-0.5">Quick:</span>
                        <button
                          type="button"
                          onClick={() => setPaymentCollectedBy("Self")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            paymentCollectedBy.trim().toLowerCase() === "self"
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                          }`}
                        >
                          Self
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentCollectedBy("Office")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            paymentCollectedBy.trim().toLowerCase() === "office"
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                          }`}
                        >
                          Office
                        </button>
                        {settlingDc?.deliveredBy && (
                          <button
                            type="button"
                            onClick={() => setPaymentCollectedBy(settlingDc.deliveredBy || "")}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                              paymentCollectedBy.trim().toLowerCase() === (settlingDc?.deliveredBy || "").toLowerCase()
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-emerald-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                            }`}
                          >
                            <UserCheck className="w-3 h-3 text-teal-600" />
                            <span>Delivery: {settlingDc.deliveredBy}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Amount Received & Remarks */}
                  <div className="grid grid-cols-1 gap-3 pt-1">
                    {/* Paid Amount */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="payment-amount-bank" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Amount Received *
                        </Label>
                        {settlingDc?.cashAmount && (
                          <button
                            type="button"
                            onClick={() => setPaymentAmountInput(String(settlingDc.cashAmount || ''))}
                            className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline font-bold cursor-pointer"
                          >
                            Full Due (₹{settlingDc.cashAmount.toLocaleString('en-IN')})
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">
                          ₹
                        </span>
                        <Input
                          id="payment-amount-bank"
                          type="number"
                          value={paymentAmountInput}
                          onChange={(e) => setPaymentAmountInput(e.target.value)}
                          placeholder={settlingDc?.cashAmount ? String(settlingDc.cashAmount) : "0"}
                          className="pl-7 h-10 font-bold text-sm bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded-xl"
                        />
                      </div>
                    </div>

                    {/* Payment Remarks */}
                    <div className="space-y-1.5">
                      <Label htmlFor="payment-remarks-bank" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Notes / Ref <span className="font-normal text-slate-400">(Optional)</span>
                      </Label>
                      <Input
                        id="payment-remarks-bank"
                        type="text"
                        value={paymentRemarksInput}
                        onChange={(e) => setPaymentRemarksInput(e.target.value)}
                        placeholder={paymentMethod === "cash" ? "e.g. Received at hospital billing" : "e.g. UTR / NEFT Ref"}
                        className="h-10 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: BANK CREDIT LINKING & MATCHING PANEL (When Bank Transfer is active) */}
                {paymentMethod === "bank_transfer" && (
                  <div className="lg:col-span-7 bg-slate-50/90 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between h-full space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Landmark className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        Mandatory Bank Credit Link &amp; Match *
                      </Label>
                      <Badge variant="outline" className="text-[10px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200">
                        {availableBankCredits.length} Statement Credits
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Select matching credit deposit from bank statement or select "Not Found" to link later:
                    </p>

                    {/* Executive Account Card Selector Tabs */}
                    <div className="space-y-1 my-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Select Account Statement:</span>
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {/* 1. BANK ACCOUNTS TABS (1538 ALWAYS FIRST ON THE LEFT!) */}
                        {sortedBankAccounts.map((acc) => {
                          const isSelected = selectedBankAccountId === acc.id;
                          const count = availableBankCredits.filter((t) => t.accountId === acc.id).length;
                          const accSuffix = acc.accountNumber ? acc.accountNumber.slice(-4) : (acc.accountName.match(/\d{4}/)?.[0] || '');
                          const is1538 = accSuffix === '1538' || acc.id.includes('1538');

                          return (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => setSelectedBankAccountId(acc.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer border ${
                                isSelected
                                  ? is1538 
                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-500/20"
                                    : "bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-500/20"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700"
                              }`}
                            >
                              <Building2 className="w-3.5 h-3.5" />
                              <span>{acc.bankName || acc.accountName.split('(')[0].trim()}</span>
                              {accSuffix && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                                  isSelected ? "bg-white/20 text-white font-mono" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                }`}>
                                  ({accSuffix})
                                </span>
                              )}
                              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                                isSelected ? "bg-white/20 text-white font-mono" : "bg-indigo-50 text-indigo-700 dark:bg-slate-800 dark:text-slate-200"
                              }`}>
                                {count}
                              </span>
                            </button>
                          );
                        })}

                        {/* 2. ALL ACCOUNTS TAB */}
                        <button
                          type="button"
                          onClick={() => setSelectedBankAccountId("all")}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer border ${
                            selectedBankAccountId === "all"
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-500/20"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700"
                          }`}
                        >
                          <Landmark className="w-3.5 h-3.5" />
                          <span>All Accounts</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                            selectedBankAccountId === "all" ? "bg-white/20 text-white font-mono" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          }`}>
                            {availableBankCredits.length}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/60 space-y-0 flex-1 min-h-[220px] max-h-[350px] overflow-y-auto">
                      {filteredBankCredits.map((tx) => {
                        const isSelected = selectedCreditTxId === tx.id;
                        const dcAmount = settlingDc.cashAmount || settlingDc.billedAmount || 0;
                        const isAmountMatch = Math.abs(tx.amount - dcAmount) < 10;
                        const dcHosp = (settlingDc.hospitalName || '').toLowerCase().trim();
                        const desc = (tx.description || '').toLowerCase();
                        const isHospMatch = dcHosp && desc.includes(dcHosp);
                        const isMatch = isAmountMatch || isHospMatch;

                        return (
                          <div
                            key={tx.id}
                            onClick={() => {
                              setSelectedCreditTxId(tx.id);
                              if (tx.amount) setPaymentAmountInput(String(tx.amount));
                            }}
                            className={`px-3.5 py-2.5 text-xs cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                              isSelected
                                ? "bg-indigo-50/90 dark:bg-indigo-950/60 border-l-4 border-l-indigo-600 font-medium"
                                : "hover:bg-slate-50 dark:hover:bg-slate-850"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}>
                                {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-bold text-slate-800 dark:text-slate-100 truncate text-[11.5px]">
                                    {tx.description || "Bank Credit Deposit"}
                                  </span>
                                  {isMatch && (
                                    <span className="text-[9px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-extrabold shrink-0">
                                      🎯 Match
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                  <span>{tx.date}</span>
                                  {tx.time && <span>• {tx.time}</span>}
                                  {tx.referenceNumber && <span className="truncate">• Ref: {tx.referenceNumber}</span>}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs font-mono">
                                +₹{tx.amount.toLocaleString('en-IN')}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingTxDetails(tx);
                                }}
                                className="p-1 rounded-md text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                title="View Email & Verification Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* NOT FOUND OPTION AT LAST */}
                      <div
                        onClick={() => setSelectedCreditTxId("not_found")}
                        className={`px-3.5 py-2.5 text-xs cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                          selectedCreditTxId === "not_found"
                            ? "bg-amber-50 dark:bg-amber-950/40 border-l-4 border-l-amber-500 font-medium"
                            : "hover:bg-slate-50 dark:hover:bg-slate-850"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${selectedCreditTxId === "not_found" ? "border-amber-600 bg-amber-600 text-white" : "border-slate-300"}`}>
                            {selectedCreditTxId === "not_found" && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="font-bold text-amber-900 dark:text-amber-300 text-[11.5px] truncate">
                              Not Found in Bank Statement Yet (Link Later)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. FOOTER ACTION BAR */}
          <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <Button
              variant="outline"
              onClick={() => setSettlingDc(null)}
              className="rounded-xl h-10 px-4 text-xs font-semibold border-slate-300 hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:border-slate-700"
            >
              Cancel
            </Button>
            <Button
              disabled={isSettling}
              onClick={handleConfirmSettleDc}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-5 text-xs font-bold gap-1.5 shadow-sm min-w-[150px]"
            >
              <Check className="h-4 w-4" />
              <span>{isSettling ? 'Settling...' : 'Confirm Payment'}</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

