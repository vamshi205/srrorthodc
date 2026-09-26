import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CashInvoiceData,
  fetchCashInvoicesFromFirestore,
  saveCashInvoiceToFirestore,
  deleteCashInvoiceFromFirestore,
} from "@/services/cashInvoiceFirebaseService";
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

  // Record Payment Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<CashInvoiceData | null>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>("");
  const [paymentModeInput, setPaymentModeInput] = useState<string>("Cash");
  const [paymentNoteInput, setPaymentNoteInput] = useState<string>("");

  // Saved Invoices Filter & Search
  const [savedSearchQuery, setSavedSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid">("all");

  // Load Invoices, Customers, and DCs on Mount
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
      const [invs, custs, dcs, cat] = await Promise.all([
        fetchCashInvoicesFromFirestore(),
        fetchUnifiedCustomers(),
        loadSavedDcs(),
        getImplantCatalog(),
      ]);
      setSavedInvoices(invs);
      setCustomers(custs);
      setSavedDcs(dcs);
      setCatalog(cat);

      // Check query params
      const paramDc = searchParams.get("dcNo") || sessionStorage.getItem("prefill_cash_dc_no");
      const paramClient = searchParams.get("client") || sessionStorage.getItem("prefill_cash_client_name");
      const paramView = searchParams.get("viewInv") || sessionStorage.getItem("view_cash_inv_num");

      if (paramView) {
        const found = invs.find(
          (i) =>
            (i.invNumber && i.invNumber.trim().toLowerCase() === paramView.trim().toLowerCase()) ||
            (i.dcNumber && i.dcNumber.trim().toLowerCase() === paramView.trim().toLowerCase())
        );
        if (found) {
          setSelectedInvoiceForView(found);
          setViewModalOpen(true);
        }
      }

      if (paramDc) {
        setDcNumber(paramDc);
        sessionStorage.removeItem("prefill_cash_dc_no");
      }
      if (paramClient) {
        setClientName(paramClient);
        sessionStorage.removeItem("prefill_cash_client_name");
        // Auto fill address and mobile if matching customer exists
        const matchedCust = custs.find(
          (c) => c.name.toLowerCase().trim() === paramClient.toLowerCase().trim()
        );
        if (matchedCust) {
          if (matchedCust.address) setClientAddress(matchedCust.address);
          if (matchedCust.mobile || matchedCust.phone) {
            setClientMobile(matchedCust.mobile || matchedCust.phone || "");
          }
          if (matchedCust.email) setClientEmail(matchedCust.email);
        }
      }

      // Auto assign next invoice number if this is a fresh invoice
      const nextNum = computeNextInvoiceNumber(invs);
      setInvNumber(nextNum);
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
  const handleClearInvoice = () => {
    const nextNum = computeNextInvoiceNumber(savedInvoices);
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
    toast.info("Started new Cash Memo draft");
  };

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

          const fromDcTracker = sessionStorage.getItem("from_dc_tracker") === "true";
          if (fromDcTracker) {
            sessionStorage.removeItem("from_dc_tracker");
            sessionStorage.removeItem("is_purchase_dc");
            const effectiveAmount = isHikedBill && actualReceivable > 0 ? actualReceivable : grandTotal;
            const isFullyPaid = effectiveAmount > 0 && paymentReceived >= effectiveAmount;
            navigate(isFullyPaid ? "/saved?queue=completed" : "/saved?queue=cash");
          }
        }, 800);

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

  // Open Record Payment Modal
  const openPaymentModal = (inv: CashInvoiceData) => {
    setPayingInvoice(inv);
    const effDue = inv.isHikedBill && inv.actualReceivable ? Number(inv.actualReceivable) : Number(inv.grandTotal);
    const balance = Math.max(0, effDue - (Number(inv.paymentReceived) || 0));
    setPaymentAmountInput(balance > 0 ? String(balance) : "");
    setPaymentModeInput("Cash");
    setPaymentNoteInput("");
    setPaymentModalOpen(true);
  };

  // Confirm Payment
  const handleConfirmPayment = async () => {
    if (!payingInvoice) return;
    const payAmt = parseFloat(paymentAmountInput) || 0;
    if (payAmt <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    const currentPaid = Number(payingInvoice.paymentReceived) || 0;
    const newPaid = currentPaid + payAmt;
    const effDue = payingInvoice.isHikedBill && payingInvoice.actualReceivable ? Number(payingInvoice.actualReceivable) : Number(payingInvoice.grandTotal);
    const isFullyPaid = newPaid >= effDue;
    const newStatus = isFullyPaid ? "paid" : "partial";

    const updatedInvoice: CashInvoiceData = {
      ...payingInvoice,
      paymentReceived: newPaid,
      status: newStatus,
      paymentNote: paymentNoteInput.trim() || undefined,
      paymentMode: paymentModeInput,
      paymentAt: new Date().toISOString(),
    };

    const success = await saveCashInvoiceToFirestore(updatedInvoice);
    if (success) {
      // Sync DC
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
                  cashRemarks: `Cash Memo ${payingInvoice.invNumber} Paid (₹${effDue}) via ${paymentModeInput}`,
                },
                meta: {
                  invoiceRef: payingInvoice.invNumber,
                  cashAmount: effDue,
                  cashRemarks: `Cash Memo ${payingInvoice.invNumber} Paid (₹${effDue}) via ${paymentModeInput}`,
                },
              });
            } else {
              await transitionSavedDc(matchingDc.id, {
                toStatus: "cash",
                action: "MOVE_TO_CASH",
                updates: {
                  invoiceRef: payingInvoice.invNumber,
                  cashAmount: effDue,
                  cashRemarks: `Cash Memo ${payingInvoice.invNumber} Partial Paid (₹${newPaid}/₹${effDue})`,
                },
              });
            }
          }
        } catch (e) {
          console.error("DC sync error after payment:", e);
        }
      }

      toast.success(`Payment of ₹${payAmt.toLocaleString("en-IN")} recorded!`);
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
      {/* Top Progress Loading Bar for Saving */}
      {isSaving && (
        <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
          <div className="w-full h-1.5 bg-teal-100 dark:bg-teal-950 overflow-hidden shadow-sm">
            <div
              className="h-full bg-gradient-to-r from-teal-500 via-emerald-500 to-amber-500 transition-all duration-300 ease-out"
              style={{ width: `${saveProgress}%` }}
            />
          </div>
          <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-auto">
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/95 dark:bg-slate-900/95 border border-teal-500/40 shadow-xl backdrop-blur-md text-xs font-semibold text-slate-800 dark:text-slate-100 animate-in fade-in slide-in-from-top-3 duration-200">
              {saveProgress < 100 ? (
                <div className="w-4 h-4 rounded-full border-2 border-teal-600 border-t-transparent animate-spin shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
              <span className="truncate max-w-[280px] sm:max-w-md">{saveStatusText}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-bold shrink-0">
                {saveProgress}%
              </span>
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
              <h1 className="text-lg sm:text-xl font-bold font-display text-foreground tracking-tight">
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
                      <th className="p-2 text-center w-[3.5%]">#</th>
                      <th className="p-2 text-left w-[45%]">Item Description</th>
                      <th className="p-2 text-center w-[25%]">Size</th>
                      <th className="p-2 text-center w-[6%]">Qty</th>
                      <th className="p-2 text-right w-[9%]">Rate (₹)</th>
                      <th className="p-2 text-right w-[9%]">Amount (₹)</th>
                      <th className="p-2 text-center w-[3.5%]"></th>
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
                          <Input
                            type="text"
                            value={item.description}
                            onChange={(e) => {
                              handleItemChange(index, "description", e.target.value);
                              setItemSearchQuery(e.target.value);
                              setActiveItemRowIndex(index);
                            }}
                            onFocus={() => {
                              setActiveItemRowIndex(index);
                              setItemSearchQuery(item.description);
                            }}
                            onClick={() => {
                              setActiveItemRowIndex(index);
                              setItemSearchQuery(item.description);
                            }}
                            className="h-8 text-xs font-semibold rounded-none w-full"
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
                              className="h-6 text-[11px] text-muted-foreground placeholder:text-muted-foreground/60 rounded-none w-full border border-dashed border-border/80 bg-muted/20 focus-visible:bg-background focus-visible:text-foreground focus-visible:border-solid px-2 font-normal"
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
                            className="h-8 text-xs text-center rounded-none font-medium w-full"
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
                            className="h-8 text-xs text-center font-bold rounded-none w-full mx-auto px-1"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={item.rate || ""}
                            onChange={(e) => handleItemChange(index, "rate", parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs text-right font-mono rounded-none w-full"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="p-2 text-right font-bold font-mono text-foreground truncate">
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
              <div className="text-xl sm:text-2xl font-black font-display text-foreground mt-1">
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
              <div className="text-xl sm:text-2xl font-black font-display font-mono text-teal-700 dark:text-teal-400 mt-1">
                ₹{kpi.totalBilled.toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Gross cash memo value</div>
            </Card>

            <Card className="border-border shadow-sm p-4 rounded-xl">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Total Received
              </div>
              <div className="text-xl sm:text-2xl font-black font-display font-mono text-emerald-600 dark:text-emerald-400 mt-1">
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
              <div className="text-xl sm:text-2xl font-black font-display font-mono text-amber-600 dark:text-amber-400 mt-1">
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
          <Card className="border-border shadow-sm overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
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
            <div className="py-2">
              <CashInvoicePreview
                invoice={selectedInvoiceForView}
                onPrint={() => printCashMemo(selectedInvoiceForView)}
                showPrintButton={false}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* RECORD PAYMENT MODAL */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="max-w-md p-5 bg-card border-border rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              Record Cash / Payment
            </DialogTitle>
          </DialogHeader>

          {payingInvoice && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted/40 rounded-xl border border-border text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice:</span>
                  <span className="font-bold font-mono">{payingInvoice.invNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-semibold">{payingInvoice.clientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Expected:</span>
                  <span className="font-bold font-mono">
                    ₹
                    {(
                      payingInvoice.isHikedBill && payingInvoice.actualReceivable
                        ? Number(payingInvoice.actualReceivable)
                        : Number(payingInvoice.grandTotal)
                    ).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Already Paid:</span>
                  <span className="font-bold font-mono text-emerald-600">
                    ₹{(Number(payingInvoice.paymentReceived) || 0).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">Payment Amount (₹) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={paymentAmountInput}
                  onChange={(e) => setPaymentAmountInput(e.target.value)}
                  className="font-bold font-mono text-base h-10 rounded-md"
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">Payment Mode</Label>
                <Select value={paymentModeInput} onValueChange={setPaymentModeInput}>
                  <SelectTrigger className="h-9 text-xs rounded-md">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent className="rounded-md">
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="UPI / QR Code">UPI / QR Code</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer (NEFT/IMPS)</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">Notes / Reference (Optional)</Label>
                <Input
                  type="text"
                  value={paymentNoteInput}
                  onChange={(e) => setPaymentNoteInput(e.target.value)}
                  className="text-xs h-9 rounded-md"
                  placeholder="e.g. Received via GPay, handed by Dr. Sharma"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  variant="outline"
                  onClick={() => setPaymentModalOpen(false)}
                  className="h-9 text-xs font-semibold rounded-md"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmPayment}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-9 text-xs gap-1.5 rounded-md"
                >
                  <CheckCircle2 className="w-4 h-4" /> Confirm Payment
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

