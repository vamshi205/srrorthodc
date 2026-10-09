import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CashInvoiceData,
  fetchCashInvoicesFromFirestore,
  saveCashInvoiceToFirestore,
  deleteCashInvoiceFromFirestore,
} from "@/services/cashInvoiceFirebaseService";
import {
  BankAccount,
  BankTransaction,
  fetchBankAccountsFromFirestore,
  fetchBankTransactionsFromFirestore,
  recordCashPaymentToCashInHand,
} from "@/services/bankAccountFirebaseService";
import {
  Customer,
  fetchUnifiedCustomers,
} from "@/lib/customerStorage";
import {
  loadSavedDcs,
  transitionSavedDc,
  SavedDc,
} from "@/lib/savedDcStorage";
import { CashInvoicePreview } from "@/components/cash-invoice/CashInvoicePreview";
import { printCashMemo } from "@/lib/cashInvoicePrint";
import { numberToIndianWords } from "@/lib/numberToWords";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { extractHdfcNarration } from "@/services/gmailConnectorService";
import {
  FileText,
  Plus,
  Trash2,
  Printer,
  Save,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  Building2,
  Receipt,
  CreditCard,
  Eye,
  Edit,
  Download,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Banknote,
  Landmark,
  Check,
  User,
  UserCheck,
  Loader2,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  Mail,
} from "lucide-react";

interface InvoiceItem {
  id: string;
  description: string;
  note?: string;
  subDescription?: string;
  sku?: string;
  size: string;
  qty: number;
  rate: number;
  amount: number;
}

const DEFAULT_COMPANY = {
  name: "SRR ORTHO PLUS",
  address: "217, SIDDARTH NAGAR, HYDERABAD - 500038",
  contact: "9396857455",
  email: "srrorthoplus999@gmail.com",
  website: "srrorthoplus.com",
  bank: "HDFC BANK, A/C: 5010023456789, IFSC: HDFC0001234, Hyderabad Branch",
  upi: "9396857455@ybl",
  signature: "A.SATYANARAYANA",
};

import {
  CatalogItem,
  getInitialCatalog,
  getImplantCatalog,
  searchImplantDescriptions,
  getSizesForDescription,
  getCatalogItemPrice,
} from "@/lib/implantCatalogStorage";

