import React, { useEffect, useMemo, useState, Fragment } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  Download,
  Edit,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Link2,
  IndianRupee,
  Images,
  List,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Plus,
  RefreshCw,
  Printer,
  Receipt,
  CreditCard,
  Search,
  Share2,
  Trash2,
  TrendingUp,
  Undo2,
  User,
  UserCheck,
  Truck,
  Wallet,
  Wrench,
  X,
  Sun,
  Moon,
  Loader2,
  Phone,
  PhoneCall,
  Smartphone,
  Building2,
  Stethoscope,
  MapPin,
  Copy,
  Check,
  MessageCircle,
  ShoppingBag,
  Lock,
  ArrowRight,
  Clock,
  Banknote,
  Landmark,
  RotateCcw,
  Layers,
  Mail,
  ArrowDownLeft,
  ChevronDown,
  ChevronUp,
  Ban,
} from "lucide-react";
import { extractHdfcNarration } from "@/services/gmailConnectorService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InstrumentImageModal } from "@/components/ortho/InstrumentImageModal";
import { TopToolbar } from "@/components/ortho/TopToolbar";
import {
  getSavedCustomers,
  saveCustomer,
  Customer,
  HospitalContact,
  normalizeHospitalName,
} from "@/lib/customerStorage";
import { HospitalSelect } from "@/components/ortho/HospitalSelect";
import { DoctorSelect } from "@/components/ortho/DoctorSelect";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as DatePickerCalendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useProcedures } from "@/hooks/useProcedures";
import {
  deleteSavedDc,
  loadSavedDcs,
  SavedDc,
  SavedDcHistoryEvent,
  SavedDcStatus,
  transitionSavedDc,
  updateSavedDc,
} from "@/lib/savedDcStorage";
import { AppLoadingSpinner } from "@/components/ui/LoadingSpinner";
import { auth } from "@/firebase";
import html2pdf from "html2pdf.js";
import {
  fetchCashInvoicesFromFirestore,
  saveCashInvoiceToFirestore,
  deleteCashInvoiceFromFirestore,
  type CashInvoiceData,
} from "@/services/cashInvoiceFirebaseService";
import { CashInvoicePreview } from "@/components/cash-invoice/CashInvoicePreview";
import { printCashMemo } from "@/lib/cashInvoicePrint";
import { DcTrackerNotifications } from "@/components/ortho/DcTrackerNotifications";
import { CollectPaymentsScroller } from "@/components/ortho/CollectPaymentsScroller";
import {
  PersonnelSelect,
  TRANSPORT_MODES,
  getTransportMode,
  renderTransportIcon,
} from "@/components/ortho/PersonnelSelect";
import {
  normalizePersonnelName,
  isDisallowedPersonnel,
  isTransportLogisticsName,
} from "@/lib/personnelStorage";
import {
  fetchBankTransactionsFromFirestore,
  fetchBankAccountsFromFirestore,
  linkBankTransactionToCashInvoice,
  unlinkBankTransactionFromCashInvoice,
  recordCashPaymentToCashInHand,
  type BankTransaction,
  type BankAccount,
} from "@/services/bankAccountFirebaseService";

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getDaysPending = (dc: SavedDc) => {
  const start = new Date(dc.savedAt);
  const end = dc.returnedAt ? new Date(dc.returnedAt) : new Date();
  const diff = Math.floor(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  return diff;
};

const getTotalQty = (dc: SavedDc) =>
  dc.items.reduce(
    (total, item) =>
      total + item.sizes.reduce((sum, size) => sum + size.qty, 0),
    0,
  );
const parseDateInput = (value: string) => {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
};

const toDateInputValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const formatFilterDate = (value: string) => {
  const date = parseDateInput(value);
  return date
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date)
    : "Select date";
};