export const NativeCashInvoice: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Navigation tab with URL synchronization
  const tabFromUrl = (searchParams.get("tab") as "editor" | "preview" | "saved") || "editor";
  const [activeTab, setActiveTabState] = useState<"editor" | "preview" | "saved">(tabFromUrl);

  useEffect(() => {
    const t = searchParams.get("tab") as "editor" | "preview" | "saved";
    if (t === "saved" || t === "preview") {
      setActiveTabState(t);
    } else {
      setActiveTabState("editor");
    }
  }, [searchParams]);

  const setActiveTab = (newTab: "editor" | "preview" | "saved") => {
    setActiveTabState(newTab);
    const newParams = new URLSearchParams(searchParams);
    if (newTab === "editor") {
      newParams.delete("tab");
    } else {
      newParams.set("tab", newTab);
    }
    setSearchParams(newParams);
  };

  // Invoices & Customers collections
  const [savedInvoices, setSavedInvoices] = useState<CashInvoiceData[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [savedDcs, setSavedDcs] = useState<SavedDc[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Active Invoice Form State
  const [invNumber, setInvNumber] = useState<string>("SRR-2026-0001");
  const [dcNumber, setDcNumber] = useState<string>("");
  const [invDate, setInvDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [clientName, setClientName] = useState<string>("");
  const [clientAddress, setClientAddress] = useState<string>("");
  const [clientMobile, setClientMobile] = useState<string>("");
  const [clientEmail, setClientEmail] = useState<string>("");
  const [discount, setDiscount] = useState<number>(0);
  const [isHikedBill, setIsHikedBill] = useState<boolean>(false);
  const [actualReceivable, setActualReceivable] = useState<number>(0);
  const [paymentReceived, setPaymentReceived] = useState<number>(0);

  // Items State
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      id: "item-1",
      description: "",
      note: "",
      subDescription: "",
      size: "",
      qty: 1,
      rate: 0,
      amount: 0,
    },
  ]);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveStatusText, setSaveStatusText] = useState("");

  // Customer Autocomplete state
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Item Autocomplete state
  const [activeItemRowIndex, setActiveItemRowIndex] = useState<number | null>(null);
  const [itemSearchQuery, setItemSearchQuery] = useState("");

  // Catalog & Sizes state (initialized synchronously with bundled catalog)
  const [catalog, setCatalog] = useState<CatalogItem[]>(() => getInitialCatalog());
  const [activeSizeRowIndex, setActiveSizeRowIndex] = useState<number | null>(null);
  const [sizeSearchQuery, setSizeSearchQuery] = useState("");

  // Saved Invoices View/Print Modal
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<CashInvoiceData | null>(null);

  // Record Payment Modal (DC Tracker Style)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<CashInvoiceData | null>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer">("cash");
  const [paymentCollectedBy, setPaymentCollectedBy] = useState<string>("Self");
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("");
  const [paymentRemarksInput, setPaymentRemarksInput] = useState<string>("");
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [selectedCreditTxId, setSelectedCreditTxId] = useState<string | null>(null);
  const [isLoadingBankCredits, setIsLoadingBankCredits] = useState<boolean>(false);
  const [viewingTxDetails, setViewingTxDetails] = useState<BankTransaction | null>(null);

  // Available & Filtered Bank Credit Statement Transactions
  const availableBankCredits = useMemo(() => {
    return bankTransactions.filter((tx) => tx.type === "credit");
  }, [bankTransactions]);

  const filteredBankCredits = useMemo(() => {
    if (!selectedBankAccountId || selectedBankAccountId === "all") {
      return availableBankCredits;
    }
    return availableBankCredits.filter((tx) => tx.accountId === selectedBankAccountId);
  }, [availableBankCredits, selectedBankAccountId]);

  const loadBankTransactions = async () => {
    setIsLoadingBankCredits(true);
    try {
      const txs = await fetchBankTransactionsFromFirestore(undefined, 200);
      setBankTransactions(txs);
    } catch (err) {
      console.error("Failed to load bank transactions:", err);
    } finally {
      setIsLoadingBankCredits(false);
    }
  };

  // Sorted executive bank accounts (HDFC 1538 ALWAYS FIRST on the far left, Cash In Hand excluded)
  const sortedBankAccounts = useMemo(() => {
    const accounts = bankAccounts.filter((a) => a.accountType !== "cash_in_hand");
    accounts.sort((a, b) => {
      const aSuffix = a.accountNumber ? a.accountNumber.slice(-4) : (a.accountName.match(/\d{4}/)?.[0] || "");
      const bSuffix = b.accountNumber ? b.accountNumber.slice(-4) : (b.accountName.match(/\d{4}/)?.[0] || "");
      if (aSuffix === "1538" || a.id.includes("1538")) return -1;
      if (bSuffix === "1538" || b.id.includes("1538")) return 1;
      return 0;
    });
    return accounts;
  }, [bankAccounts]);

  // Saved Invoices Filter & Search
  const [savedSearchQuery, setSavedSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid">("all");

  // Load Invoices, Customers, DCs, and Bank Accounts on Mount
  useEffect(() => {
    loadInitialData();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".desc-cell")) {
        setActiveItemRowIndex(null);
      }
      if (!target.closest(".size-cell")) {
        setActiveSizeRowIndex(null);
      }
      if (!target.closest(".customer-autocomplete")) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [invs, custs, dcs, cat, bAccounts, bTxs] = await Promise.all([
        fetchCashInvoicesFromFirestore(),
        fetchUnifiedCustomers(),
        loadSavedDcs(),
        getImplantCatalog(),
        fetchBankAccountsFromFirestore(),
        fetchBankTransactionsFromFirestore(undefined, 200),
      ]);
      setSavedInvoices(invs);
      setCustomers(custs);
      setSavedDcs(dcs);
      setCatalog(cat);
      setBankAccounts(bAccounts);
      setBankTransactions(bTxs);

      // Check query params
      const paramDc = searchParams.get("dcNo") || sessionStorage.getItem("prefill_cash_dc_no");
      const paramClient = searchParams.get("client") || sessionStorage.getItem("prefill_cash_client_name");
      const paramView = searchParams.get("viewInv") || sessionStorage.getItem("view_cash_inv_num");

      let loadedExisting = false;

      if (paramView) {
        const cleanView = paramView.trim().toLowerCase();
        const cleanRawView = cleanView.replace(/^dc\s*#?\s*/i, "");
        const found = invs.find(
          (i) =>
            (i.invNumber && (i.invNumber.trim().toLowerCase() === cleanView || i.invNumber.trim().toLowerCase().replace(/^dc\s*#?\s*/i, "") === cleanRawView)) ||
            (i.dcNumber && (i.dcNumber.trim().toLowerCase() === cleanView || i.dcNumber.trim().toLowerCase().replace(/^dc\s*#?\s*/i, "") === cleanRawView))
        );
        if (found) {
          handleEditSavedInvoice(found);
          setSelectedInvoiceForView(found);
          setViewModalOpen(true);
          loadedExisting = true;
        }
        sessionStorage.removeItem("view_cash_inv_num");
      }

      if (!loadedExisting && paramDc) {
        const cleanDc = paramDc.trim().toLowerCase();
        const cleanRawDc = cleanDc.replace(/^dc\s*#?\s*/i, "");
        const found = invs.find(
          (i) =>
            (i.dcNumber && (i.dcNumber.trim().toLowerCase() === cleanDc || i.dcNumber.trim().toLowerCase().replace(/^dc\s*#?\s*/i, "") === cleanRawDc)) ||
            (i.invNumber && (i.invNumber.trim().toLowerCase() === cleanDc || i.invNumber.trim().toLowerCase().replace(/^dc\s*#?\s*/i, "") === cleanRawDc))
        );
        if (found) {
          handleEditSavedInvoice(found);
          loadedExisting = true;
        } else {
          setDcNumber(paramDc);
        }
        sessionStorage.removeItem("prefill_cash_dc_no");
      }

      if (paramClient) {
        if (!loadedExisting) {
          setClientName(paramClient);
        }
        sessionStorage.removeItem("prefill_cash_client_name");
        // Auto fill address and mobile if matching customer exists
        const matchedCust = custs.find(
          (c) => c.name.toLowerCase().trim() === paramClient.toLowerCase().trim()
        );
        if (matchedCust && !loadedExisting) {
          if (matchedCust.address) setClientAddress(matchedCust.address);
          if (matchedCust.mobile || matchedCust.phone) {
            setClientMobile(matchedCust.mobile || matchedCust.phone || "");
          }
          if (matchedCust.email) setClientEmail(matchedCust.email);
        }
      }

      // Auto assign next invoice number if this is a fresh invoice
      if (!loadedExisting) {
        const nextNum = computeNextInvoiceNumber(invs);
        setInvNumber(nextNum);
      }
    } catch (err) {
      console.error("Error loading initial cash invoice data:", err);
      toast.error("Failed to load cash invoices data");
    } finally {
      setIsLoading(false);
    }
  };

  const computeNextInvoiceNumber = (invs: CashInvoiceData[]): string => {
    if (!invs || invs.length === 0) return "SRR-2026-0001";
    let maxVal = 0;
    invs.forEach((inv) => {
      const match = (inv.invNumber || "").match(/\d+$/);
      if (match) {
        const n = parseInt(match[0], 10);
        if (n > maxVal) maxVal = n;
      }
    });
    const nextVal = maxVal + 1;
    return `SRR-2026-${String(nextVal).padStart(4, "0")}`;
  };

  // Calculations
  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => {
      const q = Number(item.qty) || 0;
      const r = Number(item.rate) || 0;
      return acc + q * r;
    }, 0);
  }, [items]);

  const grandTotal = useMemo(() => {
    const raw = subtotal - (Number(discount) || 0);
    return Math.max(0, Math.round(raw * 100) / 100);
  }, [subtotal, discount]);

  const hospitalMargin = useMemo(() => {
    if (!isHikedBill || actualReceivable <= 0 || actualReceivable >= grandTotal) {
      return 0;
    }
    return Math.round((grandTotal - actualReceivable) * 100) / 100;
  }, [isHikedBill, actualReceivable, grandTotal]);

  const words = useMemo(() => {
    return numberToIndianWords(grandTotal);
  }, [grandTotal]);

  // Handle Items modification
  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      if (field === "qty" || field === "rate") {
        const q = field === "qty" ? Number(value) || 0 : Number(item.qty) || 0;
        const r = field === "rate" ? Number(value) || 0 : Number(item.rate) || 0;
        item.amount = Math.round(q * r * 100) / 100;
      }
      next[index] = item;
      return next;
    });
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        description: "",
        note: "",
        subDescription: "",
        size: "",
        qty: 1,
        rate: 0,
        amount: 0,
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) {
      setItems([
        {
          id: `item-${Date.now()}`,
          description: "",
          note: "",
          subDescription: "",
          size: "",
          qty: 1,
          rate: 0,
          amount: 0,
        },
      ]);
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Quick import from linked DC
  const matchingDcForCurrentNo = useMemo(() => {
    if (!dcNumber || !dcNumber.trim()) return null;
    const clean = dcNumber.trim().toLowerCase();
    return savedDcs.find((d) => d.dcNo && d.dcNo.trim().toLowerCase() === clean) || null;
  }, [dcNumber, savedDcs]);

  const handleImportItemsFromDc = () => {
    if (!matchingDcForCurrentNo) return;
    const importedItems: InvoiceItem[] = [];

    matchingDcForCurrentNo.items.forEach((dcItem, itemIdx) => {
      if (dcItem.sizes && dcItem.sizes.length > 0) {
        dcItem.sizes.forEach((s, sizeIdx) => {
          if (s.qty > 0) {
            const sizesForDesc = getSizesForDescription(catalog, dcItem.name);
            const matchedSize = sizesForDesc.find(
              (cs) => cs.size.toLowerCase().trim() === (s.size || "").toLowerCase().trim()
            );
            const rate = matchedSize ? matchedSize.price : (sizesForDesc[0]?.price || 0);

            importedItems.push({
              id: `imported-${itemIdx}-${sizeIdx}`,
              description: dcItem.name,
              note: "",
              subDescription: "",
              size: s.size || "",
              qty: s.qty,
              rate: rate,
              amount: Math.round(rate * s.qty * 100) / 100,
            });
          }
        });
      } else {
        const sizesForDesc = getSizesForDescription(catalog, dcItem.name);
        const rate = sizesForDesc[0]?.price || 0;
        importedItems.push({
          id: `imported-${itemIdx}`,
          description: dcItem.name,
          note: "",
          subDescription: "",
          size: "",
          qty: 1,
          rate: rate,
          amount: rate,
        });
      }
    });

    if (importedItems.length > 0) {
      setItems(importedItems);
      toast.success(`Imported ${importedItems.length} items from DC #${matchingDcForCurrentNo.dcNo}!`);
    } else {
      toast.info("No items with quantity found in DC");
    }
  };

  // Reset / Clear form
  const resetInvoiceForm = (invsList?: CashInvoiceData[], notify = false) => {
    const list = invsList || savedInvoices;
    const nextNum = computeNextInvoiceNumber(list);
    setInvNumber(nextNum);
    setDcNumber("");
    setInvDate(new Date().toISOString().split("T")[0]);
    setClientName("");
    setClientAddress("");
    setClientMobile("");
    setClientEmail("");
    setDiscount(0);
    setIsHikedBill(false);
    setActualReceivable(0);
    setPaymentReceived(0);
    setCustomerSearchQuery("");
    setShowCustomerDropdown(false);
    setActiveItemRowIndex(null);
    setActiveSizeRowIndex(null);
    setItems([
      {
        id: `item-${Date.now()}`,
        description: "",
        note: "",
        subDescription: "",
        size: "",
        qty: 1,
        rate: 0,
        amount: 0,
      },
    ]);
    if (notify) {
      toast.info("Started new Cash Memo draft");
    }
  };

  const handleClearInvoice = () => resetInvoiceForm(undefined, true);

  // Active Invoice Object for Preview & Saving
  const currentInvoiceData: CashInvoiceData = useMemo(() => {
    const effectiveDue = isHikedBill && actualReceivable > 0 ? actualReceivable : grandTotal;
    const isPaid = effectiveDue > 0 && paymentReceived >= effectiveDue;
    const isPartial = paymentReceived > 0 && paymentReceived < effectiveDue;
    const status = isPaid ? "paid" : isPartial ? "partial" : "pending";

    return {
      invNumber: invNumber.trim() || "SRR-2026-0001",
      dcNumber: dcNumber.trim() || undefined,
      invDate: invDate || new Date().toISOString().split("T")[0],
      clientName: clientName.trim() || "Walk-in Customer",
      clientAddress: clientAddress.trim() || undefined,
      clientMobile: clientMobile.trim() || undefined,
      clientEmail: clientEmail.trim() || undefined,
      items: items.map((i) => ({
        description: i.description,
        note: (i.note || i.subDescription)?.trim() || undefined,
        subDescription: (i.note || i.subDescription)?.trim() || undefined,
        sku: i.sku,
        size: i.size,
        qty: Number(i.qty) || 0,
        rate: Number(i.rate) || 0,
        amount: Number(i.amount) || (Number(i.qty) || 0) * (Number(i.rate) || 0),
      })),
      subtotal,
      discount: Number(discount) || 0,
      grandTotal,
      paymentReceived: Number(paymentReceived) || 0,
      isHikedBill,
      actualReceivable: isHikedBill ? Number(actualReceivable) || 0 : undefined,
      hospitalMargin: isHikedBill ? hospitalMargin : undefined,
      status,
      savedAt: Date.now(),
      companyName: DEFAULT_COMPANY.name,
      companyAddress: DEFAULT_COMPANY.address,
      companyContact: DEFAULT_COMPANY.contact,
      companyEmail: DEFAULT_COMPANY.email,
      companyUpi: DEFAULT_COMPANY.upi,
      companyBank: DEFAULT_COMPANY.bank,
    };
  }, [
    invNumber,
    dcNumber,
    invDate,
    clientName,
    clientAddress,
    clientMobile,
    clientEmail,
    items,
    subtotal,
    discount,
    grandTotal,
    paymentReceived,
    isHikedBill,
    actualReceivable,
    hospitalMargin,
  ]);

  // Save to Firestore & Auto-sync with DC Tracker
  const handleSaveInvoice = async (andPrint = false): Promise<boolean> => {
    const validItems = items.filter((i) => (i.description || "").trim().length > 0);
    if (validItems.length === 0) {
      toast.error("At least one item must be added to save or print the cash invoice.");
      return false;
    }

    if (!clientName.trim()) {
      toast.error("Please enter a Customer or Hospital Name");
      return false;
    }

    setIsSaving(true);
    setSaveProgress(25);
    setSaveStatusText(`Saving Cash Memo #${invNumber}...`);

    try {
      const progTimer1 = setTimeout(() => setSaveProgress(60), 300);
      const progTimer2 = setTimeout(() => setSaveProgress(85), 650);

      const success = await saveCashInvoiceToFirestore(currentInvoiceData);

      clearTimeout(progTimer1);
      clearTimeout(progTimer2);

      if (success) {
        // Auto sync with DC if dcNumber is provided
        if (dcNumber.trim()) {
          setSaveStatusText(`Syncing with DC #${dcNumber}...`);
          try {
            const dcs = await loadSavedDcs();
            const matchingDc = dcs.find(
              (d) => d.dcNo && d.dcNo.trim().toLowerCase() === dcNumber.trim().toLowerCase()
            );

            if (matchingDc) {
              const effectiveAmount = isHikedBill && actualReceivable > 0 ? actualReceivable : grandTotal;
              const margin = isHikedBill ? hospitalMargin : undefined;
              const isFullyPaid = effectiveAmount > 0 && paymentReceived >= effectiveAmount;
              const isPurchaseFlag = matchingDc.status === "pending" || sessionStorage.getItem("is_purchase_dc") === "true" || Boolean(matchingDc.isPurchase);

              if (isFullyPaid) {
                await transitionSavedDc(matchingDc.id, {
                  toStatus: "completed",
                  action: "MOVE_CASH_TO_COMPLETED",
                  updates: {
                    invoiceRef: invNumber,
                    cashAmount: effectiveAmount,
                    billedAmount: isHikedBill ? grandTotal : undefined,
                    hospitalMargin: margin,
                    cashRemarks: `Linked Cash Memo ${invNumber} Paid (₹${effectiveAmount}${isHikedBill ? `, Hiked: ₹${grandTotal}` : ""})`,
                    ...(isPurchaseFlag ? { isPurchase: true } : {}),
                  },
                  meta: {
                    invoiceRef: invNumber,
                    cashAmount: effectiveAmount,
                    billedAmount: isHikedBill ? grandTotal : undefined,
                    hospitalMargin: margin,
                    cashRemarks: `Linked Cash Memo ${invNumber} Paid (₹${effectiveAmount}${isHikedBill ? `, Hiked: ₹${grandTotal}` : ""})`,
                    isPurchase: isPurchaseFlag,
                  },
                });
              } else {
                await transitionSavedDc(matchingDc.id, {
                  toStatus: "cash",
                  action: "MOVE_TO_CASH",
                  updates: {
                    invoiceRef: invNumber,
                    cashAt: new Date().toISOString(),
                    cashAmount: effectiveAmount,
                    billedAmount: isHikedBill ? grandTotal : undefined,
                    hospitalMargin: margin,
                    cashRemarks: `Linked Cash Memo ${invNumber} (${isHikedBill ? `Expected Cash: ₹${effectiveAmount}, Hiked: ₹${grandTotal}` : "Unpaid"})`,
                    ...(isPurchaseFlag ? { isPurchase: true } : {}),
                  },
                  meta: {
                    invoiceRef: invNumber,
                    cashAt: new Date().toISOString(),
                    cashAmount: effectiveAmount,
                    billedAmount: isHikedBill ? grandTotal : undefined,
                    hospitalMargin: margin,
                    cashRemarks: `Linked Cash Memo ${invNumber} (${isHikedBill ? `Expected Cash: ₹${effectiveAmount}, Hiked: ₹${grandTotal}` : "Unpaid"})`,
                    isPurchase: isPurchaseFlag,
                  },
                });
              }
            }
          } catch (syncErr) {
            console.error("Error auto-linking cash invoice to DC:", syncErr);
          }
        }

        setSaveProgress(100);
        setSaveStatusText("✓ Cash Memo Saved Successfully!");
        toast.success(`Cash Memo #${invNumber} saved!`);

        // Refresh invoices in state
        const refreshed = await fetchCashInvoicesFromFirestore();
        setSavedInvoices(refreshed);

        if (andPrint) {
          setTimeout(() => {
            printCashMemo(currentInvoiceData);
          }, 300);
        }

        setTimeout(() => {
          setIsSaving(false);
          setSaveProgress(0);

          // Clear all invoice data & prepare fresh draft
          resetInvoiceForm(refreshed, false);

          const fromDcTracker = sessionStorage.getItem("from_dc_tracker") === "true";
          if (fromDcTracker) {
            sessionStorage.removeItem("from_dc_tracker");
            sessionStorage.removeItem("is_purchase_dc");
            const effectiveAmount = isHikedBill && actualReceivable > 0 ? actualReceivable : grandTotal;
            const isFullyPaid = effectiveAmount > 0 && paymentReceived >= effectiveAmount;
            navigate(isFullyPaid ? "/saved?queue=completed" : "/saved?queue=cash");
          } else {
            // Take to saved invoices tab
            setActiveTab("saved");
          }
        }, 850);

        return true;
      } else {
        setSaveStatusText("✕ Failed to Save");
        toast.error("Failed to save cash invoice to cloud");
        setIsSaving(false);
        return false;
      }
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Error saving cash invoice");
      setIsSaving(false);
      return false;
    }
  };

  // Direct Print with item validation
  const handleDirectPrint = () => {
    const validItems = items.filter((i) => (i.description || "").trim().length > 0);
    if (validItems.length === 0) {
      toast.error("At least one item must be added to save or print the cash invoice.");
      return;
    }
    printCashMemo(currentInvoiceData);
  };

  // Load a saved invoice into the editor
  const handleEditSavedInvoice = (inv: CashInvoiceData) => {
    setInvNumber(inv.invNumber || "");
    setDcNumber(inv.dcNumber || "");
    setInvDate(inv.invDate || new Date().toISOString().split("T")[0]);
    setClientName(inv.clientName || "");
    setClientAddress(inv.clientAddress || "");
    setClientMobile(inv.clientMobile || "");
    setClientEmail(inv.clientEmail || "");
    setDiscount(Number(inv.discount) || 0);
    setIsHikedBill(Boolean(inv.isHikedBill));
    setActualReceivable(Number(inv.actualReceivable) || 0);
    setPaymentReceived(Number(inv.paymentReceived) || 0);

    const rawList = Array.isArray(inv.items) && inv.items.length > 0
      ? inv.items
      : Array.isArray((inv as any).invoiceItems)
        ? (inv as any).invoiceItems
        : [];

    const loadedItems: InvoiceItem[] =
      rawList.length > 0
        ? rawList.map((i: any, idx: number) => ({
            id: `loaded-${idx}-${Date.now()}`,
            description: i.description || i.name || "",
            note: i.note || i.subDescription || "",
            subDescription: i.note || i.subDescription || "",
            sku: i.sku || "",
            size: i.size || "",
            qty: Number(i.qty) || 1,
            rate: Number(i.rate) || 0,
            amount: Number(i.amount) || (Number(i.qty) || 1) * (Number(i.rate) || 0),
          }))
        : [
            {
              id: `item-${Date.now()}`,
              description: "",
              note: "",
              subDescription: "",
              size: "",
              qty: 1,
              rate: 0,
              amount: 0,
            },
          ];

    setItems(loadedItems);
    setActiveTab("editor");
    toast.info(`Loaded Cash Memo #${inv.invNumber} into editor`);
  };

  // Delete invoice
  const handleDeleteInvoice = async (invNum: string) => {
    if (!window.confirm(`Are you sure you want to delete Cash Memo #${invNum}?`)) {
      return;
    }
    const success = await deleteCashInvoiceFromFirestore(invNum);
    if (success) {
      setSavedInvoices((prev) => prev.filter((i) => i.invNumber !== invNum));
      toast.success(`Cash Memo #${invNum} deleted.`);
    } else {
      toast.error("Failed to delete cash memo.");
    }
  };

  // Open Record Payment Modal (DC Tracker Style)
  const openPaymentModal = (inv: CashInvoiceData) => {
    setPayingInvoice(inv);
    const effDue = inv.isHikedBill && inv.actualReceivable ? Number(inv.actualReceivable) : Number(inv.grandTotal);
    const balance = Math.max(0, effDue - (Number(inv.paymentReceived) || 0));
    setPaymentAmountInput(balance > 0 ? String(balance) : "");
    setPaymentMethod("cash");
    setPaymentCollectedBy("Self");
    setPaymentRemarksInput("");
    setSelectedCreditTxId(null);
    if (sortedBankAccounts.length > 0) {
      setSelectedBankAccountId(sortedBankAccounts[0].id);
    }
    setPaymentModalOpen(true);
    loadBankTransactions();
  };

  // Confirm Payment
  const handleConfirmPayment = async () => {
    if (!payingInvoice) return;
    const payAmt = parseFloat(paymentAmountInput) || 0;
    if (payAmt <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    if (paymentMethod === "cash" && !paymentCollectedBy.trim()) {
      toast.error("Please select or enter who collected the cash");
      return;
    }

    const currentPaid = Number(payingInvoice.paymentReceived) || 0;
    const newPaid = currentPaid + payAmt;
    const effDue = payingInvoice.isHikedBill && payingInvoice.actualReceivable ? Number(payingInvoice.actualReceivable) : Number(payingInvoice.grandTotal);
    const isFullyPaid = newPaid >= effDue;
    const newStatus = isFullyPaid ? "paid" : "partial";
    const selectedModeStr = paymentMethod === "cash" ? `Cash (Collected by ${paymentCollectedBy.trim()})` : `Bank Transfer / UPI`;

    // Record cash payment to Cash In Hand treasury if cash
    if (paymentMethod === "cash") {
      try {
        await recordCashPaymentToCashInHand(
          {
            id: payingInvoice.invNumber,
            dcNo: payingInvoice.dcNumber || payingInvoice.invNumber,
            hospitalName: payingInvoice.clientName,
            invoiceRef: payingInvoice.invNumber,
          },
          payAmt,
          paymentCollectedBy.trim()
        );
      } catch (cashErr) {
        console.error("Error recording cash payment to Cash In Hand:", cashErr);
      }
    }

    const updatedInvoice: CashInvoiceData = {
      ...payingInvoice,
      paymentReceived: newPaid,
      status: newStatus,
      paymentNote: paymentRemarksInput.trim() || undefined,
      paymentMode: selectedModeStr,
      paymentAt: new Date().toISOString(),
    };

    const success = await saveCashInvoiceToFirestore(updatedInvoice);
    if (success) {
      // Sync DC if linked
      if (payingInvoice.dcNumber) {
        try {
          const dcs = await loadSavedDcs();
          const matchingDc = dcs.find(
            (d) => d.dcNo && d.dcNo.trim().toLowerCase() === payingInvoice.dcNumber?.trim().toLowerCase()
          );
          if (matchingDc) {
            if (isFullyPaid) {
              await transitionSavedDc(matchingDc.id, {
                toStatus: "completed",
                action: "MOVE_CASH_TO_COMPLETED",
                updates: {
                  invoiceRef: payingInvoice.invNumber,
                  cashAmount: effDue,
                  cashRemarks: `Cash Memo ${payingInvoice.invNumber} Paid (₹${effDue}) via ${selectedModeStr}`,
                },
                meta: {
                  invoiceRef: payingInvoice.invNumber,
                  cashAmount: effDue,
                  cashRemarks: `Cash Memo ${payingInvoice.invNumber} Paid (₹${effDue}) via ${selectedModeStr}`,
                },
              });
            } else {
              await transitionSavedDc(matchingDc.id, {
                toStatus: "cash",
                action: "MOVE_TO_CASH",
                updates: {
                  invoiceRef: payingInvoice.invNumber,
                  cashAmount: effDue,
                  cashRemarks: `Cash Memo ${payingInvoice.invNumber} Partial Paid (₹${newPaid}/₹${effDue}) via ${selectedModeStr}`,
                },
              });
            }
          }
        } catch (e) {
          console.error("DC sync error after payment:", e);
        }
      }

      toast.success(`Payment of ₹${payAmt.toLocaleString("en-IN")} recorded successfully!`);
      setPaymentModalOpen(false);
      setPayingInvoice(null);
      // Reload invoices
      const refreshed = await fetchCashInvoicesFromFirestore();
      setSavedInvoices(refreshed);
    } else {
      toast.error("Failed to record payment.");
    }
  };

  // Filtered Saved Invoices
  const filteredInvoices = useMemo(() => {
    return savedInvoices.filter((inv) => {
      const q = savedSearchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        (inv.invNumber && inv.invNumber.toLowerCase().includes(q)) ||
        (inv.dcNumber && inv.dcNumber.toLowerCase().includes(q)) ||
        (inv.clientName && inv.clientName.toLowerCase().includes(q));

      if (!matchQuery) return false;

      const effDue = inv.isHikedBill && inv.actualReceivable ? Number(inv.actualReceivable) : Number(inv.grandTotal);
      const isPaid = effDue > 0 && (Number(inv.paymentReceived) || 0) >= effDue;

      if (statusFilter === "paid") return isPaid;
      if (statusFilter === "pending") return !isPaid;
      return true;
    });
  }, [savedInvoices, savedSearchQuery, statusFilter]);

  // KPI Metrics
  const kpi = useMemo(() => {
    let totalBilled = 0;
    let totalReceived = 0;
    let paidCount = 0;
    let pendingCount = 0;

    savedInvoices.forEach((inv) => {
      const effDue = inv.isHikedBill && inv.actualReceivable ? Number(inv.actualReceivable) : Number(inv.grandTotal);
      const paid = Number(inv.paymentReceived) || 0;
      totalBilled += effDue;
      totalReceived += Math.min(paid, effDue);
      if (effDue > 0 && paid >= effDue) {
        paidCount++;
      } else {
        pendingCount++;
      }
    });

    const outstanding = Math.max(0, totalBilled - totalReceived);

    return {
      totalInvoices: savedInvoices.length,
      paidCount,
      pendingCount,
      totalBilled,
      totalReceived,
      outstanding,
    };
  }, [savedInvoices]);

  // Autocomplete Suggestions for Customers (shows directory on focus)
  const customerSuggestions = useMemo(() => {
    const q = customerSearchQuery.toLowerCase().trim();
    if (!q) {
      return customers.slice(0, 15);
    }
    return customers
      .filter(
        (c) =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.address || "").toLowerCase().includes(q) ||
          (c.mobile || c.phone || "").includes(q)
      )
      .slice(0, 15);
  }, [customers, customerSearchQuery]);

  // Autocomplete Suggestions for Items from dynamic catalog (shows popular/all items on empty search)
  const itemSuggestions = useMemo(() => {
    return searchImplantDescriptions(catalog, itemSearchQuery, 20);
  }, [catalog, itemSearchQuery]);

  const handleSelectDescription = (index: number, desc: string) => {
    handleItemChange(index, "description", desc);
    const available = getSizesForDescription(catalog, desc);
    if (available.length === 1) {
      handleItemChange(index, "size", available[0].size);
      if (available[0].price > 0) {
        handleItemChange(index, "rate", available[0].price);
      }
      if (available[0].sku) {
        handleItemChange(index, "sku", available[0].sku);
      }
    } else if (available.length > 1) {
      setActiveSizeRowIndex(index);
      setSizeSearchQuery("");
    } else {
      const priceInfo = getCatalogItemPrice(catalog, desc);
      if (priceInfo.price > 0) {
        handleItemChange(index, "rate", priceInfo.price);
      }
      if (priceInfo.sku) {
        handleItemChange(index, "sku", priceInfo.sku);
      }
    }
    setActiveItemRowIndex(null);
  };

  return (
    <div className="w-full flex-1 flex flex-col space-y-4 font-sans text-foreground">
      {/* Full-Screen Loading Overlay with Progress Bar */}
      {isSaving && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/75 dark:bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200 select-none">
          {/* Top animated thin edge indicator */}
          <div className="fixed top-0 left-0 right-0 h-1.5 bg-teal-950/40 overflow-hidden z-10">
            <div
              className="h-full bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-500 transition-all duration-300 ease-out"
              style={{ width: `${saveProgress}%` }}
            />
          </div>

          {/* Central Premium Loading Card */}
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-teal-500/30 dark:border-teal-700/50 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl flex flex-col items-center text-center space-y-5 animate-in zoom-in-95 duration-200">
            {/* Animated Icon Glow Container */}
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-teal-500/20 blur-xl animate-pulse" />
              <div className="relative w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-950/80 border border-teal-300 dark:border-teal-700/60 flex items-center justify-center shadow-inner">
                {saveProgress < 100 ? (
                  <div className="w-8 h-8 rounded-full border-3 border-teal-600 dark:border-teal-400 border-t-transparent animate-spin" />
                ) : (
                  <CheckCircle2 className="w-9 h-9 text-emerald-600 dark:text-emerald-400 animate-in zoom-in duration-200" />
                )}
              </div>
            </div>

            {/* Header Text */}
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold font-sans text-slate-900 dark:text-white tracking-tight">
                {saveProgress < 100 ? "Saving Cash Memo..." : "Cash Memo Saved!"}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium px-2">
                {saveStatusText || "Synchronizing data with cloud & DC records..."}
              </p>
            </div>

            {/* Main Progress Bar */}
            <div className="w-full space-y-2">
              <div className="w-full h-3.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-border/80 shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-600 shadow-sm transition-all duration-300 ease-out relative overflow-hidden"
                  style={{ width: `${saveProgress}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>
              <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground px-1">
                <span>{saveProgress < 100 ? "Saving in progress..." : "Switching to Saved Invoices..."}</span>
                <span className="font-mono text-teal-600 dark:text-teal-400 font-bold">{saveProgress}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-700 flex items-center justify-center text-teal-800 dark:text-teal-200 shadow-sm shrink-0">
            <Receipt className="w-5 h-5 text-teal-700 dark:text-teal-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold font-sans text-foreground tracking-tight">
                Cash Invoice &amp; Memos
              </h1>
              <Badge variant="outline" className="bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300 border-teal-300 text-[11px] font-bold rounded-full">
                Native Tool
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Create, calculate, print, and track cash invoices seamlessly with live DC synchronization.
            </p>
          </div>
        </div>

        {/* Tab switcher buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full sm:w-auto">
            <TabsList className="grid grid-cols-3 w-full sm:w-[380px] h-9 rounded-lg">
              <TabsTrigger value="editor" className="text-xs font-semibold gap-1.5 rounded-md">
                <Edit className="w-3.5 h-3.5" /> Editor
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs font-semibold gap-1.5 rounded-md">
                <Eye className="w-3.5 h-3.5" /> A4 Preview
              </TabsTrigger>
              <TabsTrigger value="saved" className="text-xs font-semibold gap-1.5 rounded-md">
                <FileText className="w-3.5 h-3.5" /> Saved ({savedInvoices.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* TAB 1: INVOICE EDITOR */}
      {activeTab === "editor" && (
        <div className="cash-memo-square">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Form & Items (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Invoice Meta Card */}
            <Card className="border-border shadow-sm rounded-none">
              <CardHeader className="py-3 px-4 border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <CardTitle className="text-sm font-bold">Invoice Details</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleClearInvoice}
                      className="h-7 text-xs gap-1 rounded-none"
                    >
                      <RotateCcw className="w-3 h-3" /> New / Reset
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      Bill Number *
                    </Label>
                    <Input
                      type="text"
                      value={invNumber}
                      onChange={(e) => setInvNumber(e.target.value)}
                      className="font-mono font-bold text-sm h-9 rounded-none"
                      placeholder="SRR-2026-0001"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      Linked DC Number
                    </Label>
                    <div className="relative">
                      <Input
                        type="text"
                        value={dcNumber}
                        onChange={(e) => setDcNumber(e.target.value)}
                        className="font-mono text-xs h-9 uppercase rounded-none"
                        placeholder="e.g. DC-1042"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        data-form-type="other"
                        aria-autocomplete="none"
                      />
                      {matchingDcForCurrentNo && (
                        <span className="absolute right-2 top-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Linked
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      Invoice Date
                    </Label>
                    <Input
                      type="date"
                      value={invDate}
                      onChange={(e) => setInvDate(e.target.value)}
                      className="text-xs h-9 rounded-none"
                    />
                  </div>
                </div>

                {/* Import items from linked DC banner */}
                {matchingDcForCurrentNo && matchingDcForCurrentNo.items.length > 0 && (
                  <div className="p-2.5 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-none flex items-center justify-between text-xs">
                    <div className="text-teal-900 dark:text-teal-200">
                      <strong>Found DC #{matchingDcForCurrentNo.dcNo}</strong> ({matchingDcForCurrentNo.hospitalName}) with{" "}
                      {matchingDcForCurrentNo.items.length} listed implants.
                    </div>
                    <Button
                      size="sm"
                      onClick={handleImportItemsFromDc}
                      className="h-7 text-xs bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-none"
                    >
                      Import Items
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bill To Customer Card */}
            <Card className="border-border shadow-sm rounded-none">
              <CardHeader className="py-3 px-4 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <CardTitle className="text-sm font-bold">Bill To (Customer / Hospital)</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="relative customer-autocomplete">
                  <div className="flex justify-between items-center mb-1">
                    <Label className="text-xs font-semibold text-muted-foreground block">
                      Hospital / Customer Name *
                    </Label>
                    {customers.length > 0 && (
                      <span className="text-[10px] text-teal-700 dark:text-teal-400 font-mono">
                        {customers.length} registered
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      type="text"
                      value={clientName}
                      onChange={(e) => {
                        setClientName(e.target.value);
                        setCustomerSearchQuery(e.target.value);
                        setShowCustomerDropdown(true);
                      }}
                      onFocus={() => {
                        setCustomerSearchQuery(clientName);
                        setShowCustomerDropdown(true);
                      }}
                      onClick={() => {
                        setShowCustomerDropdown(true);
                      }}
                      className="font-semibold text-sm h-9 rounded-none"
                      placeholder="Search or enter hospital / doctor name..."
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      data-form-type="other"
                      aria-autocomplete="none"
                    />
                  </div>

                  {/* Customer Autocomplete Dropdown */}
                  {showCustomerDropdown && customerSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-none shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                      <div className="px-3 py-1.5 text-[10px] font-bold text-teal-800 dark:text-teal-300 uppercase bg-teal-50 dark:bg-teal-950/80 border-b border-border flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
                        <span>Directory ({customerSuggestions.length} matches)</span>
                        <span className="text-[9px] text-muted-foreground font-normal">Click to select</span>
                      </div>
                      {customerSuggestions.map((cust, cIdx) => (
                        <div
                          key={cust.id || `cust-${cIdx}`}
                          className="px-3 py-2 text-xs hover:bg-teal-50 dark:hover:bg-teal-950/60 cursor-pointer border-b border-border/50 last:border-0 transition-colors"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setClientName(cust.name);
                            setCustomerSearchQuery(cust.name);
                            if (cust.address) setClientAddress(cust.address);
                            if (cust.mobile || cust.phone) setClientMobile(cust.mobile || cust.phone || "");
                            if (cust.email) setClientEmail(cust.email);
                            setShowCustomerDropdown(false);
                          }}
                        >
                          <div className="font-bold text-foreground">{cust.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {cust.address || cust.mobile || cust.phone || "No additional info"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      Address
                    </Label>
                    <Input
                      type="text"
                      value={clientAddress}
                      onChange={(e) => setClientAddress(e.target.value)}
                      className="text-xs h-9 rounded-none"
                      placeholder="Clinic / Hospital address"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      Mobile Number
                    </Label>
                    <Input
                      type="text"
                      value={clientMobile}
                      onChange={(e) => setClientMobile(e.target.value)}
                      className="text-xs h-9 rounded-none"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      Email
                    </Label>
                    <Input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="text-xs h-9 rounded-none"
                      placeholder="doctor@hospital.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Line Items Table Card */}
            <Card className="border-border shadow-sm overflow-hidden rounded-none">
              <CardHeader className="py-3 px-4 border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <CardTitle className="text-sm font-bold">Line Items ({items.length})</CardTitle>
                  </div>
                  <Button
                    size="sm"
                    onClick={addItemRow}
                    className="h-7 text-xs bg-teal-700 hover:bg-teal-800 text-white font-semibold gap-1 rounded-none"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Row
                  </Button>
                </div>
              </CardHeader>

              <div className="overflow-x-auto min-h-[360px] pb-24">
                <table className="w-full text-xs table-fixed min-w-[700px]">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                      <th className="p-2 text-center w-[3%]">#</th>
                      <th className="p-2 text-left w-[50%]">Item Description</th>
                      <th className="p-2 text-center w-[15%]">Size</th>
                      <th className="p-2 text-center w-[6%]">Qty</th>
                      <th className="p-2 text-right w-[14%]">Rate (₹)</th>
                      <th className="p-2 text-right w-[9%]">Amount (₹)</th>
                      <th className="p-2 text-center w-[3%]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((item, index) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-muted/20 ${activeItemRowIndex === index || activeSizeRowIndex === index ? "relative z-30" : "relative z-0"}`}
                      >
                        <td className="p-2 text-center text-muted-foreground font-mono">
                          {index + 1}
                        </td>
                        <td className="p-2 relative desc-cell">
                          <textarea
                            rows={(item.description || "").length > 35 ? 2 : 1}
                            value={item.description}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\r?\n/g, " ");
                              handleItemChange(index, "description", val);
                              setItemSearchQuery(val);
                              setActiveItemRowIndex(index);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                              }
                            }}
                            onFocus={() => {
                              setActiveItemRowIndex(index);
                              setItemSearchQuery(item.description);
                            }}
                            onClick={() => {
                              setActiveItemRowIndex(index);
                              setItemSearchQuery(item.description);
                            }}
                            className="min-h-[32px] text-[11px] font-semibold py-1.5 px-2 rounded-none w-full leading-snug resize-none bg-background border border-input focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring break-words"
                            placeholder="Search or pick implant..."
                            autoComplete="off"
                          />
                          <div className="mt-1">
                            <Input
                              type="text"
                              value={item.note || item.subDescription || ""}
                              onChange={(e) => {
                                handleItemChange(index, "note", e.target.value);
                                handleItemChange(index, "subDescription", e.target.value);
                              }}
                              onFocus={() => setActiveItemRowIndex(null)}
                              className="h-6 text-[10px] text-muted-foreground placeholder:text-muted-foreground/60 rounded-none w-full border border-dashed border-border/80 bg-muted/20 focus-visible:bg-background focus-visible:text-foreground focus-visible:border-solid px-2 font-normal"
                              placeholder="Item note / description (e.g. batch, remarks)..."
                              autoComplete="off"
                            />
                          </div>
                          {/* Item Autocomplete */}
                          {activeItemRowIndex === index && itemSuggestions.length > 0 && (
                            <div className="absolute top-full left-2 right-2 z-50 bg-card border border-border rounded-none shadow-2xl max-h-64 overflow-y-auto">
                              <div className="px-2.5 py-1.5 text-[10px] font-bold text-teal-800 dark:text-teal-300 uppercase bg-teal-50 dark:bg-teal-950/80 border-b border-border flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
                                <span>📋 Catalog Products ({catalog.length.toLocaleString()} items)</span>
                                <span className="text-[9px] text-muted-foreground font-normal">Click to select</span>
                              </div>
                              {itemSuggestions.map((sug, sIdx) => (
                                <div
                                  key={sIdx}
                                  className="px-2.5 py-2 text-xs hover:bg-teal-50 dark:hover:bg-teal-950/60 cursor-pointer flex justify-between items-center transition-colors border-b border-border/40 last:border-0"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectDescription(index, sug.description);
                                  }}
                                >
                                  <span className="font-semibold text-foreground">{sug.description}</span>
                                  <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1.5 shrink-0 ml-2">
                                    {sug.sizeCount > 0 ? (
                                      <span className="text-teal-700 dark:text-teal-400 font-bold bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.5 border border-teal-200 dark:border-teal-800">
                                        {sug.sizeCount} {sug.sizeCount === 1 ? "size" : "sizes"}
                                      </span>
                                    ) : (
                                      sug.samplePrice > 0 && <span className="font-bold text-foreground">₹{sug.samplePrice}</span>
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-2 relative size-cell">
                          <Input
                            type="text"
                            value={item.size}
                            onChange={(e) => {
                              handleItemChange(index, "size", e.target.value);
                              setActiveSizeRowIndex(index);
                              setSizeSearchQuery(e.target.value);
                            }}
                            onFocus={() => {
                              setActiveSizeRowIndex(index);
                              setSizeSearchQuery("");
                            }}
                            onClick={() => {
                              setActiveSizeRowIndex(index);
                              setSizeSearchQuery("");
                            }}
                            className="h-8 text-[11px] text-center rounded-none font-medium w-full"
                            placeholder={getSizesForDescription(catalog, item.description).length > 0 ? "Select size..." : "Size"}
                            autoComplete="off"
                          />
                          {/* Size Recommendations Dropdown */}
                          {activeSizeRowIndex === index && getSizesForDescription(catalog, item.description, sizeSearchQuery).length > 0 && (
                            <div className="absolute top-full left-0 min-w-[220px] max-h-60 overflow-y-auto z-50 bg-card border border-border shadow-2xl rounded-none py-1">
                              <div className="px-2.5 py-1 text-[10px] font-bold text-muted-foreground uppercase bg-muted/60 border-b border-border flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
                                <span>Available Sizes</span>
                                <span className="text-teal-700 dark:text-teal-400 font-mono font-bold">
                                  ({getSizesForDescription(catalog, item.description, sizeSearchQuery).length})
                                </span>
                              </div>
                              {getSizesForDescription(catalog, item.description, sizeSearchQuery).map((sugSize, sIdx) => (
                                <div
                                  key={sIdx}
                                  className="px-2.5 py-1.5 text-xs hover:bg-teal-50 dark:hover:bg-teal-950/60 cursor-pointer flex justify-between items-center transition-colors border-b border-border/30 last:border-0"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleItemChange(index, "size", sugSize.size);
                                    if (sugSize.price > 0) {
                                      handleItemChange(index, "rate", sugSize.price);
                                    }
                                    if (sugSize.sku) {
                                      handleItemChange(index, "sku", sugSize.sku);
                                    }
                                    setActiveSizeRowIndex(null);
                                  }}
                                >
                                  <span className="font-semibold text-foreground">{sugSize.size}</span>
                                  {sugSize.price > 0 && (
                                    <span className="text-[11px] text-teal-700 dark:text-teal-400 font-mono font-bold ml-2">
                                      ₹{sugSize.price.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          <Input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => handleItemChange(index, "qty", parseInt(e.target.value) || 0)}
                            className="h-8 text-[11px] text-center font-bold rounded-none w-full mx-auto px-1"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={item.rate || ""}
                            onChange={(e) => handleItemChange(index, "rate", parseFloat(e.target.value) || 0)}
                            className="h-8 text-[11px] text-right font-mono rounded-none w-full"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="p-2 text-right font-bold font-mono text-[11px] text-foreground truncate">
                          ₹{(item.amount || 0).toFixed(2)}
                        </td>
                        <td className="p-2 text-center">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeItemRow(index)}
                            className="h-7 w-7 text-muted-foreground hover:text-red-600 rounded-none"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-2.5 bg-muted/20 border-t border-border flex justify-between items-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addItemRow}
                  className="h-7 text-xs font-semibold gap-1 rounded-none"
                >
                  <Plus className="w-3 h-3" /> Add Another Row
                </Button>
                <div className="text-xs text-muted-foreground">
                  Subtotal: <strong className="text-foreground">₹{subtotal.toFixed(2)}</strong>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Totals, Hospital Markup, QR & Action Bar (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Calculation & Totals Card */}
            <Card className="border-border shadow-sm rounded-none">
              <CardHeader className="py-3 px-4 border-b border-border bg-muted/30">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span>Billing Summary</span>
                  <Badge variant="outline" className="text-[10px] font-mono font-bold bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border-teal-300 rounded-none">
                    INR (₹)
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-semibold font-mono">₹{subtotal.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center gap-2">
                    <span className="text-muted-foreground">Flat Discount (₹):</span>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={discount || ""}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      className="w-28 h-7 text-right text-xs font-mono rounded-none"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="border-t border-border pt-2 flex justify-between items-center text-sm">
                    <span className="font-black text-teal-900 dark:text-teal-300">Grand Total:</span>
                    <span className="font-black font-mono text-base text-teal-900 dark:text-teal-300">
                      ₹{grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Amount in words */}
                <div className="p-2.5 bg-muted/40 rounded-none border border-border/80 text-[11px] text-muted-foreground">
                  Amount in Words:
                  <div className="font-bold text-foreground mt-0.5 leading-snug">{words}</div>
                </div>

                {/* Hospital Hiked Bill Widget */}
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-none space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="hiked-switch" className="text-xs font-bold text-amber-900 dark:text-amber-300 cursor-pointer flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      Hospital Hiked Bill?
                    </Label>
                    <Switch
                      id="hiked-switch"
                      checked={isHikedBill}
                      onCheckedChange={setIsHikedBill}
                      className="rounded-none"
                    />
                  </div>

                  {isHikedBill && (
                    <div className="pt-2 border-t border-amber-200 dark:border-amber-800 space-y-2 animate-in fade-in duration-200">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                          Our Actual Cash Due (₹):
                        </span>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={actualReceivable || ""}
                          onChange={(e) => setActualReceivable(parseFloat(e.target.value) || 0)}
                          className="w-28 h-7 text-right text-xs font-bold font-mono bg-white dark:bg-slate-900 border-amber-400 rounded-none"
                          placeholder="Net Due"
                        />
                      </div>

                      {hospitalMargin > 0 && (
                        <div className="flex justify-between items-center text-xs font-bold text-amber-800 dark:text-amber-300">
                          <span>Hospital Margin / Cut:</span>
                          <span className="font-mono">₹{hospitalMargin.toFixed(2)}</span>
                        </div>
                      )}

                      <p className="text-[10px] text-amber-800 dark:text-amber-400 leading-tight">
                        <em>Printed memo shows ₹{grandTotal.toFixed(2)}. Internal DC &amp; Cash tracker will only expect ₹{actualReceivable > 0 ? actualReceivable.toFixed(2) : "0.00"}.</em>
                      </p>
                    </div>
                  )}
                </div>

                {/* UPI QR & Bank */}
                <div className="p-3 bg-card border border-border rounded-none flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold uppercase text-teal-700 dark:text-teal-400">
                      UPI QR Code
                    </div>
                    <div className="text-xs font-bold truncate font-mono text-foreground">
                      {DEFAULT_COMPANY.upi}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Payable: ₹{grandTotal.toFixed(2)}
                    </div>
                  </div>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(`upi://pay?pa=${DEFAULT_COMPANY.upi}&pn=SRR%20ORTHO%20PLUS&am=${grandTotal.toFixed(2)}&cu=INR`)}`}
                    alt="UPI QR"
                    className="w-14 h-14 rounded-none border border-border shrink-0"
                  />
                </div>

                {/* Primary Action Buttons */}
                <div className="space-y-2 pt-2">
                  {items.filter((i) => (i.description || "").trim().length > 0).length === 0 && (
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-none flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>At least 1 item is required to save or print.</span>
                    </div>
                  )}

                  <Button
                    onClick={() => handleSaveInvoice(false)}
                    disabled={isSaving}
                    className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold h-10 gap-2 shadow-md rounded-none"
                  >
                    <Save className="w-4 h-4" /> Save Cash Memo
                  </Button>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => handleSaveInvoice(true)}
                      disabled={isSaving}
                      variant="outline"
                      className="border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-teal-800 dark:text-teal-300 font-bold h-9 text-xs gap-1.5 rounded-none"
                    >
                      <Printer className="w-3.5 h-3.5" /> Save &amp; Print
                    </Button>
                    <Button
                      onClick={handleDirectPrint}
                      variant="outline"
                      className="border-border hover:bg-muted font-bold h-9 text-xs gap-1.5 rounded-none"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print / PDF
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      )}

      {/* TAB 2: A4 LIVE PREVIEW */}
      {activeTab === "preview" && (
        <div className="space-y-4">
          <CashInvoicePreview
            invoice={currentInvoiceData}
            onPrint={handleDirectPrint}
            showPrintButton={true}
          />
        </div>
      )}

      {/* TAB 3: SAVED CASH MEMOS */}
      {activeTab === "saved" && (
        <div className="space-y-4">
          {/* Top Bar with Back to Cash Memo button */}
          <div className="flex items-center justify-between">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTab("editor")}
              className="h-8 text-xs font-semibold gap-1.5 border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/50 rounded-md"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Cash Memo
            </Button>
            <div className="text-xs text-muted-foreground font-medium">
              Showing {filteredInvoices.length} cash memos
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-border shadow-sm p-4 rounded-xl">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Total Invoices
              </div>
              <div className="text-xl sm:text-2xl font-black font-sans text-foreground mt-1">
                {kpi.totalInvoices}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {kpi.paidCount} Paid &bull; {kpi.pendingCount} Pending
              </div>
            </Card>

            <Card className="border-border shadow-sm p-4 rounded-xl">
              <div className="text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                Total Billed
              </div>
              <div className="text-xl sm:text-2xl font-black font-sans font-mono text-teal-700 dark:text-teal-400 mt-1">
                ₹{kpi.totalBilled.toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Gross cash memo value</div>
            </Card>

            <Card className="border-border shadow-sm p-4 rounded-xl">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Total Received
              </div>
              <div className="text-xl sm:text-2xl font-black font-sans font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                ₹{kpi.totalReceived.toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {kpi.totalBilled > 0
                  ? `${Math.round((kpi.totalReceived / kpi.totalBilled) * 100)}% collected`
                  : "0% collected"}
              </div>
            </Card>

            <Card className="border-border shadow-sm p-4 rounded-xl">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Outstanding Dues
              </div>
              <div className="text-xl sm:text-2xl font-black font-sans font-mono text-amber-600 dark:text-amber-400 mt-1">
                ₹{kpi.outstanding.toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Pending collection</div>
            </Card>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                autoComplete="off"
                data-lpignore="true"
                data-form-type="other"
                value={savedSearchQuery}
                onChange={(e) => setSavedSearchQuery(e.target.value)}
                placeholder="Search invoice #, DC #, customer..."
                className="pl-9 text-xs h-9 rounded-md"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-semibold">Filter:</span>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant={statusFilter === "all" ? "default" : "outline"}
                  onClick={() => setStatusFilter("all")}
                  className={`h-8 text-xs font-semibold rounded-md ${statusFilter === "all" ? "bg-teal-700 text-white" : ""}`}
                >
                  All ({savedInvoices.length})
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === "pending" ? "default" : "outline"}
                  onClick={() => setStatusFilter("pending")}
                  className={`h-8 text-xs font-semibold rounded-md ${statusFilter === "pending" ? "bg-teal-700 text-white" : ""}`}
                >
                  Pending ({kpi.pendingCount})
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === "paid" ? "default" : "outline"}
                  onClick={() => setStatusFilter("paid")}
                  className={`h-8 text-xs font-semibold rounded-md ${statusFilter === "paid" ? "bg-teal-700 text-white" : ""}`}
                >
                  Paid ({kpi.paidCount})
                </Button>
              </div>
            </div>
          </div>

          {/* Invoices List Table */}
          <Card className="border-border shadow-sm overflow-hidden rounded-xl min-h-[420px]">
            <div className="overflow-x-auto min-h-[380px]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <th className="p-3 text-left">Invoice # / DC</th>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Customer / Hospital</th>
                    <th className="p-3 text-right">Billed Total</th>
                    <th className="p-3 text-right">Paid</th>
                    <th className="p-3 text-right">Balance</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        No cash memos found matching filter.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => {
                      const effDue =
                        inv.isHikedBill && inv.actualReceivable
                          ? Number(inv.actualReceivable)
                          : Number(inv.grandTotal);
                      const paid = Number(inv.paymentReceived) || 0;
                      const balance = Math.max(0, effDue - paid);
                      const isPaid = effDue > 0 && paid >= effDue;

                      return (
                        <tr key={inv.invNumber} className="hover:bg-muted/20">
                          <td className="p-3">
                            <div className="font-bold text-foreground font-mono">
                              {inv.invNumber}
                            </div>
                            {inv.dcNumber && (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-mono bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border-teal-300 rounded-md"
                              >
                                DC #{inv.dcNumber}
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {inv.invDate
                              ? new Date(inv.invDate).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                })
                              : "-"}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-foreground">{inv.clientName}</div>
                            {inv.clientMobile && (
                              <div className="text-[11px] text-muted-foreground">
                                {inv.clientMobile}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right font-bold font-mono">
                            ₹{Number(inv.grandTotal || 0).toLocaleString("en-IN")}
                            {inv.isHikedBill && (
                              <div className="text-[10px] text-amber-600 font-semibold">
                                Actual: ₹{(Number(inv.actualReceivable) || 0).toLocaleString("en-IN")}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                            ₹{paid.toLocaleString("en-IN")}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                            ₹{balance.toLocaleString("en-IN")}
                          </td>
                          <td className="p-3 text-center">
                            {isPaid ? (
                              <Badge className="bg-emerald-600 text-white font-bold text-[10px] rounded-full">
                                PAID
                              </Badge>
                            ) : paid > 0 ? (
                              <Badge className="bg-amber-600 text-white font-bold text-[10px] rounded-full">
                                PARTIAL
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-red-400 text-red-600 font-bold text-[10px] rounded-full">
                                PENDING
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View / Print */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedInvoiceForView(inv);
                                  setViewModalOpen(true);
                                }}
                                className="h-7 text-xs px-2 gap-1 rounded-md"
                                title="View & Print"
                              >
                                <Eye className="w-3.5 h-3.5" /> View
                              </Button>

                              {/* Record Payment */}
                              {!isPaid && (
                                <Button
                                  size="sm"
                                  onClick={() => openPaymentModal(inv)}
                                  className="h-7 text-xs px-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold gap-1 rounded-md"
                                  title="Record Payment"
                                >
                                  <CreditCard className="w-3.5 h-3.5" /> Pay
                                </Button>
                              )}

                              {/* Edit in Editor */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditSavedInvoice(inv)}
                                className="h-7 text-xs px-2 gap-1 text-teal-700 dark:text-teal-400 border-teal-300 rounded-md"
                                title="Edit"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>

                              {/* Delete */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteInvoice(inv.invNumber)}
                                className="h-7 text-xs px-2 text-muted-foreground hover:text-red-600 rounded-md"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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

      {/* VIEW & PRINT MODAL */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-900 border-border rounded-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Receipt className="w-5 h-5 text-teal-700" />
              Cash Memo — {selectedInvoiceForView?.invNumber}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  if (!selectedInvoiceForView) return;
                  const validItems = (selectedInvoiceForView.items || []).filter(
                    (i) => (i.description || "").trim().length > 0
                  );
                  if (validItems.length === 0) {
                    toast.error("At least one item must be added to save or print the cash invoice.");
                    return;
                  }
                  printCashMemo(selectedInvoiceForView);
                }}
                className="bg-teal-700 hover:bg-teal-800 text-white font-bold gap-1.5 h-8 text-xs rounded-md"
              >
                <Printer className="w-3.5 h-3.5" /> Print / PDF
              </Button>
            </div>
          </DialogHeader>

          {selectedInvoiceForView && (
            <div className="space-y-4 py-2">
              {/* Payment Settlement Audit Banner if paid or partial */}
              {(Boolean(selectedInvoiceForView.paymentReceived) || Boolean(selectedInvoiceForView.paymentMode) || selectedInvoiceForView.status === "paid" || selectedInvoiceForView.status === "partial") && (() => {
                const recPaid = Number(selectedInvoiceForView.paymentReceived) || 0;
                const grand = selectedInvoiceForView.isHikedBill && Number(selectedInvoiceForView.actualReceivable) > 0
                  ? Number(selectedInvoiceForView.actualReceivable)
                  : Number(selectedInvoiceForView.grandTotal || selectedInvoiceForView.actualReceivable) || 0;
                const isPart = recPaid > 0 && recPaid < grand;
                const bal = Math.max(0, grand - recPaid);

                if (isPart || selectedInvoiceForView.status === "partial") {
                  return (
                    <div className="rounded-xl border border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-2 text-xs shadow-2xs">
                      <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-800/60 pb-2">
                        <div className="flex items-center gap-2 font-bold text-amber-950 dark:text-amber-100">
                          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>⚠️ Part Payment Record (Cash Invoice Not Matched)</span>
                          <Badge className="bg-amber-500 text-white text-[10px] uppercase font-black rounded-full px-2 py-0.5">
                            PART PAYMENT ONLY
                          </Badge>
                        </div>
                        <div className="text-right font-mono font-bold text-amber-900 dark:text-amber-200">
                          Paid: ₹{recPaid.toLocaleString("en-IN")} / Total: ₹{grand.toLocaleString("en-IN")}
                        </div>
                      </div>
                      <div className="text-[11px] text-amber-900 dark:text-amber-300 font-semibold pt-0.5">
                        ⚠️ Part payment received. Cash invoice total is <strong>NOT matched</strong> yet. Unmatched balance due: <span className="font-bold text-rose-700 dark:text-rose-400">₹{bal.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-[11px]">
                        <div>
                          <span className="text-slate-500 font-semibold block text-[10px] uppercase">Payment Mode</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {selectedInvoiceForView.paymentMode || "Cash"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-semibold block text-[10px] uppercase">Settlement Date</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {selectedInvoiceForView.paymentAt
                              ? new Date(selectedInvoiceForView.paymentAt).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })
                              : selectedInvoiceForView.invDate || "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-semibold block text-[10px] uppercase">Collected Amount</span>
                          <span className="font-bold font-mono text-emerald-700 dark:text-emerald-400">
                            ₹{recPaid.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-semibold block text-[10px] uppercase">Unmatched Balance Due</span>
                          <span className="font-bold font-mono text-rose-700 dark:text-rose-400">
                            ₹{bal.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 p-4 space-y-2 text-xs shadow-2xs">
                    <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-800/60 pb-2">
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                        <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Recorded Payment &amp; Settlement Record</span>
                        <Badge className="bg-emerald-600 text-white text-[10px] uppercase font-bold rounded-full">
                          {selectedInvoiceForView.status || "Paid"}
                        </Badge>
                      </div>
                      <div className="text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        Paid: ₹{(Number(selectedInvoiceForView.paymentReceived) || 0).toLocaleString("en-IN")}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-[11px]">
                      <div>
                        <span className="text-slate-500 font-semibold block text-[10px] uppercase">Payment Mode</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {selectedInvoiceForView.paymentMode || "Cash / Bank Transfer"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block text-[10px] uppercase">Settlement Date</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {selectedInvoiceForView.paymentAt
                            ? new Date(selectedInvoiceForView.paymentAt).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : selectedInvoiceForView.invDate || "-"}
                        </span>
                      </div>
                      {selectedInvoiceForView.paymentNote && (
                        <div className="col-span-2">
                          <span className="text-slate-500 font-semibold block text-[10px] uppercase">Notes / Reference</span>
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {selectedInvoiceForView.paymentNote}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <CashInvoicePreview
                invoice={selectedInvoiceForView}
                onPrint={() => printCashMemo(selectedInvoiceForView)}
                showPrintButton={false}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* RECORD PAYMENT MODAL (DC TRACKER PIXEL-PERFECT MATCH) */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent 
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="sm:max-w-4xl lg:max-w-5xl w-full p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 gap-0"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Record Payment Collection</DialogTitle>
            <DialogDescription>
              Record payment settlement for Cash Memo {payingInvoice?.invNumber}.
            </DialogDescription>
          </DialogHeader>

          {/* 1. TOP HEADER */}
          <div className="bg-slate-50/80 dark:bg-slate-850 border-b border-slate-200/80 dark:border-slate-800 px-5 py-4">
            <div className="flex items-start justify-between gap-3 pr-6">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                    Memo #{payingInvoice?.invNumber}
                  </span>
                  {payingInvoice?.dcNumber && (
                    <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      DC #{payingInvoice.dcNumber}
                    </span>
                  )}
                  <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Awaiting Settlement
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  Record Cash / Payment — {payingInvoice?.invNumber}
                </h3>
                <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400 mt-1 flex-wrap">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {payingInvoice?.clientName || "Customer Record"} {payingInvoice?.dcNumber ? `(DC #${payingInvoice.dcNumber})` : ""}
                  </span>
                  {payingInvoice?.clientMobile && (
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      Ph: {payingInvoice.clientMobile}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2. BODY CONTENT (2-COLUMN RESPONSIVE LAYOUT) */}
          {payingInvoice && (
            <div className="p-5 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* LEFT COLUMN: RECEIVABLE DETAILS & PAYMENT INPUTS */}
                <div className={`${paymentMethod === "bank_transfer" ? "lg:col-span-5" : "lg:col-span-12 max-w-xl mx-auto w-full"} space-y-4`}>
                  {/* Financial Receivable Banner */}
                  {payingInvoice.isHikedBill && payingInvoice.actualReceivable ? (
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
                            ₹{Number(payingInvoice.grandTotal).toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-lg border border-amber-100 dark:border-amber-900/30 text-center">
                          <span className="block text-[10px] text-amber-700 dark:text-amber-400 uppercase font-semibold">Hospital Cut</span>
                          <span className="font-bold text-amber-800 dark:text-amber-300">
                            -₹{(Number(payingInvoice.grandTotal) - Number(payingInvoice.actualReceivable)).toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200 dark:border-emerald-900/30 text-center">
                          <span className="block text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold">Net Due</span>
                          <span className="font-black text-emerald-800 dark:text-emerald-300">
                            ₹{Number(payingInvoice.actualReceivable).toLocaleString("en-IN")}
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
                          ₹{Number(payingInvoice.grandTotal).toLocaleString("en-IN")}
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
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-200 font-mono">
                          ⚡ Cash In Hand Treasury
                        </span>
                      </div>
                      <Input
                        type="text"
                        value={paymentCollectedBy}
                        onChange={(e) => setPaymentCollectedBy(e.target.value)}
                        placeholder="Select or type collector name..."
                        className="h-10 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded-xl"
                      />
                      {/* Quick Picks */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-[11px] font-medium text-slate-400 mr-0.5">Quick:</span>
                        {["Self", "Office", "Vinay", "Naresh", "Prashanth"].map((p) => {
                          const isSelected = paymentCollectedBy.trim().toLowerCase() === p.toLowerCase();
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setPaymentCollectedBy(p)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                              }`}
                            >
                              {p}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Amount Received & Remarks */}
                  <div className="grid grid-cols-1 gap-3 pt-1">
                    {/* Paid Amount */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="payment-amount" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Amount Received *
                        </Label>
                        <button
                          type="button"
                          onClick={() => {
                            const effDue = payingInvoice.isHikedBill && payingInvoice.actualReceivable ? Number(payingInvoice.actualReceivable) : Number(payingInvoice.grandTotal);
                            const bal = Math.max(0, effDue - (Number(payingInvoice.paymentReceived) || 0));
                            setPaymentAmountInput(String(bal));
                          }}
                          className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline font-bold cursor-pointer"
                        >
                          Full Due
                        </button>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">
                          ₹
                        </span>
                        <Input
                          id="payment-amount"
                          type="number"
                          value={paymentAmountInput}
                          onChange={(e) => setPaymentAmountInput(e.target.value)}
                          placeholder="0"
                          className="pl-7 h-10 font-bold text-sm bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded-xl"
                        />
                      </div>
                    </div>

                    {/* Payment Remarks */}
                    <div className="space-y-1.5">
                      <Label htmlFor="payment-remarks" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Notes / Ref <span className="font-normal text-slate-400">(Optional)</span>
                      </Label>
                      <Input
                        id="payment-remarks"
                        type="text"
                        value={paymentRemarksInput}
                        onChange={(e) => setPaymentRemarksInput(e.target.value)}
                        placeholder={paymentMethod === "cash" ? "e.g. Received at clinic" : "e.g. UTR / NEFT Ref"}
                        className="h-10 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: BANK CREDIT LINKING & MATCHING PANEL (When Bank Transfer is active) */}
                {paymentMethod === "bank_transfer" && (
                  <div className="lg:col-span-7 bg-slate-50/80 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
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
                          const accSuffix = acc.accountNumber ? acc.accountNumber.slice(-4) : (acc.accountName.match(/\d{4}/)?.[0] || "");
                          const is1538 = accSuffix === "1538" || acc.id.includes("1538");

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
                              <span>{acc.bankName || acc.accountName.split("(")[0].trim()}</span>
                              {accSuffix && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                                  isSelected ? "bg-black/20 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                }`}>
                                  ({accSuffix})
                                </span>
                              )}
                              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                                isSelected ? "bg-black/20 text-white" : "bg-indigo-50 text-indigo-700 dark:bg-slate-800 dark:text-slate-200"
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
                            selectedBankAccountId === "all" ? "bg-indigo-700 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          }`}>
                            {availableBankCredits.length}
                          </span>
                        </button>
                      </div>
                    </div>

                    {isLoadingBankCredits ? (
                      <div className="p-4 bg-indigo-50/50 dark:bg-slate-900/60 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/30">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Fetching live bank statement credits...</span>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {filteredBankCredits.map((tx) => {
                          const isSelected = selectedCreditTxId === tx.id;
                          const invAmount = payingInvoice.isHikedBill && payingInvoice.actualReceivable ? Number(payingInvoice.actualReceivable) : Number(payingInvoice.grandTotal);
                          const isAmountMatch = Math.abs(tx.amount - invAmount) < 10;
                          const clientName = (payingInvoice.clientName || "").toLowerCase().trim();
                          const desc = (tx.description || "").toLowerCase();
                          const isClientMatch = clientName.length > 2 && desc.includes(clientName);
                          const isMatch = isAmountMatch || isClientMatch;

                          return (
                            <div
                              key={tx.id}
                              onClick={() => {
                                setSelectedCreditTxId(tx.id);
                                if (tx.amount) setPaymentAmountInput(String(tx.amount));
                                if (tx.referenceNumber) setPaymentRemarksInput(tx.referenceNumber);
                              }}
                              className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                                isSelected
                                  ? "border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 ring-2 ring-indigo-500/20 shadow-xs"
                                  : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-850"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}>
                                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                  <div>
                                    <span className="font-bold text-slate-800 dark:text-slate-100 block">
                                      {tx.description || "Bank Credit Deposit"}
                                    </span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono mt-0.5">
                                      {tx.date} {tx.time ? `• ${tx.time}` : ""} {tx.referenceNumber ? `• Ref: ${tx.referenceNumber}` : ""}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm font-mono block">
                                      +₹{tx.amount.toLocaleString("en-IN")}
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
                                  {isMatch && (
                                    <Badge className="text-[9px] px-1.5 py-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-0 font-bold">
                                      🎯 Match Candidate
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* NOT FOUND OPTION AT LAST */}
                        <div
                          onClick={() => setSelectedCreditTxId("not_found")}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                            selectedCreditTxId === "not_found"
                              ? "border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 ring-2 ring-amber-500/20 shadow-xs"
                              : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-850"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${selectedCreditTxId === "not_found" ? "border-amber-600 bg-amber-600 text-white" : "border-slate-300"}`}>
                                {selectedCreditTxId === "not_found" && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div>
                                <span className="font-bold text-amber-900 dark:text-amber-300 block flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                  Not Found in Bank Statement Yet (Link Later)
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                                  Statement update pending. You can link this later from Bank Treasury.
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. FOOTER ACTION BAR */}
          <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <Button 
              variant="outline" 
              onClick={() => setPaymentModalOpen(false)} 
              className="rounded-xl h-10 px-4 text-xs font-semibold border-slate-300 hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:border-slate-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmPayment} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-5 text-xs font-bold gap-1.5 shadow-sm min-w-[150px]"
            >
              <Check className="h-4 w-4" />
              <span>Confirm Payment</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
    </div>
  );
};