const DateFilterPicker = ({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) => {
  const [open, setOpen] = useState(false);
  const selectedDate = parseDateInput(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={`${label}: ${formatFilterDate(value)}`}
          className="h-8 w-36 justify-start gap-1.5 border-slate-300 bg-white px-2 text-left text-xs font-normal text-slate-700 hover:bg-slate-50 focus-visible:ring-teal-600"
        >
          <Calendar className="h-3.5 w-3.5 shrink-0 text-teal-700" />
          <span className="truncate">{formatFilterDate(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        collisionPadding={16}
        className="z-[100] w-auto p-0"
      >
        <DatePickerCalendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (!date) return;
            onChange(toDateInputValue(date));
            setOpen(false);
          }}
          initialFocus
        />
        {value && (
          <div className="border-t border-slate-200 p-2 text-right">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700"
              onClick={() => onChange("")}
            >
              Clear date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

const SavedDcs = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queueParam = searchParams.get("queue") as SavedDcStatus | null;
  const { toast } = useToast();
  const { fetchProcedures, loading: proceduresLoading } = useProcedures();

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (
      (localStorage.getItem("srrortho:theme") as "light" | "dark") || "dark"
    );
  });

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("srrortho:theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };
  const [savedDcs, setSavedDcs] = useState<SavedDc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false); // Loading for action dialogs
  const [loadingDcIds, setLoadingDcIds] = useState<Set<string>>(new Set()); // Loading for row operations
  const [filterText, setFilterText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quickFilter, setQuickFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [sortBy, setSortBy] = useState<
    "date" | "dcNo" | "party" | "items" | "days" | "status"
  >("date");
  const [activeQueue, setActiveQueue] = useState<SavedDcStatus>(
    queueParam || "pending",
  );

  useEffect(() => {
    if (queueParam && queueParam !== activeQueue) {
      setActiveQueue(queueParam);
    }
  }, [queueParam]);
  const [actionDialog, setActionDialog] = useState<{
    type: "return" | "invoice" | "cash" | "cancel" | "purchase" | null;
    dc: SavedDc | null;
  }>({ type: null, dc: null });
  const [returnedByInput, setReturnedByInput] = useState("");
  const [invoiceRefInput, setInvoiceRefInput] = useState("");
  const [invoiceUrlInput, setInvoiceUrlInput] = useState("");
  const [returnedRemarksInput, setReturnedRemarksInput] = useState("");
  const [invoiceRemarksInput, setInvoiceRemarksInput] = useState("");
  const [cashRemarksInput, setCashRemarksInput] = useState("");
  const [cancelledRemarksInput, setCancelledRemarksInput] = useState("");
  const [cashAmountInput, setCashAmountInput] = useState("");
  const [billedAmountInput, setBilledAmountInput] = useState("");
  const [selectedDcId, setSelectedDcId] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsModalTab, setDetailsModalTab] = useState<string>("overview");
  const [dcDocumentModalOpen, setDcDocumentModalOpen] = useState(false);
  const [cashMemoModalOpen, setCashMemoModalOpen] = useState(false);
  const [viewingCashMemoRef, setViewingCashMemoRef] = useState<string | null>(
    null,
  );
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    dc: SavedDc | null;
  }>({ open: false, dc: null });
  const [deletePassword, setDeletePassword] = useState("");
  const [moveToPendingDialog, setMoveToPendingDialog] = useState<{
    open: boolean;
    dc: SavedDc | null;
  }>({ open: false, dc: null });
  const [adminPasswordOpen, setAdminPasswordOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [paymentDialog, setPaymentDialog] = useState<{
    open: boolean;
    dc: SavedDc | null;
  }>({ open: false, dc: null });
  const [delinkConfirmDialog, setDelinkConfirmDialog] = useState<{
    open: boolean;
    dc: SavedDc | null;
  }>({ open: false, dc: null });
  const [queueTransitionState, setQueueTransitionState] = useState<{
    open: boolean;
    dcNo?: string;
    title?: string;
    targetQueueName?: string;
    message?: string;
    progress?: number;
    iconType?: "move" | "save" | "delete" | "return" | "invoice" | "cash" | "cancel";
  }>({ open: false });

  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

  const runActionWithProgress = async ({
    dcNo,
    title = "Processing Action...",
    targetQueueName,
    initialMessage,
    successMessage,
    iconType = "move",
    targetQueueKey,
    actionFn,
  }: {
    dcNo?: string;
    title?: string;
    targetQueueName?: string;
    initialMessage: string;
    successMessage: string;
    iconType?: "move" | "save" | "delete" | "return" | "invoice" | "cash" | "cancel";
    targetQueueKey?: SavedDcStatus;
    actionFn: () => Promise<void>;
  }) => {
    setQueueTransitionState({
      open: true,
      dcNo,
      title,
      targetQueueName,
      message: initialMessage,
      progress: 20,
      iconType,
    });

    try {
      await actionFn();
      setQueueTransitionState((prev) => ({ ...prev, progress: 55 }));
      await delay(900);
      setQueueTransitionState((prev) => ({
        ...prev,
        message: successMessage,
        progress: 100,
      }));
      await delay(1100);

      if (targetQueueKey) {
        setActiveQueue(targetQueueKey);
        setSearchParams({ queue: targetQueueKey });
      }
    } catch (err) {
      setQueueTransitionState({ open: false });
      throw err;
    } finally {
      setQueueTransitionState({ open: false });
    }
  };

  const runQueueTransition = async (
    dcNo: string,
    targetQueueName: string,
    message: string,
    actionFn: () => Promise<void>,
    targetQueueKey?: SavedDcStatus,
  ) => {
    await runActionWithProgress({
      dcNo,
      title: "Moving Queue...",
      targetQueueName,
      initialMessage: message,
      successMessage: `Moved to ${targetQueueName} Successfully! ✅`,
      iconType: "move",
      targetQueueKey,
      actionFn,
    });
  };
  const [paymentAmountInput, setPaymentAmountInput] = useState("");
  const [paymentRemarksInput, setPaymentRemarksInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "bank_transfer" | "others"
  >("cash");
  const [paymentCollectedBy, setPaymentCollectedBy] = useState("");
  const [partialSettlementType, setPartialSettlementType] = useState<
    "pay_more" | "final_settlement"
  >("pay_more");
  const [finalSettlementReason, setFinalSettlementReason] = useState<
    "discount" | "doctor_commission" | "hospital_commission"
  >("discount");
  const [settlementDoctorName, setSettlementDoctorName] = useState<string>("");
  const [cashInvoices, setCashInvoices] = useState<CashInvoiceData[]>([]);
  const [linkedBankTx, setLinkedBankTx] = useState<BankTransaction | null>(
    null,
  );
  const [availableBankCredits, setAvailableBankCredits] = useState<
    BankTransaction[]
  >([]);
  const [viewingTxDetails, setViewingTxDetails] =
    useState<BankTransaction | null>(null);
  const [bankAccountsList, setBankAccountsList] = useState<BankAccount[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] =
    useState<string>("all");
  const [selectedCreditTxId, setSelectedCreditTxId] =
    useState<string>("not_found");
  const [isLoadingBankCredits, setIsLoadingBankCredits] = useState(false);

  const sortedBankAccounts = useMemo(() => {
    const bankOnly = bankAccountsList.filter((a) => {
      if (a.accountType === "cash_in_hand" || a.id === "acc_cash_in_hand")
        return false;
      const name = `${a.bankName || ""} ${a.accountName || ""}`.toLowerCase();
      if (name.includes("cash in hand") || name.includes("petty cash"))
        return false;
      return true;
    });

    return bankOnly.sort((a, b) => {
      const aIs1538 = Boolean(
        (a.accountNumber && a.accountNumber.endsWith("1538")) ||
        (a.id && a.id.includes("1538")),
      );
      const bIs1538 = Boolean(
        (b.accountNumber && b.accountNumber.endsWith("1538")) ||
        (b.id && b.id.includes("1538")),
      );
      if (aIs1538 && !bIs1538) return -1;
      if (!aIs1538 && bIs1538) return 1;
      return 0;
    });
  }, [bankAccountsList]);

  const filteredBankCredits = useMemo(() => {
    const cashAccIds = new Set(
      bankAccountsList
        .filter(
          (a) =>
            a.accountType === "cash_in_hand" ||
            a.id === "acc_cash_in_hand" ||
            (a.accountName || "").toLowerCase().includes("cash in hand"),
        )
        .map((a) => a.id),
    );
    const nonCashCredits = availableBankCredits.filter(
      (tx) => !tx.accountId || !cashAccIds.has(tx.accountId),
    );

    if (selectedBankAccountId === "all") return nonCashCredits;
    return nonCashCredits.filter(
      (tx) => tx.accountId === selectedBankAccountId,
    );
  }, [availableBankCredits, selectedBankAccountId, bankAccountsList]);

  const activeViewingCashMemo = useMemo(() => {
    if (!viewingCashMemoRef) return null;
    const clean = viewingCashMemoRef.trim().toLowerCase();
    return (
      cashInvoices.find(
        (i) =>
          (i.invNumber && i.invNumber.trim().toLowerCase() === clean) ||
          (i.dcNumber && i.dcNumber.trim().toLowerCase() === clean),
      ) || null
    );
  }, [viewingCashMemoRef, cashInvoices]);

  useEffect(() => {
    if (cashMemoModalOpen && viewingCashMemoRef) {
      fetchCashInvoicesFromFirestore().then((invs) => {
        setCashInvoices(invs);
      });
    }
  }, [cashMemoModalOpen, viewingCashMemoRef]);

  // Hospital Contacts View Modal State
  const [customers, setCustomers] = useState<Customer[]>(() =>
    getSavedCustomers(),
  );
  const [viewContactModalOpen, setViewContactModalOpen] = useState(false);
  const [selectedHospitalForContact, setSelectedHospitalForContact] = useState<{
    hospitalName: string;
    dc?: SavedDc;
    customer?: Customer | null;
  } | null>(null);

  // Collapsible toggle state for multi-installment part payment history
  const [isTrackPartPaymentsOpen, setIsTrackPartPaymentsOpen] = useState(true);
  const [isRecordPartPaymentsOpen, setIsRecordPartPaymentsOpen] =
    useState(true);
  const [expandedInstallmentIdx, setExpandedInstallmentIdx] = useState<
    number | null
  >(null);

  useEffect(() => {
    const handleCustUpdate = () => {
      setCustomers(getSavedCustomers());
    };
    window.addEventListener("srrortho:customers_updated", handleCustUpdate);
    return () =>
      window.removeEventListener(
        "srrortho:customers_updated",
        handleCustUpdate,
      );
  }, []);

  // Listen for background updates to Saved DCs
  useEffect(() => {
    const handleDcsUpdated = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setSavedDcs(e.detail);
      } else {
        loadSavedDcs()
          .then((dcs) => setSavedDcs(dcs))
          .catch(() => {});
      }
    };
    window.addEventListener("srrortho:saved_dcs_updated", handleDcsUpdated);
    return () =>
      window.removeEventListener(
        "srrortho:saved_dcs_updated",
        handleDcsUpdated,
      );
  }, []);

  // Edit DC Details Modal State
  const [editDcModalOpen, setEditDcModalOpen] = useState(false);
  const [editingDcTarget, setEditingDcTarget] = useState<SavedDc | null>(null);
  const [editHospitalName, setEditHospitalName] = useState("");
  const [editDoctorName, setEditDoctorName] = useState("");
  const [editDcNo, setEditDcNo] = useState("");
  const [editDcDate, setEditDcDate] = useState("");
  const [editDeliveredBy, setEditDeliveredBy] = useState("");
  const [editReceivedBy, setEditReceivedBy] = useState("");
  const [editMaterialType, setEditMaterialType] = useState("SS");
  const [editRemarks, setEditRemarks] = useState("");
  const [isSavingDcEdit, setIsSavingDcEdit] = useState(false);

  const openEditDcModal = (dc: SavedDc) => {
    setEditingDcTarget(dc);
    setEditHospitalName(dc.hospitalName || "");
    setEditDoctorName(dc.doctorName || "");
    setEditDcNo(dc.dcNo || "");
    setEditDcDate(dc.savedAt ? dc.savedAt.split("T")[0] : "");
    setEditDeliveredBy(dc.deliveredBy || "");
    setEditReceivedBy(dc.receivedBy || "");
    setEditMaterialType(dc.materialType || "SS");
    setEditRemarks(dc.remarks || "");
    setEditDcModalOpen(true);
  };

  const handleSaveDcEdit = async () => {
    if (!editingDcTarget) return;
    const cleanHospital = normalizeHospitalName(editHospitalName);
    if (!cleanHospital) {
      toast({
        title: "Hospital Required",
        description: "Please enter or select a hospital / customer name.",
        variant: "destructive",
      });
      return;
    }
    if (!editDcNo.trim()) {
      toast({
        title: "DC Number Required",
        description: "DC number cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    setEditDcModalOpen(false);
    await runActionWithProgress({
      dcNo: editDcNo.trim(),
      title: "Saving Delivery Challan",
      targetQueueName: "DC Updates",
      initialMessage: "Saving challan items, personnel & hospital details...",
      successMessage: "Delivery Challan Updated Successfully! ✅",
      iconType: "save",
      actionFn: async () => {
        setIsSavingDcEdit(true);
        try {
          const updates: Partial<SavedDc> = {
            hospitalName: cleanHospital,
            doctorName: editDoctorName.trim() || undefined,
            dcNo: editDcNo.trim(),
            deliveredBy: editDeliveredBy.trim(),
            receivedBy: editReceivedBy.trim(),
            materialType: editMaterialType,
            remarks: editRemarks.trim() || undefined,
            savedAt: editDcDate
              ? new Date(editDcDate).toISOString()
              : editingDcTarget.savedAt,
          };

          const updated = await updateSavedDc(editingDcTarget.id, updates);

          // Update in state
          setSavedDcs((prev) =>
            prev.map((d) => (d.id === editingDcTarget.id ? updated : d)),
          );

          // Auto ensure hospital is in directory
          saveCustomer({
            name: cleanHospital,
            contactPerson: editDoctorName.trim() || undefined,
          }).catch(() => {});

          toast({
            title: "DC Updated Successfully",
            description: `DC #${updated.dcNo} has been updated to "${cleanHospital}".`,
          });
        } catch (err: any) {
          toast({
            title: "Update Failed",
            description: err.message || "Failed to update DC details.",
            variant: "destructive",
          });
        } finally {
          setIsSavingDcEdit(false);
        }
      },
    });
  };

  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const handleCopyPhone = (num: string) => {
    if (!num) return;
    navigator.clipboard.writeText(num);
    setCopiedPhone(num);
    toast({
      title: "Number Copied",
      description: `${num} copied to clipboard`,
    });
    setTimeout(() => {
      setCopiedPhone(null);
    }, 2000);
  };

  // Inline add contact inside View Contacts popup
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newContactRole, setNewContactRole] = useState<string>("OT Person");
  const [newContactName, setNewContactName] = useState<string>("");
  const [newContactPhone, setNewContactPhone] = useState<string>("");
  const [isSavingContact, setIsSavingContact] = useState(false);

  const getHospitalContactSummary = (hospitalName: string) => {
    const norm = (hospitalName || "").toLowerCase().trim();
    if (!norm)
      return { cust: null, hasPhone: false, primaryPhone: "", count: 0 };
    const cust =
      customers.find((c) => {
        const cNorm = c.name.toLowerCase().trim();
        return cNorm === norm || cNorm.includes(norm) || norm.includes(cNorm);
      }) || null;

    if (!cust)
      return { cust: null, hasPhone: false, primaryPhone: "", count: 0 };

    const validContacts = (cust.contacts || []).filter(
      (c) => c.phone && c.phone.trim(),
    );
    const count =
      validContacts.length +
      (cust.otNumber ? 1 : 0) +
      (cust.hospitalNumber ? 1 : 0) +
      (cust.personalNumber ? 1 : 0);
    const hasPhone = count > 0 || Boolean(cust.mobile || cust.phone);
    const primaryPhone =
      cust.otNumber ||
      cust.personalNumber ||
      cust.hospitalNumber ||
      validContacts[0]?.phone ||
      cust.mobile ||
      cust.phone ||
      "";

    return { cust, hasPhone, primaryPhone, count };
  };

  const handleOpenHospitalContact = (
    hospitalName: string,
    dc?: SavedDc,
    forceAdd?: boolean,
  ) => {
    const norm = (hospitalName || "").toLowerCase().trim();
    let cust =
      customers.find((c) => c.name.toLowerCase().trim() === norm) || null;
    if (!cust && norm) {
      cust =
        customers.find((c) => {
          const cNorm = c.name.toLowerCase().trim();
          return cNorm.includes(norm) || norm.includes(cNorm);
        }) || null;
    }

    const hasAnyContacts = Boolean(
      (cust?.contacts &&
        cust.contacts.some((c) => c.phone && c.phone.trim())) ||
      cust?.otNumber ||
      cust?.hospitalNumber ||
      cust?.personalNumber ||
      cust?.mobile ||
      cust?.phone,
    );

    setSelectedHospitalForContact({
      hospitalName,
      dc,
      customer: cust,
    });

    // Auto-open inline add form if contacts are blank or forceAdd requested
    setIsAddingContact(forceAdd ?? !hasAnyContacts);
    setNewContactRole(dc?.doctorName ? "Doctor" : "OT Person");
    setNewContactName(dc?.doctorName || "");
    setNewContactPhone("");
    setViewContactModalOpen(true);
  };

  const handleSaveInlineContact = async () => {
    if (!selectedHospitalForContact?.hospitalName) return;
    const phone = newContactPhone.trim();
    const name = newContactName.trim();
    if (!phone && !name) {
      toast({
        title: "Phone or Name Required",
        description: "Please enter a phone number or staff name to save.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingContact(true);
    try {
      const hospitalName = selectedHospitalForContact.hospitalName;
      let existingCust =
        selectedHospitalForContact.customer ||
        customers.find(
          (c) =>
            c.name.toLowerCase().trim() === hospitalName.toLowerCase().trim(),
        );

      const existingContacts: HospitalContact[] = existingCust?.contacts
        ? [...existingCust.contacts]
        : [];

      const newContactItem: HospitalContact = {
        id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        role: newContactRole || "Others",
        name:
          name ||
          (newContactRole === "OT Person"
            ? "OT Desk"
            : newContactRole === "Doctor"
              ? "Doctor"
              : newContactRole === "Reception"
                ? "Reception"
                : newContactRole),
        phone: phone,
      };

      existingContacts.push(newContactItem);

      // Derive primary compatibility fields
      const otNum =
        existingContacts.find((c) => c.role === "OT Person" && c.phone)
          ?.phone ||
        existingCust?.otNumber ||
        "";
      const hospNum =
        existingContacts.find((c) => c.role === "Reception" && c.phone)
          ?.phone ||
        existingCust?.hospitalNumber ||
        "";
      const persNum =
        existingContacts.find((c) => c.role === "Doctor" && c.phone)?.phone ||
        existingCust?.personalNumber ||
        "";
      const contactDoc =
        existingContacts.find((c) => c.role === "Doctor")?.name ||
        existingCust?.contactPerson ||
        "";
      const primaryMobile =
        persNum || otNum || hospNum || phone || existingCust?.mobile || "";

      const updatedCustomer = await saveCustomer({
        id: existingCust?.id,
        name: hospitalName,
        contacts: existingContacts,
        otNumber: otNum,
        hospitalNumber: hospNum,
        personalNumber: persNum,
        contactPerson: contactDoc,
        mobile: primaryMobile,
        phone: primaryMobile,
        address: existingCust?.address || "",
      });

      const refreshed = getSavedCustomers();
      setCustomers(refreshed);
      setSelectedHospitalForContact((prev) =>
        prev
          ? {
              ...prev,
              customer: updatedCustomer,
            }
          : null,
      );

      setNewContactPhone("");
      setNewContactName("");
      setIsAddingContact(false);

      toast({
        title: "Contact Number Saved!",
        description: `Added ${newContactItem.role}: ${newContactItem.phone || newContactItem.name} to ${hospitalName}.`,
      });
    } catch (err: any) {
      console.error("Failed to save contact:", err);
      toast({
        title: "Error saving contact",
        description:
          err.message || "Failed to save number to customer profile.",
        variant: "destructive",
      });
    } finally {
      setIsSavingContact(false);
    }
  };

  useEffect(() => {
    const fetchDcs = async () => {
      setIsLoading(true);
      try {
        const dcs = await loadSavedDcs();
        setSavedDcs(dcs);
      } catch (error) {
        console.error("Error loading DCs:", error);
        toast({
          title: "Error loading DCs",
          description:
            error instanceof Error
              ? error.message
              : "Failed to load DCs from Google Sheets",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
      try {
        const invoices = await fetchCashInvoicesFromFirestore();
        setCashInvoices(invoices);
      } catch (err) {
        console.warn("Failed to load cash invoices for reminders:", err);
      }
    };
    fetchDcs();
  }, [toast]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const { action, payload, requestId } = event.data || {};
      if (!action) return;

      const targetWindow =
        (event.source as Window) ||
        (document.querySelector("iframe") as HTMLIFrameElement | null)
          ?.contentWindow;

      if (action === "FETCH_CASH_INVOICES") {
        const invoices = await fetchCashInvoicesFromFirestore();
        targetWindow?.postMessage(
          {
            action: "FETCH_CASH_INVOICES_RESPONSE",
            payload: invoices,
            requestId,
          },
          "*",
        );
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const normalizedDcs = useMemo(
    () =>
      savedDcs.map((dc) => {
        let effectiveCashAmount = dc.cashAmount;
        if (dc.status === "cash" && dc.invoiceRef) {
          const invClean = dc.invoiceRef.trim().toLowerCase();
          const matchInv = cashInvoices.find(
            (i) => i.invNumber && i.invNumber.trim().toLowerCase() === invClean,
          );
          if (
            matchInv &&
            (Number(matchInv.grandTotal) || Number(matchInv.actualReceivable))
          ) {
            const trueTotal = Number(
              matchInv.grandTotal || matchInv.actualReceivable,
            );
            if (trueTotal > 0) {
              effectiveCashAmount = trueTotal;
            }
          }
        }

        return {
          ...dc,
          cashAmount: effectiveCashAmount,
          status: (dc.status ?? "pending") as SavedDcStatus,
          receivedBy: dc.receivedBy ?? "",
          deliveredBy: dc.deliveredBy ?? "",
          remarks: dc.remarks ?? "",
        };
      }),
    [savedDcs, cashInvoices],
  );

  const dcCounts = useMemo(() => {
    return {
      all: normalizedDcs.length,
      pending: normalizedDcs.filter((d) => d.status === "pending").length,
      returned: normalizedDcs.filter((d) => d.status === "returned").length,
      cash: normalizedDcs.filter((d) => d.status === "cash").length,
      completed: normalizedDcs.filter((d) => d.status === "completed").length,
      cancelled: normalizedDcs.filter((d) => d.status === "cancelled").length,
    };
  }, [normalizedDcs]);

  const cashQueueStats = useMemo(() => {
    const cashDcs = normalizedDcs.filter((d) => d.status === "cash");
    const totalOutstanding = cashDcs.reduce(
      (acc, d) => acc + (d.cashAmount || 0),
      0,
    );
    return { count: cashDcs.length, totalOutstanding };
  }, [normalizedDcs]);

  const completedQueueStats = useMemo(() => {
    const completedDcs = normalizedDcs.filter((d) => d.status === "completed");
    const totalCollected = completedDcs.reduce(
      (acc, d) => acc + (d.cashAmount || 0),
      0,
    );
    return { count: completedDcs.length, totalCollected };
  }, [normalizedDcs]);

  // Top frequently used return persons for Quick Select chips
  const topReturnPersons = useMemo(() => {
    const counts = new Map<string, number>();
    savedDcs.forEach((d) => {
      const ret = normalizePersonnelName(d.returnedBy);
      if (
        ret &&
        !isDisallowedPersonnel(ret) &&
        !isTransportLogisticsName(ret)
      ) {
        counts.set(ret, (counts.get(ret) || 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));
  }, [savedDcs]);

  const handleShareWhatsApp = (dc: SavedDc) => {
    const statusText = dc.status === "completed" ? "PAID ✅" : "UNPAID ⏳";
    const text =
      `*SRI RAJA RAJESHWARI ORTHO PLUS*\n*Cash Memo Details*\n\n` +
      `📄 *Memo No:* ${dc.invoiceRef || "N/A"}\n` +
      `🚚 *DC No:* ${dc.dcNo}\n` +
      `🏥 *Party Name:* ${dc.hospitalName}\n` +
      `💰 *Amount:* ₹${dc.cashAmount || 0}\n` +
      `📌 *Status:* ${statusText}\n\n` +
      `Thank you!`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const getCashMemoAgingDays = (dc: SavedDc) => {
    const cashEvent = dc.history?.find((h) => h.action === "MOVE_TO_CASH");
    const cashDate = cashEvent
      ? new Date(cashEvent.at)
      : dc.savedAt
        ? new Date(dc.savedAt)
        : new Date();
    const diff = Math.floor(
      (new Date().getTime() - cashDate.getTime()) / (1000 * 3600 * 24),
    );
    return Math.max(0, diff);
  };

  const formatCompact = (val: number) => {
    if (!val) return "0";
    if (val >= 100000 && val % 1000 === 0) return `${val / 100000}L`;
    if (val >= 1000 && val % 1000 === 0) return `${val / 1000}k`;
    return val.toLocaleString("en-IN");
  };

  const openPaymentDialog = (dc: SavedDc) => {
    setPaymentDialog({ open: true, dc });

    // Check if previously part-paid to calculate remaining balance default
    let prevPaid = dc.paidAmount || 0;
    let origTotal = dc.originalInvoiceTotal || dc.cashAmount || 0;
    if (dc.cashRemarks && dc.cashRemarks.includes("Part Payment Received")) {
      const match = dc.cashRemarks.match(
        /Part Payment Received:\s*₹?([\d,]+)\s*of\s*₹?([\d,]+)/i,
      );
      if (match) {
        prevPaid = parseFloat(match[1].replace(/,/g, "")) || prevPaid;
        origTotal = parseFloat(match[2].replace(/,/g, "")) || origTotal;
      }
    }

    const remainingDue =
      origTotal > prevPaid && prevPaid > 0 ? origTotal - prevPaid : origTotal;

    setPaymentAmountInput(
      remainingDue > 0
        ? String(remainingDue)
        : dc.cashAmount
          ? String(dc.cashAmount)
          : "",
    );
    setPaymentRemarksInput("");
    setPaymentMethod(dc.paymentMethod || "cash");
    setPaymentCollectedBy(dc.collectedBy || "");
    setPartialSettlementType("pay_more");
    setSelectedCreditTxId("not_found");
    setSelectedBankAccountId("all");
  };

  useEffect(() => {
    if (!paymentDialog.open || paymentMethod !== "bank_transfer") return;

    let isMounted = true;
    const loadUnlinkedCreditsAndAccounts = async () => {
      setIsLoadingBankCredits(true);
      try {
        const [txs, accs] = await Promise.all([
          fetchBankTransactionsFromFirestore(undefined, 300),
          fetchBankAccountsFromFirestore(),
        ]);
        if (!isMounted) return;
        setBankAccountsList(accs);

        const unlinked = txs.filter((tx) => {
          if (tx.type !== "credit") return false;
          if (tx.linkedInvoiceNumber || tx.linkedInvoiceId) return false;
          const alreadyUsedByDc = savedDcs.some(
            (d) =>
              d.status === "completed" &&
              d.utrNo &&
              tx.referenceNumber &&
              d.utrNo === tx.referenceNumber,
          );
          if (alreadyUsedByDc) return false;
          return true;
        });
        setAvailableBankCredits(unlinked);

        // Check for automatic best candidate match
        const dcAmount =
          paymentDialog.dc?.cashAmount || paymentDialog.dc?.billedAmount || 0;
        const dcHosp = (paymentDialog.dc?.hospitalName || "")
          .toLowerCase()
          .trim();
        const cleanDcNo = (paymentDialog.dc?.dcNo || "").toLowerCase().trim();

        const bestMatch = unlinked.find((tx) => {
          const desc = (tx.description || "").toLowerCase();
          const cust = (
            tx.linkedCustomerName ||
            tx.linkedHospital ||
            ""
          ).toLowerCase();
          const ref = (tx.referenceNumber || "").toLowerCase();
          const matchesHosp =
            dcHosp && (desc.includes(dcHosp) || cust.includes(dcHosp));
          const matchesAmount = Math.abs(tx.amount - dcAmount) < 10;
          const matchesDcNo =
            cleanDcNo && (desc.includes(cleanDcNo) || ref.includes(cleanDcNo));
          return (matchesHosp && matchesAmount) || matchesDcNo;
        });

        // Find default HDFC 1538 account if present
        const target1538Acc = accs.find(
          (a) =>
            (a.accountNumber && a.accountNumber.endsWith("1538")) ||
            (a.id && a.id.includes("1538")),
        );
        const defaultAccId = target1538Acc ? target1538Acc.id : "all";

        if (bestMatch) {
          setSelectedCreditTxId(bestMatch.id);
          if (bestMatch.accountId) {
            setSelectedBankAccountId(bestMatch.accountId);
          }
          if (bestMatch.amount) {
            setPaymentAmountInput(String(bestMatch.amount));
          }
        } else {
          setSelectedCreditTxId("not_found");
          setSelectedBankAccountId(defaultAccId);
        }
      } catch (err) {
        console.error(
          "Error fetching unlinked bank credits for payment modal:",
          err,
        );
      } finally {
        if (isMounted) setIsLoadingBankCredits(false);
      }
    };

    loadUnlinkedCreditsAndAccounts();
    return () => {
      isMounted = false;
    };
  }, [paymentDialog.open, paymentMethod, paymentDialog.dc, savedDcs]);

  const handleQuickRecordPayment = async () => {
    if (!paymentDialog.dc) return;
    const dc = paymentDialog.dc;

    let currentInstallment = parseFloat(paymentAmountInput) || 0;
    let prevPaid = dc.paidAmount || 0;
    let originalInvoiceTotal =
      dc.originalInvoiceTotal ||
      dc.cashAmount ||
      (dc.billedAmount
        ? dc.billedAmount - (dc.hospitalMargin || 0)
        : currentInstallment);

    if (dc.cashRemarks && dc.cashRemarks.includes("Part Payment Received")) {
      const match = dc.cashRemarks.match(
        /Part Payment Received:\s*₹?([\d,]+)\s*of\s*₹?([\d,]+)/i,
      );
      if (match) {
        prevPaid = parseFloat(match[1].replace(/,/g, "")) || prevPaid;
        originalInvoiceTotal =
          parseFloat(match[2].replace(/,/g, "")) || originalInvoiceTotal;
      }
    }

    // Cumulative paid amount across installments
    const paidAmount = prevPaid + currentInstallment;
    const isPartialPayment =
      paidAmount > 0 && paidAmount < originalInvoiceTotal;
    const isFullPayment =
      paidAmount >= originalInvoiceTotal && originalInvoiceTotal > 0;

    // Decision rule based on user choice for part payment:
    // Option 1: "User will pay more" -> stay in cash queue so more payments can be recorded
    // Option 2: "Final settlement" or full payment -> move to completed queue
    const nextStatus: SavedDcStatus =
      isPartialPayment && partialSettlementType === "pay_more"
        ? "cash"
        : "completed";

    if (paymentMethod === "cash" && !paymentCollectedBy.trim()) {
      toast({
        title: "Collector Name Required",
        description: "Please specify who collected the cash payment.",
        variant: "destructive",
      });
      return;
    }

    const matchedBankTx =
      paymentMethod === "bank_transfer" && selectedCreditTxId !== "not_found"
        ? availableBankCredits.find((t) => t.id === selectedCreditTxId)
        : null;

    const hasHiked = dc.billedAmount && dc.billedAmount > paidAmount;
    const margin = hasHiked
      ? Math.round((dc.billedAmount! - paidAmount) * 100) / 100
      : dc.hospitalMargin;
    const methodLabel = paymentMethod === "cash" ? "Cash" : "Bank Transfer";
    const collectedInfo =
      paymentMethod === "cash" && paymentCollectedBy.trim()
        ? ` • Collected by ${paymentCollectedBy.trim()}`
        : matchedBankTx?.referenceNumber
          ? ` • Linked to Ref: ${matchedBankTx.referenceNumber}`
          : "";

    let settlementReasonText = "";
    if (isPartialPayment && partialSettlementType === "final_settlement") {
      if (finalSettlementReason === "discount") {
        settlementReasonText = ` • Reason: Discount given (Shortfall: ₹${(originalInvoiceTotal - paidAmount).toLocaleString("en-IN")})`;
      } else if (finalSettlementReason === "hospital_commission") {
        settlementReasonText = ` • Reason: Hospital Cut / Commission (Shortfall: ₹${(originalInvoiceTotal - paidAmount).toLocaleString("en-IN")})`;
      } else if (finalSettlementReason === "doctor_commission") {
        const drName = settlementDoctorName.trim() || dc.doctorName || "N/A";
        settlementReasonText = ` • Reason: Doctor Commission for Dr. ${drName} (Shortfall: ₹${(originalInvoiceTotal - paidAmount).toLocaleString("en-IN")})`;
      }
    }

    const statusRemarkText = isPartialPayment
      ? partialSettlementType === "final_settlement"
        ? `Part Payment Final Settled: ₹${paidAmount.toLocaleString("en-IN")} of ₹${originalInvoiceTotal.toLocaleString("en-IN")}${settlementReasonText} via ${methodLabel}${collectedInfo}`
        : `Part Payment Received: ₹${paidAmount.toLocaleString("en-IN")} of ₹${originalInvoiceTotal.toLocaleString("en-IN")} (Balance Due: ₹${(originalInvoiceTotal - paidAmount).toLocaleString("en-IN")}) via ${methodLabel}${collectedInfo}`
      : `Paid ₹${paidAmount.toLocaleString("en-IN")} via ${methodLabel}${collectedInfo}`;

    const finalRemarks = paymentRemarksInput.trim()
      ? `${paymentRemarksInput.trim()} (${statusRemarkText})`
      : statusRemarkText;

    setIsActionLoading(true);
    try {
      setLoadingDcIds((prev) => new Set(prev).add(dc.id));

      const bankAccountId = matchedBankTx?.accountId;
      const bankName = matchedBankTx?.description || "Bank Account";
      const utrNo = matchedBankTx?.referenceNumber || matchedBankTx?.id;

      const existingPartPayments = dc.partPayments || [];
      const newInstallmentEntry = {
        at: new Date().toISOString(),
        amount: currentInstallment,
        paymentMethod,
        collectedBy:
          paymentMethod === "cash" ? paymentCollectedBy.trim() : undefined,
        utrNo: matchedBankTx?.referenceNumber || matchedBankTx?.id,
        remarks: paymentRemarksInput.trim() || undefined,
      };
      const updatedPartPayments = [
        ...existingPartPayments,
        newInstallmentEntry,
      ];

      await transitionSavedDc(dc.id, {
        toStatus: nextStatus,
        action:
          nextStatus === "completed"
            ? "MOVE_CASH_TO_COMPLETED"
            : "MOVE_TO_CASH",
        updates: {
          cashAmount: originalInvoiceTotal,
          paidAmount,
          originalInvoiceTotal,
          isPartialPayment,
          hospitalMargin: margin,
          paymentMethod,
          collectedBy:
            paymentMethod === "cash" ? paymentCollectedBy.trim() : undefined,
          paidAt: new Date().toISOString(),
          cashRemarks: finalRemarks,
          partPayments: updatedPartPayments,
          ...(matchedBankTx
            ? {
                bankAccountId,
                bankName,
                utrNo,
              }
            : {}),
        },
        meta: {
          paidAt: new Date().toISOString(),
          paidAmount,
          originalInvoiceTotal,
          isPartialPayment,
          paymentMethod,
          collectedBy:
            paymentMethod === "cash" ? paymentCollectedBy.trim() : undefined,
          billedAmount: dc.billedAmount,
          hospitalMargin: margin,
          partPayments: updatedPartPayments,
          remarks: finalRemarks,
          ...(matchedBankTx ? { bankAccountId, utrNo } : {}),
        },
      });

      // Link to Bank Transaction if matched
      if (matchedBankTx) {
        try {
          const mockInvoice: CashInvoiceData = {
            invNumber: dc.invoiceRef || `DC #${dc.dcNo}`,
            dcNumber: dc.dcNo,
            clientName: dc.hospitalName,
            grandTotal: paidAmount,
            status: "Paid",
            paymentReceived: paidAmount,
            savedAt: Date.now(),
          };
          await linkBankTransactionToCashInvoice(
            matchedBankTx.id,
            mockInvoice,
            true,
          );
        } catch (e) {
          console.error("Failed to link bank transaction on DC pay modal:", e);
        }
      } else if (paymentMethod === "cash") {
        try {
          await recordCashPaymentToCashInHand(
            dc,
            paidAmount,
            paymentCollectedBy,
            finalRemarks,
          );
        } catch (e) {
          console.error(
            "Failed to record cash transaction in Cash In Hand account:",
            e,
          );
        }
      }

      // Sync payment status to Firestore Cash Invoice
      if (dc.invoiceRef || dc.dcNo) {
        try {
          const invoices = await fetchCashInvoicesFromFirestore();
          const match = invoices.find(
            (inv) =>
              (dc.invoiceRef && inv.invNumber === dc.invoiceRef) ||
              (dc.dcNo && inv.dcNumber === dc.dcNo),
          );
          if (match) {
            match.paymentReceived = paidAmount;
            match.status = "Paid";
            await saveCashInvoiceToFirestore(match);
          }
        } catch (e) {
          console.error(
            "Failed to sync payment status to Firestore cash invoice:",
            e,
          );
        }
      }

      setSavedDcs((prev) =>
        prev.map((d) =>
          d.id === dc.id
            ? {
                ...d,
                status: "completed",
                cashAmount: paidAmount,
                paymentMethod,
                collectedBy:
                  paymentMethod === "cash"
                    ? paymentCollectedBy.trim()
                    : undefined,
                paidAt: new Date().toISOString(),
                cashRemarks: finalRemarks,
                ...(matchedBankTx ? { bankAccountId, bankName, utrNo } : {}),
              }
            : d,
        ),
      );

      setSelectedDcId(null);
      setActiveQueue("completed");
      setSearchParams({ queue: "completed" });

      const successDesc = matchedBankTx
        ? `DC #${dc.dcNo} linked to Bank Credit (Ref: ${utrNo}) & moved to Completed!`
        : `DC #${dc.dcNo} marked as Bank Transfer (Link later from Bank Accounts) & moved to Completed!`;

      toast({ title: "Payment Recorded", description: successDesc });
      setPaymentDialog({ open: false, dc: null });
      setPaymentAmountInput("");
      setPaymentRemarksInput("");
      setPaymentCollectedBy("");
      setPaymentMethod("cash");
      setSelectedCreditTxId("not_found");
    } catch (err) {
      toast({
        title: "Payment Failed",
        description:
          err instanceof Error ? err.message : "Failed to record payment.",
        variant: "destructive",
      });
    } finally {
      setIsActionLoading(false);
      setLoadingDcIds((prev) => {
        const next = new Set(prev);
        next.delete(dc.id);
        return next;
      });
    }
  };

  // Apply quick filters
  const applyQuickFilter = (dcs: SavedDc[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    switch (quickFilter) {
      case "today":
        return dcs.filter((dc) => new Date(dc.savedAt) >= today);
      case "week":
        return dcs.filter((dc) => new Date(dc.savedAt) >= weekAgo);
      case "month":
        return dcs.filter((dc) => new Date(dc.savedAt) >= monthAgo);
      case "overdue":
        return dcs.filter(
          (dc) => dc.status === "pending" && getDaysPending(dc) > 7,
        );
      default:
        return dcs;
    }
  };

  const statusCounts = useMemo(
    () =>
      normalizedDcs.reduce(
        (acc, dc) => {
          acc[dc.status] += 1;
          return acc;
        },
        {
          pending: 0,
          returned: 0,
          completed: 0,
          cash: 0,
          cancelled: 0,
        } as Record<SavedDcStatus, number>,
      ),
    [normalizedDcs],
  );

  const selectedDc = useMemo(() => {
    if (!selectedDcId) return null;
    return normalizedDcs.find((dc) => dc.id === selectedDcId) ?? null;
  }, [normalizedDcs, selectedDcId]);

  useEffect(() => {
    if (!detailsDialogOpen || !selectedDc) {
      setLinkedBankTx(null);
      return;
    }

    const loadLinkedTx = async () => {
      try {
        const txs = await fetchBankTransactionsFromFirestore(undefined, 250);
        const dcNoClean = selectedDc.dcNo.toLowerCase().trim();
        const invRefClean = (selectedDc.invoiceRef || "").toLowerCase().trim();

        const match = txs.find((tx) => {
          const linkedInv = (tx.linkedInvoiceNumber || tx.linkedInvoiceId || "")
            .toLowerCase()
            .trim();
          if (!linkedInv) return false;
          if (
            linkedInv === `dc #${dcNoClean}` ||
            linkedInv === `dc#${dcNoClean}` ||
            linkedInv === dcNoClean
          )
            return true;
          if (
            invRefClean &&
            (linkedInv === invRefClean ||
              linkedInv === invRefClean.replace(/\//g, "_"))
          )
            return true;
          return false;
        });

        setLinkedBankTx(match || null);
      } catch (err) {
        console.error("Error loading linked bank transaction for DC:", err);
      }
    };

    loadLinkedTx();
  }, [detailsDialogOpen, selectedDc]);

  const selectedIsTaxInvoice = useMemo(() => {
    if (!selectedDc?.invoiceRef) return false;
    return Boolean(
      selectedDc.isTaxInvoice ||
      (!selectedDc.cashAmount && !selectedDc.invoiceRef.startsWith("SRR-")),
    );
  }, [selectedDc]);

  const selectedIsCashMemo = useMemo(() => {
    if (!selectedDc?.invoiceRef) return false;
    return !selectedIsTaxInvoice;
  }, [selectedDc, selectedIsTaxInvoice]);

  const getDisplayDate = (dc: SavedDc) => {
    return dc.savedAt || (dc as any).createdAt || new Date().toISOString();
  };

  const filteredDcs = useMemo(() => {
    const term = filterText.trim().toLowerCase();
    const filtered = normalizedDcs.filter((dc) => dc.status === activeQueue);
    const quickFiltered = applyQuickFilter(filtered);
    const byParty = term
      ? quickFiltered.filter(
          (dc) =>
            dc.hospitalName.toLowerCase().includes(term) ||
            dc.dcNo.toLowerCase().includes(term) ||
            (dc.deliveredBy && dc.deliveredBy.toLowerCase().includes(term)) ||
            (dc.receivedBy && dc.receivedBy.toLowerCase().includes(term)),
        )
      : quickFiltered;
    const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null;
    const byDate = byParty.filter((dc) => {
      const dateValue = new Date(getDisplayDate(dc)).getTime();
      if (fromDate && dateValue < fromDate.getTime()) return false;
      if (toDate && dateValue > toDate.getTime()) return false;
      return true;
    });
    return [...byDate].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case "date":
          aValue = new Date(getDisplayDate(a)).getTime();
          bValue = new Date(getDisplayDate(b)).getTime();
          break;
        case "dcNo":
          aValue = a.dcNo.toLowerCase();
          bValue = b.dcNo.toLowerCase();
          break;
        case "party":
          aValue = a.hospitalName.toLowerCase();
          bValue = b.hospitalName.toLowerCase();
          break;
        case "items":
          aValue = getTotalQty(a);
          bValue = getTotalQty(b);
          break;
        case "days":
          aValue = getDaysPending(a);
          bValue = getDaysPending(b);
          break;
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          aValue = new Date(getDisplayDate(a)).getTime();
          bValue = new Date(getDisplayDate(b)).getTime();
      }

      if (sortBy === "date" || sortBy === "items" || sortBy === "days") {
        return sortOrder === "desc" ? bValue - aValue : aValue - bValue;
      } else {
        if (sortOrder === "desc") {
          return bValue < aValue ? -1 : bValue > aValue ? 1 : 0;
        } else {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        }
      }
    });
  }, [
    activeQueue,
    dateFrom,
    dateTo,
    filterText,
    normalizedDcs,
    sortBy,
    sortOrder,
    quickFilter,
  ]);

  // Dashboard metrics
  const dashboardMetrics = useMemo(() => {
    const totalDcs = normalizedDcs.length;
    const pendingDcs = statusCounts.pending;
    const returnedAwaiting = normalizedDcs.filter(
      (dc) => dc.status === "returned" && !dc.invoiceRef,
    ).length;
    const unpaidCash = statusCounts.cash;
    const avgTurnaround =
      normalizedDcs
        .filter((dc) => dc.status !== "pending" && dc.status !== "cancelled")
        .reduce((sum, dc) => sum + getDaysPending(dc), 0) /
      (totalDcs - pendingDcs - statusCounts.cancelled || 1);
    return {
      totalDcs,
      pendingDcs,
      returnedAwaiting,
      unpaidCash,
      avgTurnaround: Math.round(avgTurnaround),
    };
  }, [
    normalizedDcs,
    statusCounts.pending,
    statusCounts.cash,
    statusCounts.cancelled,
  ]);

  const handleDelete = async (id: string) => {
    setLoadingDcIds((prev) => new Set(prev).add(id));
    try {
      await deleteSavedDc(id);
      const dcs = await loadSavedDcs();
      setSavedDcs(dcs);
      toast({ title: "DC deleted" });
    } catch (error) {
      console.error("Error deleting DC:", error);
      toast({
        title: "Error deleting DC",
        description:
          error instanceof Error ? error.message : "Failed to delete DC",
        variant: "destructive",
      });
    } finally {
      setLoadingDcIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const requestDelete = (dc: SavedDc) => {
    // Close details modal so we don't see its header behind the confirm dialog
    setDetailsDialogOpen(false);
    if (dc.status === "pending") {
      handleDelete(dc.id);
      setSelectedDcId(null);
      return;
    }
    setDeletePassword("");
    setDeleteDialog({ open: true, dc });
  };

  const confirmProtectedDelete = async () => {
    const dc = deleteDialog.dc;
    if (!dc) return;
    if (deletePassword.trim() !== "srrortho") {
      toast({ title: "Incorrect password", variant: "destructive" });
      return;
    }
    setDeleteDialog({ open: false, dc: null });
    setDeletePassword("");
    setSelectedDcId(null);

    await runActionWithProgress({
      dcNo: dc.dcNo,
      title: "Deleting Delivery Challan",
      targetQueueName: "Trash",
      initialMessage: "Verifying admin authorization & deleting records...",
      successMessage: "Delivery Challan Deleted Successfully! 🗑️",
      iconType: "delete",
      actionFn: async () => {
        await handleDelete(dc.id);
      },
    });
  };

  const handleAdminClick = () => {
    setAdminPassword("");
    setAdminPasswordOpen(true);
  };

  const confirmAdminAccess = () => {
    if (adminPassword.trim() === "srrortho") {
      setAdminPasswordOpen(false);
      navigate("/admin");
    } else {
      toast({ title: "Incorrect password", variant: "destructive" });
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("srrortho:auth");
    localStorage.removeItem("srrortho:procedures_cache");
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleExportCSV = () => {
    if (filteredDcs.length === 0) {
      toast({
        title: "Export Empty",
        description: "No records to export in current queue view.",
        variant: "destructive",
      });
      return;
    }
    const headers = [
      "Date",
      "DC No",
      "Invoice/Memo No",
      "Party Name",
      "Items Count",
      "Days Pending",
      "Delivered By",
      "Received By",
      "Returned By",
      "Status",
      "Cash Amount (INR)",
    ];
    const rows = filteredDcs.map((dc) => [
      formatDate(getDisplayDate(dc)),
      `"${dc.dcNo || ""}"`,
      `"${dc.invoiceRef || ""}"`,
      `"${(dc.hospitalName || "").replace(/"/g, '""')}"`,
      getTotalQty(dc).toString(),
      getDaysPending(dc).toString(),
      `"${dc.deliveredBy || ""}"`,
      `"${dc.receivedBy || ""}"`,
      `"${dc.returnedBy || ""}"`,
      dc.status.toUpperCase(),
      dc.cashAmount || 0,
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `DC-Tracker-${activeQueue}-${formatDate(new Date().toISOString())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported to CSV" });
  };

  const createPdfBlob = async (dc: SavedDc) => {
    const rows = dc.items
      .map((item) => {
        const totalQty = item.sizes.reduce((sum, size) => sum + size.qty, 0);
        const sizes = item.sizes
          .filter((size) => size.size)
          .map((size) => `${size.size} (${size.qty})`)
          .join(", ");
        return `<tr><td>${item.name}</td><td>${item.procedure}</td><td>${sizes || "-"}</td><td>${totalQty}</td></tr>`;
      })
      .join("");

    const container = document.createElement("div");
    container.style.padding = "16px";
    container.style.fontFamily = "Arial, sans-serif";
    container.innerHTML = `
      <h1 style="font-size:18px;margin:0 0 6px 0;">DC ${dc.dcNo}</h1>
      <div style="font-size:12px;color:#555;margin-bottom:10px;">
        Party: ${dc.hospitalName} | Date: ${formatDate(dc.savedAt)}
      </div>
      <div style="font-size:12px;color:#555;margin-bottom:10px;">
        Delivered By: ${dc.deliveredBy || "-"} | Received By: ${dc.receivedBy || "-"}
      </div>
      <div style="font-size:12px;color:#555;margin-bottom:10px;">
        Remarks: ${dc.remarks || "-"}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr>
            <th style="border:1px solid #ddd;padding:6px;text-align:left;background:#f5f5f5;">Item</th>
            <th style="border:1px solid #ddd;padding:6px;text-align:left;background:#f5f5f5;">Procedure</th>
            <th style="border:1px solid #ddd;padding:6px;text-align:left;background:#f5f5f5;">Sizes</th>
            <th style="border:1px solid #ddd;padding:6px;text-align:left;background:#f5f5f5;">Qty</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="font-size:12px;color:#555;margin-top:10px;">Instruments: ${dc.instruments.join(", ") || "-"}</div>
      <div style="font-size:12px;color:#555;margin-top:4px;">Box Numbers: ${dc.boxNumbers.join(", ") || "-"}</div>
    `;
    document.body.appendChild(container);
    const opt = {
      margin: 10,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };
    const pdf = await html2pdf().set(opt).from(container).outputPdf("blob");
    document.body.removeChild(container);
    return pdf as Blob;
  };

  const handleShare = async (dc: SavedDc) => {
    try {
      const blob = await createPdfBlob(dc);
      const file = new File([blob], `DC-${dc.dcNo}.pdf`, {
        type: "application/pdf",
      });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `DC ${dc.dcNo}` });
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `DC-${dc.dcNo}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "PDF downloaded" });
    } catch {
      toast({ title: "Unable to share", variant: "destructive" });
    }
  };

  const handlePrint = (dc: SavedDc) => {
    const win = window.open("", "_blank");
    if (!win) {
      toast({ title: "Popup blocked", description: "Allow popups to print." });
      return;
    }

    // Group items by procedure name
    const groupedItems: Record<string, typeof dc.items> = {};
    dc.items.forEach((item) => {
      const proc = item.procedure || "General Items";
      if (!groupedItems[proc]) groupedItems[proc] = [];
      groupedItems[proc].push(item);
    });

    const rows = Object.entries(groupedItems)
      .map(([procName, items]) => {
        const itemRows = items
          .map((item, idx) => {
            const totalQty = item.sizes.reduce(
              (sum, size) => sum + size.qty,
              0,
            );
            const sizes = item.sizes
              .filter((size) => size.size)
              .map((size) => `${size.size} (Qty: ${size.qty})`)
              .join(", ");
            const desc = sizes
              ? `<div style="font-size: 9.5px; color: #555; margin-top: 2px;">${sizes}</div>`
              : "";
            return `<tr>
              <td style="text-align: center; border: 1px solid #000; padding: 5px;">${idx + 1}</td>
              <td style="border: 1px solid #000; padding: 5px;"><strong>${item.name}</strong>${desc}</td>
              <td style="text-align: center; font-weight: bold; border: 1px solid #000; padding: 5px;">${totalQty}</td>
            </tr>`;
          })
          .join("");

        return `
          <tr style="background: #f5f5f5;">
            <td colSpan="3" style="border: 1px solid #000; padding: 5px; font-weight: bold; font-size: 11px;">${procName}</td>
          </tr>
          ${itemRows}
        `;
      })
      .join("");

    win.document.write(`
      <html>
        <head>
          <title>DC ${dc.dcNo}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; font-size: 11px; color: #000; }
            h1 { font-size: 18px; font-weight: bold; margin-bottom: 2px; text-align: center; }
            p { margin: 2px 0; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 12px; }
            .meta-grid { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
            th, td { border: 1px solid #000; padding: 5px; }
            th { background: #f0f0f0; }
            .box { border: 1px solid #000; padding: 6px; margin-between: 8px; margin-bottom: 10px; font-size: 11px; }
            .sig-grid { display: flex; justify-content: space-between; margin-top: 60px; margin-bottom: 25px; }
            .sig { border-top: 1px solid #000; width: 180px; text-align: center; padding-top: 4px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>SRI RAJA RAJESHWARI ORTHO PLUS</h1>
            <p style="font-weight: bold;">Orthopedic Implant Delivery Challan</p>
            <p style="font-size: 10px; color: #444;">Hyderabad, India | Mobile: +91 9396857455, +91 8686559393 | srrorthoplus.com</p>
          </div>
          <div class="meta-grid">
            <div>
              <p><strong>Hospital:</strong> ${dc.hospitalName}</p>
              <p><strong>DC No:</strong> ${dc.dcNo}</p>
              <p><strong>Date:</strong> ${formatDate(dc.savedAt)}</p>
            </div>
            <div style="text-align: right;">
              <p><strong>Delivered By:</strong> ${dc.deliveredBy || "-"}</p>
              <p><strong>Received By:</strong> ${dc.receivedBy || "-"}</p>
              <p><strong>Material Type:</strong> ${dc.materialType || "SS"}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr><th style="width: 35px; text-align: center;">S.No</th><th style="text-align: left;">Item Description</th><th style="width: 45px; text-align: center;">Qty</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          ${dc.instruments && dc.instruments.length > 0 ? `<div class="box"><strong>Instruments Details:</strong><br/>${dc.instruments.join(", ")}</div>` : ""}
          ${dc.boxNumbers && dc.boxNumbers.length > 0 ? `<div class="box"><strong>Box Numbers:</strong><br/>${dc.boxNumbers.join(", ")}</div>` : ""}
          ${dc.remarks ? `<div class="box"><strong>Remarks:</strong><br/>${dc.remarks}</div>` : ""}
          <div class="sig-grid">
            <div class="sig">Receiver Sign</div>
            <div class="sig">For Sri Raja Rajeshwari Ortho Plus</div>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  const getStatusBadgeClass = (status: SavedDcStatus) => {
    if (status === "pending")
      return "bg-rose-100 text-rose-800 border-rose-300 font-bold";
    if (status === "returned")
      return "bg-teal-100 text-teal-800 border-teal-300 font-bold";
    if (status === "completed")
      return "bg-teal-100 text-teal-900 border-teal-400 font-bold";
    if (status === "cash")
      return "bg-blue-100 text-blue-800 border-blue-300 font-bold";
    if (status === "cancelled")
      return "bg-rose-50 text-rose-800 border-rose-200 font-bold";
    return "bg-teal-50 text-teal-800 border-teal-300 font-bold";
  };

  const getStatusIcon = (status: SavedDcStatus) => {
    if (status === "pending") return <Truck className="h-3.5 w-3.5 text-teal-600" />;
    if (status === "returned") return <Undo2 className="h-3.5 w-3.5" />;
    if (status === "cash") return <Wallet className="h-3.5 w-3.5" />;
    if (status === "cancelled") return <Ban className="h-3.5 w-3.5 text-rose-600" />;
    return <CheckCircle2 className="h-3.5 w-3.5" />;
  };

  const openActionDialog = (
    type: "return" | "invoice" | "cash" | "cancel" | "purchase",
    dc: SavedDc,
  ) => {
    // Close details modal so we don't see it behind the action dialog
    setDetailsDialogOpen(false);
    setActionDialog({ type, dc });
    setReturnedByInput(dc.returnedBy || "");
    setInvoiceRefInput(dc.invoiceRef || "");
    setInvoiceUrlInput(dc.invoiceUrl || "");
    setReturnedRemarksInput(dc.returnedRemarks || "");
    setInvoiceRemarksInput(dc.invoiceRemarks || "");
    setCashRemarksInput(dc.cashRemarks || "");
    setCancelledRemarksInput(dc.cancelledRemarks || "");
    setCashAmountInput(dc.cashAmount ? String(dc.cashAmount) : "");
    setBilledAmountInput(dc.billedAmount ? String(dc.billedAmount) : "");
  };

  const closeActionDialog = () => {
    setActionDialog({ type: null, dc: null });
    setReturnedByInput("");
    setInvoiceRefInput("");
    setInvoiceUrlInput("");
    setReturnedRemarksInput("");
    setInvoiceRemarksInput("");
    setCashRemarksInput("");
    setCancelledRemarksInput("");
    setCashAmountInput("");
    setBilledAmountInput("");
  };

  const handleConfirmReturn = async (dc: SavedDc) => {
    const returnedBy = returnedByInput.trim();
    if (!returnedBy) {
      toast({ title: "Returned By is required" });
      return;
    }

    const hasPaymentInfo = Boolean(
      dc.status === "completed" ||
      dc.status === "cash" ||
      dc.invoiceRef ||
      dc.cashAmount ||
      dc.paidAt ||
      dc.paymentMethod ||
      dc.utrNo ||
      dc.isPurchase
    );

    if (hasPaymentInfo) {
      try {
        await executeDelinkPayment(dc, "returned", {
          returnedBy,
          returnedAt: new Date().toISOString(),
          returnedRemarks: returnedRemarksInput.trim() || "",
        });
        closeActionDialog();
      } catch (error) {
        console.error("Error marking DC as returned:", error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to update DC",
          variant: "destructive",
        });
      }
      return;
    }

    await runQueueTransition(
      dc.dcNo,
      "Returned Queue",
      "Marking challan as returned...",
      async () => {
        setIsActionLoading(true);
        try {
          await transitionSavedDc(dc.id, {
            toStatus: "returned",
            action: "MARK_RETURNED",
            updates: {
              returnedBy,
              returnedAt: new Date().toISOString(),
              returnedRemarks: returnedRemarksInput.trim() || "",
            },
            meta: {
              returnedBy,
              returnedAt: new Date().toISOString(),
              returnedRemarks: returnedRemarksInput.trim() || "",
            },
          });
          const dcs = await loadSavedDcs();
          setSavedDcs(dcs);
          closeActionDialog();
          toast({ title: "DC marked as returned" });
        } finally {
          setIsActionLoading(false);
        }
      },
      "returned"
    );
  };

  const handleConfirmInvoice = async (dc: SavedDc) => {
    const invoiceRef = invoiceRefInput.trim();
    const invoiceUrl = invoiceUrlInput.trim();
    if (!invoiceRef) {
      toast({ title: "Invoice number is required" });
      return;
    }

    await runActionWithProgress({
      dcNo: dc.dcNo,
      title: "Linking GoGSTBill Invoice",
      targetQueueName: "Completed Queue",
      initialMessage: "Linking tax invoice & updating settlement status...",
      successMessage: "Invoice Linked & Moved to Completed! 📄",
      iconType: "invoice",
      targetQueueKey: "completed",
      actionFn: async () => {
        setIsActionLoading(true);
        try {
          const isFromPending = dc.status === "pending";
          await transitionSavedDc(dc.id, {
            toStatus: "completed",
            action:
              dc.status === "cash" ? "MOVE_CASH_TO_COMPLETED" : "LINK_INVOICE",
            clear:
              dc.status === "cash"
                ? (["cashAt", "cashAmount", "cashRemarks"] as any)
                : [],
            updates: {
              invoiceRef,
              invoiceUrl: invoiceUrl || undefined,
              invoiceRemarks: invoiceRemarksInput.trim() || "",
              isTaxInvoice: true,
              ...(isFromPending ? { isPurchase: true } : {}),
            },
          });
          const dcs = await loadSavedDcs();
          setSavedDcs(dcs);
          closeActionDialog();
          toast({ title: "Invoice linked. Moved to Completed." });
        } finally {
          setIsActionLoading(false);
        }
      },
    });
  };

  const handleConfirmCash = async (dc: SavedDc) => {
    const amount = parseFloat(cashAmountInput);
    if (!cashAmountInput.trim() || isNaN(amount) || amount <= 0) {
      toast({ title: "Valid cash amount is required" });
      return;
    }
    const billed = parseFloat(billedAmountInput);
    const hasHikedBill = !isNaN(billed) && billed > amount;
    const hospitalMargin = hasHikedBill
      ? Math.round((billed - amount) * 100) / 100
      : undefined;

    await runActionWithProgress({
      dcNo: dc.dcNo,
      title: "Moving to Cash Queue",
      targetQueueName: "Cash Queue",
      initialMessage: "Setting cash receivable & queueing for collection...",
      successMessage: "Moved to Cash Queue Successfully! 💰",
      iconType: "cash",
      targetQueueKey: "cash",
      actionFn: async () => {
        setIsActionLoading(true);
        try {
          const isFromPending = dc.status === "pending";
          await transitionSavedDc(dc.id, {
            toStatus: "cash",
            action: "MOVE_TO_CASH",
            updates: {
              cashAt: new Date().toISOString(),
              cashAmount: amount,
              billedAmount: !isNaN(billed) && billed > 0 ? billed : undefined,
              hospitalMargin: hospitalMargin,
              cashRemarks:
                cashRemarksInput.trim() ||
                (hasHikedBill
                  ? `Hiked Bill: ₹${billed.toLocaleString("en-IN")} | Hospital Cut: ₹${hospitalMargin!.toLocaleString("en-IN")} | Net Cash: ₹${amount.toLocaleString("en-IN")}`
                  : ""),
              ...(isFromPending ? { isPurchase: true } : {}),
            },
          });
          const dcs = await loadSavedDcs();
          setSavedDcs(dcs);
          closeActionDialog();
          toast({
            title: "Moved to Cash queue",
            description: hasHikedBill
              ? `Expected cash: ₹${amount.toLocaleString("en-IN")} (Printed Bill: ₹${billed.toLocaleString("en-IN")})`
              : `Amount: ₹${amount.toLocaleString("en-IN")}`,
          });
        } finally {
          setIsActionLoading(false);
        }
      },
    });
  };

  const handleCreateCashMemoForDc = async (dc: SavedDc) => {
    await runActionWithProgress({
      dcNo: dc.dcNo,
      title: "Creating Cash Invoice",
      targetQueueName: "Cash Invoice Editor",
      initialMessage: "Verifying records & prefilling items into Cash Memo editor...",
      successMessage: "Opening Cash Invoice Editor... 📄",
      iconType: "cash",
      actionFn: async () => {
        setIsActionLoading(true);
        try {
          const invoices = await fetchCashInvoicesFromFirestore();
          const alreadyExists = invoices.some(
            (inv) =>
              inv.dcNumber &&
              inv.dcNumber.trim().toLowerCase() ===
                (dc.dcNo || "").trim().toLowerCase(),
          );

          if (alreadyExists) {
            toast({
              title: "Cash Invoice Already Created",
              description: `A cash memo for DC ${dc.dcNo} has already been created by another user.`,
              variant: "destructive",
            });
            return;
          }

          sessionStorage.setItem("prefill_cash_dc_no", dc.dcNo || "");
          sessionStorage.setItem("prefill_cash_client_name", dc.hospitalName || "");
          sessionStorage.setItem("from_dc_tracker", "true");
          if (dc.status === "pending" || dc.isPurchase) {
            sessionStorage.setItem("is_purchase_dc", "true");
          }
          closeActionDialog();
          navigate(
            `/cash-invoice?dcNo=${encodeURIComponent(dc.dcNo || "")}&client=${encodeURIComponent(dc.hospitalName || "")}`,
          );
        } catch (err) {
          console.error("Failed to verify if cash invoice exists:", err);
          toast({
            title: "Verification Failed",
            description:
              "Could not verify if a cash invoice already exists. Please try again.",
            variant: "destructive",
          });
        } finally {
          setIsActionLoading(false);
        }
      },
    });
  };

  const handleConfirmCancel = async (dc: SavedDc) => {
    const remarks = cancelledRemarksInput.trim();
    if (!remarks) {
      toast({ title: "Cancellation reason is required" });
      return;
    }
    const returnedBy = returnedByInput.trim();

    await runActionWithProgress({
      dcNo: dc.dcNo,
      title: "Cancelling Case",
      targetQueueName: "Cancelled Queue",
      initialMessage: "Cancelling challan & archiving case records...",
      successMessage: "Case Cancelled & Archived! ❌",
      iconType: "cancel",
      targetQueueKey: "cancelled",
      actionFn: async () => {
        setIsActionLoading(true);
        try {
          await transitionSavedDc(dc.id, {
            toStatus: "cancelled",
            action: "CANCEL_CASE",
            updates: {
              cancelledAt: new Date().toISOString(),
              cancelledRemarks: remarks,
              ...(returnedBy
                ? {
                    returnedBy,
                    returnedAt: dc.returnedAt || new Date().toISOString(),
                  }
                : {}),
            },
          });
          const dcs = await loadSavedDcs();
          setSavedDcs(dcs);
          closeActionDialog();
          toast({ title: "Case cancelled successfully" });
        } finally {
          setIsActionLoading(false);
        }
      },
    });
  };

  const restoreFromCancelled = async (dc: SavedDc) => {
    setLoadingDcIds((prev) => new Set(prev).add(dc.id));
    try {
      await transitionSavedDc(dc.id, {
        toStatus: "pending",
        action: "RESTORE_FROM_CANCELLED",
        clear: ["cancelledAt", "cancelledRemarks"],
      });
      const dcs = await loadSavedDcs();
      setSavedDcs(dcs);
      toast({ title: "Case restored to pending" });
    } catch (error) {
      console.error("Error restoring case:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to restore case",
        variant: "destructive",
      });
    } finally {
      setLoadingDcIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(dc.id);
        return newSet;
      });
    }
  };

  const moveBackToReturned = async (dc: SavedDc) => {
    const hasPaymentInfo = Boolean(
      dc.status === "completed" ||
      dc.status === "cash" ||
      dc.invoiceRef ||
      dc.cashAmount ||
      dc.paidAt ||
      dc.paymentMethod ||
      dc.utrNo ||
      dc.isPurchase
    );

    if (hasPaymentInfo) {
      openDelinkConfirmDialog(dc);
      return;
    }

    setLoadingDcIds((prev) => new Set(prev).add(dc.id));
    try {
      await transitionSavedDc(dc.id, {
        toStatus: "returned",
        action: "MOVE_BACK_TO_RETURNED",
        clear: ["invoiceRef", "invoiceRemarks", "invoiceUrl", "isTaxInvoice"],
      });
      const dcs = await loadSavedDcs();
      setSavedDcs(dcs);
      toast({ title: "Moved back to Returned" });
    } catch (error) {
      console.error("Error moving to returned:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update DC",
        variant: "destructive",
      });
    } finally {
      setLoadingDcIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(dc.id);
        return newSet;
      });
    }
  };

  const openDelinkConfirmDialog = (dc: SavedDc) => {
    setPaymentDialog({ open: false, dc: null });
    setDelinkConfirmDialog({ open: true, dc });
  };

  const executeDelinkPayment = async (
    dc: SavedDc,
    targetStatus: "cash" | "returned",
    extraUpdates?: Partial<SavedDc>,
  ) => {
    const targetQueueName = targetStatus === "returned" ? "Returned Queue" : "Cash Queue";
    await runQueueTransition(
      dc.dcNo,
      targetQueueName,
      `Delinking payment records & moving to ${targetQueueName}...`,
      async () => {
        setLoadingDcIds((prev) => new Set(prev).add(dc.id));
        setIsActionLoading(true);
        try {
          // 1. Unlink bank credit transaction in Bank Accounts / Treasury
          try {
            const txs = await fetchBankTransactionsFromFirestore(undefined, 300);
            const dcNoClean = (dc.dcNo || "").toLowerCase().trim();
            const invRefClean = (dc.invoiceRef || "").toLowerCase().trim();
            const utrClean = (dc.utrNo || "").toLowerCase().trim();

            const matchingTxs = txs.filter((t) => {
              const linkedInv = (t.linkedInvoiceNumber || t.linkedInvoiceId || "")
                .toLowerCase()
                .trim();
              const refNo = (t.referenceNumber || "").toLowerCase().trim();
              if (utrClean && refNo === utrClean) return true;
              if (
                linkedInv &&
                (linkedInv === invRefClean ||
                  linkedInv === "dc #" + dcNoClean ||
                  linkedInv === dcNoClean)
              )
                return true;
              return false;
            });

            for (const tx of matchingTxs) {
              await unlinkBankTransactionFromCashInvoice(tx.id, false);
            }
          } catch (err) {
            console.warn("Could not unlink bank transaction during delink:", err);
          }

          // 2. Unlink & Reset Cash Invoice payment status if linked
          if (dc.invoiceRef) {
            try {
              const invs = await fetchCashInvoicesFromFirestore();
              const invRefClean = dc.invoiceRef.trim().toLowerCase();
              const matchingInv = invs.find(
                (i) =>
                  i.invNumber && i.invNumber.trim().toLowerCase() === invRefClean,
              );

              if (matchingInv) {
                if (targetStatus === "returned") {
                  await deleteCashInvoiceFromFirestore(matchingInv.invNumber);
                } else {
                  const resetInv: CashInvoiceData = {
                    ...matchingInv,
                    paymentReceived: 0,
                    status: "pending",
                    paymentMode: undefined,
                    paymentAt: undefined,
                    paymentNote: undefined,
                    lastBankPaymentRef: undefined,
                    lastBankPaymentDate: undefined,
                    lastBankPaymentAccountId: undefined,
                    savedAt: Date.now(),
                  };
                  await saveCashInvoiceToFirestore(resetInv);
                }
              }
            } catch (invErr) {
              console.warn(
                "Could not reset cash invoice payment state during delink:",
                invErr,
              );
            }
          }

          // 3. Determine original Cash Invoice / DC amount before delinking
          let originalCashAmount = dc.cashAmount || 0;
          if (dc.invoiceRef) {
            try {
              const invs = await fetchCashInvoicesFromFirestore();
              const match = invs.find(
                (i) =>
                  i.invNumber &&
                  i.invNumber.trim().toLowerCase() ===
                    dc.invoiceRef?.trim().toLowerCase(),
              );
              if (
                match &&
                (Number(match.grandTotal) || Number(match.actualReceivable))
              ) {
                originalCashAmount = Number(
                  match.grandTotal || match.actualReceivable,
                );
              }
            } catch {}
          }
          if (!originalCashAmount && dc.billedAmount) {
            originalCashAmount = dc.billedAmount - (dc.hospitalMargin || 0);
          }

          // 4. Clear payment metadata fields
          const clearFields: Array<keyof SavedDc> = [
            "paidAt",
            "paymentMethod",
            "utrNo",
            "bankName",
            "accountNumber",
            "collectedBy",
            "cashAt",
            "cashRemarks",
            "paidAmount",
            "originalInvoiceTotal",
            "isPartialPayment",
            "partPayments",
          ];

          if (targetStatus === "returned") {
            clearFields.push(
              "invoiceRef",
              "invoiceRemarks",
              "invoiceUrl",
              "isTaxInvoice",
              "cashAmount",
              "billedAmount",
              "hospitalMargin",
              "isPurchase",
            );
          }

          await transitionSavedDc(dc.id, {
            toStatus: targetStatus,
            action:
              targetStatus === "returned"
                ? "DELINK_PAYMENT_MOVE_TO_RETURNED"
                : "DELINK_PAYMENT_MOVE_TO_CASH",
            clear: clearFields,
            updates: {
              paidAmount: 0,
              isPartialPayment: false,
              partPayments: [],
              ...(targetStatus === "cash"
                ? {
                    cashAmount:
                      originalCashAmount > 0
                        ? originalCashAmount
                        : dc.originalInvoiceTotal || dc.cashAmount,
                    cashRemarks:
                      "Payment delinked & reset like new. Awaiting fresh collection.",
                  }
                : {}),
              ...extraUpdates,
            },
            meta: {
              note: `Payment delinked by user. Reset all part payments like new. Moved to ${targetStatus === "returned" ? "Returned Queue" : "Cash Queue"}.`,
              previousPaidAmount: dc.paidAmount,
              previousPartPayments: dc.partPayments,
              previousPaidAt: dc.paidAt,
              previousUtrNo: dc.utrNo,
              previousPaymentMethod: dc.paymentMethod,
            },
          });

          // 5. Refresh local states instantly
          setLinkedBankTx(null);
          const [refreshedDcs, refreshedInvs] = await Promise.all([
            loadSavedDcs(),
            fetchCashInvoicesFromFirestore(),
          ]);
          setSavedDcs(refreshedDcs);
          setCashInvoices(refreshedInvs);
          setDelinkConfirmDialog({ open: false, dc: null });

          toast({
            title: "⚡ Payment Delinked & Reset",
            description: `DC #${dc.dcNo} payment & part payments reset like new! Moved to ${targetQueueName}.`,
          });
        } catch (error) {
          console.error("Error delinking payment:", error);
          toast({
            title: "Error Delinking Payment",
            description:
              error instanceof Error ? error.message : "Failed to update DC",
            variant: "destructive",
          });
        } finally {
          setIsActionLoading(false);
          setLoadingDcIds((prev) => {
            const newSet = new Set(prev);
            newSet.delete(dc.id);
            return newSet;
          });
        }
      },
      targetStatus
    );
  };

  const handleDeletePartPaymentInstallment = async (
    dc: SavedDc,
    indexToDelete: number,
  ) => {
    const existingPartPayments = dc.partPayments || [];
    if (indexToDelete < 0 || indexToDelete >= existingPartPayments.length)
      return;

    const deletedItem = existingPartPayments[indexToDelete];
    const confirmText = `Are you sure you want to delete Installment #${indexToDelete + 1} (+₹${deletedItem.amount.toLocaleString("en-IN")})?`;
    if (!window.confirm(confirmText)) return;

    setLoadingDcIds((prev) => new Set(prev).add(dc.id));
    setIsActionLoading(true);
    try {
      const updatedPartPayments = existingPartPayments.filter(
        (_, idx) => idx !== indexToDelete,
      );
      const newPaidAmount = updatedPartPayments.reduce(
        (sum, item) => sum + (item.amount || 0),
        0,
      );
      const originalInvoiceTotal =
        dc.originalInvoiceTotal ||
        dc.cashAmount ||
        (dc.billedAmount
          ? dc.billedAmount - (dc.hospitalMargin || 0)
          : newPaidAmount);

      const isStillPartial =
        newPaidAmount > 0 && newPaidAmount < originalInvoiceTotal;
      const nextStatus: SavedDcStatus = isStillPartial
        ? "cash"
        : newPaidAmount >= originalInvoiceTotal && originalInvoiceTotal > 0
          ? "completed"
          : "cash";

      const methodLabel =
        updatedPartPayments.length > 0
          ? updatedPartPayments[updatedPartPayments.length - 1]
              .paymentMethod === "cash"
            ? "Cash"
            : "Bank Transfer"
          : "Cash";
      const newCashRemarks =
        updatedPartPayments.length === 0 || newPaidAmount === 0
          ? "Part payment installment deleted. Awaiting re-collection."
          : isStillPartial
            ? `Part Payment Received: ₹${newPaidAmount.toLocaleString("en-IN")} of ₹${originalInvoiceTotal.toLocaleString("en-IN")} (Balance Due: ₹${(originalInvoiceTotal - newPaidAmount).toLocaleString("en-IN")}) via ${methodLabel}`
            : `Paid ₹${newPaidAmount.toLocaleString("en-IN")} via ${methodLabel}`;

      await transitionSavedDc(dc.id, {
        toStatus: nextStatus,
        action: "DELETE_PART_PAYMENT_INSTALLMENT",
        updates: {
          partPayments: updatedPartPayments,
          paidAmount: newPaidAmount,
          isPartialPayment: isStillPartial,
          cashRemarks: newCashRemarks,
        },
        meta: {
          note: `Deleted installment #${indexToDelete + 1} (₹${deletedItem.amount.toLocaleString("en-IN")}).`,
          deletedInstallment: deletedItem,
          deletedIndex: indexToDelete,
          remainingPartPaymentsCount: updatedPartPayments.length,
          newPaidAmount,
          originalInvoiceTotal,
        },
      });

      const refreshedDcs = await loadSavedDcs();
      setSavedDcs(refreshedDcs);

      const updatedDcObj = refreshedDcs.find((d) => d.id === dc.id);
      if (
        updatedDcObj &&
        paymentDialog.open &&
        paymentDialog.dc?.id === dc.id
      ) {
        setPaymentDialog({ open: true, dc: updatedDcObj });
      }

      toast({
        title: "🗑️ Installment Deleted",
        description: `Installment #${indexToDelete + 1} (₹${deletedItem.amount.toLocaleString("en-IN")}) removed. Paid total is now ₹${newPaidAmount.toLocaleString("en-IN")}.`,
      });
    } catch (error) {
      console.error("Error deleting part payment installment:", error);
      toast({
        title: "Error Deleting Installment",
        description:
          error instanceof Error ? error.message : "Failed to update DC",
        variant: "destructive",
      });
    } finally {
      setIsActionLoading(false);
      setLoadingDcIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(dc.id);
        return newSet;
      });
    }
  };

  const cancelReturnToPending = async (dc: SavedDc) => {
    await runQueueTransition(
      dc.dcNo,
      "Delivered Queue",
      "Clearing returned status & moving back to Delivered...",
      async () => {
        setLoadingDcIds((prev) => new Set(prev).add(dc.id));
        try {
          await transitionSavedDc(dc.id, {
            toStatus: "pending",
            action: "MOVE_BACK_TO_PENDING",
            clear: ["returnedBy", "returnedAt", "returnedRemarks"],
            meta: {
              previousReturnedBy: dc.returnedBy,
              previousReturnedAt: dc.returnedAt,
            },
          });
          const dcs = await loadSavedDcs();
          setSavedDcs(dcs);
          toast({ title: "Moved back to Delivered" });
        } catch (error) {
          console.error("Error moving to pending:", error);
          toast({
            title: "Error",
            description:
              error instanceof Error ? error.message : "Failed to update DC",
            variant: "destructive",
          });
        } finally {
          setLoadingDcIds((prev) => {
            const newSet = new Set(prev);
            newSet.delete(dc.id);
            return newSet;
          });
        }
      },
      "pending"
    );
  };

  const SortableHeader = ({
    children,
    sortKey,
    className = "",
  }: {
    children: React.ReactNode;
    sortKey: "date" | "dcNo" | "party" | "items" | "days" | "status";
    className?: string;
  }) => (
    <button
      onClick={() => {
        if (sortBy === sortKey) {
          setSortOrder(sortOrder === "desc" ? "asc" : "desc");
        } else {
          setSortBy(sortKey);
          setSortOrder("desc");
        }
      }}
      className={`flex items-center gap-1 hover:bg-slate-200 px-2 py-1 rounded transition-colors ${className}`}
    >
      {children}
      <ArrowUpDown
        className={`h-3 w-3 ${sortBy === sortKey ? "text-slate-700" : "text-slate-400"}`}
      />
      {sortBy === sortKey && (
        <span className="text-xs font-bold text-slate-700">
          {sortOrder === "desc" ? "↓" : "↑"}
        </span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden flex flex-col">
      {/* Main Content */}
      <main className="flex-grow flex flex-col w-full px-3 sm:px-6 lg:px-8 py-3 sm:py-4 overflow-x-hidden">
        {/* Top toolbar */}
        <TopToolbar
          theme={theme}
          toggleTheme={toggleTheme}
          fetchProcedures={fetchProcedures}
          loading={proceduresLoading}
          handlePrint={() => {}}
          navigate={navigate}
          handleLogout={handleLogout}
          setDcMode={(mode) => navigate(`/?mode=${mode}`)}
          setInitialFilterType={() => {}}
          setShowProcedureSelector={() => {}}
          setActiveProcedures={() => {}}
          setCollapsedProcedures={() => {}}
        />

        {/* DC Tracker Header: Collect Payments Scroller */}
        <div className="mb-4">
          <CollectPaymentsScroller
            savedDcs={savedDcs}
            cashInvoices={cashInvoices}
            onCollectPayment={openPaymentDialog}
            onViewDc={(dc, queue) => {
              setActiveQueue(queue);
              setSearchParams({ queue });
              setSelectedDcId(dc.id);
              setDetailsDialogOpen(true);
            }}
          />
          <DcTrackerNotifications
            savedDcs={savedDcs}
            cashInvoices={cashInvoices}
            onCollectPayment={openPaymentDialog}
            onRecordReturn={(dc) => openActionDialog("return", dc)}
            onViewDc={(dc, queue) => {
              setActiveQueue(queue);
              setSearchParams({ queue });
              setSelectedDcId(dc.id);
              setDetailsDialogOpen(true);
            }}
          />
        </div>

        <div className="space-y-4">

          <Card className="bg-card text-card-foreground shadow-none border rounded-xl">
            {(isLoading || savedDcs.length > 0) && (
              <CardHeader className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                {/* Row 1: Search Bar (Expanded), Quick Time Pills, Date Filter Icon & Export CSV Icon */}
                <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-2.5 bg-slate-50 dark:bg-slate-900/60 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                  {/* Prominent Full-Width Search Input till filter controls */}
                  <div className="relative flex-1 min-w-[240px]">
                    <Input
                      id="dc-tracker-search-input"
                      type="search"
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      placeholder="Search Party, DC No, Personnel..."
                      className="pl-3.5 pr-10 h-9 text-xs sm:text-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus-visible:ring-teal-600 rounded-lg shadow-2xs w-full"
                    />
                    <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5 z-10">
                      {filterText && (
                        <button
                          type="button"
                          onClick={() => setFilterText("")}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                          title="Clear search"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <Search className="h-4 w-4 text-slate-400 shrink-0 pointer-events-none" />
                    </div>
                  </div>

                  {/* Right Tools Group: Quick Time Pills, Date Filter Icon, Reset & Export CSV Icon */}
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                    {/* Quick Time Pills (All, Today, Week, Month) */}
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                      {["all", "today", "week", "month"].map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setQuickFilter(filter)}
                          className={`px-2.5 py-0.5 text-xs font-bold rounded-md transition-all capitalize ${
                            quickFilter === filter
                              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs"
                              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                          }`}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>

                    {/* Date Range Filter Icon Button (Popover inside Icon) */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          size="icon"
                          variant="outline"
                          className={`h-8 w-8 relative border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 shadow-2xs ${
                            dateFrom || dateTo
                              ? "border-teal-500 ring-2 ring-teal-500/20 text-teal-700"
                              : "text-slate-700 dark:text-slate-300"
                          }`}
                          title={dateFrom || dateTo ? `Date Filter: ${dateFrom || "Any"} to ${dateTo || "Any"}` : "Filter by Date Range"}
                        >
                          <Calendar className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                          {(dateFrom || dateTo) && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-teal-600 rounded-full ring-2 ring-white dark:ring-slate-950" />
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="p-3.5 w-72 space-y-3 z-50 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-950">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-teal-600" /> Date Range Filter
                          </span>
                          {(dateFrom || dateTo) && (
                            <button
                              onClick={() => {
                                setDateFrom("");
                                setDateTo("");
                              }}
                              className="text-[11px] font-bold text-rose-600 hover:underline"
                            >
                              Clear Date
                            </button>
                          )}
                        </div>
                        <div className="space-y-2.5">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">From Date</label>
                            <DateFilterPicker label="From date" value={dateFrom} onChange={setDateFrom} />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">To Date</label>
                            <DateFilterPicker label="To date" value={dateTo} onChange={setDateTo} />
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Reset Filters button if active */}
                    {(filterText || dateFrom || dateTo || quickFilter !== "all") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setFilterText("");
                          setDateFrom("");
                          setDateTo("");
                          setQuickFilter("all");
                        }}
                        className="h-7 px-2 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 shrink-0"
                      >
                        Reset Filters
                      </Button>
                    )}

                    {/* Export CSV Icon Button */}
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={handleExportCSV}
                      className="h-8 w-8 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0 shadow-2xs"
                      title="Export CSV"
                    >
                      <Download className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    </Button>
                  </div>
                </div>

                {/* Row 2: Dedicated Status Queue Tabs (High-contrast active pills) */}
                <Tabs
                  value={activeQueue}
                  onValueChange={(value) => {
                    setActiveQueue(value as SavedDcStatus);
                    setSearchParams({ queue: value });
                    setSelectedDcId(null);
                  }}
                  className="w-full"
                >
                  <TabsList className="grid h-11 grid-cols-5 gap-1 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900 p-1 shadow-2xs">
                    {/* Delivered Tab */}
                    <TabsTrigger
                      value="pending"
                      className="flex h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-xs sm:text-sm font-semibold transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-teal-800 dark:data-[state=active]:text-teal-300 data-[state=active]:shadow-2xs data-[state=active]:font-bold border border-transparent data-[state=active]:border-teal-200/80 dark:data-[state=active]:border-teal-900/40"
                    >
                      <Truck className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
                      <span className="hidden sm:inline">Delivered</span>
                      {statusCounts.pending > 0 && (
                        <Badge
                          className={`h-5 min-w-5 flex items-center justify-center text-[10px] px-1 font-bold rounded-full transition-all ${
                            activeQueue === "pending"
                              ? "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800"
                              : "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {statusCounts.pending > 99 ? "99+" : statusCounts.pending}
                        </Badge>
                      )}
                    </TabsTrigger>

                    {/* Returned Tab */}
                    <TabsTrigger
                      value="returned"
                      className="flex h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-xs sm:text-sm font-semibold transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-teal-800 dark:data-[state=active]:text-teal-300 data-[state=active]:shadow-2xs data-[state=active]:font-bold border border-transparent data-[state=active]:border-teal-200/80 dark:data-[state=active]:border-teal-900/40"
                    >
                      <RotateCcw className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
                      <span className="hidden sm:inline">Returned</span>
                      {statusCounts.returned > 0 && (
                        <Badge
                          className={`h-5 min-w-5 flex items-center justify-center text-[10px] px-1 font-bold rounded-full transition-all ${
                            activeQueue === "returned"
                              ? "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800"
                              : "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {statusCounts.returned > 99 ? "99+" : statusCounts.returned}
                        </Badge>
                      )}
                    </TabsTrigger>

                    {/* Completed Tab */}
                    <TabsTrigger
                      value="completed"
                      className="flex h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-xs sm:text-sm font-semibold transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-emerald-800 dark:data-[state=active]:text-emerald-300 data-[state=active]:shadow-2xs data-[state=active]:font-bold border border-transparent data-[state=active]:border-emerald-200/80 dark:data-[state=active]:border-emerald-900/40"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span className="hidden sm:inline">Completed</span>
                      {statusCounts.completed > 0 && (
                        <Badge
                          className={`h-5 min-w-5 flex items-center justify-center text-[10px] px-1 font-bold rounded-full transition-all ${
                            activeQueue === "completed"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {statusCounts.completed > 99 ? "99+" : statusCounts.completed}
                        </Badge>
                      )}
                    </TabsTrigger>

                    {/* Cash Tab */}
                    <TabsTrigger
                      value="cash"
                      className="flex h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-xs sm:text-sm font-semibold transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-amber-800 dark:data-[state=active]:text-amber-300 data-[state=active]:shadow-2xs data-[state=active]:font-bold border border-transparent data-[state=active]:border-amber-200/80 dark:data-[state=active]:border-amber-900/40"
                    >
                      <Wallet className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span className="hidden sm:inline">Cash</span>
                      {statusCounts.cash > 0 && (
                        <Badge
                          className={`h-5 min-w-5 flex items-center justify-center text-[10px] px-1 font-bold rounded-full transition-all ${
                            activeQueue === "cash"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                              : "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {statusCounts.cash > 99 ? "99+" : statusCounts.cash}
                        </Badge>
                      )}
                    </TabsTrigger>

                    {/* Cancelled Tab */}
                    <TabsTrigger
                      value="cancelled"
                      className="flex h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-xs sm:text-sm font-semibold transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-rose-800 dark:data-[state=active]:text-rose-300 data-[state=active]:shadow-2xs data-[state=active]:font-bold border border-transparent data-[state=active]:border-rose-200/80 dark:data-[state=active]:border-rose-900/40"
                    >
                      <Ban className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                      <span className="hidden sm:inline">Cancelled</span>
                      {statusCounts.cancelled > 0 && (
                        <Badge
                          className={`h-5 min-w-5 flex items-center justify-center text-[10px] px-1 font-bold rounded-full transition-all ${
                            activeQueue === "cancelled"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                              : "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {statusCounts.cancelled > 99 ? "99+" : statusCounts.cancelled}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
            )}

            <CardContent className="p-0">
              {isLoading && savedDcs.length === 0 ? (
                <div className="py-20 flex justify-center items-center">
                  <AppLoadingSpinner
                    message="Loading DCs..."
                    subtext="Fetching Delivery Challans from database"
                  />
                </div>
              ) : savedDcs.length === 0 ? (
                <div className="p-8 sm:p-12 text-center border-t border-slate-200">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-muted/20 flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold mb-2">
                    No DCs Tracked Yet
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Save a DC from the generator to start tracking.
                  </p>
                </div>
              ) : (
                <>
                  {/* Top Action Banner when a DC is selected */}
                  {selectedDc &&
                    (() => {
                      const daysPending = getDaysPending(selectedDc);
                      const hasPartPayments = Boolean(
                        selectedDc.partPayments &&
                          selectedDc.partPayments.length > 0,
                      );

                      // Consistent Sticky Row Theme Configuration
                      const getStatusCardTheme = () => {
                        return "border-2 border-slate-300 dark:border-slate-700 shadow-md bg-background dark:bg-slate-900/95";
                      };

                      const getStatusBadgeStyle = () => {
                        switch (selectedDc.status) {
                          case "pending":
                            return "bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950 dark:text-teal-200";
                          case "returned":
                            return "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-200";
                          case "cash":
                            return "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 font-extrabold";
                          case "completed":
                            return "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 font-extrabold";
                          case "cancelled":
                            return "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200";
                          default:
                            return "bg-slate-100 text-slate-900 border-slate-300";
                        }
                      };

                      return (
                        <div
                          className={`sticky top-[80px] z-20 mb-4 mt-2 p-2 px-4 text-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200 dark:text-slate-100 ${getStatusCardTheme()}`}
                        >
                          {/* Left Status Info */}
                          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                            <Badge className="bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-black px-2.5 py-1 shadow-2xs">
                              DC #{selectedDc.dcNo}
                            </Badge>
                            {/* Status Icon Only */}
                            {(() => {
                              switch (selectedDc.status) {
                                case "pending":
                                  return (
                                    <div
                                      className="h-7 w-7 rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border border-teal-300 dark:border-teal-800 flex items-center justify-center shrink-0 shadow-2xs"
                                      title="Delivered Queue"
                                    >
                                      <Truck className="w-4 h-4" />
                                    </div>
                                  );
                                case "returned":
                                  return (
                                    <div
                                      className="h-7 w-7 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center justify-center shrink-0 shadow-2xs"
                                      title="Returned Queue"
                                    >
                                      <RotateCcw className="w-4 h-4" />
                                    </div>
                                  );
                                case "cash":
                                  return (
                                    <div
                                      className="h-7 w-7 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center justify-center shrink-0 shadow-2xs"
                                      title="Awaiting Payment (Cash Queue)"
                                    >
                                      <Wallet className="w-4 h-4" />
                                    </div>
                                  );
                                case "completed":
                                  return (
                                    <div
                                      className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center shrink-0 shadow-2xs"
                                      title="Paid / Completed"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                    </div>
                                  );
                                case "cancelled":
                                  return (
                                    <div
                                      className="h-7 w-7 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center justify-center shrink-0 shadow-2xs"
                                      title="Cancelled"
                                    >
                                      <Ban className="w-4 h-4" />
                                    </div>
                                  );
                                default:
                                  return (
                                    <div
                                      className="h-7 w-7 rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 flex items-center justify-center shrink-0 shadow-2xs"
                                      title={selectedDc.status}
                                    >
                                      <FileText className="w-4 h-4" />
                                    </div>
                                  );
                              }
                            })()}
                            <span
                              className="font-bold text-sm truncate max-w-[220px]"
                              title={selectedDc.hospitalName}
                            >
                              {selectedDc.hospitalName}
                            </span>
                            {/* Hide memo number in cash queue */}
                            {selectedDc.invoiceRef && selectedDc.status !== "cash" && (
                              <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 font-mono text-[10px] px-1.5 py-0.5 border border-slate-300 dark:border-slate-700">
                                #{selectedDc.invoiceRef}
                              </Badge>
                            )}
                          </div>

                          {/* Right Actions */}
                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            {/* Part payment info button */}
                            {hasPartPayments && (
                              <Button
                                size="sm"
                                className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1.5 shadow-xs"
                                onClick={() => {
                                  setDetailsModalTab("payment");
                                  setIsTrackPartPaymentsOpen(true);
                                  setDetailsDialogOpen(true);
                                }}
                              >
                                <Banknote className="w-3.5 h-3.5" /> Payment Info ({selectedDc.partPayments!.length})
                              </Button>
                            )}

                            {/* Status Specific Primary Action Buttons */}
                            {selectedDc.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  className="h-8 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg gap-1.5 shadow-xs"
                                  onClick={() =>
                                    openActionDialog("return", selectedDc)
                                  }
                                >
                                  <RotateCcw className="w-3.5 h-3.5" /> Return
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-8 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg gap-1.5 shadow-xs"
                                  onClick={() =>
                                    openActionDialog("purchase", selectedDc)
                                  }
                                >
                                  <ShoppingBag className="w-3.5 h-3.5" /> Direct Purchase
                                </Button>
                              </>
                            )}

                            {selectedDc.status === "returned" && (
                              <>
                                {!selectedDc.invoiceRef && (
                                  <>
                                    <Button
                                      size="sm"
                                      className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg gap-1.5 shadow-xs"
                                      onClick={() =>
                                        handleCreateCashMemoForDc(selectedDc)
                                      }
                                    >
                                      <Receipt className="w-3.5 h-3.5" /> Cash Memo
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg gap-1.5 shadow-xs"
                                      onClick={() =>
                                        openActionDialog("invoice", selectedDc)
                                      }
                                    >
                                      <FileText className="w-3.5 h-3.5" /> Tax Invoice
                                    </Button>
                                  </>
                                )}
                              </>
                            )}

                            {/* Memo viewing button if invoiceRef exists */}
                            {selectedDc.invoiceRef && selectedIsCashMemo && (
                              <Button
                                size="sm"
                                className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg gap-1.5 shadow-xs"
                                onClick={() => {
                                  setViewingCashMemoRef(selectedDc.invoiceRef!);
                                  setCashMemoModalOpen(true);
                                }}
                              >
                                <Receipt className="w-3.5 h-3.5" /> View Memo
                              </Button>
                            )}

                            {/* Cash Queue specific Record Payment button */}
                            {selectedDc.status === "cash" && (
                              <Button
                                size="sm"
                                className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1.5 shadow-xs"
                                onClick={() => openPaymentDialog(selectedDc)}
                              >
                                <Wallet className="w-3.5 h-3.5" /> Pay
                              </Button>
                            )}

                            {selectedDc.invoiceRef && selectedIsTaxInvoice && (
                              <Button
                                size="sm"
                                className="h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg gap-1.5 shadow-xs"
                                onClick={() =>
                                  selectedDc.invoiceUrl
                                    ? window.open(
                                        selectedDc.invoiceUrl,
                                        "_blank",
                                      )
                                    : openActionDialog("invoice", selectedDc)
                                }
                              >
                                <ExternalLink className="w-3.5 h-3.5" /> GoGSTBill
                              </Button>
                            )}

                            {/* Completed Status Payment Details shortcut */}
                            {selectedDc.status === "completed" && !hasPartPayments && (
                              <Button
                                size="sm"
                                className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1.5 shadow-xs"
                                onClick={() => {
                                  setDetailsModalTab("payment");
                                  setDetailsDialogOpen(true);
                                }}
                              >
                                <Banknote className="w-3.5 h-3.5" /> Payment Info
                              </Button>
                            )}

                            <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1 hidden sm:block" />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-teal-700 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/80 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded-lg shadow-2xs"
                              onClick={() => setDcDocumentModalOpen(true)}
                              title="View DC Document"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg shadow-2xs"
                              onClick={() => {
                                setDetailsModalTab("overview");
                                setDetailsDialogOpen(true);
                              }}
                              title="Track Status & History"
                            >
                              <Activity className="w-4 h-4" />
                            </Button>

                            {/* Close Button */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 rounded-lg ml-1"
                              onClick={() => setSelectedDcId(null)}
                              title="Deselect"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })()}

                  {/* DC Tracker Main View: Full Width Layout */}
                  <div className="w-full">
                    <div className="border-t-2 border-border">
                      {filteredDcs.length === 0 ? (
                        <div className="p-8 sm:p-12 text-center">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-muted/20 flex items-center justify-center mx-auto mb-4">
                            <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                          </div>
                          <h3 className="text-base sm:text-lg font-semibold mb-2">
                            No DCs found
                          </h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            No delivery challans match your current filters.
                          </p>
                          {(filterText ||
                            dateFrom ||
                            dateTo ||
                            quickFilter !== "all") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setFilterText("");
                                setDateFrom("");
                                setDateTo("");
                                setQuickFilter("all");
                              }}
                            >
                              Clear all filters
                            </Button>
                          )}
                        </div>
                      ) : (
                        <>
                          {/* Mobile Card View */}
                          <div className="md:hidden divide-y divide-slate-200">
                            {filteredDcs.map((dc) => {
                              const daysPending = getDaysPending(dc);
                              const totalQty = getTotalQty(dc);
                              const isSelected = selectedDcId === dc.id;
                              return (
                                <div
                                  key={dc.id}
                                  className={`group p-3 transition-colors duration-150 cursor-pointer ${
                                    isSelected
                                      ? "bg-teal-500/10 border-l-4 border-l-teal-600 font-semibold"
                                      : "bg-white border-l-4 border-l-transparent hover:border-l-teal-500 hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900"
                                  }`}
                                  onClick={() => setSelectedDcId(dc.id)}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedDcId(dc.id);
                                            setDetailsDialogOpen(true);
                                          }}
                                          className="font-semibold text-blue-700 hover:underline text-sm"
                                        >
                                          {dc.dcNo}
                                        </button>
                                        <Badge
                                          className={`${getStatusBadgeClass(dc.status)} flex items-center gap-1 text-[10px] font-medium border px-1.5 py-0.5`}
                                        >
                                          {getStatusIcon(dc.status)}
                                          {dc.status.charAt(0).toUpperCase() +
                                            dc.status.slice(1)}
                                        </Badge>
                                      </div>
                                      <div className="mt-1">
                                        <div className="text-sm font-semibold text-slate-900 break-words whitespace-normal">
                                          {dc.hospitalName}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                                        <span className="flex items-center gap-1">
                                          <Calendar className="h-3 w-3" />
                                          {formatDate(getDisplayDate(dc))}
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Package className="h-3 w-3" />
                                          {totalQty} items
                                        </span>
                                        <span
                                          className={`flex items-center gap-1 ${daysPending > 7 && dc.status === "pending" ? "text-red-600 font-medium" : ""}`}
                                        >
                                          {daysPending}d
                                          {daysPending > 7 &&
                                            dc.status === "pending" && (
                                              <AlertCircle className="h-3 w-3" />
                                            )}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      {/* Quick Call Icon Action */}
                                      {(() => {
                                        const contactSummary =
                                          getHospitalContactSummary(
                                            dc.hospitalName,
                                          );
                                        return (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenHospitalContact(
                                                dc.hospitalName,
                                                dc,
                                                !contactSummary.hasPhone,
                                              );
                                            }}
                                            className={`w-8 h-8 flex items-center justify-center rounded-full transition-all shadow-none border ${
                                              contactSummary.hasPhone
                                                ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                                                : "bg-slate-50 border-slate-200 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200"
                                            }`}
                                            title={
                                              contactSummary.hasPhone
                                                ? `Call / Contacts: ${contactSummary.primaryPhone}`
                                                : `Add phone number for ${dc.hospitalName}`
                                            }
                                          >
                                            <Phone className="w-3.5 h-3.5" />
                                          </button>
                                        );
                                      })()}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedDcId(dc.id);
                                          setDcDocumentModalOpen(true);
                                        }}
                                        className="w-8 h-8 flex items-center justify-center bg-teal-50 border border-teal-200 rounded-full text-teal-700 hover:bg-teal-100 transition-all shadow-none"
                                        title="View Delivery Challan (Document Preview)"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedDcId(dc.id);
                                          setDetailsDialogOpen(true);
                                        }}
                                        className="w-8 h-8 flex items-center justify-center bg-blue-50 border border-blue-200 rounded-full text-blue-700 hover:bg-blue-100 transition-all shadow-none"
                                        title="Track Status & History"
                                      >
                                        <Activity className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handlePrint(dc);
                                        }}
                                        className="w-8 h-8 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-full text-slate-700 hover:bg-slate-100 transition-all shadow-none"
                                        title="Print DC"
                                      >
                                        <Printer className="w-4 h-4" />
                                      </button>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0"
                                            onClick={(e) => e.stopPropagation()}
                                            disabled={loadingDcIds.has(dc.id)}
                                          >
                                            {loadingDcIds.has(dc.id) ? (
                                              <RefreshCw className="h-4 w-4 text-slate-600 animate-spin" />
                                            ) : (
                                              <Edit className="h-4 w-4 text-slate-600" />
                                            )}
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                          align="end"
                                          className="w-52"
                                        >
                                          <DropdownMenuItem
                                            onClick={() => {
                                              const cs =
                                                getHospitalContactSummary(
                                                  dc.hospitalName,
                                                );
                                              handleOpenHospitalContact(
                                                dc.hospitalName,
                                                dc,
                                                !cs.hasPhone,
                                              );
                                            }}
                                            className="gap-2 font-medium text-emerald-800 dark:text-emerald-300"
                                          >
                                            <Phone className="h-4 w-4 text-emerald-600" />
                                            {getHospitalContactSummary(
                                              dc.hospitalName,
                                            ).hasPhone
                                              ? `Call (${getHospitalContactSummary(dc.hospitalName).primaryPhone})`
                                              : "Add Phone Number"}
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => openEditDcModal(dc)}
                                            className="gap-2 font-bold text-teal-800 dark:text-teal-300 bg-teal-50/60 hover:bg-teal-100 cursor-pointer"
                                          >
                                            <Edit className="h-4 w-4 text-blue-600" />
                                            Edit DC Details
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={() => {
                                              setSelectedDcId(dc.id);
                                              setDcDocumentModalOpen(true);
                                            }}
                                            className="gap-2"
                                          >
                                            <Eye className="h-4 w-4 text-blue-600" />
                                            View DC Document
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => {
                                              setSelectedDcId(dc.id);
                                              setDetailsDialogOpen(true);
                                            }}
                                            className="gap-2"
                                          >
                                            <Activity className="h-4 w-4 text-blue-600" />
                                            Track Status
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => handlePrint(dc)}
                                            className="gap-2"
                                          >
                                            <Printer className="h-4 w-4 text-indigo-600" />
                                            Print DC
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => handleShare(dc)}
                                            className="gap-2"
                                          >
                                            <Share2 className="h-4 w-4 text-slate-600" />
                                            Share PDF
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={() =>
                                              openActionDialog("return", dc)
                                            }
                                            disabled={dc.status !== "pending"}
                                            className="gap-2"
                                          >
                                            <RotateCcw className="h-4 w-4" />
                                            Mark as Returned
                                          </DropdownMenuItem>
                                          {dc.status === "pending" && (
                                            <>
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  openActionDialog(
                                                    "purchase",
                                                    dc,
                                                  )
                                                }
                                                className="gap-2 font-bold text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30 cursor-pointer"
                                              >
                                                <ShoppingBag className="h-4 w-4 text-slate-600" />
                                                Purchase (Direct Sale)
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  handleCreateCashMemoForDc(dc)
                                                }
                                                className="gap-2 pl-7 text-xs text-blue-700 hover:bg-blue-50 dark:text-blue-400 cursor-pointer font-medium"
                                              >
                                                <Receipt className="h-3.5 w-3.5 text-blue-600" />
                                                &bull; Cash Invoice
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  openActionDialog(
                                                    "invoice",
                                                    dc,
                                                  )
                                                }
                                                className="gap-2 pl-7 text-xs text-purple-700 hover:bg-purple-50 dark:text-purple-400 cursor-pointer font-medium"
                                              >
                                                <FileText className="h-3.5 w-3.5 text-slate-600" />
                                                &bull; Go GST Bill
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  openActionDialog("cancel", dc)
                                                }
                                                className="gap-2 text-orange-600"
                                              >
                                                <AlertCircle className="h-4 w-4" />
                                                Cancel Case
                                              </DropdownMenuItem>
                                            </>
                                          )}
                                          {dc.status === "cancelled" && (
                                            <DropdownMenuItem
                                              onClick={() =>
                                                restoreFromCancelled(dc)
                                              }
                                              className="gap-2"
                                            >
                                              <Undo2 className="h-4 w-4" />
                                              Restore to Pending
                                            </DropdownMenuItem>
                                          )}
                                          {dc.status === "returned" && (
                                            <>
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  openActionDialog(
                                                    "invoice",
                                                    dc,
                                                  )
                                                }
                                                className="gap-2"
                                              >
                                                <Receipt className="h-4 w-4" />
                                                Link Invoice
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  handleCreateCashMemoForDc(dc)
                                                }
                                                className="gap-2 font-bold text-blue-700 hover:bg-blue-50"
                                              >
                                                <Receipt className="h-4 w-4 text-blue-600" />
                                                Create Cash Memo
                                              </DropdownMenuItem>
                                            </>
                                          )}
                                          {dc.status === "completed" && (
                                            <>
                                              {dc.invoiceRef &&
                                                (dc.isTaxInvoice ||
                                                  (!dc.cashAmount &&
                                                    !dc.invoiceRef.startsWith(
                                                      "SRR-",
                                                    ))) && (
                                                  <>
                                                    <DropdownMenuItem
                                                      onClick={() =>
                                                        openActionDialog(
                                                          "invoice",
                                                          dc,
                                                        )
                                                      }
                                                      className="gap-2 font-bold text-purple-800 bg-purple-50 hover:bg-purple-100 cursor-pointer"
                                                    >
                                                      <FileText className="h-4 w-4 text-slate-600" />
                                                      Tax Invoice:{" "}
                                                      {dc.invoiceRef}
                                                    </DropdownMenuItem>
                                                    {dc.invoiceUrl ? (
                                                      <DropdownMenuItem
                                                        onClick={() =>
                                                          window.open(
                                                            dc.invoiceUrl,
                                                            "_blank",
                                                          )
                                                        }
                                                        className="gap-2 font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 cursor-pointer"
                                                      >
                                                        <ExternalLink className="h-4 w-4 text-emerald-600" />
                                                        Open GoGSTBill
                                                      </DropdownMenuItem>
                                                    ) : (
                                                      <DropdownMenuItem
                                                        onClick={() =>
                                                          openActionDialog(
                                                            "invoice",
                                                            dc,
                                                          )
                                                        }
                                                        className="gap-2 font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 cursor-pointer"
                                                      >
                                                        <Link2 className="h-4 w-4 text-indigo-600" />
                                                        Enter GoGSTBill URL
                                                      </DropdownMenuItem>
                                                    )}
                                                  </>
                                                )}
                                              {dc.invoiceRef &&
                                                !(
                                                  dc.isTaxInvoice ||
                                                  (!dc.cashAmount &&
                                                    !dc.invoiceRef.startsWith(
                                                      "SRR-",
                                                    ))
                                                ) && (
                                                  <DropdownMenuItem
                                                    onClick={() => {
                                                      setViewingCashMemoRef(
                                                        dc.invoiceRef!,
                                                      );
                                                      setCashMemoModalOpen(
                                                        true,
                                                      );
                                                    }}
                                                    className="gap-2 font-bold text-blue-700 hover:bg-blue-50 cursor-pointer"
                                                  >
                                                    <Receipt className="h-4 w-4 text-blue-600" />
                                                    View Cash Memo (
                                                    {dc.invoiceRef})
                                                  </DropdownMenuItem>
                                                )}
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  openPaymentDialog(dc)
                                                }
                                                className="gap-2 font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 cursor-pointer"
                                              >
                                                <Wallet className="h-4 w-4 text-emerald-600" />
                                                Edit Payment Info
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  openDelinkConfirmDialog(dc)
                                                }
                                                className="gap-2 font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 cursor-pointer"
                                              >
                                                <Undo2 className="h-4 w-4 text-slate-600" />
                                                Delink & Move to Cash Queue
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  moveBackToReturned(dc)
                                                }
                                                className="gap-2"
                                              >
                                                <Undo2 className="h-4 w-4" />
                                                Move back to Returned
                                              </DropdownMenuItem>
                                            </>
                                          )}
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={() => requestDelete(dc)}
                                            className="text-destructive gap-2"
                                          >
                                            <X className="h-4 w-4" />
                                            Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Desktop Table View */}
                          <div className="hidden md:block border border-border/80 rounded-xl overflow-hidden shadow-none bg-background dark:bg-slate-900/95 ">
                            <div className="max-h-[60vh] overflow-y-auto">
                              <table className="w-full border-separate border-spacing-0">
                                <thead>
                                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-border sticky top-0 z-10 text-slate-700 dark:text-slate-300">
                                    <th className="text-center p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 w-[50px] border-r border-border/50">
                                      Select
                                    </th>
                                    <th className="text-left p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 w-[110px] border-r border-border/50">
                                      <SortableHeader sortKey="date">
                                        <Calendar className="h-3.5 w-3.5 mr-1" />
                                        Date
                                      </SortableHeader>
                                    </th>
                                    <th className="text-left p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 w-[100px] border-r border-border/50">
                                      <SortableHeader sortKey="dcNo">
                                        DC No
                                      </SortableHeader>
                                    </th>
                                    {(activeQueue === "cash" ||
                                      activeQueue === "completed" ||
                                      activeQueue === "all") && (
                                      <th className="text-left p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 w-[150px] border-r border-border/50">
                                        Invoice / Memo No
                                      </th>
                                    )}
                                    <th className="text-left p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 border-r border-border/50 min-w-[200px]">
                                      <SortableHeader sortKey="party">
                                        Party Name
                                      </SortableHeader>
                                    </th>
                                    <th className="text-center p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 w-[80px] border-r border-border/50">
                                      <SortableHeader sortKey="items">
                                        <Package className="h-3.5 w-3.5 mr-1" />
                                        Items
                                      </SortableHeader>
                                    </th>
                                    <th className="text-center p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 w-[70px] border-r border-border/50">
                                      <SortableHeader sortKey="days">
                                        Days
                                      </SortableHeader>
                                    </th>
                                    <th className="text-left p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 w-[120px] border-r border-border/50">
                                      Delivered
                                    </th>
                                    {(activeQueue === "returned" ||
                                      activeQueue === "completed" ||
                                      activeQueue === "cash" ||
                                      activeQueue === "cancelled") && (
                                      <th className="text-left p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 w-[120px] border-r border-border/50">
                                        Returned
                                      </th>
                                    )}
                                    <th className="text-center p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 w-[60px]">
                                      Actions
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredDcs.map((dc) => {
                                    const daysPending = getDaysPending(dc);
                                    const totalQty = getTotalQty(dc);
                                    return (
                                      <tr
                                        key={dc.id}
                                        className={`group border-b border-border/50 transition-colors duration-150 cursor-pointer ${
                                          selectedDcId === dc.id
                                            ? "bg-teal-500/10 hover:bg-teal-500/15 border-l-4 border-l-teal-600 font-semibold"
                                            : "hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
                                        }`}
                                        onClick={() => {
                                          setSelectedDcId(dc.id);
                                        }}
                                      >
                                        <td className="relative p-3 text-center border-r-2 border-slate-200">
                                          <span
                                            className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r transition-all duration-200 ${
                                              selectedDcId === dc.id
                                                ? "bg-teal-600 opacity-100 scale-y-100"
                                                : "bg-teal-500 opacity-0 group-hover:opacity-100 scale-y-50 group-hover:scale-y-100"
                                            }`}
                                          />
                                          <input
                                            type="radio"
                                            name="selected-dc"
                                            className="h-4 w-4 accent-blue-600 cursor-pointer transition-transform duration-200 group-hover:scale-110"
                                            checked={selectedDcId === dc.id}
                                            onChange={() =>
                                              setSelectedDcId(dc.id)
                                            }
                                            aria-label={`Select DC ${dc.dcNo}`}
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                        </td>
                                        <td className="p-3 border-r-2 border-slate-200">
                                          <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:scale-110 transition-all duration-200 flex-shrink-0" />
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedDcId(dc.id);
                                                setDetailsDialogOpen(true);
                                              }}
                                              className="text-sm font-medium hover:text-blue-700 group-hover:text-slate-900 transition-colors text-left"
                                            >
                                              {formatDate(getDisplayDate(dc))}
                                            </button>
                                          </div>
                                        </td>
                                        <td className="p-3 border-r-2 border-slate-200">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedDcId(dc.id);
                                              setDetailsDialogOpen(true);
                                            }}
                                            className="text-sm font-extrabold text-teal-800 hover:text-teal-900 group-hover:text-teal-700 group-hover:translate-x-1 inline-flex items-center gap-1 hover:underline transition-all duration-200"
                                          >
                                            {dc.dcNo}
                                          </button>
                                        </td>
                                        {(activeQueue === "cash" ||
                                          activeQueue === "completed" ||
                                          activeQueue === "all") && (
                                          <td className="p-3 border-r-2 border-slate-200">
                                            {dc.invoiceRef ? (
                                              dc.isTaxInvoice ||
                                              (!dc.cashAmount &&
                                                !dc.invoiceRef.startsWith(
                                                  "SRR-",
                                                )) ? (
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                  {dc.invoiceUrl ? (
                                                    <a
                                                      href={dc.invoiceUrl}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      onClick={(e) =>
                                                        e.stopPropagation()
                                                      }
                                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-300 px-2 py-0.5 rounded-full shadow-none whitespace-nowrap transition-colors"
                                                      title={`GoGSTBill Invoice: ${dc.invoiceUrl} (Click to open)`}
                                                    >
                                                      <FileText className="w-3 h-3 text-slate-600 shrink-0" />
                                                      <span>
                                                        {dc.invoiceRef}
                                                      </span>
                                                      <ExternalLink className="w-2.5 h-2.5 text-slate-600 ml-0.5" />
                                                    </a>
                                                  ) : (
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        openActionDialog(
                                                          "invoice",
                                                          dc,
                                                        );
                                                      }}
                                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-full shadow-none whitespace-nowrap transition-colors cursor-pointer"
                                                      title={`Tax Invoice: ${dc.invoiceRef} (Click to enter GoGSTBill link)`}
                                                    >
                                                      <FileText className="w-3 h-3 text-slate-600 shrink-0" />
                                                      <span>
                                                        {dc.invoiceRef}
                                                      </span>
                                                      <Link2 className="w-2.5 h-2.5 text-purple-500 ml-0.5 opacity-70" />
                                                    </button>
                                                  )}
                                                </div>
                                              ) : (
                                                <div className="flex flex-col gap-1 items-start">
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setViewingCashMemoRef(
                                                        dc.invoiceRef!,
                                                      );
                                                      setCashMemoModalOpen(
                                                        true,
                                                      );
                                                    }}
                                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full hover:bg-blue-100 hover:text-blue-800 transition-all cursor-pointer shadow-none whitespace-nowrap"
                                                    title="Click to View Cash Memo"
                                                  >
                                                    <Receipt className="w-3 h-3 text-blue-600 shrink-0" />
                                                    <span>{dc.invoiceRef}</span>
                                                  </button>
                                                  {dc.status === "cash" &&
                                                    (() => {
                                                      
                                                       const isPart = Boolean(
                                                        dc.cashRemarks?.includes(
                                                          "Part Payment",
                                                        ) ||
                                                        dc.cashRemarks?.includes(
                                                          "Partial",
                                                        ),
                                                      );
                                                      const partMatch =
                                                        dc.cashRemarks?.match(
                                                          /₹?\s*([0-9,]+)\s*of\s*₹?\s*([0-9,]+)/i,
                                                        );
                                                      const paidAmt = partMatch
                                                        ? parseFloat(
                                                            partMatch[1].replace(
                                                              /,/g,
                                                              "",
                                                            ),
                                                          )
                                                        : 0;
                                                      const origAmt = partMatch
                                                        ? parseFloat(
                                                            partMatch[2].replace(
                                                              /,/g,
                                                              "",
                                                            ),
                                                          )
                                                        : dc.cashAmount || 0;

                                                      if (
                                                        isPart &&
                                                        paidAmt > 0 &&
                                                        origAmt > 0
                                                      ) {
                                                        const dueAmt = Math.max(
                                                          0,
                                                          origAmt - paidAmt,
                                                        );
                                                         return (
                                                           <span
                                                             className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-amber-400 bg-amber-100 text-amber-900 shadow-none max-w-full truncate"
                                                             title={`Part Payment Recorded: Paid ₹${paidAmt.toLocaleString("en-IN")} of Original Invoice ₹${origAmt.toLocaleString("en-IN")}. Balance Due: ₹${dueAmt.toLocaleString("en-IN")}`}
                                                           >
                                                             <span className="truncate">
                                                               ⚡ PART: ₹{formatCompact(paidAmt)} / ₹{formatCompact(origAmt)} (DUE ₹{formatCompact(dueAmt)})
                                                             </span>
                                                           </span>
                                                        );
                                                      }

                                                      return (
                                                        <span
                                                          className={`inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border whitespace-nowrap ${
                                                            getCashMemoAgingDays(
                                                              dc,
                                                            ) > 15
                                                              ? "bg-rose-100 text-rose-800 border-rose-300 animate-pulse"
                                                              : getCashMemoAgingDays(
                                                                    dc,
                                                                  ) > 7
                                                                ? "bg-amber-100 text-amber-800 border-amber-300"
                                                                : "bg-blue-50 text-blue-700 border-blue-200"
                                                          }`}
                                                          title={
                                                            dc.billedAmount &&
                                                            dc.billedAmount >
                                                              (dc.cashAmount ||
                                                                0)
                                                              ? `Our Expected Cash: ₹${(dc.cashAmount || 0).toLocaleString("en-IN")} (Printed Bill: ₹${dc.billedAmount.toLocaleString("en-IN")} | Hospital Cut: ₹${(dc.hospitalMargin || dc.billedAmount - (dc.cashAmount || 0)).toLocaleString("en-IN")}) • Unpaid for ${getCashMemoAgingDays(dc)} days`
                                                              : `Unpaid for ${getCashMemoAgingDays(dc)} days`
                                                          }
                                                        >
                                                          ● UNPAID{" "}
                                                          {dc.cashAmount
                                                            ? `₹${dc.cashAmount}`
                                                            : ""}{" "}
                                                          (
                                                          {getCashMemoAgingDays(
                                                            dc,
                                                          )}
                                                          d)
                                                          {dc.billedAmount &&
                                                            dc.billedAmount >
                                                              (dc.cashAmount ||
                                                                0) && (
                                                              <span
                                                                className="text-[8px] font-extrabold text-amber-800 bg-amber-200/90 px-1 py-0.2 rounded ml-0.5"
                                                                title={`Printed Hiked Bill: ₹${dc.billedAmount}`}
                                                              >
                                                                Hiked
                                                              </span>
                                                            )}
                                                        </span>
                                                      );
                                                    })()}
                                                  {dc.status === "completed" &&
                                                    dc.cashAmount && (
                                                      <span
                                                        className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full max-w-full truncate"
                                                        title={
                                                          dc.billedAmount &&
                                                          dc.billedAmount >
                                                            (dc.cashAmount || 0)
                                                            ? `Paid Cash: ₹${dc.cashAmount} (Printed Bill: ₹${dc.billedAmount} | Hospital Cut: ₹${dc.hospitalMargin || dc.billedAmount - (dc.cashAmount || 0)})`
                                                            : "Cash Memo Paid"
                                                        }
                                                      >
                                                        {dc.isPartialPayment ||
                                                        (dc.paidAmount &&
                                                          dc.originalInvoiceTotal &&
                                                          dc.paidAmount <
                                                            dc.originalInvoiceTotal) ||
                                                        (dc.cashRemarks &&
                                                          dc.cashRemarks.includes(
                                                            "Part Payment Received",
                                                          ))
                                                          ? `⚡ PART: ₹${formatCompact(dc.paidAmount || 0)} / ₹${formatCompact(dc.originalInvoiceTotal || dc.cashAmount || 0)}`
                                                          : `✓ PAID ₹${formatCompact(dc.cashAmount || 0)}`}
                                                        {dc.billedAmount &&
                                                          dc.billedAmount >
                                                            (dc.cashAmount ||
                                                              0) && (
                                                            <span className="text-[8px] font-bold text-emerald-950 bg-emerald-200 px-1 rounded ml-0.5">
                                                              Hiked
                                                            </span>
                                                          )}
                                                      </span>
                                                    )}
                                                </div>
                                              )
                                            ) : (
                                              <span className="text-xs text-slate-400 font-medium">
                                                -
                                              </span>
                                            )}
                                          </td>
                                        )}
                                        <td className="p-3 border-r-2 border-slate-200">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedDcId(dc.id);
                                              setDetailsDialogOpen(true);
                                            }}
                                            className="text-sm font-semibold text-slate-900 hover:text-teal-800 transition-colors text-left break-words whitespace-normal block"
                                          >
                                            {dc.hospitalName}
                                          </button>
                                        </td>
                                        <td className="p-3 text-center border-r-2 border-slate-200">
                                          <div className="flex items-center justify-center gap-1">
                                            <Badge
                                              variant="outline"
                                              className="text-xs font-medium border-slate-300"
                                            >
                                              {totalQty}
                                            </Badge>
                                          </div>
                                        </td>
                                        <td className="p-3 text-center border-r-2 border-slate-200">
                                          <div
                                            className={`text-sm font-medium ${daysPending > 7 && dc.status === "pending" ? "text-red-600" : "text-slate-600"}`}
                                          >
                                            {daysPending}d
                                            {daysPending > 7 &&
                                              dc.status === "pending" && (
                                                <AlertCircle className="h-3 w-3 inline ml-1" />
                                              )}
                                          </div>
                                        </td>
                                        <td className="p-3 border-r-2 border-slate-200">
                                          <div
                                            className="text-xs font-medium truncate max-w-[120px] flex items-center gap-1.5"
                                            title={dc.deliveredBy}
                                          >
                                            {dc.deliveredBy ? (
                                              <>
                                                {getTransportMode(
                                                  dc.deliveredBy,
                                                ) &&
                                                  renderTransportIcon(
                                                    getTransportMode(
                                                      dc.deliveredBy,
                                                    )?.iconName,
                                                    "w-3 h-3 text-blue-600 shrink-0",
                                                  )}
                                                <span className="truncate">
                                                  {dc.deliveredBy}
                                                </span>
                                              </>
                                            ) : (
                                              "-"
                                            )}
                                          </div>
                                        </td>
                                        {(activeQueue === "returned" ||
                                          activeQueue === "completed" ||
                                          activeQueue === "cash" ||
                                          activeQueue === "cancelled") && (
                                          <td className="p-3 border-r-2 border-slate-200">
                                            <div
                                              className="text-xs font-medium truncate max-w-[120px] flex items-center gap-1.5"
                                              title={dc.returnedBy}
                                            >
                                              {dc.returnedBy ? (
                                                <>
                                                  {getTransportMode(
                                                    dc.returnedBy,
                                                  ) &&
                                                    renderTransportIcon(
                                                      getTransportMode(
                                                        dc.returnedBy,
                                                      )?.iconName,
                                                      "w-3 h-3 text-blue-600 shrink-0",
                                                    )}
                                                  <span className="truncate">
                                                    {dc.returnedBy}
                                                  </span>
                                                </>
                                              ) : (
                                                "-"
                                              )}
                                            </div>
                                          </td>
                                        )}
                                        <td className="p-3 text-center">
                                          <div className="flex items-center justify-center gap-1.5">
                                            {/* Quick Call Icon Action */}
                                            {(() => {
                                              const contactSummary =
                                                getHospitalContactSummary(
                                                  dc.hospitalName,
                                                );
                                              return (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenHospitalContact(
                                                      dc.hospitalName,
                                                      dc,
                                                      !contactSummary.hasPhone,
                                                    );
                                                  }}
                                                  className={`w-8 h-8 flex items-center justify-center rounded-full transition-all shadow-none border ${
                                                    contactSummary.hasPhone
                                                      ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                                                      : "bg-slate-50 border-slate-200 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200"
                                                  }`}
                                                  title={
                                                    contactSummary.hasPhone
                                                      ? `Call / Contacts: ${contactSummary.primaryPhone}`
                                                      : `Add phone number for ${dc.hospitalName}`
                                                  }
                                                >
                                                  <Phone className="w-3.5 h-3.5" />
                                                </button>
                                              );
                                            })()}
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedDcId(dc.id);
                                                setDcDocumentModalOpen(true);
                                              }}
                                              className="w-8 h-8 flex items-center justify-center bg-teal-50 border border-teal-200 rounded-full text-teal-700 hover:bg-teal-100 transition-all shadow-none"
                                              title="View Delivery Challan (Document Preview)"
                                            >
                                              <Eye className="w-4 h-4 text-teal-700" />
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedDcId(dc.id);
                                                setDetailsDialogOpen(true);
                                              }}
                                              className="w-8 h-8 flex items-center justify-center bg-blue-50 border border-blue-200 rounded-full text-blue-700 hover:bg-blue-100 transition-all shadow-none"
                                              title="Track Status & History"
                                            >
                                              <Activity className="w-4 h-4 text-blue-700" />
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handlePrint(dc);
                                              }}
                                              className="w-8 h-8 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-full text-slate-700 hover:bg-slate-100 transition-all shadow-none"
                                              title="Print DC"
                                            >
                                              <Printer className="w-4 h-4 text-slate-700" />
                                            </button>
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  className="h-8 w-8 p-0 hover:bg-slate-200"
                                                  disabled={loadingDcIds.has(
                                                    dc.id,
                                                  )}
                                                  title="Actions"
                                                  onClick={(e) =>
                                                    e.stopPropagation()
                                                  }
                                                >
                                                  {loadingDcIds.has(dc.id) ? (
                                                    <RefreshCw className="h-4 w-4 text-slate-600 animate-spin" />
                                                  ) : (
                                                    <Edit className="h-4 w-4 text-slate-600" />
                                                  )}
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent
                                                align="end"
                                                className="w-52"
                                              >
                                                <DropdownMenuItem
                                                  onClick={() => {
                                                    const cs =
                                                      getHospitalContactSummary(
                                                        dc.hospitalName,
                                                      );
                                                    handleOpenHospitalContact(
                                                      dc.hospitalName,
                                                      dc,
                                                      !cs.hasPhone,
                                                    );
                                                  }}
                                                  className="gap-2 font-medium text-emerald-800 dark:text-emerald-300"
                                                >
                                                  <Phone className="h-4 w-4 text-emerald-600" />
                                                  {getHospitalContactSummary(
                                                    dc.hospitalName,
                                                  ).hasPhone
                                                    ? `Call (${getHospitalContactSummary(dc.hospitalName).primaryPhone})`
                                                    : "Add Phone Number"}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                  onClick={() =>
                                                    openEditDcModal(dc)
                                                  }
                                                  className="gap-2 font-bold text-teal-800 dark:text-teal-300 bg-teal-50/60 hover:bg-teal-100 cursor-pointer"
                                                >
                                                  <Edit className="h-4 w-4 text-blue-600" />
                                                  Edit DC Details
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                  onClick={() => {
                                                    setSelectedDcId(dc.id);
                                                    setDcDocumentModalOpen(
                                                      true,
                                                    );
                                                  }}
                                                  className="gap-2"
                                                >
                                                  <Eye className="h-4 w-4 text-blue-600" />
                                                  View DC Document
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                  onClick={() => {
                                                    setSelectedDcId(dc.id);
                                                    setDetailsDialogOpen(true);
                                                  }}
                                                  className="gap-2"
                                                >
                                                  <Activity className="h-4 w-4 text-blue-600" />
                                                  Track Status
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                  onClick={() =>
                                                    handlePrint(dc)
                                                  }
                                                  className="gap-2"
                                                >
                                                  <Printer className="h-4 w-4 text-indigo-600" />
                                                  Print DC
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                  onClick={() =>
                                                    handleShare(dc)
                                                  }
                                                  className="gap-2"
                                                >
                                                  <Share2 className="h-4 w-4 text-slate-600" />
                                                  Share PDF
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                  onClick={() =>
                                                    openActionDialog(
                                                      "return",
                                                      dc,
                                                    )
                                                  }
                                                  disabled={
                                                    dc.status !== "pending"
                                                  }
                                                  className="gap-2"
                                                >
                                                  <RotateCcw className="h-4 w-4" />
                                                  Mark as Returned
                                                </DropdownMenuItem>
                                                {dc.status === "pending" && (
                                                  <>
                                                    <DropdownMenuItem
                                                      onClick={() =>
                                                        openActionDialog(
                                                          "purchase",
                                                          dc,
                                                        )
                                                      }
                                                      className="gap-2 font-bold text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30 cursor-pointer"
                                                    >
                                                      <ShoppingBag className="h-4 w-4 text-slate-600" />
                                                      Purchase (Direct Sale)
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                      onClick={() =>
                                                        handleCreateCashMemoForDc(
                                                          dc,
                                                        )
                                                      }
                                                      className="gap-2 pl-7 text-xs text-blue-700 hover:bg-blue-50 dark:text-blue-400 cursor-pointer font-medium"
                                                    >
                                                      <Receipt className="h-3.5 w-3.5 text-blue-600" />
                                                      &bull; Cash Invoice
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                      onClick={() =>
                                                        openActionDialog(
                                                          "invoice",
                                                          dc,
                                                        )
                                                      }
                                                      className="gap-2 pl-7 text-xs text-purple-700 hover:bg-purple-50 dark:text-purple-400 cursor-pointer font-medium"
                                                    >
                                                      <FileText className="h-3.5 w-3.5 text-slate-600" />
                                                      &bull; Go GST Bill
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                      onClick={() =>
                                                        openActionDialog(
                                                          "cancel",
                                                          dc,
                                                        )
                                                      }
                                                      className="gap-2 text-orange-600"
                                                    >
                                                      <AlertCircle className="h-4 w-4" />
                                                      Cancel Case
                                                    </DropdownMenuItem>
                                                  </>
                                                )}
                                                {dc.status === "cancelled" && (
                                                  <DropdownMenuItem
                                                    onClick={() =>
                                                      restoreFromCancelled(dc)
                                                    }
                                                    className="gap-2"
                                                  >
                                                    <Undo2 className="h-4 w-4" />
                                                    Restore to Pending
                                                  </DropdownMenuItem>
                                                )}
                                                {dc.status === "returned" && (
                                                  <DropdownMenuItem
                                                    onClick={() =>
                                                      openActionDialog(
                                                        "invoice",
                                                        dc,
                                                      )
                                                    }
                                                    className="gap-2"
                                                  >
                                                    <Receipt className="h-4 w-4" />
                                                    Link Invoice
                                                  </DropdownMenuItem>
                                                )}
                                                {dc.status === "returned" &&
                                                  !dc.invoiceRef && (
                                                    <DropdownMenuItem
                                                      onClick={() =>
                                                        handleCreateCashMemoForDc(
                                                          dc,
                                                        )
                                                      }
                                                      className="gap-2 font-bold text-blue-700 hover:bg-blue-50"
                                                    >
                                                      <Receipt className="h-4 w-4 text-blue-600" />
                                                      Create Cash Memo
                                                    </DropdownMenuItem>
                                                  )}
                                                {dc.invoiceRef &&
                                                  (dc.isTaxInvoice ||
                                                    (!dc.cashAmount &&
                                                      !dc.invoiceRef.startsWith(
                                                        "SRR-",
                                                      ))) && (
                                                    <>
                                                      <DropdownMenuItem
                                                        onClick={() =>
                                                          openActionDialog(
                                                            "invoice",
                                                            dc,
                                                          )
                                                        }
                                                        className="gap-2 font-bold text-purple-800 bg-purple-50 hover:bg-purple-100 cursor-pointer"
                                                      >
                                                        <FileText className="h-4 w-4 text-slate-600" />
                                                        Tax Invoice:{" "}
                                                        {dc.invoiceRef}
                                                      </DropdownMenuItem>
                                                      {dc.invoiceUrl ? (
                                                        <DropdownMenuItem
                                                          onClick={() =>
                                                            window.open(
                                                              dc.invoiceUrl,
                                                              "_blank",
                                                            )
                                                          }
                                                          className="gap-2 font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 cursor-pointer"
                                                        >
                                                          <ExternalLink className="h-4 w-4 text-emerald-600" />
                                                          Open GoGSTBill
                                                        </DropdownMenuItem>
                                                      ) : (
                                                        <DropdownMenuItem
                                                          onClick={() =>
                                                            openActionDialog(
                                                              "invoice",
                                                              dc,
                                                            )
                                                          }
                                                          className="gap-2 font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 cursor-pointer"
                                                        >
                                                          <Link2 className="h-4 w-4 text-indigo-600" />
                                                          Enter GoGSTBill URL
                                                        </DropdownMenuItem>
                                                      )}
                                                    </>
                                                  )}
                                                {dc.invoiceRef &&
                                                  !(
                                                    dc.isTaxInvoice ||
                                                    (!dc.cashAmount &&
                                                      !dc.invoiceRef.startsWith(
                                                        "SRR-",
                                                      ))
                                                  ) && (
                                                    <>
                                                      <DropdownMenuItem
                                                        onClick={() => {
                                                          setViewingCashMemoRef(
                                                            dc.invoiceRef!,
                                                          );
                                                          setCashMemoModalOpen(
                                                            true,
                                                          );
                                                        }}
                                                        className="gap-2 font-bold text-blue-700 hover:bg-blue-50"
                                                      >
                                                        <Receipt className="h-4 w-4 text-blue-600" />
                                                        View Cash Memo (
                                                        {dc.invoiceRef})
                                                      </DropdownMenuItem>
                                                      <DropdownMenuItem
                                                        onClick={() =>
                                                          handleShareWhatsApp(
                                                            dc,
                                                          )
                                                        }
                                                        className="gap-2"
                                                      >
                                                        <MessageSquare className="h-4 w-4 text-emerald-600" />
                                                        Share via WhatsApp
                                                      </DropdownMenuItem>
                                                      {dc.status === "cash" && (
                                                        <DropdownMenuItem
                                                          onClick={() =>
                                                            openPaymentDialog(
                                                              dc,
                                                            )
                                                          }
                                                          className="gap-2 font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                                                        >
                                                          <Wallet className="h-4 w-4 text-emerald-600" />
                                                          Mark as Paid
                                                        </DropdownMenuItem>
                                                      )}
                                                    </>
                                                  )}
                                                {dc.status === "completed" && (
                                                  <>
                                                    {dc.invoiceRef &&
                                                      (dc.isTaxInvoice ||
                                                        (!dc.cashAmount &&
                                                          !dc.invoiceRef.startsWith(
                                                            "SRR-",
                                                          ))) && (
                                                        <>
                                                          <DropdownMenuItem
                                                            onClick={() =>
                                                              openActionDialog(
                                                                "invoice",
                                                                dc,
                                                              )
                                                            }
                                                            className="gap-2 font-bold text-purple-800 bg-purple-50 hover:bg-purple-100 cursor-pointer"
                                                          >
                                                            <FileText className="h-4 w-4 text-slate-600" />
                                                            Tax Invoice:{" "}
                                                            {dc.invoiceRef}
                                                          </DropdownMenuItem>
                                                          {dc.invoiceUrl ? (
                                                            <DropdownMenuItem
                                                              onClick={() =>
                                                                window.open(
                                                                  dc.invoiceUrl,
                                                                  "_blank",
                                                                )
                                                              }
                                                              className="gap-2 font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 cursor-pointer"
                                                            >
                                                              <ExternalLink className="h-4 w-4 text-emerald-600" />
                                                              Open GoGSTBill
                                                            </DropdownMenuItem>
                                                          ) : (
                                                            <DropdownMenuItem
                                                              onClick={() =>
                                                                openActionDialog(
                                                                  "invoice",
                                                                  dc,
                                                                )
                                                              }
                                                              className="gap-2 font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 cursor-pointer"
                                                            >
                                                              <Link2 className="h-4 w-4 text-indigo-600" />
                                                              Enter GoGSTBill
                                                              URL
                                                            </DropdownMenuItem>
                                                          )}
                                                        </>
                                                      )}
                                                    {dc.invoiceRef &&
                                                      !(
                                                        dc.isTaxInvoice ||
                                                        (!dc.cashAmount &&
                                                          !dc.invoiceRef.startsWith(
                                                            "SRR-",
                                                          ))
                                                      ) && (
                                                        <DropdownMenuItem
                                                          onClick={() => {
                                                            setViewingCashMemoRef(
                                                              dc.invoiceRef!,
                                                            );
                                                            setCashMemoModalOpen(
                                                              true,
                                                            );
                                                          }}
                                                          className="gap-2 font-bold text-blue-700 hover:bg-blue-50 cursor-pointer"
                                                        >
                                                          <Receipt className="h-4 w-4 text-blue-600" />
                                                          View Cash Memo (
                                                          {dc.invoiceRef})
                                                        </DropdownMenuItem>
                                                      )}
                                                    <DropdownMenuItem
                                                      onClick={() =>
                                                        openPaymentDialog(dc)
                                                      }
                                                      className="gap-2 font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 cursor-pointer"
                                                    >
                                                      <Wallet className="h-4 w-4 text-emerald-600" />
                                                      Edit Payment Info
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                      onClick={() =>
                                                        openDelinkConfirmDialog(
                                                          dc,
                                                        )
                                                      }
                                                      className="gap-2 font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 cursor-pointer"
                                                    >
                                                      <Undo2 className="h-4 w-4 text-slate-600" />
                                                      Delink & Move to Cash
                                                      Queue
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                      onClick={() =>
                                                        moveBackToReturned(dc)
                                                      }
                                                      className="gap-2"
                                                    >
                                                      <Undo2 className="h-4 w-4" />
                                                      Move back to Returned
                                                    </DropdownMenuItem>
                                                  </>
                                                )}
                                                {dc.status === "returned" && (
                                                  <DropdownMenuItem
                                                    onClick={() =>
                                                      setMoveToPendingDialog({
                                                        open: true,
                                                        dc,
                                                      })
                                                    }
                                                    className="gap-2"
                                                  >
                                                    <Undo2 className="h-4 w-4" />
                                                    Move back to Pending
                                                  </DropdownMenuItem>
                                                )}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                  onClick={() =>
                                                    requestDelete(dc)
                                                  }
                                                  className="text-destructive gap-2"
                                                >
                                                  <X className="h-4 w-4" />
                                                  Delete
                                                </DropdownMenuItem>
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Action Dialogs */}
      <Dialog
        open={actionDialog.type !== null && actionDialog.dc !== null}
        onOpenChange={(open) => {
          if (!open) closeActionDialog();
        }}
      >
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="w-[94vw] max-w-[94vw] sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 border border-slate-200/90 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 gap-0 overflow-hidden"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>
              {actionDialog.type === "return" && "Mark as Returned"}
              {actionDialog.type === "invoice" && "Link GoGSTBill Invoice"}
              {actionDialog.type === "cash" && "Move to Cash Queue"}
              {actionDialog.type === "purchase" && "Purchase DC (Direct Sale)"}
              {actionDialog.type === "cancel" && "Cancel Case"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Delivery Challan Action Dialog
            </DialogDescription>
          </DialogHeader>

          {/* 1. Return Action Dialog */}
          {actionDialog.type === "return" && actionDialog.dc && (
            <div>
              {/* Top Header */}
              <div className="bg-slate-50/80 dark:bg-slate-900/80 px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 border border-teal-200/80 dark:border-teal-800">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                      <span>Returned By</span>
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 border border-teal-300 dark:border-teal-700">
                        DC #{actionDialog.dc.dcNo}
                      </span>
                    </h3>
                    {(actionDialog.dc.doctorName || actionDialog.dc.patientName) && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        {actionDialog.dc.doctorName ? `Dr. ${actionDialog.dc.doctorName}` : ""}
                        {actionDialog.dc.doctorName && actionDialog.dc.patientName ? ` • ` : ""}
                        {actionDialog.dc.patientName ? `Pt: ${actionDialog.dc.patientName}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Dispatch Info Summary */}
              <div className="px-5 pt-3.5 pb-1">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 text-xs space-y-2.5">
                  {/* Hospital Header */}
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-bold">
                    <Building2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span className="text-xs truncate">{actionDialog.dc.hospitalName}</span>
                  </div>

                  {/* Structured 2-Column Details Grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {/* Delivered By */}
                    <div className="flex items-start gap-2 min-w-0">
                      {getTransportMode(actionDialog.dc.deliveredBy) ? (
                        renderTransportIcon(getTransportMode(actionDialog.dc.deliveredBy)?.iconName, "w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5")
                      ) : (
                        <Truck className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Delivered By</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {normalizePersonnelName(actionDialog.dc.deliveredBy) || actionDialog.dc.deliveredBy || "Standard Dispatch"}
                        </div>
                      </div>
                    </div>

                    {/* Received By */}
                    <div className="flex items-start gap-2 min-w-0">
                      <UserCheck className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Received By</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {normalizePersonnelName(actionDialog.dc.receivedBy) || actionDialog.dc.receivedBy || "Hospital Receiver"}
                        </div>
                      </div>
                    </div>

                    {/* Total Items */}
                    <div className="flex items-start gap-2 min-w-0">
                      <Package className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Total Items</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {getTotalQty(actionDialog.dc)} <span className="text-[11px] font-normal text-slate-500">({actionDialog.dc.items?.length || 0} types)</span>
                        </div>
                      </div>
                    </div>

                    {/* Instruments */}
                    <div className="flex items-start gap-2 min-w-0">
                      <Wrench className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Instruments</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {actionDialog.dc.instruments?.length || 0} Sets / Trays
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment & Delink Warning Alert if payment info exists */}
              {Boolean(
                actionDialog.dc.status === "completed" ||
                actionDialog.dc.status === "cash" ||
                actionDialog.dc.invoiceRef ||
                actionDialog.dc.cashAmount ||
                actionDialog.dc.paidAt ||
                actionDialog.dc.paymentMethod ||
                actionDialog.dc.utrNo ||
                actionDialog.dc.isPurchase
              ) && (
                <div className="px-5 pt-2 pb-0">
                  <div className="rounded-xl border border-rose-200/90 dark:border-rose-900/40 bg-rose-50/70 dark:bg-rose-950/20 p-3 space-y-1 text-xs text-rose-950 dark:text-rose-300">
                    <div className="flex items-center gap-1.5 font-bold text-rose-900 dark:text-rose-200">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Payment Records &amp; Linked Tx Will Be Delinked</span>
                    </div>
                    <p className="leading-relaxed text-[11px]">
                      This DC has existing payment records ({actionDialog.dc.invoiceRef ? `Memo #${actionDialog.dc.invoiceRef}` : `Paid ₹${(actionDialog.dc.cashAmount || actionDialog.dc.paidAmount || 0).toLocaleString("en-IN")}`}). Confirming return will permanently delete all payment records and delink any associated bank/cash transactions.
                    </p>
                  </div>
                </div>
              )}

              {/* Bottom Options & Form Inputs */}
              <div className="px-5 py-3.5 space-y-3.5">
                <div>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Returned By *
                  </Label>
                  <div className="mt-1.5">
                    <PersonnelSelect
                      value={returnedByInput}
                      onChange={setReturnedByInput}
                      placeholder="Select or enter person who returned items..."
                      showQuickPicks={false}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Click dropdown above to search team members or select Courier options.
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Return Remarks (Optional)
                  </Label>
                  <Textarea
                    value={returnedRemarksInput}
                    onChange={(e) => setReturnedRemarksInput(e.target.value)}
                    placeholder="Condition of returned sets, missing screws, hospital remarks..."
                    className="mt-1.5 resize-none rounded-xl border-slate-300 dark:border-slate-700 text-xs font-medium"
                    rows={2}
                  />
                </div>
              </div>

              {/* Action Footer */}
              <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <Button
                  variant="outline"
                  onClick={closeActionDialog}
                  disabled={isActionLoading}
                  className="rounded-xl h-9 px-4 text-xs font-semibold border-slate-300 hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:border-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleConfirmReturn(actionDialog.dc!)}
                  disabled={isActionLoading}
                  className="rounded-xl h-9 px-5 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-none gap-2 min-w-[140px]"
                >
                  {isActionLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm Return</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* 2. Invoice Action Dialog */}
          {actionDialog.type === "invoice" && actionDialog.dc && (
            <div>
              {/* Top Header */}
              <div className="bg-background from-purple-50 via-indigo-50/60 to-slate-50/50 px-5 py-4 border-b border-slate-200/80">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 border border-purple-200/80 shadow-none">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-300">
                          DC #{actionDialog.dc.dcNo}
                        </span>
                        {actionDialog.dc.date && (
                          <span className="text-[11px] font-medium text-slate-500">
                            {actionDialog.dc.date}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-purple-800 bg-purple-100/80 border border-purple-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Tax Invoice
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
                        {actionDialog.dc.invoiceRef
                          ? "Update Linked Invoice"
                          : "Link GoGSTBill Tax Invoice"}
                      </h3>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-600 mt-2.5 pt-2 border-t border-slate-200/60 flex-wrap">
                  <span className="text-slate-800 font-semibold">
                    {actionDialog.dc.hospitalName}
                  </span>
                  {actionDialog.dc.doctorName && (
                    <span className="flex items-center gap-1">
                      <Stethoscope className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      Dr. {actionDialog.dc.doctorName}
                    </span>
                  )}
                  {actionDialog.dc.patientName && (
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {actionDialog.dc.patientName}
                    </span>
                  )}
                </div>
              </div>

              {/* Top Info Card */}
              <div className="px-5 pt-4 pb-1">
                <div className="rounded-xl border border-purple-200/90 dark:border-purple-900/40 bg-purple-50/60 dark:bg-purple-950/20 p-3.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-bold text-purple-900 dark:text-purple-200">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-600" />
                      GoGSTBill Settlement Link
                    </span>
                    <span className="text-[10px] bg-purple-200/80 dark:bg-purple-900/80 px-2 py-0.5 rounded-full font-bold">
                      Direct Integration
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Attach the official tax invoice number and online sharing
                    URL to settle this DC and lock it into the Completed queue.
                  </p>
                </div>
              </div>

              {/* Bottom Options & Form Inputs */}
              <div className="px-5 py-3.5 space-y-3.5">
                <div>
                  <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Invoice Number *
                  </Label>
                  <Input
                    value={invoiceRefInput}
                    onChange={(e) => setInvoiceRefInput(e.target.value)}
                    placeholder="e.g. 2026/001 or GST-1049"
                    className="mt-1.5 h-10 rounded-xl border-slate-300 dark:border-slate-700 font-mono text-sm"
                  />
                </div>

                <div className="rounded-xl border border-purple-200/80 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-900/40 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-purple-950 dark:text-purple-200 flex items-center gap-1.5">
                      <Link2 className="h-3.5 w-3.5 text-slate-600" />
                      GoGSTBill Share URL (Optional)
                    </Label>
                    {typeof navigator !== "undefined" &&
                      navigator.clipboard && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const text = await navigator.clipboard.readText();
                              if (text) setInvoiceUrlInput(text.trim());
                            } catch {
                              // ignore clipboard read failure
                            }
                          }}
                          className="text-[11px] text-purple-700 dark:text-purple-400 hover:underline font-semibold cursor-pointer"
                        >
                          Paste Clipboard Link
                        </button>
                      )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={invoiceUrlInput}
                      onChange={(e) => setInvoiceUrlInput(e.target.value)}
                      placeholder="https://bill.gogstbill.com/wa/s/..."
                      className="text-xs h-10 bg-white dark:bg-slate-900 rounded-xl border-purple-200 dark:border-purple-800"
                    />
                    {invoiceUrlInput.trim() && (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 px-3 text-xs border-purple-300 text-purple-800 bg-white hover:bg-purple-100 shrink-0 gap-1.5 rounded-xl cursor-pointer"
                        onClick={() =>
                          window.open(invoiceUrlInput.trim(), "_blank")
                        }
                        title="Open link in new tab"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-slate-600" />
                        Test
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Invoice Remarks (Optional)
                  </Label>
                  <Textarea
                    value={invoiceRemarksInput}
                    onChange={(e) => setInvoiceRemarksInput(e.target.value)}
                    placeholder="Payment terms, PO reference, hospital notes..."
                    className="mt-1.5 resize-none rounded-xl border-slate-300 dark:border-slate-700 text-xs"
                    rows={2}
                  />
                </div>
              </div>

              {/* Action Footer */}
              <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <Button
                  variant="outline"
                  onClick={closeActionDialog}
                  disabled={isActionLoading}
                  className="rounded-xl h-10 px-4 text-xs font-semibold border-slate-300 hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:border-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleConfirmInvoice(actionDialog.dc!)}
                  disabled={isActionLoading}
                  className="rounded-xl h-10 px-5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-none gap-2 min-w-[140px]"
                >
                  {isActionLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>
                        {actionDialog.dc.invoiceRef
                          ? "Update Invoice"
                          : "Link Invoice"}
                      </span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* 3. Cash Action Dialog */}
          {actionDialog.type === "cash" && actionDialog.dc && (
            <div>
              {/* Top Header */}
              <div className="bg-background from-blue-50 via-sky-50/60 to-slate-50/50 px-5 py-4 border-b border-slate-200/80">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200/80 shadow-none">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-300">
                          DC #{actionDialog.dc.dcNo}
                        </span>
                        {actionDialog.dc.date && (
                          <span className="text-[11px] font-medium text-slate-500">
                            {actionDialog.dc.date}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-blue-800 bg-blue-100/80 border border-blue-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Cash Queue
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
                        Move to Cash Queue / Bill Settlement
                      </h3>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-600 mt-2.5 pt-2 border-t border-slate-200/60 flex-wrap">
                  <span className="text-slate-800 font-semibold">
                    {actionDialog.dc.hospitalName}
                  </span>
                  {actionDialog.dc.doctorName && (
                    <span className="flex items-center gap-1">
                      <Stethoscope className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      Dr. {actionDialog.dc.doctorName}
                    </span>
                  )}
                  {actionDialog.dc.patientName && (
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {actionDialog.dc.patientName}
                    </span>
                  )}
                </div>
              </div>

              {/* Top Info Card */}
              <div className="px-5 pt-4 pb-1">
                <div className="rounded-xl border border-blue-200/90 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 p-3.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-bold text-blue-900 dark:text-blue-200">
                    <span className="flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-blue-600" />
                      Cash Memo Preparation
                    </span>
                    <span className="text-[10px] bg-blue-200/80 dark:bg-blue-900/80 px-2 py-0.5 rounded-full font-bold">
                      Awaiting Payment
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Set the actual cash to collect. You can also generate an
                    instant prefilled Cash Memo with 1 click.
                  </p>
                </div>
              </div>

              {/* Bottom Options & Form Inputs */}
              <div className="px-5 py-3.5 space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-xs">
                      <IndianRupee className="h-3.5 w-3.5 text-emerald-600" />
                      Our Actual Net Cash to Collect *
                    </Label>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Net Expected
                    </span>
                  </div>
                  <div className="flex items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 h-10 px-3">
                    <span className="text-sm font-bold text-slate-500 mr-2">
                      ₹
                    </span>
                    <Input
                      type="number"
                      value={cashAmountInput}
                      onChange={(e) => setCashAmountInput(e.target.value)}
                      placeholder="e.g. 32000"
                      className="h-full border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 font-bold text-slate-900 dark:text-slate-100 text-sm"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                {/* Hiked Bill / Hospital Printed Amount (Optional) */}
                <div className="rounded-xl border border-amber-200/90 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900/40 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5 font-bold text-amber-950 dark:text-amber-200 text-xs">
                      <Receipt className="h-3.5 w-3.5 text-slate-600" />
                      Hospital Printed / Hiked Total (Optional)
                    </Label>
                    <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full font-bold">
                      Paper Bill
                    </span>
                  </div>
                  <div className="flex items-center rounded-xl border border-amber-300/80 bg-white dark:bg-slate-900 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 h-10 px-3">
                    <span className="text-sm font-bold text-amber-700 mr-2">
                      ₹
                    </span>
                    <Input
                      type="number"
                      value={billedAmountInput}
                      onChange={(e) => setBilledAmountInput(e.target.value)}
                      placeholder="e.g. 50000 (if printed with markup for hospital)"
                      className="h-full border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-xs font-semibold"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  {/* Live Calculation of Margin */}
                  {parseFloat(billedAmountInput) >
                    (parseFloat(cashAmountInput) || 0) && (
                    <div className="mt-1 pt-2 border-t border-amber-200/80 text-xs flex items-center justify-between text-amber-950 dark:text-amber-200 font-semibold">
                      <span>Hospital Markup / Cut:</span>
                      <span className="font-bold text-amber-800">
                        ₹
                        {(
                          parseFloat(billedAmountInput) -
                          (parseFloat(cashAmountInput) || 0)
                        ).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Cash Remarks (Optional)
                  </Label>
                  <Textarea
                    value={cashRemarksInput}
                    onChange={(e) => setCashRemarksInput(e.target.value)}
                    placeholder="Payment terms, collector details, hospital instructions..."
                    className="mt-1.5 resize-none rounded-xl border-slate-300 dark:border-slate-700 text-xs"
                    rows={2}
                  />
                </div>
              </div>

              {/* Action Footer */}
              <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <Button
                  onClick={() => handleCreateCashMemoForDc(actionDialog.dc!)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 w-full sm:w-auto h-10 px-4 text-xs rounded-xl shadow-none cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Create Cash Memo (Prefilled)
                </Button>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button
                    variant="outline"
                    onClick={closeActionDialog}
                    disabled={isActionLoading}
                    className="rounded-xl h-10 px-4 text-xs font-semibold border-slate-300 hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:border-slate-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleConfirmCash(actionDialog.dc!)}
                    disabled={isActionLoading}
                    variant="secondary"
                    className="rounded-xl h-10 px-4 text-xs font-bold gap-1.5 border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {isActionLoading && (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    )}
                    {isActionLoading ? "Saving..." : "Move to Cash Queue"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 4. Cancel Action Dialog */}
          {actionDialog.type === "cancel" && actionDialog.dc && (
            <div>
              {/* Top Header */}
              <div className="bg-slate-50/80 dark:bg-slate-900/80 px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0 border border-rose-200/80 dark:border-rose-800">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                      <span>Cancel Case</span>
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700">
                        DC #{actionDialog.dc.dcNo}
                      </span>
                    </h3>
                    {(actionDialog.dc.doctorName || actionDialog.dc.patientName) && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        {actionDialog.dc.doctorName ? `Dr. ${actionDialog.dc.doctorName}` : ""}
                        {actionDialog.dc.doctorName && actionDialog.dc.patientName ? ` • ` : ""}
                        {actionDialog.dc.patientName ? `Pt: ${actionDialog.dc.patientName}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Dispatch Info Summary */}
              <div className="px-5 pt-3.5 pb-1">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 text-xs space-y-2.5">
                  {/* Hospital Header */}
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-bold">
                    <Building2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span className="text-xs truncate">{actionDialog.dc.hospitalName}</span>
                  </div>

                  {/* Structured 2-Column Details Grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {/* Delivered By */}
                    <div className="flex items-start gap-2 min-w-0">
                      {getTransportMode(actionDialog.dc.deliveredBy) ? (
                        renderTransportIcon(getTransportMode(actionDialog.dc.deliveredBy)?.iconName, "w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5")
                      ) : (
                        <Truck className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Delivered By</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {normalizePersonnelName(actionDialog.dc.deliveredBy) || actionDialog.dc.deliveredBy || "Standard Dispatch"}
                        </div>
                      </div>
                    </div>

                    {/* Mode */}
                    <div className="flex items-start gap-2 min-w-0">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Target Queue</div>
                        <div className="font-semibold text-rose-700 dark:text-rose-300 truncate">
                          Cancelled Cases
                        </div>
                      </div>
                    </div>

                    {/* Total Items */}
                    <div className="flex items-start gap-2 min-w-0">
                      <Package className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Total Items</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {getTotalQty(actionDialog.dc)} <span className="text-[11px] font-normal text-slate-500">({actionDialog.dc.items?.length || 0} types)</span>
                        </div>
                      </div>
                    </div>

                    {/* Instruments */}
                    <div className="flex items-start gap-2 min-w-0">
                      <Wrench className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Instruments</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {actionDialog.dc.instruments?.length || 0} Sets / Trays
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Inputs */}
              <div className="px-5 py-3.5 space-y-3.5">
                <div>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Returned By *
                  </Label>
                  <div className="mt-1.5">
                    <PersonnelSelect
                      value={returnedByInput}
                      onChange={setReturnedByInput}
                      placeholder="Select or enter person who returned items..."
                      showQuickPicks={false}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Click dropdown above to search team members or select Courier options.
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Cancellation Reason *
                  </Label>
                  <Textarea
                    value={cancelledRemarksInput}
                    onChange={(e) => setCancelledRemarksInput(e.target.value)}
                    placeholder="Why was this case cancelled (e.g., patient unfit, surgery postponed, implant change)?"
                    className="mt-1.5 resize-none rounded-xl border-slate-300 dark:border-slate-700 text-xs font-medium"
                    rows={2}
                  />
                </div>
              </div>

              {/* Action Footer */}
              <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <Button
                  variant="outline"
                  onClick={closeActionDialog}
                  disabled={isActionLoading}
                  className="rounded-xl h-9 px-4 text-xs font-semibold border-slate-300 hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:border-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleConfirmCancel(actionDialog.dc!)}
                  disabled={isActionLoading}
                  className="rounded-xl h-9 px-5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-none gap-2 min-w-[140px]"
                >
                  {isActionLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      <span>Confirm Cancellation</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* 5. Purchase Action Dialog */}
          {actionDialog.type === "purchase" && actionDialog.dc && (
            <div>
              {/* Top Header */}
              <div className="bg-slate-50/80 dark:bg-slate-900/80 px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 border border-amber-200/80 dark:border-amber-800">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                      <span>Direct Sale</span>
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                        DC #{actionDialog.dc.dcNo}
                      </span>
                    </h3>
                    {(actionDialog.dc.doctorName || actionDialog.dc.patientName) && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        {actionDialog.dc.doctorName ? `Dr. ${actionDialog.dc.doctorName}` : ""}
                        {actionDialog.dc.doctorName && actionDialog.dc.patientName ? ` • ` : ""}
                        {actionDialog.dc.patientName ? `Pt: ${actionDialog.dc.patientName}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Dispatch Info Summary */}
              <div className="px-5 pt-3.5 pb-1">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 text-xs space-y-2.5">
                  {/* Hospital Header */}
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-bold">
                    <Building2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span className="text-xs truncate">{actionDialog.dc.hospitalName}</span>
                  </div>

                  {/* Structured 2-Column Details Grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {/* Delivered By */}
                    <div className="flex items-start gap-2 min-w-0">
                      {getTransportMode(actionDialog.dc.deliveredBy) ? (
                        renderTransportIcon(getTransportMode(actionDialog.dc.deliveredBy)?.iconName, "w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5")
                      ) : (
                        <Truck className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Delivered By</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {normalizePersonnelName(actionDialog.dc.deliveredBy) || actionDialog.dc.deliveredBy || "Standard Dispatch"}
                        </div>
                      </div>
                    </div>

                    {/* Mode */}
                    <div className="flex items-start gap-2 min-w-0">
                      <ShoppingBag className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Sale Mode</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          Direct Sale (No Return)
                        </div>
                      </div>
                    </div>

                    {/* Total Items */}
                    <div className="flex items-start gap-2 min-w-0">
                      <Package className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Total Items</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {getTotalQty(actionDialog.dc)} <span className="text-[11px] font-normal text-slate-500">({actionDialog.dc.items?.length || 0} types)</span>
                        </div>
                      </div>
                    </div>

                    {/* Instruments */}
                    <div className="flex items-start gap-2 min-w-0">
                      <Wrench className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Instruments</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {actionDialog.dc.instruments?.length || 0} Sets / Trays
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Options: Billing Method Choice Cards */}
              <div className="px-5 py-3.5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1: Cash Invoice */}
                  <div
                    onClick={() => {
                      handleCreateCashMemoForDc(actionDialog.dc!);
                    }}
                    className="group relative flex flex-col justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-teal-500 dark:hover:border-teal-500 bg-white dark:bg-slate-900 hover:bg-teal-50/50 dark:hover:bg-teal-950/20 transition-all duration-200 cursor-pointer text-left shadow-xs"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300">
                          <Receipt className="h-4 w-4" />
                        </div>
                        <Badge className="bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 text-[10.5px] font-semibold">
                          Cash Memo
                        </Badge>
                      </div>
                      <div>
                        <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400">
                          Cash Invoice
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          Open Cash Invoice editor with all items & hospital prefilled from this DC.
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-teal-600 dark:text-teal-400">
                      <span>Create Cash Invoice</span>
                      <span className="text-sm group-hover:translate-x-1 transition-transform">
                        &rarr;
                      </span>
                    </div>
                  </div>

                  {/* Option 2: Go GST Bill */}
                  <div
                    onClick={() => {
                      openActionDialog("invoice", actionDialog.dc!);
                    }}
                    className="group relative flex flex-col justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-purple-500 dark:hover:border-purple-500 bg-white dark:bg-slate-900 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition-all duration-200 cursor-pointer text-left shadow-xs"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                          <FileText className="h-4 w-4" />
                        </div>
                        <Badge className="bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 text-[10.5px] font-semibold">
                          GoGSTBill
                        </Badge>
                      </div>
                      <div>
                        <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                          Go GST Bill
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          Link GoGSTBill tax invoice number and URL directly to complete this purchase.
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-purple-600 dark:text-purple-400">
                      <span>Link Go GST Bill</span>
                      <span className="text-sm group-hover:translate-x-1 transition-transform">
                        &rarr;
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => openActionDialog("cash", actionDialog.dc!)}
                  className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 gap-1.5 h-9 px-3 rounded-xl cursor-pointer"
                >
                  <IndianRupee className="h-3.5 w-3.5 text-teal-600" />
                  Quick Cash Entry
                </Button>
                <Button
                  variant="outline"
                  onClick={closeActionDialog}
                  className="h-9 px-4 text-xs font-semibold rounded-xl border-slate-300 hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:border-slate-700"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cash Memo Viewer Modal Popup */}
      <Dialog open={cashMemoModalOpen} onOpenChange={setCashMemoModalOpen}>
        <DialogContent
          className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-900 border-border"
          aria-describedby={undefined}
        >
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Receipt className="h-5 w-5 text-teal-700" />
              Cash Memo Details — {viewingCashMemoRef}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {activeViewingCashMemo && (
                <Button
                  size="sm"
                  onClick={() => {
                    const validItems = (
                      activeViewingCashMemo.items || []
                    ).filter((i) => (i.description || "").trim().length > 0);
                    if (validItems.length === 0) {
                      toast.error(
                        "At least one item must be added to save or print the cash invoice.",
                      );
                      return;
                    }
                    printCashMemo(activeViewingCashMemo);
                  }}
                  className="bg-teal-700 hover:bg-teal-800 text-white font-bold gap-1.5 h-8 text-xs rounded-md"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / PDF
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="py-2">
            {activeViewingCashMemo ? (
              <CashInvoicePreview
                invoice={activeViewingCashMemo}
                onPrint={() => printCashMemo(activeViewingCashMemo)}
                showPrintButton={false}
              />
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm space-y-3">
                <p>Loading or locating Cash Memo "{viewingCashMemoRef}"...</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    navigate(
                      `/cash-invoice?viewInv=${encodeURIComponent(viewingCashMemoRef || "")}`,
                    )
                  }
                  className="text-xs font-semibold gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open in Cash Invoices
                  Suite
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* DC Document Preview Modal (View DC like Print) */}
      <Dialog open={dcDocumentModalOpen} onOpenChange={setDcDocumentModalOpen}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto p-3 sm:p-6 bg-slate-100 dark:bg-slate-900"
          aria-describedby={undefined}
        >
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-300">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-slate-900">
              <FileText className="h-5 w-5 text-teal-700" />
              Delivery Challan Document — {selectedDc?.dcNo}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {selectedDc &&
                selectedDc.status !== "completed" &&
                selectedDc.status !== "cash" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => selectedDc && openEditDcModal(selectedDc)}
                    className="border-teal-300 gap-1.5 h-8 text-xs bg-teal-50 text-teal-800 hover:bg-teal-100 font-bold"
                  >
                    <Edit className="h-3.5 w-3.5 text-teal-700" /> Edit DC
                  </Button>
                )}
              <Button
                size="sm"
                onClick={() => selectedDc && handlePrint(selectedDc)}
                className="bg-teal-700 text-white hover:bg-teal-800 font-bold gap-1.5 h-8 text-xs"
              >
                <Printer className="h-3.5 w-3.5" /> Print DC
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => selectedDc && handleShare(selectedDc)}
                className="border-slate-300 gap-1.5 h-8 text-xs bg-white text-slate-800 hover:bg-slate-50"
              >
                <Share2 className="h-3.5 w-3.5 text-slate-600" /> Share PDF
              </Button>
            </div>
          </DialogHeader>

          {!selectedDc ? (
            <div className="text-sm text-slate-600 p-4">
              Select a DC to view document preview.
            </div>
          ) : (
            <div className="bg-white p-4 sm:p-8 rounded-xl shadow-none border border-slate-300 text-slate-900 space-y-5 font-sans">
              {/* Document Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b-2 border-teal-600 gap-3">
                <div>
                  <h1 className="text-lg sm:text-2xl font-extrabold text-teal-900 uppercase tracking-tight">
                    SRI RAJA RAJESHWARI ORTHO PLUS
                  </h1>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">
                    Implants, Instruments & Surgical Accessories
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Hyderabad, India • Mobile: +91 9396857455, +91 8686559393 •
                    Web: srrorthoplus.com
                  </p>
                </div>
                <div className="bg-teal-50 border border-teal-200 px-4 py-2 rounded-xl text-left sm:text-right shrink-0">
                  <div className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">
                    DELIVERY CHALLAN
                  </div>
                  <div className="text-base sm:text-xl font-black text-teal-950">
                    {selectedDc.dcNo}
                  </div>
                  <div className="text-xs text-slate-600 font-semibold">
                    {formatDate(getDisplayDate(selectedDc))}
                  </div>
                </div>
              </div>

              {/* Party & Personnel Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">
                      Hospital / Party Name:
                    </span>
                    {selectedDc.status !== "completed" &&
                      selectedDc.status !== "cash" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditDcModal(selectedDc)}
                          className="h-5 px-1.5 text-[10.5px] font-bold text-teal-700 hover:text-teal-900 hover:bg-teal-50 gap-1 border border-teal-200/80 rounded"
                          title="Edit DC details or change hospital name"
                        >
                          <Edit className="w-2.5 h-2.5" />
                          <span>Change</span>
                        </Button>
                      )}
                  </div>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {selectedDc.hospitalName}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">
                    Material Type:
                  </span>
                  <span className="font-semibold text-slate-800">
                    {selectedDc.materialType || "SS"}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">
                    Delivered By:
                  </span>
                  <span className="font-semibold text-slate-800">
                    {selectedDc.deliveredBy || "-"}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">
                    Received By:
                  </span>
                  <span className="font-semibold text-slate-800">
                    {selectedDc.receivedBy || "-"}
                  </span>
                </div>
              </div>

              {/* Despatched Items Table - Clean procedure bold header, no procedure column */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Despatched Items List
                  </h3>
                  <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    Total Qty: {getTotalQty(selectedDc)}
                  </span>
                </div>
                <div className="border border-slate-300 rounded-xl overflow-hidden shadow-none">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-teal-800 text-white font-bold">
                        <th className="p-2.5 border-r border-teal-700 w-10 text-center">
                          S.No
                        </th>
                        <th className="p-2.5 border-r border-teal-700">
                          Item Description
                        </th>
                        <th className="p-2.5 text-center w-20">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(() => {
                        const grouped: Record<string, typeof selectedDc.items> =
                          {};
                        selectedDc.items.forEach((item) => {
                          const proc = item.procedure || "General Items";
                          if (!grouped[proc]) grouped[proc] = [];
                          grouped[proc].push(item);
                        });

                        return Object.entries(grouped).map(
                          ([procName, items]) => (
                            <Fragment key={procName}>
                              {/* Procedure Header Row - Bold in first cell */}
                              <tr className="bg-slate-100 font-bold border-b border-slate-300">
                                <td
                                  colSpan={3}
                                  className="p-2.5 text-left font-bold text-slate-900 bg-slate-100"
                                >
                                  {procName}
                                </td>
                              </tr>
                              {items.map((item, idx) => {
                                const totalQty = item.sizes.reduce(
                                  (sum, size) => sum + size.qty,
                                  0,
                                );
                                const sizeStr = item.sizes
                                  .filter((s) => s.size)
                                  .map((s) => `${s.size} (Qty: ${s.qty})`)
                                  .join(", ");

                                return (
                                  <tr
                                    key={idx}
                                    className={
                                      idx % 2 === 0
                                        ? "bg-white"
                                        : "bg-slate-50/70"
                                    }
                                  >
                                    <td className="p-2.5 text-center font-bold text-slate-500 border-r border-slate-200">
                                      {idx + 1}
                                    </td>
                                    <td className="p-2.5 font-bold text-slate-900 border-r border-slate-200">
                                      <div>{item.name}</div>
                                      {sizeStr && (
                                        <div className="text-[11px] text-slate-600 font-normal mt-0.5">
                                          {sizeStr}
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-2.5 text-center font-extrabold text-teal-800 text-sm">
                                      {totalQty}
                                    </td>
                                  </tr>
                                );
                              })}
                            </Fragment>
                          ),
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Instruments Details */}
              {selectedDc.instruments && selectedDc.instruments.length > 0 && (
                <div className="border-t border-slate-200 pt-3 text-xs">
                  <span className="font-bold text-slate-800 block uppercase tracking-wider text-[10px] mb-1">
                    Instruments Details:
                  </span>
                  <div className="text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-medium">
                    {selectedDc.instruments.join(", ")}
                  </div>
                </div>
              )}

              {/* Box Numbers */}
              {selectedDc.boxNumbers && selectedDc.boxNumbers.length > 0 && (
                <div className="border-t border-slate-200 pt-3 text-xs">
                  <span className="font-bold text-slate-800 block uppercase tracking-wider text-[10px] mb-1">
                    Box Numbers:
                  </span>
                  <div className="text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-medium">
                    {selectedDc.boxNumbers.join(", ")}
                  </div>
                </div>
              )}

              {/* Remarks */}
              {selectedDc.remarks && (
                <div className="border-t border-slate-200 pt-2 text-xs">
                  <span className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">
                    Remarks / Instructions:
                  </span>
                  <p className="text-slate-700 mt-0.5 italic bg-amber-50/60 p-2 rounded border border-amber-200">
                    {selectedDc.remarks}
                  </p>
                </div>
              )}

              {/* Signatures */}
              <div className="flex justify-between items-end border-t-2 border-slate-300 pt-12 mt-12 text-xs text-slate-600">
                <div>
                  <div className="border-t-2 border-slate-400 w-36 text-center pt-1 font-bold text-slate-800">
                    Receiver Sign
                  </div>
                </div>
                <div>
                  <div className="border-t-2 border-slate-400 w-48 text-center pt-1 font-extrabold text-teal-900">
                    For Sri Raja Rajeshwari Ortho Plus
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Details Modal */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-5xl lg:max-w-6xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-1">
            <DialogTitle className="sr-only">
              {selectedDc ? `DC ${selectedDc.dcNo} - ${selectedDc.hospitalName}` : "DC Details"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              View delivery challan details, payment info, items, instruments, notes, and history.
            </DialogDescription>
          </DialogHeader>

          {!selectedDc ? (
            <div className="text-sm text-slate-600">
              Select a DC to view details.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Top 2-Column Header Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 shadow-2xs">
                {/* Left Column: DC Number, Status Pill & Hospital Name + Call Icon */}
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-extrabold text-xs px-2.5 py-0.5 shadow-2xs">
                      DC #{selectedDc.dcNo}
                    </Badge>

                    <Badge
                      className={`${getStatusBadgeClass(selectedDc.status)} flex items-center gap-1 text-[11px] font-bold border px-2 py-0.5`}
                    >
                      {getStatusIcon(selectedDc.status)}
                      {selectedDc.status === "completed"
                        ? selectedDc.isPartialPayment ||
                          (selectedDc.paidAmount &&
                            selectedDc.originalInvoiceTotal &&
                            selectedDc.paidAmount < selectedDc.originalInvoiceTotal) ||
                          selectedDc.cashRemarks?.includes("Part Payment Received")
                          ? "COMPLETED (PART PAID)"
                          : selectedDc.isTaxInvoice ||
                              (!selectedDc.cashAmount &&
                                selectedDc.invoiceRef &&
                                !selectedDc.invoiceRef.startsWith("SRR-"))
                            ? "TAX INVOICE LINKED"
                            : selectedDc.paymentMethod === "bank_transfer" ||
                                linkedBankTx ||
                                selectedDc.utrNo
                              ? "PAYMENT SETTLED"
                              : "PAID (UNLINKED)"
                        : selectedDc.status === "cash"
                          ? "AWAITING PAYMENT"
                          : selectedDc.status === "pending"
                            ? "DELIVERED"
                            : selectedDc.status.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 truncate" title={selectedDc.hospitalName}>
                      {selectedDc.hospitalName}
                    </h3>

                    {/* Call / Contacts Phone Icon Button */}
                    {(() => {
                      const summary = getHospitalContactSummary(selectedDc.hospitalName);
                      return (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            handleOpenHospitalContact(
                              selectedDc.hospitalName,
                              selectedDc,
                              !summary.hasPhone,
                            )
                          }
                          className={`h-7 w-7 p-0 rounded-full shrink-0 flex items-center justify-center cursor-pointer transition-transform hover:scale-105 ${
                            summary.hasPhone
                              ? "text-emerald-700 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300"
                              : "text-slate-500 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-400 border border-slate-300"
                          }`}
                          title={
                            summary.hasPhone
                              ? `Call / Contacts: ${summary.primaryPhone}`
                              : "Add Contact / Phone Number"
                          }
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </Button>
                      );
                    })()}
                  </div>
                </div>

                {/* Right Column: Date, Items & Quick Actions */}
                <div className="flex flex-col sm:items-end justify-between gap-2 pr-6 sm:pr-8">
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-medium flex items-center gap-2 flex-wrap">
                    <span>Date: <strong className="text-slate-900 dark:text-slate-100 font-semibold">{formatDate(getDisplayDate(selectedDc))}</strong></span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span>Items: <strong className="text-slate-900 dark:text-slate-100 font-semibold">{getTotalQty(selectedDc)}</strong></span>
                  </div>

                  <div className="flex items-center gap-1">
                    {selectedDc.status !== "completed" && selectedDc.status !== "cash" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-teal-700 hover:text-teal-900 hover:bg-teal-50 dark:text-teal-400"
                        onClick={() => openEditDcModal(selectedDc)}
                        title="Edit DC Details"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    ) : (
                      <div
                        className="h-8 w-8 flex items-center justify-center text-slate-400"
                        title="Completed — locked"
                      >
                        <Lock className="h-4 w-4" />
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      onClick={() => handlePrint(selectedDc)}
                      title="Print DC"
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      onClick={() => handleShare(selectedDc)}
                      title="Share PDF"
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      onClick={() => requestDelete(selectedDc)}
                      title="Delete DC"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <Tabs value={detailsModalTab} onValueChange={setDetailsModalTab}>
                <TabsList className="w-full justify-start bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-1 rounded-lg">
                  <TabsTrigger
                    value="overview"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger
                    value="items"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    Items & Instruments
                  </TabsTrigger>
                  <TabsTrigger
                    value="notes"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    Notes
                  </TabsTrigger>
                  <TabsTrigger
                    value="history"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    History
                  </TabsTrigger>
                  {(selectedDc.status === "completed" ||
                    selectedDc.status === "cash" ||
                    selectedDc.paidAmount ||
                    (selectedDc.partPayments && selectedDc.partPayments.length > 0)) && (
                    <TabsTrigger
                      value="payment"
                      className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white flex items-center gap-1.5"
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      <span>Payment Info</span>
                      {(selectedDc.paidAmount || (selectedDc.partPayments && selectedDc.partPayments.length > 0)) ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                      ) : null}
                    </TabsTrigger>
                  )}
                </TabsList>

                {/* Separate Payment Info Tab */}
                <TabsContent value="payment" className="mt-3 space-y-3">
                  {/* Bank & Payment Settlement Transaction Details */}
                  {selectedDc.isTaxInvoice ||
                  (!selectedDc.cashAmount &&
                    selectedDc.invoiceRef &&
                    !selectedDc.invoiceRef.startsWith("SRR-")) ? (
                    <div className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 p-4 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-blue-900 dark:text-blue-200 flex items-center gap-2">
                            <span>
                              GoGST Tax Invoice Linked (
                              {selectedDc.invoiceRef || "Linked"})
                            </span>
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-[10px] py-0 px-2 font-extrabold border border-blue-300">
                              Tax Invoice
                            </Badge>
                          </h4>
                          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                            Payments and bank settlements for GoGST bill
                            transactions are tracked directly in GoGSTBill.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    (selectedDc.status === "completed" ||
                      Boolean(selectedDc.paidAt || linkedBankTx || (selectedDc.partPayments && selectedDc.partPayments.length > 0))) ? (
                      <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-background from-emerald-50 via-teal-50/50 to-emerald-50/20 dark:from-emerald-950/40 dark:to-slate-900 p-3.5 space-y-2.5 shadow-none">
                        {/* Part Payment Alert Banner if Partial Payment */}
                        {(() => {
                          let isPart = Boolean(selectedDc.isPartialPayment);
                          let paid = selectedDc.paidAmount ?? 0;
                          let orig =
                            selectedDc.originalInvoiceTotal ??
                            (selectedDc.cashAmount || 0);

                          // Fallback parsing from cashRemarks string if stored prior: e.g. "Part Payment Received: ₹6 of ₹1,200"
                          if (
                            selectedDc.cashRemarks &&
                            selectedDc.cashRemarks.includes(
                              "Part Payment Received",
                            )
                          ) {
                            isPart = true;
                            const match = selectedDc.cashRemarks.match(
                              /Part Payment Received:\s*₹?([\d,]+)\s*of\s*₹?([\d,]+)/i,
                            );
                            if (match) {
                              paid =
                                parseFloat(match[1].replace(/,/g, "")) || paid;
                              orig =
                                parseFloat(match[2].replace(/,/g, "")) || orig;
                            }
                          }

                          if (!isPart && paid > 0 && orig > 0 && paid < orig) {
                            isPart = true;
                          }

                          const due = Math.max(0, orig - paid);

                          if (!isPart && due <= 0 && (!selectedDc.partPayments || selectedDc.partPayments.length === 0)) return null;

                          const partPaymentsList =
                            selectedDc.partPayments || [];

                          return (
                            <div className="rounded-lg border border-amber-300/80 bg-amber-50/70 dark:bg-amber-950/40 dark:border-amber-800 p-2.5 text-xs text-amber-950 dark:text-amber-200 space-y-2">
                              {/* Header + Stats in a compact row */}
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 dark:border-amber-800/80 pb-2">
                                <div className="flex items-center gap-1.5 font-bold">
                                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                  <span className="text-amber-900 dark:text-amber-100">Part Payment Settlement</span>
                                  {selectedDc.invoiceRef && (
                                    <span className="text-[10px] font-mono font-bold text-amber-900 dark:text-amber-200 bg-amber-200/80 dark:bg-amber-900/80 px-1.5 py-0.5 rounded border border-amber-400/60 ml-0.5">
                                      Memo #{selectedDc.invoiceRef}
                                    </span>
                                  )}
                                  <Badge className="bg-amber-500 text-white font-bold text-[9px] px-1.5 py-0">
                                    PART PAID
                                  </Badge>
                                </div>

                                <div className="flex items-center gap-2 font-mono text-[11px] font-semibold flex-wrap">
                                  <span className="text-slate-600 dark:text-slate-400">
                                    Invoice: <b className="text-slate-900 dark:text-slate-100">₹{orig.toLocaleString("en-IN")}</b>
                                  </span>
                                  <span className="text-slate-300 dark:text-slate-700">•</span>
                                  <span className="text-emerald-700 dark:text-emerald-400">
                                    Settled: <b>₹{paid.toLocaleString("en-IN")}</b>
                                  </span>
                                  <span className="text-slate-300 dark:text-slate-700">•</span>
                                  <span className="text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/80 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                                    Unpaid Balance: <b>₹{due.toLocaleString("en-IN")}</b>
                                  </span>
                                </div>
                              </div>

                              {/* Installment Breakdown Rows */}
                              {partPaymentsList.length > 0 && (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-900 dark:text-amber-200 px-0.5">
                                    <span className="flex items-center gap-1.5">
                                      <Banknote className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                                      Installment Breakdown ({partPaymentsList.length} Payments)
                                    </span>
                                  </div>

                                  <div className="space-y-1">
                                    {partPaymentsList.map((inst, index) => {
                                      const isExp = expandedInstallmentIdx === index;
                                      return (
                                        <div
                                          key={index}
                                          className="rounded-md border border-amber-200/90 dark:border-amber-800/80 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 shadow-2xs space-y-1"
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                              <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950 text-[9px] px-1 py-0 border-amber-300 font-extrabold shrink-0">
                                                #{index + 1}
                                              </Badge>

                                              <span className="font-semibold text-slate-800 dark:text-slate-200 shrink-0 text-[11px]">
                                                {inst.paymentMethod === "bank_transfer" ? "🏦 Bank Transfer" : "💵 Cash"}
                                              </span>

                                              <span className="text-[10px] text-slate-500 font-mono shrink-0">
                                                {formatDate(inst.at)}
                                              </span>

                                              {inst.utrNo && (
                                                <div className="flex items-center gap-1 bg-amber-50/80 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-amber-200/80 dark:border-slate-700 text-[10px] font-mono">
                                                  <span className="text-slate-500 text-[9px]">UTR:</span>
                                                  <span className="font-bold text-slate-900 dark:text-slate-100">{inst.utrNo}</span>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      navigator.clipboard.writeText(inst.utrNo || "");
                                                      toast({ title: "Copied UTR", description: inst.utrNo });
                                                    }}
                                                    className="text-amber-700 hover:text-amber-900 cursor-pointer ml-0.5"
                                                    title="Copy UTR"
                                                  >
                                                    <Copy className="w-3 h-3 text-amber-700" />
                                                  </button>
                                                </div>
                                              )}

                                              {inst.collectedBy && (
                                                <span className="text-[10px] text-slate-500 hidden sm:inline truncate max-w-[120px]" title={inst.collectedBy}>
                                                  by {inst.collectedBy}
                                                </span>
                                              )}
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                              <span className="font-extrabold font-mono text-emerald-700 dark:text-emerald-400 text-xs">
                                                +₹{inst.amount.toLocaleString("en-IN")}
                                              </span>

                                              {(inst.remarks || inst.collectedBy) && (
                                                <button
                                                  type="button"
                                                  onClick={() => setExpandedInstallmentIdx(isExp ? null : index)}
                                                  className="px-1.5 py-0.5 text-[10px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-200 rounded border border-amber-300 flex items-center gap-0.5 cursor-pointer"
                                                  title="Toggle Extra Info"
                                                >
                                                  <span>{isExp ? "Less" : "Info"}</span>
                                                  {isExp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                </button>
                                              )}

                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeletePartPaymentInstallment(selectedDc, index);
                                                }}
                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                                                title={`Delete installment #${index + 1}`}
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </div>

                                          {isExp && (
                                            <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-600 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
                                              {inst.collectedBy && (
                                                <span>Collected By: <strong className="text-slate-800 dark:text-slate-200">{inst.collectedBy}</strong></span>
                                              )}
                                              {inst.remarks && (
                                                <span className="italic">"{inst.remarks}"</span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Render single-transaction payment details card ONLY if there are no multi-installment part payments */}
                        {(!selectedDc.partPayments ||
                          selectedDc.partPayments.length === 0) && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="p-2 rounded-lg bg-emerald-700 text-white shadow-none">
                                <Landmark className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                  <span>
                                    {selectedDc.paymentMethod ===
                                      "bank_transfer" ||
                                    linkedBankTx ||
                                    selectedDc.utrNo
                                      ? "Payment & Bank Transaction Details"
                                      : "Cash Collection Record (Physical Cash)"}
                                  </span>
                                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-[10px] py-0 px-1.5 font-bold border border-emerald-300">
                                    {selectedDc.paymentMethod ===
                                      "bank_transfer" ||
                                    linkedBankTx ||
                                    selectedDc.utrNo
                                      ? "🏦 Bank Transfer / UPI"
                                      : "💵 Physical Cash (Hand Collected)"}
                                  </Badge>
                                </h4>
                                <p className="text-[11px] text-slate-500">
                                  {selectedDc.paymentMethod === "bank_transfer" ||
                                  linkedBankTx ||
                                  selectedDc.utrNo
                                    ? `Reconciled bank transaction record for DC #${selectedDc.dcNo}`
                                    : `Physical cash collected in hand for DC #${selectedDc.dcNo} • Unlinked to bank statement`}
                                </p>
                              </div>
                            </div>
                            {selectedDc.paidAmount ||
                            selectedDc.cashAmount ||
                            linkedBankTx?.amount ? (
                              <div className="text-right">
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                                  Paid Amount
                                </span>
                                <span className="text-base font-black font-mono text-emerald-700 dark:text-emerald-400">
                                  ₹
                                  {(
                                    selectedDc.paidAmount ||
                                    selectedDc.cashAmount ||
                                    linkedBankTx?.amount ||
                                    0
                                  ).toLocaleString("en-IN")}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        )}

                        {(!selectedDc.partPayments ||
                          selectedDc.partPayments.length === 0) && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2.5 border-t border-emerald-200/90 dark:border-emerald-800/80 text-xs">
                            <div>
                              <span className="text-[10px] font-bold uppercase text-slate-500 block">
                                Bank Account
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1 mt-0.5">
                                <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                {selectedDc.paymentMethod === "bank_transfer" ||
                                linkedBankTx ||
                                selectedDc.utrNo
                                  ? selectedDc.bankName || "Operating Account"
                                  : selectedDc.bankName ||
                                    "Physical Cash Treasury (In Hand)"}{" "}
                                {selectedDc.accountNumber
                                  ? `(${selectedDc.accountNumber})`
                                  : ""}
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] font-bold uppercase text-slate-500 block">
                                UTR / Ref #
                              </span>
                              {selectedDc.utrNo ||
                              linkedBankTx?.referenceNumber ? (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <code className="font-mono font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-[11px]">
                                    {selectedDc.utrNo ||
                                      linkedBankTx?.referenceNumber}
                                  </code>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const val =
                                        selectedDc.utrNo ||
                                        linkedBankTx?.referenceNumber ||
                                        "";
                                      navigator.clipboard.writeText(val);
                                      toast({
                                        title: "Copied UTR #",
                                        description: val,
                                      });
                                    }}
                                    className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                                    title="Copy UTR Number"
                                  >
                                    <Copy className="w-3.5 h-3.5 text-teal-700" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-400 mt-0.5 block">
                                  N/A
                                </span>
                              )}
                            </div>

                            <div>
                              <span className="text-[10px] font-bold uppercase text-slate-500 block">
                                Settlement Date
                              </span>
                              <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                {selectedDc.paidAt
                                  ? formatDate(selectedDc.paidAt)
                                  : linkedBankTx?.date
                                    ? `${linkedBankTx.date} ${linkedBankTx.time || ""}`
                                    : formatDate(selectedDc.savedAt)}
                              </span>
                            </div>

                            {selectedDc.invoiceRef && (
                              <div>
                                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                                  Invoice / Memo Ref
                                </span>
                                <span className="font-mono font-bold text-teal-800 dark:text-teal-300 mt-0.5 block">
                                  {selectedDc.invoiceRef}
                                </span>
                              </div>
                            )}

                            {linkedBankTx?.description && (
                              <div className="sm:col-span-2">
                                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                                  Bank Narration
                                </span>
                                <span
                                  className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 block truncate"
                                  title={linkedBankTx.description}
                                >
                                  {linkedBankTx.description}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-6 text-center space-y-2">
                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 flex items-center justify-center mx-auto">
                          <Banknote className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                          No Payment Settlement Recorded
                        </h4>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          Payment settlements, cash receipts, and bank transaction reconciliations for DC #{selectedDc.dcNo} will appear here once recorded.
                        </p>
                      </div>
                    )
                  )}
                </TabsContent>

                {/* Overview Tab Content */}
                <TabsContent value="overview" className="mt-3 space-y-3">

                  {/* Tracking + actions (courier-tracking style) */}
                  <div className="rounded-md border border-slate-200 bg-white p-2.5 sm:p-3">
                    <div className="space-y-4">
                      {/* Animated Workflow Progress */}
                      <div className="min-w-0">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Workflow Lifecycle
                          </span>
                          <span className="text-[11px] font-medium text-slate-400">
                            Step-by-step audit trail
                          </span>
                        </div>
                        {(() => {
                          const isCancelled = selectedDc.status === "cancelled";
                          const isPurchase = selectedDc.isPurchase;
                          const isReturned =
                            selectedDc.status === "returned" ||
                            selectedDc.status === "completed" ||
                            selectedDc.status === "cash";
                          const isCompleted = selectedDc.status === "completed";
                          const isBankLinked = Boolean(
                            selectedDc.paymentMethod === "bank_transfer" ||
                            linkedBankTx ||
                            selectedDc.utrNo,
                          );

                          const isCashQueue = selectedDc.status === "cash";
                          const isAwaitingPayment = isCashQueue;
                          const isPaidNotLinked = isCompleted && !isBankLinked;
                          const isPaidAndLinked = isCompleted && isBankLinked;
                          const selectedIsTaxInvoice = Boolean(
                            (selectedDc as any)?.isTaxInvoice ||
                            (!selectedDc?.cashAmount &&
                              selectedDc?.invoiceRef &&
                              !selectedDc?.invoiceRef.startsWith("SRR-")),
                          );

                          const Step = ({
                            num,
                            label,
                            sublabel,
                            state,
                            icon,
                          }: {
                            num: number;
                            label: string;
                            sublabel: string;
                            state: "done" | "active" | "pending" | "cancelled";
                            icon?: React.ReactNode;
                          }) => {
                            const renderStepIcon = () => {
                              if (state === "cancelled")
                                return <Ban className="h-4 w-4 stroke-[2.2]" />;
                              if (icon) return icon;

                              // Fallbacks based on label
                              if (label.includes("Delivered"))
                                return <Truck className="h-4 w-4 stroke-[2.2]" />;
                              if (label.includes("Purchased"))
                                return <ShoppingBag className="h-4 w-4 stroke-[2.2]" />;
                              if (label.includes("Returned"))
                                return <RotateCcw className="h-4 w-4 stroke-[2.2]" />;
                              if (label.includes("Awaiting"))
                                return <Clock className="h-4 w-4 stroke-[2.2]" />;
                              if (label.includes("GoGST"))
                                return <Receipt className="h-4 w-4 stroke-[2.2]" />;
                              if (label.includes("Cash Invoice") || label.includes("Cash Memo"))
                                return <IndianRupee className="h-4 w-4 stroke-[2.2]" />;
                              if (label.includes("Not Linked"))
                                return <Wallet className="h-4 w-4 stroke-[2.2]" />;
                              if (label.includes("Settled") || label.includes("Paid"))
                                return <CheckCircle2 className="h-4 w-4 stroke-[2.2]" />;

                              return state === "done" ? (
                                <Check className="h-4 w-4 stroke-[2.5]" />
                              ) : (
                                num
                              );
                            };

                            return (
                              <div className="flex flex-col items-center gap-1 flex-1 min-w-0 z-10">
                                <div className="relative flex items-center justify-center">
                                  {state === "active" && (
                                    <div className="absolute -inset-1 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                                  )}
                                  <div
                                    className={`
                                    relative h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0 transition-all
                                    ${
                                      state === "done"
                                        ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                                        : state === "active"
                                          ? "bg-amber-500 border-amber-500 text-white font-extrabold shadow-md scale-105"
                                          : state === "cancelled"
                                            ? "bg-red-100 border-red-500 text-red-600"
                                            : "bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700"
                                    }
                                  `}
                                  >
                                    {renderStepIcon()}
                                  </div>
                                </div>
                                <div
                                  className={`text-[11px] font-bold text-center leading-tight mt-1
                                  ${
                                    state === "done"
                                      ? "text-emerald-700 dark:text-emerald-400"
                                      : state === "active"
                                        ? "text-amber-700 dark:text-amber-300 font-extrabold"
                                        : state === "cancelled"
                                          ? "text-red-600"
                                          : "text-slate-400"
                                  }
                                `}
                                >
                                  {label}
                                </div>
                                <div className="text-[10px] text-slate-400 text-center leading-tight truncate w-full px-0.5">
                                  {sublabel}
                                </div>
                              </div>
                            );
                          };

                          const Line = ({ done }: { done: boolean }) => (
                            <div
                              className={`h-0.5 flex-1 rounded-full -mt-7 shrink-0 transition-colors duration-300 ${
                                done
                                  ? "bg-emerald-500"
                                  : "bg-slate-200 dark:bg-slate-700"
                              }`}
                            />
                          );

                          if (isCancelled)
                            return (
                              <div className="flex items-center gap-1">
                                <Step
                                  num={1}
                                  label="Delivered"
                                  sublabel={formatDate(
                                    selectedDc.savedAt ||
                                      getDisplayDate(selectedDc),
                                  )}
                                  state="done"
                                />
                                <Line done={true} />
                                <Step
                                  num={2}
                                  label="Cancelled"
                                  sublabel={
                                    selectedDc.cancelledAt
                                      ? formatDate(selectedDc.cancelledAt)
                                      : "–"
                                  }
                                  state="cancelled"
                                />
                              </div>
                            );

                          if (selectedIsTaxInvoice)
                            return (
                              <div className="flex items-center gap-1">
                                {/* Step 1: Created */}
                                <Step
                                  num={1}
                                  label="Delivered"
                                  sublabel={formatDate(
                                    selectedDc.savedAt ||
                                      getDisplayDate(selectedDc),
                                  )}
                                  state="done"
                                />
                                <Line done={isReturned} />

                                {/* Step 2: Returned / Purchased */}
                                <Step
                                  num={2}
                                  label={isPurchase ? "Purchased" : "Returned"}
                                  sublabel={
                                    selectedDc.returnedAt
                                      ? formatDate(selectedDc.returnedAt)
                                      : isPurchase
                                        ? "Direct Sale"
                                        : "Awaiting Return"
                                  }
                                  state={isReturned ? "done" : "active"}
                                />
                                <Line done={isReturned} />

                                {/* Step 3: Awaiting Billing */}
                                <Step
                                  num={3}
                                  label="Awaiting Billing"
                                  sublabel="Passed (GoGST Selected)"
                                  state="done"
                                />
                                <Line done={Boolean(selectedDc.invoiceRef)} />

                                {/* Step 4: GoGST Bill Linked */}
                                <Step
                                  num={4}
                                  label="GoGST Bill Linked"
                                  sublabel={
                                    selectedDc.invoiceRef
                                      ? `${selectedDc.invoiceRef} (Check in GoGST to track payments)`
                                      : "(Check in GoGST to track payments)"
                                  }
                                  state={
                                    selectedDc.invoiceRef ? "done" : "pending"
                                  }
                                />
                              </div>
                            );

                          const hasBilled = isCashQueue || isCompleted;

                          return (
                            <div className="flex items-center gap-1">
                              {/* Step 1: Created */}
                              <Step
                                num={1}
                                label="Delivered"
                                sublabel={formatDate(
                                  selectedDc.savedAt ||
                                    getDisplayDate(selectedDc),
                                )}
                                state="done"
                              />
                              <Line done={isReturned} />

                              {/* Step 2: Returned / Purchased */}
                              <Step
                                num={2}
                                label={isPurchase ? "Purchased" : "Returned"}
                                sublabel={
                                  selectedDc.returnedAt
                                    ? formatDate(selectedDc.returnedAt)
                                    : isPurchase
                                      ? "Direct Sale"
                                      : "Awaiting Return"
                                }
                                state={isReturned ? "done" : "active"}
                              />
                              <Line done={hasBilled || isReturned} />

                              {/* Step 3: Awaiting Billing */}
                              <Step
                                num={3}
                                label="Awaiting Billing"
                                sublabel={
                                  isCashQueue
                                    ? "Passed (Cash Memo Created)"
                                    : hasBilled
                                      ? "Passed"
                                      : isReturned
                                        ? "Cash or GoGST decision"
                                        : "Pending Return"
                                }
                                state={
                                  hasBilled
                                    ? "done"
                                    : isReturned
                                      ? "active"
                                      : "pending"
                                }
                              />
                              <Line done={hasBilled} />

                              {/* Step 4: Cash Invoice */}
                              <Step
                                num={4}
                                label={
                                  isCashQueue || isCompleted
                                    ? "Cash Invoice"
                                    : isReturned
                                      ? "Cash Invoice OR GoGST Bill"
                                      : "Cash Invoice"
                                }
                                sublabel={
                                  isCashQueue
                                    ? `(Awaiting Payment) • Due ₹${Math.max(0, (selectedDc.originalInvoiceTotal || selectedDc.cashAmount || selectedDc.billedAmount || 0) - (selectedDc.paidAmount || 0)).toLocaleString("en-IN")}`
                                    : isCompleted
                                      ? "Passed"
                                      : isReturned
                                        ? "Branching: GoGST Tax Invoice OR Cash Memo"
                                        : "Bill Not Raised Yet"
                                }
                                state={
                                  isCashQueue
                                    ? "active"
                                    : isCompleted
                                      ? "done"
                                      : "pending"
                                }
                              />
                              <Line done={isCompleted} />

                              {/* Step 5: Paid (Not Linked) */}
                              <Step
                                num={5}
                                label="Paid (Not Linked)"
                                sublabel={
                                  isPaidNotLinked
                                    ? "Cash Collected"
                                    : isPaidAndLinked
                                      ? "Passed"
                                      : "Pending"
                                }
                                state={
                                  isPaidNotLinked
                                    ? "active"
                                    : isPaidAndLinked
                                      ? "done"
                                      : "pending"
                                }
                              />
                              <Line done={isPaidAndLinked} />

                              {/* Step 6: Paid & Linked & Settled */}
                              {(() => {
                                let isPart = Boolean(
                                  selectedDc.isPartialPayment,
                                );
                                let paid = selectedDc.paidAmount ?? 0;
                                let orig =
                                  selectedDc.originalInvoiceTotal ??
                                  (selectedDc.cashAmount || 0);

                                if (
                                  selectedDc.cashRemarks &&
                                  selectedDc.cashRemarks.includes(
                                    "Part Payment Received",
                                  )
                                ) {
                                  isPart = true;
                                  const match = selectedDc.cashRemarks.match(
                                    /Part Payment Received:\s*₹?([\d,]+)\s*of\s*₹?([\d,]+)/i,
                                  );
                                  if (match) {
                                    paid =
                                      parseFloat(match[1].replace(/,/g, "")) ||
                                      paid;
                                    orig =
                                      parseFloat(match[2].replace(/,/g, "")) ||
                                      orig;
                                  }
                                }

                                if (
                                  !isPart &&
                                  paid > 0 &&
                                  orig > 0 &&
                                  paid < orig
                                ) {
                                  isPart = true;
                                }

                                const due = Math.max(0, orig - paid);

                                return (
                                  <Step
                                    num={6}
                                    label={
                                      isPart
                                        ? "Part Paid Settled"
                                        : "Paid & Linked & Settled"
                                    }
                                    sublabel={
                                      isPart
                                        ? `⚠️ Paid ₹${paid.toLocaleString("en-IN")} / ₹${orig.toLocaleString("en-IN")} (Due ₹${due.toLocaleString("en-IN")})`
                                        : isPaidAndLinked
                                          ? selectedDc.paidAt
                                            ? formatDate(selectedDc.paidAt)
                                            : selectedDc.utrNo ||
                                                linkedBankTx?.referenceNumber
                                              ? `Ref: ${selectedDc.utrNo || linkedBankTx?.referenceNumber}`
                                              : "Bank Settled"
                                          : isCompleted
                                            ? "Completed"
                                            : "Bank Match"
                                    }
                                    state={
                                      isCompleted || isPaidAndLinked
                                        ? "done"
                                        : "pending"
                                    }
                                  />
                                );
                              })()}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Next Steps Action Cards */}
                      <div className="pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                              <ArrowRight className="h-3 w-3" />
                            </span>
                            <span className="text-xs font-semibold text-slate-700 tracking-wide">
                              Next Steps
                            </span>
                          </div>
                          {selectedDc.isTaxInvoice ||
                          (!selectedDc.cashAmount &&
                            selectedDc.invoiceRef &&
                            !selectedDc.invoiceRef.startsWith("SRR-")) ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-bold border-purple-300 text-purple-800 bg-purple-100 gap-1 py-0.5 px-2"
                            >
                              <FileText className="h-3 w-3 text-slate-600" />
                              Invoice Linked • Track Payments in GoGSTBill
                            </Badge>
                          ) : selectedDc.status === "completed" ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-bold border-emerald-300 text-emerald-800 bg-emerald-100 gap-1 py-0.5 px-2"
                            >
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              {selectedDc.isPartialPayment ||
                              (selectedDc.paidAmount &&
                                selectedDc.originalInvoiceTotal &&
                                selectedDc.paidAmount <
                                  selectedDc.originalInvoiceTotal) ||
                              selectedDc.cashRemarks?.includes(
                                "Part Payment Received",
                              )
                                ? "⚡ Part Payment Settled & Completed"
                                : selectedDc.paymentMethod ===
                                      "bank_transfer" ||
                                    linkedBankTx ||
                                    selectedDc.utrNo
                                  ? "⚡ Payment Linked & Settled"
                                  : "✅ Payment Settled & Completed"}
                            </Badge>
                          ) : selectedDc.status === "cash" ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-bold border-amber-300 text-amber-800 bg-amber-50 gap-1 py-0 h-5"
                            >
                              ● Awaiting Payment
                            </Badge>
                          ) : selectedDc.status === "returned" ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-medium border-teal-200 text-teal-700 bg-teal-50 gap-1 py-0 h-5"
                            >
                              Returned • Ready to Bill
                            </Badge>
                          ) : selectedDc.status === "pending" ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-bold border-teal-300 text-teal-800 bg-teal-50 gap-1 py-0.5 px-2"
                            >
                              <Truck className="h-3 w-3 text-teal-600" />
                              Delivered • Pending Return
                            </Badge>
                          ) : null}
                        </div>

                        {/* State: Pending Return */}
                        {selectedDc.status === "pending" && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {/* 1. Record Return */}
                              <button
                                type="button"
                                onClick={() =>
                                  openActionDialog("return", selectedDc)
                                }
                                className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-indigo-200/90 bg-indigo-50/60 hover:bg-indigo-100 hover:border-indigo-300 text-indigo-900 transition-all text-center group shadow-none hover:shadow-none"
                              >
                                <div className="h-7 w-7 rounded-full bg-indigo-100 group-hover:bg-indigo-200 flex items-center justify-center mb-1 text-indigo-700 transition-colors">
                                  <RotateCcw className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold leading-tight">
                                  Return
                                </span>
                                <span className="text-[10px] text-slate-500 mt-0.5">
                                  Receive Sets
                                </span>
                              </button>

                              {/* 2. Purchase: Cash Memo */}
                              <button
                                type="button"
                                onClick={() => {
                                  setDetailsDialogOpen(false);
                                  handleCreateCashMemoForDc(selectedDc);
                                }}
                                className="relative flex flex-col items-center justify-center p-2.5 rounded-lg border border-amber-300/90 bg-amber-50/60 hover:bg-amber-100 hover:border-amber-400 text-amber-950 transition-all text-center group shadow-none hover:shadow-none"
                              >
                                <span className="absolute -top-1.5 right-2 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold uppercase bg-amber-500 text-white shadow-none">
                                  Purchase
                                </span>
                                <div className="h-7 w-7 rounded-full bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center mb-1 text-amber-800 transition-colors">
                                  <Receipt className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold leading-tight">
                                  Cash Memo
                                </span>
                                <span className="text-[10px] text-amber-800/80 mt-0.5">
                                  Instant Bill
                                </span>
                              </button>

                              {/* 3. Purchase: Go GST Bill */}
                              <button
                                type="button"
                                onClick={() => {
                                  setDetailsDialogOpen(false);
                                  openActionDialog("invoice", selectedDc);
                                }}
                                className="relative flex flex-col items-center justify-center p-2.5 rounded-lg border border-amber-300/90 bg-amber-50/60 hover:bg-amber-100 hover:border-amber-400 text-amber-950 transition-all text-center group shadow-none hover:shadow-none"
                              >
                                <span className="absolute -top-1.5 right-2 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold uppercase bg-amber-500 text-white shadow-none">
                                  Purchase
                                </span>
                                <div className="h-7 w-7 rounded-full bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center mb-1 text-amber-800 transition-colors">
                                  <FileText className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold leading-tight">
                                  Go GST Bill
                                </span>
                                <span className="text-[10px] text-amber-800/80 mt-0.5">
                                  Link Invoice
                                </span>
                              </button>

                              {/* 4. Cancel Case */}
                              <button
                                type="button"
                                onClick={() =>
                                  openActionDialog("cancel", selectedDc)
                                }
                                className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-rose-200/90 bg-rose-50/50 hover:bg-rose-100 hover:border-rose-300 text-rose-900 transition-all text-center group shadow-none hover:shadow-none"
                              >
                                <div className="h-7 w-7 rounded-full bg-rose-100 group-hover:bg-rose-200 flex items-center justify-center mb-1 text-rose-700 transition-colors">
                                  <AlertCircle className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold leading-tight text-rose-800">
                                  Cancel Case
                                </span>
                                <span className="text-[10px] text-rose-600/80 mt-0.5">
                                  Surgery Cancelled
                                </span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* State: Returned, Awaiting Billing */}
                        {selectedDc.status === "returned" &&
                          !selectedDc.invoiceRef && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {/* Option 1: Create Cash Memo */}
                              <div className="rounded-lg border border-blue-200/80 bg-blue-50/40 p-2.5 flex flex-col justify-between hover:border-blue-300 transition-colors">
                                <div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
                                      <Receipt className="h-3.5 w-3.5 text-blue-600" />
                                      Create Cash Memo
                                    </div>
                                    <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                                      Instant
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                                    Auto-fill returned items and generate
                                    instant cash bill
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  className="mt-2.5 h-7 w-full text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-none"
                                  onClick={() =>
                                    handleCreateCashMemoForDc(selectedDc)
                                  }
                                >
                                  Create Cash Memo{" "}
                                  <ArrowRight className="h-3 w-3" />
                                </Button>
                              </div>

                              {/* Option 2: Link GoGSTBill */}
                              <div className="rounded-lg border border-purple-200/80 bg-purple-50/40 p-2.5 flex flex-col justify-between hover:border-purple-300 transition-colors">
                                <div>
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-900">
                                    <FileText className="h-3.5 w-3.5 text-slate-600" />
                                    Link GoGSTBill
                                  </div>
                                  <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                                    Attach tax invoice number from GoGSTBill
                                    portal
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-2.5 h-7 w-full text-xs font-medium border-purple-300 text-purple-700 bg-white hover:bg-purple-50 gap-1.5"
                                  onClick={() =>
                                    openActionDialog("invoice", selectedDc)
                                  }
                                >
                                  Link Invoice Number{" "}
                                  <ArrowRight className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          )}

                        {/* State: Cash Queue - Awaiting Payment */}
                        {selectedDc.status === "cash" && (
                          <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                                <Wallet className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                  <span>Cash Memo Linked:</span>
                                  <span className="font-mono text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded text-[11px] font-bold">
                                    {selectedDc.invoiceRef || "Cash Memo"}
                                  </span>
                                  <Badge className="bg-amber-500/15 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0 font-bold">
                                    ● Awaiting Payment (
                                    {getCashMemoAgingDays(selectedDc)}d)
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-slate-600 mt-0.5">
                                  Unpaid in Cash Queue. Remaining Due:{" "}
                                  <span className="font-bold text-slate-800">
                                    ₹
                                    {Math.max(
                                      0,
                                      (selectedDc.originalInvoiceTotal ||
                                        selectedDc.cashAmount ||
                                        0) - (selectedDc.paidAmount || 0),
                                    ).toLocaleString("en-IN")}
                                  </span>
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                              {selectedDc.invoiceRef && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-amber-300 text-amber-900 bg-white hover:bg-amber-50 font-medium"
                                  onClick={() => {
                                    setDetailsDialogOpen(false);
                                    setViewingCashMemoRef(
                                      selectedDc.invoiceRef!,
                                    );
                                    setCashMemoModalOpen(true);
                                  }}
                                >
                                  <Receipt className="h-3 w-3 mr-1" /> View Memo
                                </Button>
                              )}
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-none"
                                onClick={() => openPaymentDialog(selectedDc)}
                              >
                                <Wallet className="h-3.5 w-3.5 mr-1" /> Collect
                                / Mark as Paid
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* State: GoGST Tax Invoice Linked */}
                        {selectedDc.isTaxInvoice ||
                        (!selectedDc.cashAmount &&
                          selectedDc.invoiceRef &&
                          !selectedDc.invoiceRef.startsWith("SRR-")) ? (
                          <div className="rounded-xl border border-purple-300/90 bg-purple-50/70 dark:bg-purple-950/40 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-none">
                            <div className="flex items-center gap-2.5">
                              <div className="h-9 w-9 rounded-xl bg-purple-700 text-white flex items-center justify-center shrink-0 shadow-none">
                                <FileText className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="text-xs font-bold text-purple-950 dark:text-purple-200 flex items-center gap-2 flex-wrap">
                                  <span>
                                    GoGST Tax Invoice Linked:{" "}
                                    {selectedDc.invoiceRef}
                                  </span>
                                  <Badge className="bg-purple-700 text-white text-[10px] font-bold py-0.5 px-2">
                                    INVOICE LINKED
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-purple-800 dark:text-purple-300 mt-0.5 leading-relaxed">
                                  Invoice linked is final step in OrthoDC.
                                  Payment details and collection are tracked
                                  directly in GoGSTBill.
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-purple-300 text-purple-800 bg-white hover:bg-purple-50 font-semibold"
                                onClick={() => {
                                  setDetailsDialogOpen(false);
                                  openActionDialog("invoice", selectedDc);
                                }}
                              >
                                <FileText className="h-3 w-3 mr-1 text-slate-600" />{" "}
                                View / Edit Link
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-purple-700 hover:bg-purple-800 text-white font-bold shadow-none gap-1"
                                onClick={() =>
                                  window.open(
                                    selectedDc.invoiceUrl ||
                                      "https://gogstbill.com",
                                    "_blank",
                                  )
                                }
                              >
                                <ExternalLink className="h-3 w-3" /> Open
                                GoGSTBill
                              </Button>
                            </div>
                          </div>
                        ) : (
                          (selectedDc.status === "completed" ||
                            (selectedDc.status !== "cash" &&
                              selectedDc.invoiceRef)) && (
                            <div className="rounded-xl border border-emerald-300/90 bg-emerald-50/70 dark:bg-emerald-950/40 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-none">
                              <div className="flex items-center gap-2.5">
                                <div className="h-9 w-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-none">
                                  <CheckCircle2 className="h-5 w-5" />
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-2 flex-wrap">
                                    <span>
                                      {selectedDc.paymentMethod ===
                                        "bank_transfer" ||
                                      linkedBankTx ||
                                      selectedDc.utrNo
                                        ? "⚡ Bank Payment Linked & Settled"
                                        : "💵 Physical Cash Collected (Unlinked to Bank Deposit)"}
                                    </span>
                                    <Badge className="bg-emerald-700 text-white text-[10px] font-bold py-0.5 px-2">
                                      {selectedDc.paymentMethod ===
                                        "bank_transfer" ||
                                      linkedBankTx ||
                                      selectedDc.utrNo
                                        ? "BANK SETTLED"
                                        : "CASH COLLECTED"}
                                    </Badge>
                                  </div>
                                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                                    {selectedDc.invoiceRef
                                      ? `Cash Memo: ${selectedDc.invoiceRef} • `
                                      : ""}
                                    {selectedDc.paymentMethod ===
                                      "bank_transfer" ||
                                    linkedBankTx ||
                                    selectedDc.utrNo
                                      ? `Reconciled with Bank Deposit (UTR: ${selectedDc.utrNo || linkedBankTx?.referenceNumber || "Verified"})`
                                      : `Cash payment of ₹${((selectedDc as any).cashAmount || 0).toLocaleString("en-IN")} collected${selectedDc.collectedBy ? ` by ${selectedDc.collectedBy}` : ""}. Optional bank deposit link pending.`}
                                  </p>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                                {selectedIsCashMemo && (
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-none"
                                    onClick={() => {
                                      setDetailsDialogOpen(false);
                                      setViewingCashMemoRef(
                                        selectedDc.invoiceRef!,
                                      );
                                      setCashMemoModalOpen(true);
                                    }}
                                  >
                                    <Receipt className="h-3.5 w-3.5 mr-1" />{" "}
                                    View Cash Memo
                                  </Button>
                                )}
                                {!(
                                  selectedDc.paymentMethod ===
                                    "bank_transfer" ||
                                  linkedBankTx ||
                                  selectedDc.utrNo
                                ) && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-emerald-400 text-emerald-800 bg-white hover:bg-emerald-50 font-semibold shadow-none"
                                    onClick={() => {
                                      setDetailsDialogOpen(false);
                                      openPaymentDialog(selectedDc);
                                    }}
                                  >
                                    <Landmark className="h-3 w-3 mr-1 text-emerald-600" />{" "}
                                    Link Bank Deposit
                                  </Button>
                                )}
                              </div>
                            </div>
                          )
                        )}

                        {/* State: Cancelled */}
                        {selectedDc.status === "cancelled" && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                              <div>
                                <span className="text-xs text-slate-700">
                                  This case was cancelled.
                                </span>
                                {selectedDc.returnedBy && (
                                  <div className="text-[11px] text-slate-600 font-medium">
                                    Items returned by:{" "}
                                    <span className="text-slate-900 font-bold">
                                      {selectedDc.returnedBy}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-slate-300 text-slate-700 hover:bg-white"
                              onClick={() => restoreFromCancelled(selectedDc)}
                            >
                              <Undo2 className="h-3 w-3 mr-1" /> Restore DC
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Optional Cash Memo / Tax Invoice Card in Overview */}
                  {selectedDc.invoiceRef && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 mt-3">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {selectedIsTaxInvoice ? (
                            <>
                              <FileText className="h-4 w-4 text-slate-600" />
                              Tax Invoice Details
                            </>
                          ) : (
                            <>
                              <Receipt className="h-4 w-4 text-emerald-600" />
                              Cash Memo Details
                            </>
                          )}
                        </div>
                        {selectedDc.status === "cash" && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-bold border-amber-300 text-amber-800 bg-amber-50"
                          >
                            Awaiting Payment
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">
                            {selectedIsTaxInvoice
                              ? "Tax Invoice No"
                              : "Cash Memo No"}
                          </span>
                          <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                            {selectedDc.invoiceRef || "-"}
                          </span>
                        </div>
                        {selectedIsTaxInvoice && (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">
                              GoGSTBill Link
                            </span>
                            {selectedDc.invoiceUrl ? (
                              <a
                                href={selectedDc.invoiceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 text-xs truncate max-w-[200px]"
                                title={selectedDc.invoiceUrl}
                              >
                                <span>Open Invoice</span>
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setDetailsDialogOpen(false);
                                  openActionDialog("invoice", selectedDc);
                                }}
                                className="text-xs text-purple-700 hover:text-purple-900 font-semibold underline cursor-pointer"
                              >
                                + Attach Link
                              </button>
                            )}
                          </div>
                        )}
                        {!selectedIsTaxInvoice && (
                          <>
                            {Boolean(
                              (selectedDc as any).billedAmount &&
                              (selectedDc as any).billedAmount >
                                ((selectedDc as any).cashAmount || 0),
                            ) && (
                              <>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-slate-500">
                                    Printed Bill (Hiked)
                                  </span>
                                  <span className="font-semibold text-slate-600 line-through">
                                    ₹
                                    {(
                                      selectedDc as any
                                    ).billedAmount.toLocaleString("en-IN")}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-amber-700 font-medium">
                                    Hospital Cut / Margin
                                  </span>
                                  <span className="font-bold text-amber-700">
                                    - ₹
                                    {(
                                      (selectedDc as any).hospitalMargin ||
                                      (selectedDc as any).billedAmount -
                                        ((selectedDc as any).cashAmount || 0)
                                    ).toLocaleString("en-IN")}
                                  </span>
                                </div>
                              </>
                            )}
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-slate-500">
                                {selectedDc.status === "cash"
                                  ? "Net Cash Due"
                                  : selectedDc.isPartialPayment ||
                                      (selectedDc.paidAmount &&
                                        selectedDc.originalInvoiceTotal &&
                                        selectedDc.paidAmount <
                                          selectedDc.originalInvoiceTotal) ||
                                      selectedDc.cashRemarks?.includes(
                                        "Part Payment Received",
                                      )
                                    ? "Settled Part Paid Amount"
                                    : (selectedDc as any).billedAmount
                                      ? "Our Net Cash"
                                      : "Cash Amount"}
                              </span>
                              <span
                                className={`font-bold ${selectedDc.status === "cash" ? "text-amber-800 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-400"}`}
                              >
                                {(() => {
                                  if (selectedDc.status === "cash") {
                                    const orig =
                                      selectedDc.originalInvoiceTotal ||
                                      selectedDc.cashAmount ||
                                      0;
                                    const paid = selectedDc.paidAmount || 0;
                                    const remaining = Math.max(0, orig - paid);
                                    return `₹${remaining.toLocaleString("en-IN")}`;
                                  }
                                  const isPart =
                                    selectedDc.isPartialPayment ||
                                    (selectedDc.paidAmount &&
                                      selectedDc.originalInvoiceTotal &&
                                      selectedDc.paidAmount <
                                        selectedDc.originalInvoiceTotal) ||
                                    selectedDc.cashRemarks?.includes(
                                      "Part Payment Received",
                                    );
                                  if (isPart) {
                                    let paid = selectedDc.paidAmount ?? 0;
                                    if (
                                      selectedDc.cashRemarks &&
                                      selectedDc.cashRemarks.includes(
                                        "Part Payment Received",
                                      )
                                    ) {
                                      const match =
                                        selectedDc.cashRemarks.match(
                                          /Part Payment Received:\s*₹?([\d,]+)\s*of/i,
                                        );
                                      if (match)
                                        paid =
                                          parseFloat(
                                            match[1].replace(/,/g, ""),
                                          ) || paid;
                                    }
                                    return `₹${paid.toLocaleString("en-IN")} (Part Paid)`;
                                  }
                                  return typeof (selectedDc as any)
                                    .cashAmount === "number"
                                    ? `₹${(selectedDc as any).cashAmount.toLocaleString("en-IN")}`
                                    : "-";
                                })()}
                                {selectedDc.status === "cash"
                                  ? " (Unpaid)"
                                  : ""}
                              </span>
                            </div>
                            {selectedDc.status !== "cash" &&
                              selectedDc.paymentMethod && (
                                <div className="flex items-center justify-between gap-3 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                                  <span className="text-slate-500">
                                    Payment Mode
                                  </span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                    {selectedDc.paymentMethod === "cash" ? (
                                      <>
                                        <Banknote className="h-3.5 w-3.5 text-emerald-600" />
                                        Cash{" "}
                                        {selectedDc.collectedBy
                                          ? `(${selectedDc.collectedBy})`
                                          : ""}
                                      </>
                                    ) : (
                                      <>
                                        <Landmark className="h-3.5 w-3.5 text-indigo-600" />
                                        Bank Transfer / UPI
                                      </>
                                    )}
                                  </span>
                                </div>
                              )}
                            {selectedDc.status === "cash" && (
                              <Button
                                size="sm"
                                className="mt-2 h-8 w-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 rounded-xl shadow-none"
                                onClick={() => openPaymentDialog(selectedDc)}
                              >
                                <Wallet className="h-3.5 w-3.5" /> Mark as Paid
                                (Collect Payment)
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* HISTORY TAB: DETAILED ACTIVITY & AUDIT TIMELINE */}
                <TabsContent value="history" className="mt-3">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          Detailed Activity &amp; Transaction Audit Trail
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Complete timestamped event history for DC #
                          {selectedDc.dcNo}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold"
                      >
                        {(selectedDc.history || []).length || 1} Event Log
                        {((selectedDc.history || []).length || 1) > 1
                          ? "s"
                          : ""}
                      </Badge>
                    </div>

                    <div className="p-4">
                      <div className="relative pl-6 space-y-5">
                        {selectedDc.history && selectedDc.history.length > 0 ? (
                          selectedDc.history
                            .slice()
                            .reverse()
                            .map((h, idx) => {
                              const isFirst = idx === 0;
                              return (
                                <div
                                  key={`${h.at}-${idx}`}
                                  className="relative pl-2"
                                >
                                  {/* Timeline node */}
                                  <span
                                    className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900 shadow-none ${
                                      h.action.includes("COMPLETED") ||
                                      h.action.includes("PAID")
                                        ? "bg-emerald-600 ring-2 ring-emerald-500/20"
                                        : h.action.includes("RETURN")
                                          ? "bg-teal-600"
                                          : h.action.includes("CASH")
                                            ? "bg-blue-600"
                                            : h.action.includes("CANCEL")
                                              ? "bg-rose-600"
                                              : "bg-indigo-600"
                                    }`}
                                  />

                                  <div className="bg-slate-50/80 dark:bg-slate-850/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                        {h.action === "CREATED" ? "DC DELIVERED" : h.action.replace(/_/g, " ")}
                                        {isFirst && (
                                          <Badge className="text-[9px] py-0 px-1.5 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-0 font-bold">
                                            Latest Event
                                          </Badge>
                                        )}
                                      </span>
                                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                        {formatDateTime(h.at)}
                                      </span>
                                    </div>

                                    {/* Status Badge transition */}
                                    {h.fromStatus && h.toStatus && (
                                      <div className="flex items-center gap-1.5 text-[10px]">
                                        <span className="text-slate-400">
                                          Status Change:
                                        </span>
                                        <Badge
                                          variant="outline"
                                          className="text-[9px] py-0 px-1 font-semibold uppercase bg-white dark:bg-slate-900"
                                        >
                                          {h.fromStatus === "pending" ? "DELIVERED" : h.fromStatus?.toUpperCase()}
                                        </Badge>
                                        <span className="text-slate-400 font-bold">
                                          →
                                        </span>
                                        <Badge
                                          variant="outline"
                                          className="text-[9px] py-0 px-1 font-bold uppercase bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                        >
                                          {h.toStatus === "pending" ? "DELIVERED" : h.toStatus?.toUpperCase()}
                                        </Badge>
                                      </div>
                                    )}

                                    {/* Personnel & Details */}
                                    <div className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5 pt-0.5">
                                      {(h.action === "CREATED" ||
                                        h.action === "PURCHASE") && (
                                        <>
                                          {selectedDc.deliveredBy && (
                                            <div>
                                              Delivered by:{" "}
                                              <strong className="text-slate-800 dark:text-slate-200">
                                                {selectedDc.deliveredBy}
                                              </strong>
                                            </div>
                                          )}
                                          {selectedDc.receivedBy && (
                                            <div>
                                              Hospital Received by:{" "}
                                              <strong className="text-slate-800 dark:text-slate-200">
                                                {selectedDc.receivedBy}
                                              </strong>
                                            </div>
                                          )}
                                        </>
                                      )}

                                      {h.action === "MARK_RETURNED" && (
                                        <>
                                          {((h.meta?.returnedBy as string) ||
                                            selectedDc.returnedBy) && (
                                            <div>
                                              Returned by:{" "}
                                              <strong className="text-slate-800 dark:text-slate-200">
                                                {(h.meta
                                                  ?.returnedBy as string) ||
                                                  selectedDc.returnedBy}
                                              </strong>
                                            </div>
                                          )}
                                          {((h.meta
                                            ?.returnedRemarks as string) ||
                                            (h.meta?.cleared as any)
                                              ?.returnedRemarks) && (
                                            <div className="italic text-slate-500">
                                              "
                                              {(h.meta
                                                ?.returnedRemarks as string) ||
                                                (h.meta?.cleared as any)
                                                  ?.returnedRemarks}
                                              "
                                            </div>
                                          )}
                                        </>
                                      )}

                                      {h.action === "MOVE_TO_CASH" && (
                                        <div>
                                          Expected Cash Receivable:{" "}
                                          <strong className="text-emerald-700 dark:text-emerald-400">
                                            ₹
                                            {(
                                              (h.meta?.cashAmount as number) ||
                                              selectedDc.cashAmount ||
                                              0
                                            ).toLocaleString("en-IN")}
                                          </strong>
                                        </div>
                                      )}

                                      {h.action ===
                                        "MOVE_CASH_TO_COMPLETED" && (
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span>
                                            Payment Mode:{" "}
                                            <strong className="text-slate-800 dark:text-slate-200">
                                              {(h.meta
                                                ?.paymentMethod as string) ||
                                                selectedDc.paymentMethod ||
                                                "cash"}
                                            </strong>
                                          </span>
                                          {((h.meta?.collectedBy as string) ||
                                            selectedDc.collectedBy) && (
                                            <span>
                                              • Collected by:{" "}
                                              <strong className="text-slate-800 dark:text-slate-200">
                                                {(h.meta
                                                  ?.collectedBy as string) ||
                                                  selectedDc.collectedBy}
                                              </strong>
                                            </span>
                                          )}
                                          <span>
                                            • Paid Amount:{" "}
                                            <strong className="text-emerald-700 dark:text-emerald-400">
                                              ₹
                                              {(
                                                (h.meta
                                                  ?.paidAmount as number) ||
                                                selectedDc.cashAmount ||
                                                0
                                              ).toLocaleString("en-IN")}
                                            </strong>
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Meta Attributes Table */}
                                    {h.meta &&
                                      Object.keys(h.meta).length > 0 && (
                                        <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-slate-200/60 dark:border-slate-800 mt-1">
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px]">
                                            {Object.entries(h.meta).map(
                                              ([key, val]) => {
                                                if (
                                                  typeof val === "object" &&
                                                  val !== null
                                                )
                                                  return null;
                                                return (
                                                  <div key={key}>
                                                    <span className="text-slate-400 font-medium capitalize">
                                                      {key.replace(
                                                        /([A-Z])/g,
                                                        " $1",
                                                      )}
                                                      :
                                                    </span>{" "}
                                                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                                                      {String(val)}
                                                    </span>
                                                  </div>
                                                );
                                              },
                                            )}
                                          </div>
                                        </div>
                                      )}
                                  </div>
                                </div>
                              );
                            })
                        ) : (
                          <div className="text-center py-6 text-slate-500 text-xs">
                            No history events available for this DC.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="items" className="mt-3">
                  <div className="space-y-3">
                    <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50">
                        <div className="text-xs font-semibold text-slate-700">
                          Items
                        </div>
                        <Badge
                          variant="outline"
                          className="border-slate-300 text-slate-700"
                        >
                          {getTotalQty(selectedDc)} qty
                        </Badge>
                      </div>
                      <div className="max-h-[35vh] overflow-auto">
                        <table className="w-full text-sm border-separate border-spacing-0">
                          <thead className="sticky top-0 z-10">
                            <tr className="bg-slate-100 border-b border-slate-200">
                              <th className="text-left px-3 py-2 text-xs font-semibold text-slate-700 border-b border-slate-200">
                                Item
                              </th>
                              <th className="text-left px-3 py-2 text-xs font-semibold text-slate-700 border-b border-slate-200">
                                Procedure
                              </th>
                              <th className="text-left px-3 py-2 text-xs font-semibold text-slate-700 border-b border-slate-200">
                                Sizes
                              </th>
                              <th className="text-right px-3 py-2 text-xs font-semibold text-slate-700 border-b border-slate-200">
                                Qty
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedDc.items.map((item, idx) => {
                              const itemQty = item.sizes.reduce(
                                (sum, size) => sum + size.qty,
                                0,
                              );
                              const sizeDetails = item.sizes
                                .filter((size) => size.size)
                                .map((size) => `${size.size} (${size.qty})`)
                                .join(", ");
                              return (
                                <tr
                                  key={idx}
                                  className="border-b border-slate-200"
                                >
                                  <td className="px-3 py-2 font-medium text-slate-900">
                                    {item.name}
                                  </td>
                                  <td className="px-3 py-2 text-slate-600">
                                    {item.procedure}
                                  </td>
                                  <td className="px-3 py-2 text-slate-600">
                                    {sizeDetails || "-"}
                                  </td>
                                  <td className="px-3 py-2 text-right font-semibold text-slate-900">
                                    {itemQty}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="text-xs font-semibold text-slate-700 mb-2">
                          Instruments
                        </div>
                        <div className="text-sm bg-slate-50 border border-slate-200 rounded px-2 py-2 min-h-[60px]">
                          {selectedDc.instruments?.length
                            ? selectedDc.instruments.join(", ")
                            : "-"}
                        </div>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="text-xs font-semibold text-slate-700 mb-2">
                          Box Numbers
                        </div>
                        <div className="text-sm bg-slate-50 border border-slate-200 rounded px-2 py-2 min-h-[60px]">
                          {selectedDc.boxNumbers?.length
                            ? selectedDc.boxNumbers.join(", ")
                            : "-"}
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="notes" className="mt-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="text-xs font-semibold text-slate-700 mb-2">
                        Initial Remarks
                      </div>
                      <div className="text-sm bg-slate-50 border border-slate-200 rounded px-2 py-2 min-h-[72px]">
                        {selectedDc.remarks || "-"}
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="text-xs font-semibold text-slate-700 mb-2">
                        Return Remarks
                      </div>
                      <div className="text-sm bg-slate-50 border border-slate-200 rounded px-2 py-2 min-h-[72px]">
                        {selectedDc.returnedRemarks || "-"}
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="text-xs font-semibold text-slate-700 mb-2">
                        Invoice Remarks
                      </div>
                      <div className="text-sm bg-slate-50 border border-slate-200 rounded px-2 py-2 min-h-[72px]">
                        {selectedDc.invoiceRemarks || "-"}
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="text-xs font-semibold text-slate-700 mb-2">
                        Cash Remarks
                      </div>
                      <div className="text-sm bg-slate-50 border border-slate-200 rounded px-2 py-2 min-h-[72px]">
                        {selectedDc.cashRemarks || "-"}
                      </div>
                    </div>
                    {selectedDc.status === "cancelled" && (
                      <div className="rounded-md border border-slate-200 bg-orange-50 p-3 md:col-span-2">
                        <div className="text-xs font-semibold text-orange-700 mb-2">
                          Cancellation Remarks
                        </div>
                        <div className="text-sm bg-white border border-orange-200 rounded px-2 py-2 min-h-[72px] text-orange-900 font-medium">
                          {selectedDc.cancelledRemarks || "No reason provided."}
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Protected Delete Dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          setDeleteDialog({ open, dc: open ? deleteDialog.dc : null })
        }
      >
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="w-[94vw] max-w-[94vw] sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 overflow-hidden border border-slate-200/90 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 gap-0"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription className="sr-only">
              Enter password to delete non-pending delivery challans.
            </DialogDescription>
          </DialogHeader>

          {deleteDialog.dc && (
            <>
              {/* Top Header */}
              <div className="bg-slate-50/80 dark:bg-slate-900/80 px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0 border border-rose-200/80 dark:border-rose-800">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                      <span>Delete Delivery Challan</span>
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700">
                        DC #{deleteDialog.dc.dcNo}
                      </span>
                    </h3>
                    {(deleteDialog.dc.doctorName || deleteDialog.dc.patientName) && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        {deleteDialog.dc.doctorName ? `Dr. ${deleteDialog.dc.doctorName}` : ""}
                        {deleteDialog.dc.doctorName && deleteDialog.dc.patientName ? ` • ` : ""}
                        {deleteDialog.dc.patientName ? `Pt: ${deleteDialog.dc.patientName}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Dispatch Info Summary */}
              <div className="px-5 pt-3.5 pb-1">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 text-xs space-y-2.5">
                  {/* Hospital Header */}
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-bold">
                    <Building2 className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="text-xs truncate">
                      {deleteDialog.dc.hospitalName || deleteDialog.dc.partyName || "Hospital Record"}
                    </span>
                  </div>

                  {/* Structured 2-Column Details Grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {/* Delivered By */}
                    <div className="flex items-start gap-2 min-w-0">
                      {getTransportMode(deleteDialog.dc.deliveredBy) ? (
                        renderTransportIcon(getTransportMode(deleteDialog.dc.deliveredBy)?.iconName, "w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5")
                      ) : (
                        <Truck className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Delivered By</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {normalizePersonnelName(deleteDialog.dc.deliveredBy) || deleteDialog.dc.deliveredBy || "Standard Dispatch"}
                        </div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-start gap-2 min-w-0">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Challan Status</div>
                        <div className="font-semibold text-rose-700 dark:text-rose-300 uppercase truncate">
                          {deleteDialog.dc.status}
                        </div>
                      </div>
                    </div>

                    {/* Total Items */}
                    <div className="flex items-start gap-2 min-w-0">
                      <Package className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Total Items</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {getTotalQty(deleteDialog.dc)} <span className="text-[11px] font-normal text-slate-500">({deleteDialog.dc.items?.length || 0} types)</span>
                        </div>
                      </div>
                    </div>

                    {/* Instruments */}
                    <div className="flex items-start gap-2 min-w-0">
                      <Wrench className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Instruments</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {deleteDialog.dc.instruments?.length || 0} Sets / Trays
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Admin Authorization Notice */}
              <div className="px-5 py-2.5">
                <div className="rounded-xl border border-rose-200/90 dark:border-rose-900/40 bg-rose-50/70 dark:bg-rose-950/20 p-3 space-y-1 text-xs text-rose-950 dark:text-rose-300">
                  <div className="flex items-center gap-1.5 font-bold text-rose-900 dark:text-rose-200">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Admin Authorization Required</span>
                  </div>
                  <p className="leading-relaxed">
                    Deleting a{" "}
                    <span className="font-bold uppercase tracking-wider underline">
                      {deleteDialog.dc.status}
                    </span>{" "}
                    challan is a protected action. Please enter the manager password.
                  </p>
                </div>
              </div>

              {/* Bottom Form */}
              <div className="px-5 py-2 space-y-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Admin Password *
                  </Label>
                  <Input
                    type="password"
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter password to authorize deletion..."
                    className="mt-1.5 h-9 rounded-xl border-slate-300 dark:border-slate-700 text-xs font-medium"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmProtectedDelete();
                    }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialog({ open: false, dc: null })}
                  className="rounded-xl h-9 px-4 text-xs font-semibold border-slate-300 hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:border-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmProtectedDelete}
                  className="rounded-xl h-9 px-5 text-xs font-bold gap-1.5 min-w-[130px] bg-rose-600 hover:bg-rose-700 text-white shadow-none"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirm Delete</span>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Move Back to Delivered Dialog */}
      <Dialog
        open={moveToPendingDialog.open}
        onOpenChange={(open) =>
          setMoveToPendingDialog({
            open,
            dc: open ? moveToPendingDialog.dc : null,
          })
        }
      >
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="w-[94vw] max-w-[94vw] sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 overflow-hidden border border-slate-200/90 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 gap-0"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Move Back to Delivered</DialogTitle>
            <DialogDescription>
              Confirm moving DC {moveToPendingDialog.dc?.dcNo} back to delivered.
            </DialogDescription>
          </DialogHeader>

          {moveToPendingDialog.dc && (
            <>
              {/* Top Header */}
              <div className="bg-slate-50/80 dark:bg-slate-900/80 px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 border border-amber-200/80 dark:border-amber-800">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                      <span>Move Back to Delivered?</span>
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                        DC #{moveToPendingDialog.dc.dcNo}
                      </span>
                    </h3>
                    {(moveToPendingDialog.dc.doctorName || moveToPendingDialog.dc.patientName) && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        {moveToPendingDialog.dc.doctorName ? `Dr. ${moveToPendingDialog.dc.doctorName}` : ""}
                        {moveToPendingDialog.dc.doctorName && moveToPendingDialog.dc.patientName ? ` • ` : ""}
                        {moveToPendingDialog.dc.patientName ? `Pt: ${moveToPendingDialog.dc.patientName}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Dispatch Info Summary */}
              <div className="px-5 pt-3.5 pb-1">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 text-xs space-y-2.5">
                  {/* Hospital Header */}
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-bold">
                    <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-xs truncate">
                      {moveToPendingDialog.dc.hospitalName || moveToPendingDialog.dc.partyName || "Hospital Record"}
                    </span>
                  </div>

                  {/* Structured 2-Column Details Grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {/* Delivered By */}
                    <div className="flex items-start gap-2 min-w-0">
                      {getTransportMode(moveToPendingDialog.dc.deliveredBy) ? (
                        renderTransportIcon(getTransportMode(moveToPendingDialog.dc.deliveredBy)?.iconName, "w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5")
                      ) : (
                        <Truck className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Delivered By</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {normalizePersonnelName(moveToPendingDialog.dc.deliveredBy) || moveToPendingDialog.dc.deliveredBy || "Standard Dispatch"}
                        </div>
                      </div>
                    </div>

                    {/* Received By */}
                    <div className="flex items-start gap-2 min-w-0">
                      <UserCheck className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Received By</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {normalizePersonnelName(moveToPendingDialog.dc.receivedBy) || moveToPendingDialog.dc.receivedBy || "Hospital Receiver"}
                        </div>
                      </div>
                    </div>

                    {/* Total Items */}
                    <div className="flex items-start gap-2 min-w-0">
                      <Package className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Total Items</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {getTotalQty(moveToPendingDialog.dc)} <span className="text-[11px] font-normal text-slate-500">({moveToPendingDialog.dc.items?.length || 0} types)</span>
                        </div>
                      </div>
                    </div>

                    {/* Instruments */}
                    <div className="flex items-start gap-2 min-w-0">
                      <Wrench className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Instruments</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {moveToPendingDialog.dc.instruments?.length || 0} Sets / Trays
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notice Box */}
              <div className="px-5 py-3">
                <div className="rounded-xl border border-amber-200/90 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 p-3.5 space-y-1">
                  <p className="text-xs text-amber-950 dark:text-amber-300 leading-relaxed font-medium">
                    This will clear the returned status and move DC #{moveToPendingDialog.dc.dcNo} back into the active pending list.
                  </p>
                </div>
              </div>

              {/* Action Footer */}
              <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <Button
                  variant="outline"
                  onClick={() => setMoveToPendingDialog({ open: false, dc: null })}
                  className="rounded-xl h-9 px-4 text-xs font-semibold border-slate-300 hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:border-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    const dc = moveToPendingDialog.dc;
                    if (!dc) return;
                    setMoveToPendingDialog({ open: false, dc: null });
                    await cancelReturnToPending(dc);
                  }}
                  className="rounded-xl h-9 px-5 text-xs font-bold gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shadow-none"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Move Back to Delivered</span>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Password Dialog */}
      <Dialog open={adminPasswordOpen} onOpenChange={setAdminPasswordOpen}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="sm:max-w-[420px] p-0 overflow-hidden border border-slate-200/90 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 gap-0"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Admin Access</DialogTitle>
            <DialogDescription>
              Please enter the administrator password.
            </DialogDescription>
          </DialogHeader>

          {/* Top Header */}
          <div className="bg-background from-indigo-50 via-blue-50/60 to-slate-50/50 px-5 py-4 border-b border-slate-200/80">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-200/80 shadow-none">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-300">
                      Security Access
                    </span>
                    <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100/80 border border-indigo-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Manager Panel
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
                    Admin Authorization
                  </h3>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-2.5 pt-2 border-t border-slate-200/60">
              Restricted management & system controls
            </p>
          </div>

          {/* Top Info Card */}
          <div className="px-5 pt-4 pb-1">
            <div className="rounded-xl border border-blue-200/90 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 p-3.5 space-y-1 text-xs text-blue-950 dark:text-blue-200">
              <div className="flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-200">
                <Lock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Protected Management Tools</span>
              </div>
              <p className="leading-relaxed text-slate-600 dark:text-slate-400">
                Enter your administrative key to manage system settings,
                registers, and audit options.
              </p>
            </div>
          </div>

          {/* Bottom Form */}
          <div className="px-5 py-3.5 space-y-3.5">
            <div>
              <Label
                htmlFor="admin-pass"
                className="text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                Manager Password *
              </Label>
              <Input
                id="admin-pass"
                type="password"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                data-form-type="other"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter password..."
                className="mt-1.5 h-10 rounded-xl border-slate-300 dark:border-slate-700 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmAdminAccess();
                }}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <Button
              variant="outline"
              onClick={() => setAdminPasswordOpen(false)}
              className="rounded-xl h-10 px-4 text-xs font-semibold border-slate-300 hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:border-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmAdminAccess}
              className="rounded-xl h-10 px-5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-none min-w-[130px]"
            >
              Enter Admin Panel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Record Payment Dialog */}
      <Dialog
        open={paymentDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setPaymentDialog({ open: false, dc: null });
            setPaymentAmountInput("");
            setPaymentRemarksInput("");
            setPaymentMethod("cash");
            setPaymentCollectedBy("");
          }
        }}
      >
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="w-[94vw] max-w-[94vw] sm:max-w-4xl lg:max-w-5xl max-h-[92vh] flex flex-col p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 gap-0"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Record Payment Collection</DialogTitle>
            <DialogDescription>
              Record payment settlement for DC {paymentDialog.dc?.dcNo}.
            </DialogDescription>
          </DialogHeader>

          {/* 1. TOP HEADER */}
          {paymentDialog.dc && (
            <div className="bg-slate-50/80 dark:bg-slate-900/80 px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-200/80 dark:border-emerald-800">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2 flex-wrap">
                    <span>Record Payment Collection</span>
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                      DC #{paymentDialog.dc.dcNo}
                    </span>
                    {paymentDialog.dc.invoiceRef && (
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        Memo #{paymentDialog.dc.invoiceRef}
                      </span>
                    )}
                  </h3>
                  {(paymentDialog.dc.doctorName || paymentDialog.dc.patientName) && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      {paymentDialog.dc.doctorName ? `Dr. ${paymentDialog.dc.doctorName}` : ""}
                      {paymentDialog.dc.doctorName && paymentDialog.dc.patientName ? ` • ` : ""}
                      {paymentDialog.dc.patientName ? `Pt: ${paymentDialog.dc.patientName}` : ""}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. BODY CONTENT (2-COLUMN RESPONSIVE LAYOUT) */}
          <div className="p-5 max-h-[78vh] overflow-y-auto space-y-4">
            {/* Dispatch Info Summary */}
            {paymentDialog.dc && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 text-xs space-y-2.5">
                {/* Hospital Header */}
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-bold">
                  <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs truncate">
                    {paymentDialog.dc.hospitalName || paymentDialog.dc.partyName || "Hospital Record"}
                  </span>
                </div>

                {/* Structured 4-Column Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2.5">
                  {/* Delivered By */}
                  <div className="flex items-start gap-2 min-w-0">
                    {getTransportMode(paymentDialog.dc.deliveredBy) ? (
                      renderTransportIcon(getTransportMode(paymentDialog.dc.deliveredBy)?.iconName, "w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5")
                    ) : (
                      <Truck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Delivered By</div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {normalizePersonnelName(paymentDialog.dc.deliveredBy) || paymentDialog.dc.deliveredBy || "Standard Dispatch"}
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-start gap-2 min-w-0">
                    <CreditCard className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Status</div>
                      <div className="font-semibold text-amber-700 dark:text-amber-300 uppercase truncate">
                        Awaiting Settlement
                      </div>
                    </div>
                  </div>

                  {/* Total Items */}
                  <div className="flex items-start gap-2 min-w-0">
                    <Package className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Total Items</div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {getTotalQty(paymentDialog.dc)} <span className="text-[11px] font-normal text-slate-500">({paymentDialog.dc.items?.length || 0} types)</span>
                      </div>
                    </div>
                  </div>

                  {/* Instruments */}
                  <div className="flex items-start gap-2 min-w-0">
                    <Wrench className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Instruments</div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {paymentDialog.dc.instruments?.length || 0} Sets / Trays
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* LEFT COLUMN: RECEIVABLE DETAILS & PAYMENT INPUTS */}
              <div
                className={`${paymentMethod === "bank_transfer" ? "lg:col-span-5" : "lg:col-span-12 max-w-xl mx-auto w-full"} space-y-4`}
              >
                {/* Financial Receivable Banner */}
                {Boolean(
                  paymentDialog.dc?.billedAmount &&
                  paymentDialog.dc.billedAmount >
                    (paymentDialog.dc.cashAmount || 0),
                ) ? (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5 text-slate-600" />
                        Hiked Bill Settlement
                      </span>
                      <span className="text-[10px] bg-amber-200/70 dark:bg-amber-900/60 px-2 py-0.5 rounded-full font-bold text-amber-900 dark:text-amber-200">
                        Margin Deducted
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-amber-200/60 dark:border-amber-900/30">
                      <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-lg border border-amber-100 dark:border-amber-900/30 text-center">
                        <span className="block text-[10px] text-slate-500 uppercase font-semibold">
                          Printed Bill
                        </span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          ₹
                          {paymentDialog.dc?.billedAmount?.toLocaleString(
                            "en-IN",
                          )}
                        </span>
                      </div>
                      <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-lg border border-amber-100 dark:border-amber-900/30 text-center">
                        <span className="block text-[10px] text-amber-700 dark:text-amber-400 uppercase font-semibold">
                          Hospital Cut
                        </span>
                        <span className="font-bold text-amber-800 dark:text-amber-300">
                          -₹
                          {(
                            paymentDialog.dc?.hospitalMargin ||
                            paymentDialog.dc!.billedAmount! -
                              (paymentDialog.dc!.cashAmount || 0)
                          ).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200 dark:border-emerald-900/30 text-center">
                        <span className="block text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold">
                          Net Due
                        </span>
                        <span className="font-black text-emerald-800 dark:text-emerald-300">
                          ₹
                          {(paymentDialog.dc?.cashAmount || 0).toLocaleString(
                            "en-IN",
                          )}
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
                        Total payment due for this DC
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                        ₹
                        {(paymentDialog.dc?.cashAmount || 0).toLocaleString(
                          "en-IN",
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {/* Collapsible History of Prior Part Payments (if any exist) */}
                {paymentDialog.dc?.partPayments &&
                  paymentDialog.dc.partPayments.length > 0 && (
                    <div className="rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30 p-3 space-y-2">
                      <button
                        type="button"
                        onClick={() =>
                          setIsRecordPartPaymentsOpen(!isRecordPartPaymentsOpen)
                        }
                        className="w-full flex items-center justify-between text-xs font-bold text-amber-950 dark:text-amber-100 hover:text-amber-800 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <Banknote className="w-4 h-4 text-slate-600 dark:text-amber-400" />
                          <span>
                            Previous Installments Collected (
                            {paymentDialog.dc.partPayments.length})
                          </span>
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-amber-800 dark:text-amber-200 bg-amber-200/70 dark:bg-amber-900/80 px-2 py-0.5 rounded-full border border-amber-300">
                          {isRecordPartPaymentsOpen
                            ? "Hide Breakdown"
                            : "View Breakdown"}
                          {isRecordPartPaymentsOpen ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </span>
                      </button>

                      {isRecordPartPaymentsOpen && (
                        <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                          {paymentDialog.dc.partPayments.map((inst, idx) => {
                            const isExp =
                              expandedInstallmentIdx === idx ||
                              expandedInstallmentIdx === -1;
                            return (
                              <div
                                key={idx}
                                className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-xs space-y-2 shadow-sm"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="space-y-0.5 min-w-0">
                                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
                                      <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950 text-[9px] px-1.5 py-0 border-amber-300 font-extrabold">
                                        #{idx + 1}
                                      </Badge>
                                      <span>
                                        Installment #{idx + 1} (
                                        {inst.paymentMethod === "bank_transfer"
                                          ? "🏦 Bank Transfer"
                                          : "💵 Cash"}
                                        )
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 flex items-center gap-2 flex-wrap">
                                      <span>{formatDate(inst.at)}</span>
                                      {inst.collectedBy && (
                                        <span>• Collected by {inst.collectedBy}</span>
                                      )}
                                      {inst.utrNo && (
                                        <span>• UTR: {inst.utrNo}</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="font-extrabold font-mono text-emerald-700 dark:text-emerald-400 text-xs">
                                      +₹{inst.amount.toLocaleString("en-IN")}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedInstallmentIdx(
                                          isExp ? null : idx,
                                        )
                                      }
                                      className="px-2 py-0.5 text-[10px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-200 rounded border border-amber-300 flex items-center gap-1 cursor-pointer"
                                      title="View Payment Information"
                                    >
                                      <span>
                                        {isExp ? "Hide Info" : "Payment Info"}
                                      </span>
                                      {isExp ? (
                                        <ChevronUp className="w-3 h-3" />
                                      ) : (
                                        <ChevronDown className="w-3 h-3" />
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeletePartPaymentInstallment(
                                          paymentDialog.dc!,
                                          idx,
                                        );
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                                      title={`Delete wrong installment #${idx + 1} (+₹${inst.amount.toLocaleString("en-IN")})`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {isExp && (
                                  <div className="p-2.5 rounded-md bg-amber-50/80 dark:bg-slate-850 border border-amber-300 dark:border-amber-900/60 text-[11px] space-y-1.5 animate-in fade-in duration-150">
                                    <div className="font-extrabold text-amber-900 dark:text-amber-300 uppercase tracking-wider text-[10px] flex items-center gap-1">
                                      <Landmark className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                                      Installment #{idx + 1} Payment Information
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-amber-200/80 dark:border-amber-900/50">
                                      <div>
                                        <span className="text-[10px] text-slate-500 font-bold uppercase block">
                                          Payment Mode
                                        </span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                          {inst.paymentMethod === "bank_transfer"
                                            ? "🏦 Bank Transfer / UPI"
                                            : "💵 Physical Cash (Hand Collected)"}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-[10px] text-slate-500 font-bold uppercase block">
                                          Settlement Date
                                        </span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                          {formatDate(inst.at)}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-[10px] text-slate-500 font-bold uppercase block">
                                          UTR / Ref #
                                        </span>
                                        {inst.utrNo ? (
                                          <div className="flex items-center gap-1">
                                            <code className="font-mono font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-[10px]">
                                              {inst.utrNo}
                                            </code>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                navigator.clipboard.writeText(
                                                  inst.utrNo || "",
                                                );
                                                toast({
                                                  title: "Copied UTR #",
                                                  description: inst.utrNo,
                                                });
                                              }}
                                              className="text-amber-700 hover:text-amber-900 cursor-pointer"
                                              title="Copy UTR"
                                            >
                                              <Copy className="w-3 h-3 text-amber-700" />
                                            </button>
                                          </div>
                                        ) : (
                                          <span className="text-slate-400">
                                            N/A
                                          </span>
                                        )}
                                      </div>
                                      {inst.collectedBy && (
                                        <div>
                                          <span className="text-[10px] text-slate-500 font-bold uppercase block">
                                            Collected By
                                          </span>
                                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                                            {inst.collectedBy}
                                          </span>
                                        </div>
                                      )}
                                      {inst.remarks && (
                                        <div className="sm:col-span-2">
                                          <span className="text-[10px] text-slate-500 font-bold uppercase block">
                                            Remarks / Notes
                                          </span>
                                          <span className="italic text-slate-700 dark:text-slate-300">
                                            "{inst.remarks}"
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
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
                      onClick={() => {
                        if (paymentMethod !== "cash") {
                          setPaymentMethod("cash");
                          setPaymentAmountInput("");
                          setPaymentRemarksInput("");
                          setPaymentCollectedBy("");
                          setPartialSettlementType("pay_more");
                          setFinalSettlementReason("discount");
                          setSettlementDoctorName("");
                          setSelectedCreditTxId("not_found");
                        }
                      }}
                      className={`flex items-center justify-center gap-2 h-10 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        paymentMethod === "cash"
                          ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 shadow-none"
                          : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                    >
                      <Banknote
                        className={`w-4 h-4 shrink-0 ${paymentMethod === "cash" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}
                      />
                      <span>Cash Payment</span>
                      {paymentMethod === "cash" && (
                        <Check className="w-3.5 h-3.5 ml-auto text-emerald-600" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (paymentMethod !== "bank_transfer") {
                          setPaymentMethod("bank_transfer");
                          setPaymentAmountInput("");
                          setPaymentRemarksInput("");
                          setPaymentCollectedBy("");
                          setPartialSettlementType("pay_more");
                          setFinalSettlementReason("discount");
                          setSettlementDoctorName("");
                        }
                      }}
                      className={`flex items-center justify-center gap-2 h-10 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        paymentMethod === "bank_transfer"
                          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20 shadow-none"
                          : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                    >
                      <Landmark
                        className={`w-4 h-4 shrink-0 ${paymentMethod === "bank_transfer" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`}
                      />
                      <span>Bank / UPI</span>
                      {paymentMethod === "bank_transfer" && (
                        <Check className="w-3.5 h-3.5 ml-auto text-indigo-600" />
                      )}
                    </button>
                  </div>
                </div>

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
                      <span className="text-[11px] font-medium text-slate-400 mr-0.5">
                        Quick:
                      </span>
                      <button
                        type="button"
                        onClick={() => setPaymentCollectedBy("Self")}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          paymentCollectedBy.trim().toLowerCase() === "self"
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-none"
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
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-none"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                        }`}
                      >
                        Office
                      </button>
                      {paymentDialog.dc?.deliveredBy &&
                        !isDisallowedPersonnel(
                          paymentDialog.dc.deliveredBy,
                        ) && (
                          <button
                            type="button"
                            onClick={() =>
                              setPaymentCollectedBy(
                                paymentDialog.dc?.deliveredBy || "",
                              )
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                              paymentCollectedBy.trim().toLowerCase() ===
                              (
                                paymentDialog.dc?.deliveredBy || ""
                              ).toLowerCase()
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-none"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-emerald-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                            }`}
                          >
                            <UserCheck className="w-3 h-3 text-blue-600" />
                            <span>
                              Delivery: {paymentDialog.dc.deliveredBy}
                            </span>
                          </button>
                        )}
                      {topReturnPersons.slice(0, 4).map((p) => {
                        const isSelected =
                          paymentCollectedBy.trim().toLowerCase() ===
                          p.name.toLowerCase();
                        return (
                          <button
                            key={p.name}
                            type="button"
                            onClick={() => setPaymentCollectedBy(p.name)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                              isSelected
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-none"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                            }`}
                          >
                            <User
                              className={`w-3 h-3 ${isSelected ? "text-white" : "text-emerald-600"}`}
                            />
                            <span>{p.name}</span>
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
                      <Label
                        htmlFor="payment-amount"
                        className="text-xs font-bold text-slate-700 dark:text-slate-300"
                      >
                        Amount Received *
                      </Label>
                      {paymentDialog.dc?.cashAmount && (
                        <button
                          type="button"
                          onClick={() =>
                            setPaymentAmountInput(
                              String(paymentDialog.dc?.cashAmount || ""),
                            )
                          }
                          className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline font-bold cursor-pointer"
                        >
                          Full Due (₹
                          {paymentDialog.dc.cashAmount.toLocaleString("en-IN")})
                        </button>
                      )}
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
                        placeholder={
                          paymentDialog.dc?.cashAmount
                            ? String(paymentDialog.dc.cashAmount)
                            : "0"
                        }
                        className="pl-7 h-10 font-bold text-sm bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Payment Remarks */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="payment-remarks"
                      className="text-xs font-bold text-slate-700 dark:text-slate-300"
                    >
                      Notes / Ref{" "}
                      <span className="font-normal text-slate-400">
                        (Optional)
                      </span>
                    </Label>
                    <Input
                      id="payment-remarks"
                      type="text"
                      value={paymentRemarksInput}
                      onChange={(e) => setPaymentRemarksInput(e.target.value)}
                      placeholder={
                        paymentMethod === "cash"
                          ? "e.g. Received at hospital billing"
                          : "e.g. UTR / NEFT Ref"
                      }
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
                      Mandatory Bank Credit Link & Match *
                    </Label>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200"
                    >
                      {availableBankCredits.length} Statement Credits
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Select matching credit deposit from bank statement or select
                    "Not Found" to link later:
                  </p>

                  {/* Executive Account Card Selector Tabs ("Go with something else") */}
                  <div className="space-y-1 my-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Select Account Statement:
                    </span>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                      {/* 1. BANK ACCOUNTS TABS (1538 ALWAYS FIRST ON THE LEFT!) */}
                      {sortedBankAccounts.map((acc) => {
                        const isSelected = selectedBankAccountId === acc.id;
                        const count = availableBankCredits.filter(
                          (t) => t.accountId === acc.id,
                        ).length;
                        const accSuffix = acc.accountNumber
                          ? acc.accountNumber.slice(-4)
                          : acc.accountName.match(/\d{4}/)?.[0] || "";
                        const is1538 =
                          accSuffix === "1538" || acc.id.includes("1538");

                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => setSelectedBankAccountId(acc.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer border ${
                              isSelected
                                ? is1538
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-none ring-2 ring-emerald-500/20"
                                  : "bg-indigo-600 text-white border-indigo-600 shadow-none ring-2 ring-indigo-500/20"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700"
                            }`}
                          >
                            <Building2 className="w-3.5 h-3.5" />
                            <span>
                              {acc.bankName ||
                                acc.accountName.split("(")[0].trim()}
                            </span>
                            {accSuffix && (
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                                  isSelected
                                    ? "bg-black/20 text-white"
                                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                }`}
                              >
                                ({accSuffix})
                              </span>
                            )}
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                                isSelected
                                  ? "bg-black/20 text-white"
                                  : "bg-indigo-50 text-indigo-700 dark:bg-slate-800 dark:text-slate-200"
                              }`}
                            >
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
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-none ring-2 ring-indigo-500/20"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700"
                        }`}
                      >
                        <Landmark className="w-3.5 h-3.5" />
                        <span>All Accounts</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                            selectedBankAccountId === "all"
                              ? "bg-indigo-700 text-white"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          }`}
                        >
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
                        const dcAmount =
                          paymentDialog.dc?.cashAmount ||
                          paymentDialog.dc?.billedAmount ||
                          0;
                        const isAmountMatch =
                          Math.abs(tx.amount - dcAmount) < 10;
                        const dcHosp = (paymentDialog.dc?.hospitalName || "")
                          .toLowerCase()
                          .trim();
                        const desc = (tx.description || "").toLowerCase();
                        const isHospMatch = dcHosp && desc.includes(dcHosp);
                        const isMatch = isAmountMatch || isHospMatch;

                        return (
                          <div
                            key={tx.id}
                            onClick={() => {
                              setSelectedCreditTxId(tx.id);
                              if (tx.amount)
                                setPaymentAmountInput(String(tx.amount));
                            }}
                            className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                              isSelected
                                ? "border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 ring-2 ring-indigo-500/20 shadow-none"
                                : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-850"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}
                                >
                                  {isSelected && (
                                    <Check className="w-3 h-3 stroke-[3]" />
                                  )}
                                </div>
                                <div>
                                  <span className="font-bold text-slate-800 dark:text-slate-100 block">
                                    {tx.description || "Bank Credit Deposit"}
                                  </span>
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono mt-0.5">
                                    {tx.date} {tx.time ? `• ${tx.time}` : ""}{" "}
                                    {tx.referenceNumber
                                      ? `• Ref: ${tx.referenceNumber}`
                                      : ""}
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
                                    className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-teal-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
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
                            ? "border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 ring-2 ring-amber-500/20 shadow-none"
                            : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-850"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${selectedCreditTxId === "not_found" ? "border-amber-600 bg-amber-600 text-white" : "border-slate-300"}`}
                            >
                              {selectedCreditTxId === "not_found" && (
                                <Check className="w-3 h-3 stroke-[3]" />
                              )}
                            </div>
                            <div>
                              <span className="font-bold text-amber-900 dark:text-amber-300 block flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 text-slate-600 dark:text-amber-400 shrink-0" />
                                Not Found in Bank Statement Yet (Link Later)
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                                Statement update pending. You can link this
                                later from Bank Treasury.
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

          {/* FIXED BOTTOM FOOTER & LIVE CONFIRMATION BANNER */}
          <div className="shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 py-3 space-y-2.5 z-30 shadow-none">
            {/* Live Part Payment Banner */}
            {(() => {
              const prevPaid = paymentDialog.dc?.paidAmount || 0;
              const origAmt =
                paymentDialog.dc?.originalInvoiceTotal ||
                paymentDialog.dc?.cashAmount ||
                (paymentDialog.dc?.billedAmount
                  ? paymentDialog.dc.billedAmount -
                    (paymentDialog.dc.hospitalMargin || 0)
                  : 0) ||
                0;
              const remainingBalance = Math.max(0, origAmt - prevPaid);
              const currentInstallment = parseFloat(paymentAmountInput) || 0;
              const totalCollectedAfter = prevPaid + currentInstallment;
              const remainingDueAfter = Math.max(
                0,
                origAmt - totalCollectedAfter,
              );
              // Show part payment options ONLY if entered amount is less than remaining balance
              const isPart =
                origAmt > 0 &&
                currentInstallment > 0 &&
                currentInstallment < remainingBalance;

              if (isPart) {
                return (
                  <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-3 py-2 bg-amber-100/80 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-800">
                      <span className="flex items-center gap-1.5 text-amber-900 dark:text-amber-100 text-xs font-bold">
                        <AlertCircle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        Part Payment — ₹
                        {remainingDueAfter.toLocaleString("en-IN")} still
                        outstanding
                      </span>
                      <Badge className="bg-amber-500 text-white text-[9px] font-extrabold px-1.5 py-0 uppercase tracking-wide">
                        Action Required
                      </Badge>
                    </div>

                    {/* Compact Metrics Strip */}
                    <div className="grid grid-cols-4 divide-x divide-amber-200 dark:divide-amber-800 text-center text-[10px]">
                      <div className="py-1.5 px-2">
                        <div className="text-slate-500 font-medium uppercase tracking-wide text-[9px]">
                          Invoice
                        </div>
                        <div className="font-extrabold text-slate-800 dark:text-slate-100 font-mono text-xs">
                          ₹{origAmt.toLocaleString("en-IN")}
                        </div>
                      </div>
                      <div className="py-1.5 px-2 bg-blue-50/60 dark:bg-blue-950/30">
                        <div className="text-blue-600 font-medium uppercase tracking-wide text-[9px]">
                          Prev. Paid
                        </div>
                        <div className="font-extrabold text-blue-700 dark:text-blue-400 font-mono text-xs">
                          ₹{prevPaid.toLocaleString("en-IN")}
                        </div>
                      </div>
                      <div className="py-1.5 px-2 bg-emerald-50/60 dark:bg-emerald-950/30">
                        <div className="text-emerald-700 font-medium uppercase tracking-wide text-[9px]">
                          Now
                        </div>
                        <div className="font-extrabold text-emerald-700 dark:text-emerald-400 font-mono text-xs">
                          ₹{currentInstallment.toLocaleString("en-IN")}
                        </div>
                      </div>
                      <div className="py-1.5 px-2 bg-rose-50/60 dark:bg-rose-950/30">
                        <div className="text-rose-600 font-medium uppercase tracking-wide text-[9px]">
                          Remaining
                        </div>
                        <div className="font-extrabold text-rose-700 dark:text-rose-400 font-mono text-xs">
                          ₹{remainingDueAfter.toLocaleString("en-IN")}
                        </div>
                      </div>
                    </div>

                    {/* Settlement Action */}
                    <div className="px-3 py-2.5 space-y-2">
                      <p className="text-[10.5px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                        How should we record this?
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {/* Option 1: Keep in Cash Queue */}
                        <button
                          type="button"
                          onClick={() => setPartialSettlementType("pay_more")}
                          className={`text-left p-2.5 rounded-lg border-2 transition-all ${
                            partialSettlementType === "pay_more"
                              ? "border-amber-500 bg-amber-50 dark:bg-amber-950/50 ring-1 ring-amber-400/30"
                              : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-amber-300"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <div
                              className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${partialSettlementType === "pay_more" ? "border-amber-500 bg-amber-500" : "border-slate-300"}`}
                            >
                              {partialSettlementType === "pay_more" && (
                                <Check className="w-2 h-2 text-white stroke-[4]" />
                              )}
                            </div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                              Keep in Cash Queue
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug pl-5">
                            Mark as <strong>Part Paid</strong>. Patient owes ₹
                            {remainingDueAfter.toLocaleString("en-IN")} more.
                          </p>
                        </button>

                        {/* Option 2: Final Settlement */}
                        <button
                          type="button"
                          onClick={() =>
                            setPartialSettlementType("final_settlement")
                          }
                          className={`text-left p-2.5 rounded-lg border-2 transition-all ${
                            partialSettlementType === "final_settlement"
                              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 ring-1 ring-emerald-400/30"
                              : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-emerald-300"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <div
                              className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${partialSettlementType === "final_settlement" ? "border-emerald-500 bg-emerald-500" : "border-slate-300"}`}
                            >
                              {partialSettlementType === "final_settlement" && (
                                <Check className="w-2 h-2 text-white stroke-[4]" />
                              )}
                            </div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                              Final Settlement
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug pl-5">
                            Accept ₹
                            {totalCollectedAfter.toLocaleString("en-IN")} as
                            full & final. Move to <strong>Completed</strong>.
                          </p>
                        </button>
                      </div>

                      {/* Reason sub-form — only for Final Settlement */}
                      {partialSettlementType === "final_settlement" && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                          <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                            Reason for shortfall
                          </p>
                          <div className="flex gap-1.5">
                            {(
                              [
                                "discount",
                                "doctor_commission",
                                "hospital_commission",
                              ] as const
                            ).map((r) => {
                              const labels: Record<string, string> = {
                                discount: "Discount",
                                doctor_commission: "Dr. Commission",
                                hospital_commission: "Hospital Cut",
                              };
                              return (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => setFinalSettlementReason(r)}
                                  className={`flex-1 py-1 px-2 rounded text-[10px] font-bold border transition-colors ${
                                    finalSettlementReason === r
                                      ? "bg-emerald-600 text-white border-emerald-600"
                                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  {labels[r]}
                                </button>
                              );
                            })}
                          </div>
                          {finalSettlementReason === "doctor_commission" && (
                            <div className="flex items-center gap-2">
                              <Input
                                type="text"
                                value={settlementDoctorName}
                                onChange={(e) =>
                                  setSettlementDoctorName(e.target.value)
                                }
                                placeholder={
                                  paymentDialog.dc?.doctorName
                                    ? `Dr. ${paymentDialog.dc.doctorName}`
                                    : "Doctor name (or N/A)"
                                }
                                className="h-7 text-xs flex-1 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded"
                              />
                              <span className="text-[9px] text-slate-400 shrink-0">
                                Leave blank = N/A
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* 3. FOOTER ACTION BAR */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
              <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                {paymentMethod === "bank_transfer" ? (
                  <span>
                    Select bank deposit credit or choose "Not Found" to link
                    later
                  </span>
                ) : (
                  <span>Collect physical cash payment into treasury</span>
                )}
              </div>

              <div className="flex items-center gap-3 ml-auto w-full sm:w-auto justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPaymentDialog({ open: false, dc: null });
                    setPaymentAmountInput("");
                    setPaymentRemarksInput("");
                    setPaymentMethod("cash");
                    setPaymentCollectedBy("");
                  }}
                  className="rounded-xl h-11 px-5 text-sm font-semibold border-slate-300 hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:border-slate-700 cursor-pointer"
                  disabled={isActionLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleQuickRecordPayment}
                  className="rounded-xl h-11 px-6 text-sm font-extrabold gap-2 shadow-none min-w-[200px] cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white"
                  disabled={isActionLoading}
                >
                  {isActionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                      <span>Confirm Payment Collection</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CONFIRMATION DIALOG: DELINK PAYMENT & RESET STATUS */}
      <Dialog
        open={delinkConfirmDialog.open}
        onOpenChange={(open) => {
          if (!open && !isActionLoading) {
            setDelinkConfirmDialog({ open: false, dc: null });
          }
        }}
      >
        <DialogContent className="w-[94vw] max-w-[94vw] sm:max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 gap-0">
          <DialogHeader className="p-5 bg-amber-50/70 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-900/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 border border-amber-300 dark:border-amber-700 flex items-center justify-center text-amber-800 dark:text-amber-200 shrink-0 shadow-none">
                <AlertCircle className="w-5 h-5 text-slate-600 dark:text-amber-400" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-amber-950 dark:text-amber-100">
                  Delink Payment &amp; Reset Status
                </DialogTitle>
                <DialogDescription className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                  Confirm delinking payment details for DC #
                  {delinkConfirmDialog.dc?.dcNo}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 space-y-4 text-xs">
            {/* DC Details Summary Box */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                  DC #{delinkConfirmDialog.dc?.dcNo}
                </span>
                <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-200">
                  Paid ₹
                  {(delinkConfirmDialog.dc?.cashAmount || 0).toLocaleString(
                    "en-IN",
                  )}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2 flex-wrap">
                <span className="font-semibold">
                  {delinkConfirmDialog.dc?.hospitalName}
                </span>
                {delinkConfirmDialog.dc?.utrNo && (
                  <span className="font-mono bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                    Ref: {delinkConfirmDialog.dc.utrNo}
                  </span>
                )}
              </div>
            </div>

            {/* Impact Explanation List */}
            <div className="space-y-2">
              <span className="font-bold text-slate-900 dark:text-slate-100 block">
                What will happen when you confirm:
              </span>
              <ul className="space-y-2 text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-slate-600 font-bold shrink-0">1.</span>
                  <span>
                    <strong>Payment metadata cleared:</strong> Paid timestamp,
                    payment method, collector name, and payment remarks will be
                    deleted.
                  </span>
                </li>
                {delinkConfirmDialog.dc?.utrNo && (
                  <li className="flex items-start gap-2">
                    <span className="text-slate-600 font-bold shrink-0">
                      2.
                    </span>
                    <span>
                      <strong>Bank credit unlinked:</strong> Bank transaction
                      matching UTR{" "}
                      <code className="font-mono bg-amber-100 dark:bg-amber-950 px-1 rounded">
                        {delinkConfirmDialog.dc.utrNo}
                      </code>{" "}
                      will be unlinked and returned to available treasury
                      credits.
                    </span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="text-slate-600 font-bold shrink-0">
                    {delinkConfirmDialog.dc?.utrNo ? "3." : "2."}
                  </span>
                  <span>
                    <strong>Status moved:</strong> Choose destination below:
                    move to <strong>Cash Queue</strong> (to re-record payment)
                    OR <strong>Returned Queue</strong> (to reset billing path).
                  </span>
                </li>
              </ul>
            </div>

            {/* Destination Selection Buttons */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Select Destination Queue:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  type="button"
                  onClick={() =>
                    delinkConfirmDialog.dc &&
                    executeDelinkPayment(delinkConfirmDialog.dc, "cash")
                  }
                  disabled={isActionLoading}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-11 text-xs font-bold flex items-center justify-center gap-1.5 shadow-none cursor-pointer"
                >
                  {isActionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Wallet className="w-4 h-4" />
                      <span>Move to Cash Queue</span>
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  onClick={() =>
                    delinkConfirmDialog.dc &&
                    executeDelinkPayment(delinkConfirmDialog.dc, "returned")
                  }
                  disabled={isActionLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 text-xs font-bold flex items-center justify-center gap-1.5 shadow-none cursor-pointer"
                >
                  {isActionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Undo2 className="w-4 h-4" />
                      <span>Move to Returned Queue</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <Button
              variant="outline"
              onClick={() => setDelinkConfirmDialog({ open: false, dc: null })}
              disabled={isActionLoading}
              className="rounded-xl h-9 px-4 text-xs font-semibold"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: EMAIL CONTENT */}
      <Dialog
        open={Boolean(viewingTxDetails)}
        onOpenChange={(open) => !open && setViewingTxDetails(null)}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto p-5">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Email Content</span>
              </DialogTitle>
              {viewingTxDetails && (
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  +₹{viewingTxDetails.amount?.toLocaleString("en-IN")}
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
                      .replace(/<https?:\/\/[^>]+>/gi, "")
                      .replace(/\n{3,}/g, "\n\n")
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

      {/* View Hospital Contacts Modal */}
      <Dialog
        open={viewContactModalOpen}
        onOpenChange={setViewContactModalOpen}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl bg-white shadow-2xl border-0">
          <div className="bg-background from-teal-800 via-teal-900 to-slate-900 text-white p-5 rounded-t-2xl relative">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center shrink-0 text-teal-300">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight line-clamp-1">
                    {selectedHospitalForContact?.hospitalName ||
                      "Hospital Contacts"}
                  </h3>
                  {selectedHospitalForContact?.customer?.address ? (
                    <p className="text-xs text-teal-200/80 flex items-center gap-1 mt-0.5 line-clamp-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span>{selectedHospitalForContact.customer.address}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-teal-200/70 mt-0.5">
                      Direct hospital lines & operational contacts
                    </p>
                  )}
                </div>
              </div>
            </div>

            {selectedHospitalForContact?.dc && (
              <div className="mt-3 pt-3 border-t border-teal-700/50 flex flex-wrap items-center gap-3 text-xs text-teal-100/90">
                <span className="font-semibold text-white">
                  DC: #{selectedHospitalForContact.dc.dcNo}
                </span>
                {selectedHospitalForContact.dc.doctorName && (
                  <span className="flex items-center gap-1">
                    <Stethoscope className="w-3 h-3 text-teal-300" />
                    Dr: {selectedHospitalForContact.dc.doctorName}
                  </span>
                )}
                {selectedHospitalForContact.dc.patientName && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-teal-300" />
                    Pt: {selectedHospitalForContact.dc.patientName}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="p-5 space-y-4">
            {(() => {
              const cust = selectedHospitalForContact?.customer;
              const allContacts: HospitalContact[] = [];

              if (cust?.contacts && Array.isArray(cust.contacts)) {
                cust.contacts.forEach((c) => {
                  if (c && (c.phone?.trim() || c.name?.trim())) {
                    allContacts.push(c);
                  }
                });
              }

              // Fallbacks from legacy/direct fields if not already in contacts
              if (
                cust?.otNumber &&
                !allContacts.some((c) => c.phone === cust.otNumber)
              ) {
                allContacts.unshift({
                  id: "ot",
                  role: "OT Person",
                  name: "OT Desk / Incharge",
                  phone: cust.otNumber,
                });
              }
              if (
                cust?.hospitalNumber &&
                !allContacts.some((c) => c.phone === cust.hospitalNumber)
              ) {
                allContacts.push({
                  id: "hosp",
                  role: "Reception",
                  name: "Hospital Reception",
                  phone: cust.hospitalNumber,
                });
              }
              if (
                (cust?.personalNumber || cust?.mobile) &&
                !allContacts.some(
                  (c) => c.phone === (cust.personalNumber || cust.mobile),
                )
              ) {
                allContacts.push({
                  id: "doc",
                  role: "Doctor",
                  name: cust.contactPerson || "Doctor",
                  phone: cust.personalNumber || cust.mobile || "",
                });
              }

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <PhoneCall className="w-3.5 h-3.5 text-blue-600" />
                      Hospital Contacts{" "}
                      {allContacts.length > 0
                        ? `(${allContacts.length})`
                        : "(None)"}
                    </span>
                    {!isAddingContact && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsAddingContact(true)}
                        className="h-6 px-2 text-[11px] font-bold text-teal-700 hover:text-teal-800 hover:bg-teal-50 gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Number</span>
                      </Button>
                    )}
                  </div>

                  {/* List of existing contacts */}
                  {allContacts.length > 0 && (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {allContacts.map((contact, idx) => {
                        const roleColors: Record<
                          string,
                          { badge: string; border: string; bg: string }
                        > = {
                          "OT Person": {
                            badge:
                              "bg-emerald-100 text-emerald-800 border-emerald-200",
                            border: "border-emerald-200",
                            bg: "bg-emerald-50/40",
                          },
                          Accounts: {
                            badge:
                              "bg-amber-100 text-amber-800 border-amber-200",
                            border: "border-amber-200",
                            bg: "bg-amber-50/40",
                          },
                          Reception: {
                            badge: "bg-sky-100 text-sky-800 border-sky-200",
                            border: "border-sky-200",
                            bg: "bg-sky-50/40",
                          },
                          Doctor: {
                            badge:
                              "bg-purple-100 text-purple-800 border-purple-200",
                            border: "border-purple-200",
                            bg: "bg-purple-50/40",
                          },
                          Others: {
                            badge:
                              "bg-slate-100 text-slate-800 border-slate-200",
                            border: "border-slate-200",
                            bg: "bg-slate-50/40",
                          },
                        };
                        const style =
                          roleColors[contact.role] || roleColors["Others"];

                        return (
                          <div
                            key={contact.id || idx}
                            className={`p-3 rounded-xl border ${style.border} ${style.bg} hover:shadow-none transition-all flex items-center justify-between gap-2`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${style.badge}`}
                                >
                                  {contact.role}
                                </span>
                                <span className="text-xs font-bold text-slate-900 truncate">
                                  {contact.name || contact.role}
                                </span>
                              </div>
                              <div className="text-sm font-bold text-slate-900 font-mono mt-1">
                                {contact.phone || (
                                  <span className="text-xs font-normal text-slate-400 italic">
                                    No number
                                  </span>
                                )}
                              </div>
                            </div>

                            {contact.phone && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <a
                                  href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
                                  className="h-8 px-2.5 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-lg inline-flex items-center gap-1 shadow-none transition-colors"
                                  title={`Call ${contact.name || contact.role}`}
                                >
                                  <Phone className="w-3 h-3" />
                                  <span>Call</span>
                                </a>
                                <a
                                  href={`https://wa.me/${contact.phone.replace(/\D/g, "").length === 10 ? "91" + contact.phone.replace(/\D/g, "") : contact.phone.replace(/\D/g, "")}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="h-8 w-8 text-emerald-700 hover:text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg inline-flex items-center justify-center transition-colors"
                                  title={`WhatsApp ${contact.name || contact.role}`}
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleCopyPhone(contact.phone)}
                                  className="h-8 w-8 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg inline-flex items-center justify-center transition-colors"
                                  title="Copy Number"
                                >
                                  {copiedPhone === contact.phone ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Inline Add Contact Form (visible when blank or when user clicks Add Number) */}
                  {isAddingContact && (
                    <div className="p-4 rounded-xl border-2 border-teal-500/70 bg-teal-50/60 dark:bg-teal-950/40 shadow-none space-y-3 mt-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-teal-600 text-white flex items-center justify-center shrink-0">
                            <Plus className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-teal-950 dark:text-teal-100">
                              {allContacts.length === 0
                                ? "Add Hospital Contact Number"
                                : "Add Another Contact Number"}
                            </h4>
                            <p className="text-[10px] text-muted-foreground">
                              {allContacts.length === 0
                                ? "No number saved yet for this hospital. Enter below to save directly:"
                                : "Add an additional direct department line or surgeon number"}
                            </p>
                          </div>
                        </div>
                        {allContacts.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setIsAddingContact(false)}
                            className="text-slate-400 hover:text-slate-600 text-xs font-semibold px-1 py-0.5"
                          >
                            Cancel
                          </button>
                        )}
                      </div>

                      {/* 1. One-click role buttons */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          Select Department / Role:
                        </span>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {[
                            {
                              role: "OT Person",
                              label: "OT Person",
                              icon: "🩺",
                            },
                            { role: "Doctor", label: "Doctor", icon: "👨‍⚕️" },
                            {
                              role: "Reception",
                              label: "Reception",
                              icon: "🏥",
                            },
                            { role: "Accounts", label: "Accounts", icon: "💳" },
                            { role: "Others", label: "Others", icon: "📋" },
                          ].map((item) => {
                            const isSelected = newContactRole === item.role;
                            return (
                              <button
                                key={item.role}
                                type="button"
                                onClick={() => setNewContactRole(item.role)}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 ${
                                  isSelected
                                    ? "bg-teal-700 text-white border-teal-700 shadow-none"
                                    : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                              >
                                <span>{item.icon}</span>
                                <span>{item.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. Direct inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                            <span>
                              Phone Number{" "}
                              <span className="text-red-500">*</span>
                            </span>
                            <span className="text-[10px] text-muted-foreground font-normal">
                              Mobile / Landline
                            </span>
                          </label>
                          <Input
                            type="tel"
                            placeholder="e.g. 9848011223 or 040-23607777"
                            value={newContactPhone}
                            onChange={(e) => setNewContactPhone(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSaveInlineContact();
                              }
                            }}
                            className="h-9 text-xs font-bold bg-white dark:bg-slate-900 border-teal-300 dark:border-teal-700 focus-visible:ring-teal-600"
                            autoFocus
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                            <span>Contact Person Name</span>
                            <span className="text-[10px] text-muted-foreground font-normal">
                              Optional
                            </span>
                          </label>
                          <Input
                            placeholder="e.g. Sister Sujatha / Dr. Rao"
                            value={newContactName}
                            onChange={(e) => setNewContactName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSaveInlineContact();
                              }
                            }}
                            className="h-9 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          disabled={
                            isSavingContact ||
                            (!newContactPhone.trim() && !newContactName.trim())
                          }
                          onClick={handleSaveInlineContact}
                          className="h-9 px-5 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white gap-1.5 shadow-none"
                        >
                          {isSavingContact ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>Save Number</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Footer action bar */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setViewContactModalOpen(false);
                  navigate("/customers");
                }}
                className="text-xs font-semibold text-teal-800 border-teal-200 hover:bg-teal-50 gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Customer Directory</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setViewContactModalOpen(false)}
                className="text-xs font-semibold border-slate-300 hover:bg-slate-100 text-slate-700 px-4"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit DC Details Modal */}
      <Dialog open={editDcModalOpen} onOpenChange={setEditDcModalOpen}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="w-[94vw] max-w-[94vw] sm:max-w-[540px] max-h-[90vh] flex flex-col p-0 border border-slate-200/90 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 gap-0 overflow-hidden"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Edit DC Details</DialogTitle>
            <DialogDescription>
              Update hospital, doctor, DC number, date, or personnel.
            </DialogDescription>
          </DialogHeader>

          {/* Clean Light Header */}
          <div className="bg-background from-teal-50 via-emerald-50/60 to-slate-50/50 dark:from-slate-850 dark:via-teal-950/30 dark:to-slate-900 border-b border-teal-100 dark:border-slate-800 px-5 py-4 rounded-t-2xl">
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 border border-teal-200/80 shadow-none">
                <Edit className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-300 border border-teal-200">
                    DC #{editingDcTarget?.dcNo}
                  </span>
                  <span className="text-[10px] font-bold text-teal-800 dark:text-teal-300 bg-teal-100/90 dark:bg-teal-950/80 border border-teal-200/90 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Registry Editor
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-snug">
                  Edit Delivery Challan Details
                </h3>
                <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400 mt-1 flex-wrap">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {editingDcTarget?.hospitalName || "Hospital"}
                  </span>
                  {editingDcTarget?.doctorName && (
                    <span className="flex items-center gap-1">
                      <Stethoscope className="w-3.5 h-3.5 text-blue-600 dark:text-teal-400 shrink-0" />
                      Dr. {editingDcTarget.doctorName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Top Info Card */}
          <div className="px-5 pt-4 pb-1">
            <div className="rounded-xl border border-teal-200/80 dark:border-teal-900/40 bg-teal-50/60 dark:bg-teal-950/20 p-3 space-y-1 text-xs text-teal-950 dark:text-teal-200">
              <div className="flex items-center gap-1.5 font-bold text-teal-900 dark:text-teal-200">
                <Edit className="w-3.5 h-3.5 text-blue-600" />
                <span>Active Register Update</span>
              </div>
              <p className="leading-relaxed text-slate-600 dark:text-slate-400">
                Changes will sync across local storage and cloud records.
              </p>
            </div>
          </div>

          {/* Form Body */}
          <div className="px-5 py-3.5 space-y-3 max-h-[60vh] overflow-y-auto">
            <div>
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Hospital / Customer Name{" "}
                <span className="text-rose-500">*</span>
              </Label>
              <div className="mt-1.5">
                <HospitalSelect
                  value={editHospitalName}
                  onChange={setEditHospitalName}
                  placeholder="Select or enter hospital name..."
                  autoFocus={false}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Doctor Name
                </Label>
                <div className="mt-1.5">
                  <DoctorSelect
                    value={editDoctorName}
                    onChange={setEditDoctorName}
                    hospitalName={editHospitalName}
                    placeholder="Doctor Name"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  DC Number <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={editDcNo}
                  onChange={(e) => setEditDcNo(e.target.value)}
                  placeholder="DC Number"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  aria-autocomplete="none"
                  className="mt-1.5 h-10 rounded-xl border-slate-300 dark:border-slate-700 text-xs font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  DC Date
                </Label>
                <Input
                  type="date"
                  value={editDcDate}
                  onChange={(e) => setEditDcDate(e.target.value)}
                  className="mt-1.5 h-10 rounded-xl border-slate-300 dark:border-slate-700 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Material Type
                </Label>
                <select
                  value={editMaterialType}
                  onChange={(e) => setEditMaterialType(e.target.value)}
                  className="mt-1.5 w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="SS">SS (Stainless Steel)</option>
                  <option value="TITANIUM">TITANIUM</option>
                  <option value="Mixed">Mixed</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Delivered By
                </Label>
                <div className="mt-1.5">
                  <PersonnelSelect
                    role="delivery"
                    value={editDeliveredBy}
                    onChange={setEditDeliveredBy}
                    placeholder="Delivery person"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Received By
                </Label>
                <Input
                  value={editReceivedBy}
                  onChange={(e) => setEditReceivedBy(e.target.value)}
                  placeholder="Receiver name / phone"
                  className="mt-1.5 h-10 rounded-xl border-slate-300 dark:border-slate-700 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Remarks / Notes
              </Label>
              <Textarea
                value={editRemarks}
                onChange={(e) => setEditRemarks(e.target.value)}
                placeholder="Optional notes or instructions..."
                className="mt-1.5 text-xs rounded-xl border-slate-300 dark:border-slate-700 min-h-[60px]"
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditDcModalOpen(false)}
              className="rounded-xl h-10 px-4 text-xs font-semibold border-slate-300 hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:border-slate-700"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSavingDcEdit}
              onClick={handleSaveDcEdit}
              className="rounded-xl h-10 px-5 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-none gap-2 min-w-[130px]"
            >
              {isSavingDcEdit ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Queue & Action Animated Progress Dialog */}
      <Dialog
        open={queueTransitionState.open}
        onOpenChange={() => {
          /* prevent closing manually while transition progress is active */
        }}
      >
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="w-[90vw] max-w-[90vw] sm:max-w-[420px] max-h-[90vh] p-0 overflow-hidden border border-slate-200/90 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 gap-0"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{queueTransitionState.title || "Processing..."}</DialogTitle>
            <DialogDescription>
              {queueTransitionState.message}
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 text-center space-y-4">
            {/* Animated Icon Tile */}
            <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
              {queueTransitionState.progress === 100 ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-bounce" />
              ) : queueTransitionState.iconType === "delete" ? (
                <Trash2 className="w-7 h-7 text-rose-600 dark:text-rose-400 animate-pulse" />
              ) : queueTransitionState.iconType === "save" ? (
                <Check className="w-7 h-7 text-emerald-600 dark:text-emerald-400 animate-pulse" />
              ) : queueTransitionState.iconType === "return" ? (
                <RotateCcw className="w-7 h-7 text-teal-600 dark:text-teal-400 animate-spin" />
              ) : queueTransitionState.iconType === "invoice" ? (
                <FileText className="w-7 h-7 text-purple-600 dark:text-purple-400 animate-pulse" />
              ) : queueTransitionState.iconType === "cash" ? (
                <Wallet className="w-7 h-7 text-amber-600 dark:text-amber-400 animate-pulse" />
              ) : queueTransitionState.iconType === "cancel" ? (
                <AlertCircle className="w-7 h-7 text-orange-600 dark:text-orange-400 animate-pulse" />
              ) : (
                <RefreshCw className="w-7 h-7 text-teal-600 dark:text-teal-400 animate-spin" />
              )}
            </div>

            {/* Title & DC Badge */}
            <div className="space-y-1.5">
              {queueTransitionState.dcNo && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className="font-mono font-bold text-teal-700 dark:text-teal-300">
                    DC #{queueTransitionState.dcNo}
                  </span>
                  {queueTransitionState.targetQueueName && (
                    <>
                      <span>→</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {queueTransitionState.targetQueueName}
                      </span>
                    </>
                  )}
                </div>
              )}
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight pt-1">
                {queueTransitionState.progress === 100
                  ? "Action Completed!"
                  : queueTransitionState.title || "Processing..."}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed px-2">
                {queueTransitionState.message}
              </p>
            </div>

            {/* Smooth Progress Bar */}
            <div className="pt-2 px-2">
              <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    queueTransitionState.progress === 100
                      ? "bg-emerald-500"
                      : "bg-gradient-to-r from-teal-500 via-indigo-500 to-amber-500"
                  }`}
                  style={{ width: `${queueTransitionState.progress || 20}%` }}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SavedDcs;
