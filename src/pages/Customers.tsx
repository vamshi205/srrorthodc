import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { TopToolbar } from "@/components/ortho/TopToolbar";
import { auth } from "@/firebase";
import { useProcedures } from "@/hooks/useProcedures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Building2,
  Phone,
  User,
  Plus,
  Search,
  Edit2,
  Trash2,
  Sparkles,
  ExternalLink,
  MessageSquare,
  FileText,
  Receipt,
  MapPin,
  Clock,
  CheckCircle2,
  Check,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  LayoutList,
  LayoutGrid,
  PhoneCall,
  ChevronRight,
  Hash,
  GitMerge,
  ArrowRight,
  ArrowLeftRight,
  AlertTriangle,
  Stethoscope,
  Smartphone,
  UserCheck,
  Lock,
  BookOpen,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { CustomerCashLedgerModal } from "@/components/customers/CustomerCashLedgerModal";
import { CashInvoiceData, fetchCashInvoicesFromFirestore } from "@/services/cashInvoiceFirebaseService";
import {
  Customer,
  HospitalContact,
  getSavedCustomers,
  saveCustomer,
  deleteCustomer,
  fetchUnifiedCustomers,
  mergeCustomers,
  CustomerRecordsSummary,
  getCustomerRecordsSummary,
  updateHospitalNameAcrossAllDcsAndInvoices,
  normalizeHospitalName,
  deduplicateAndCleanCustomers,
  syncCustomersFromDcs,
  batchMergeCustomers,
} from "@/lib/customerStorage";
import { loadSavedDcs, SavedDc } from "@/lib/savedDcStorage";
import {
  findNearDuplicateHospital,
  findAllDuplicateClusters,
  DuplicateClusterPair,
} from "@/lib/hospitalDuplicateDetector";

interface CustomersProps {
  embedded?: boolean;
}

export default function Customers({ embedded = false }: CustomersProps = {}) {
  const navigate = useNavigate();
  const { fetchProcedures, loading } = useProcedures();

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("srrortho:theme") as "light" | "dark") || "light";
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

  const handleLogout = async () => {
    localStorage.removeItem("srrortho:auth");
    localStorage.removeItem("srrortho:procedures_cache");
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Customers Data
  const [customers, setCustomers] = useState<Customer[]>(getSavedCustomers);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "ot" | "contacts" | "dues">("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedHospitalForContacts, setSelectedHospitalForContacts] = useState<Customer | null>(null);
  const [invoicesDuesMap, setInvoicesDuesMap] = useState<Record<string, number>>({});
  const [selectedCustomerForLedger, setSelectedCustomerForLedger] = useState<Customer | null>(null);
  const [allCashInvoices, setAllCashInvoices] = useState<CashInvoiceData[]>([]);

  // Add / Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCust, setEditingCust] = useState<Customer | null>(null);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formContacts, setFormContacts] = useState<HospitalContact[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Merge Customers State
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [mergeCombineNotes, setMergeCombineNotes] = useState(true);
  const [mergeUpdateDcs, setMergeUpdateDcs] = useState(true);
  const [mergeUpdateInvoices, setMergeUpdateInvoices] = useState(true);
  const [isMerging, setIsMerging] = useState(false);

  // Auto-Deduplicate Directory State
  const [autoDeduplicateModalOpen, setAutoDeduplicateModalOpen] = useState(false);
  const [detectedClusters, setDetectedClusters] = useState<DuplicateClusterPair[]>([]);
  const [selectedClusterIndices, setSelectedClusterIndices] = useState<Set<number>>(new Set());
  const [isBatchMerging, setIsBatchMerging] = useState(false);

  const handleScanAndShowAutoDeduplicateModal = () => {
    const clusters = findAllDuplicateClusters(customers, 0.70);
    setDetectedClusters(clusters);
    setSelectedClusterIndices(new Set(clusters.map((_, i) => i)));
    setAutoDeduplicateModalOpen(true);
  };

  const handleToggleClusterSelection = (index: number) => {
    const next = new Set(selectedClusterIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedClusterIndices(next);
  };

  const handleExecuteBatchMerge = async () => {
    const pairsToMerge = detectedClusters
      .filter((_, idx) => selectedClusterIndices.has(idx))
      .map((c) => ({
        targetId: c.target.id,
        sourceId: c.source.id,
        targetName: c.target.name,
      }));

    if (pairsToMerge.length === 0) {
      toast.error("No duplicate hospital pairs selected to merge.");
      return;
    }

    setIsBatchMerging(true);
    try {
      const res = await batchMergeCustomers(pairsToMerge);
      toast.success(
        `Successfully merged ${res.mergedCount} duplicate hospital profiles! All historical DCs & Invoices updated with clean names.`
      );
      setAutoDeduplicateModalOpen(false);
      const unified = await fetchUnifiedCustomers();
      setCustomers(deduplicateAndCleanCustomers(unified));
    } catch (e: any) {
      toast.error(e.message || "Failed to perform batch deduplication.");
    } finally {
      setIsBatchMerging(false);
    }
  };

  // Delete Caution Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [deleteSummary, setDeleteSummary] = useState<CustomerRecordsSummary | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [isCheckingDelete, setIsCheckingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync unified customers on mount
  useEffect(() => {
    fetchUnifiedCustomers()
      .then((unified) => {
        setCustomers(deduplicateAndCleanCustomers(unified));
      })
      .catch((err) => console.warn("Failed to fetch unified customers:", err));

    // Load cash invoices from cache / Firestore to calculate customer dues accurately
    const loadCashInvoices = async () => {
      try {
        const invoices = await fetchCashInvoicesFromFirestore();
        if (Array.isArray(invoices)) {
          setAllCashInvoices(invoices);
          const dues: Record<string, number> = {};
          invoices.forEach((inv: any) => {
            if (inv && inv.clientName) {
              const nameLower = inv.clientName.toLowerCase().trim();
              const balance = (Number(inv.grandTotal) || 0) - (Number(inv.paymentReceived) || 0);
              dues[nameLower] = (dues[nameLower] || 0) + balance;
            }
          });
          setInvoicesDuesMap(dues);
        }
      } catch (e) {
        console.error("Error calculating dues from cash invoices:", e);
      }
    };
    loadCashInvoices();

    const handleCashInvoicesUpdated = (e: any) => {
      const invoices = e?.detail && Array.isArray(e.detail) ? e.detail : null;
      if (invoices) {
        setAllCashInvoices(invoices);
        const dues: Record<string, number> = {};
        invoices.forEach((inv: any) => {
          if (inv && inv.clientName) {
            const nameLower = inv.clientName.toLowerCase().trim();
            const balance = (Number(inv.grandTotal) || 0) - (Number(inv.paymentReceived) || 0);
            dues[nameLower] = (dues[nameLower] || 0) + balance;
          }
        });
        setInvoicesDuesMap(dues);
      }
    };
    window.addEventListener("srrortho:cash_invoices_updated", handleCashInvoicesUpdated);

    const handleUpdate = () => {
      setCustomers(deduplicateAndCleanCustomers(getSavedCustomers()));
    };
    window.addEventListener("srrortho:customers_updated", handleUpdate);
    return () => {
      window.removeEventListener("srrortho:customers_updated", handleUpdate);
      window.removeEventListener("srrortho:cash_invoices_updated", handleCashInvoicesUpdated);
    };
  }, []);

  const [savedDcs, setSavedDcs] = useState<SavedDc[]>([]);
  const [isSyncingUnmatched, setIsSyncingUnmatched] = useState(false);

  useEffect(() => {
    loadSavedDcs()
      .then((dcs) => {
        setSavedDcs(dcs);
        const synced = syncCustomersFromDcs(dcs);
        if (synced && synced.length > 0) {
          setCustomers(deduplicateAndCleanCustomers(synced));
        }
      })
      .catch(() => {});

    const handleDcs = (e: any) => {
      const dcs = e?.detail && Array.isArray(e.detail) ? e.detail : null;
      if (dcs) {
        setSavedDcs(dcs);
        const synced = syncCustomersFromDcs(dcs);
        if (synced && synced.length > 0) {
          setCustomers(deduplicateAndCleanCustomers(synced));
        }
      } else {
        loadSavedDcs()
          .then((fresh) => {
            setSavedDcs(fresh);
            const synced = syncCustomersFromDcs(fresh);
            if (synced && synced.length > 0) {
              setCustomers(deduplicateAndCleanCustomers(synced));
            }
          })
          .catch(() => {});
      }
    };
    window.addEventListener("srrortho:saved_dcs_updated", handleDcs);
    return () => window.removeEventListener("srrortho:saved_dcs_updated", handleDcs);
  }, []);

  const unmatchedDcsList = useMemo(() => {
    if (!savedDcs.length || !customers.length) return [];
    const customerNamesSet = new Set(customers.map((c) => normalizeHospitalName(c.name).toLowerCase()));
    const map = new Map<string, { count: number; dcs: SavedDc[]; matchedCustomer?: Customer }>();

    savedDcs.forEach((dc) => {
      if (!dc.hospitalName) return;
      const cleanDcName = normalizeHospitalName(dc.hospitalName);
      if (!cleanDcName || cleanDcName === "-" || cleanDcName.toLowerCase() === "none") return;
      const lower = cleanDcName.toLowerCase();
      if (!customerNamesSet.has(lower)) {
        if (!map.has(lower)) {
          const matchResult = findNearDuplicateHospital(cleanDcName, customers, 0.60);
          map.set(lower, {
            count: 1,
            dcs: [dc],
            matchedCustomer: matchResult?.match,
          });
        } else {
          const entry = map.get(lower)!;
          entry.count++;
          entry.dcs.push(dc);
        }
      }
    });

    return Array.from(map.entries()).map(([, data]) => ({
      rawName: data.dcs[0].hospitalName,
      count: data.count,
      dcs: data.dcs,
      matchedCustomer: data.matchedCustomer,
    }));
  }, [savedDcs, customers]);

  const handleSyncAllUnmatchedDcs = async () => {
    setIsSyncingUnmatched(true);
    let totalUpdated = 0;
    let totalAdded = 0;
    try {
      for (const item of unmatchedDcsList) {
        if (item.matchedCustomer?.name) {
          const res = await updateHospitalNameAcrossAllDcsAndInvoices(item.rawName, item.matchedCustomer.name);
          totalUpdated += res.updatedDcsCount;
        } else {
          await saveCustomer({
            name: item.rawName,
            contactPerson: item.dcs[0]?.doctorName || "",
            notes: "Imported from DC history",
          });
          totalAdded++;
        }
      }
      const refreshed = await loadSavedDcs();
      setSavedDcs(refreshed);
      setCustomers(deduplicateAndCleanCustomers(getSavedCustomers()));
      const msgs = [];
      if (totalUpdated > 0) msgs.push(`Updated ${totalUpdated} DC(s)`);
      if (totalAdded > 0) msgs.push(`Added ${totalAdded} customer(s) to directory`);
      toast.success(msgs.join(" & ") || "Synchronization complete.");
    } catch (e: any) {
      toast.error(e.message || "Failed to sync DCs.");
    } finally {
      setIsSyncingUnmatched(false);
    }
  };

  const handleAddSingleUnmatchedToDirectory = async (item: { rawName: string; dcs: SavedDc[] }) => {
    try {
      const saved = await saveCustomer({
        name: item.rawName,
        contactPerson: item.dcs[0]?.doctorName || "",
        notes: "Imported from DC history",
      });
      setCustomers(deduplicateAndCleanCustomers(getSavedCustomers()));
      toast.success(`"${saved.name}" has been added to the customer directory!`);
    } catch (e: any) {
      toast.error(e.message || "Failed to add customer.");
    }
  };

  // The 5 standard roles requested by user
  const STANDARD_ROLES = ["OT Person", "Accounts", "Reception", "Others", "Doctor"] as const;

  const normalizeToStandardRole = (r?: string): string => {
    if (!r) return "Others";
    const lower = r.toLowerCase().trim();
    if (lower.includes("ot") || lower.includes("theatre") || lower.includes("sister") || lower.includes("nurse")) return "OT Person";
    if (lower.includes("acc") || lower.includes("bill") || lower.includes("finan") || lower.includes("store") || lower.includes("pharm")) return "Accounts";
    if (lower.includes("recept") || lower.includes("board") || lower.includes("front") || lower.includes("desk") || lower.includes("landline")) return "Reception";
    if (lower.includes("doc") || lower.includes("surg") || lower.includes("ortho") || lower.includes("person") || lower.includes("mobile")) return "Doctor";
    return "Others";
  };

  const normalizeDigits = (str?: string) => {
    if (!str) return "";
    const d = str.replace(/\D/g, "");
    if (d.length === 12 && d.startsWith("91")) return d.slice(2);
    if (d.length === 11 && d.startsWith("0")) return d.slice(1);
    return d;
  };

  const toTitleCase = (str?: string) => {
    if (!str) return "";
    return str
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  const cleanName = (n?: string) =>
    (n || "")
      .toLowerCase()
      .replace(/^(dr\.?|mr\.?|mrs\.?|ms\.?|sister|brother|nurse)\s+/i, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();

  const isGenericName = (n?: string) => {
    if (!n) return true;
    const clean = cleanName(n);
    return (
      !clean ||
      clean === "notset" ||
      clean === "none" ||
      clean === "null" ||
      clean === "doctor" ||
      clean === "dr" ||
      clean === "ot" ||
      clean === "otperson" ||
      clean === "otincharge" ||
      clean === "hospital" ||
      clean === "staff" ||
      clean === "contact"
    );
  };

  const getWaUrl = (digits: string) => {
    if (!digits || digits.length < 10) return undefined;
    const wa = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${wa}`;
  };

  const getHospitalDoctorAndOt = (cust: Customer) => {
    const contactsList = Array.isArray(cust.contacts) ? cust.contacts : [];

    // --- 1. DOCTOR / INCHARGE ---
    let drName = "";
    if (!isGenericName(cust.contactPerson)) {
      drName = toTitleCase(cust.contactPerson);
    }
    if (!drName) {
      const drContact = contactsList.find((c) =>
        /doc|surg|ortho|incharge|consult/i.test(c.role || "")
      );
      if (drContact && !isGenericName(drContact.name)) {
        drName = toTitleCase(drContact.name);
      }
    }

    const persRaw = (cust.personalNumber || cust.mobile || "").trim();
    let persDigits = normalizeDigits(persRaw);
    let drPhone = persRaw;

    if (!persDigits || persDigits.length < 6) {
      const drPhoneContact = contactsList.find(
        (c) =>
          c.phone &&
          normalizeDigits(c.phone).length >= 6 &&
          (/doc|surg|ortho|personal/i.test(c.role || "") ||
            (drName && cleanName(c.name) === cleanName(drName)))
      );
      if (drPhoneContact && drPhoneContact.phone) {
        drPhone = drPhoneContact.phone.trim();
        persDigits = normalizeDigits(drPhone);
      }
    }

    // --- 2. OT CONTACT ---
    const otRaw = (cust.otNumber || "").trim();
    const otDigits = normalizeDigits(otRaw);
    let otPersonName = "";

    // Match OT name if role explicitly includes 'ot', 'theatre', or 'theater'
    const otContact = contactsList.find((c) =>
      /ot\b|theatre|theater/i.test(c.role || "") || /ot\b/i.test(c.name || "")
    );
    if (otContact && !isGenericName(otContact.name)) {
      otPersonName = toTitleCase(otContact.name);
    }

    // Match OT name by phone if not found yet
    if (!otPersonName && otDigits) {
      const matchedByPhone = contactsList.find(
        (c) => c.phone && normalizeDigits(c.phone) === otDigits && !isGenericName(c.name)
      );
      if (matchedByPhone) {
        otPersonName = toTitleCase(matchedByPhone.name);
      }
    }

    // Check if Janahitha Sujatha case or matching person:
    const isSujathaOtCase =
      drName &&
      otDigits &&
      persDigits === otDigits &&
      contactsList.some(
        (c) =>
          /ot/i.test(c.role || "") &&
          cleanName(c.name) === cleanName(drName)
      );

    if (otPersonName && drName && cleanName(otPersonName) === cleanName(drName)) {
      drName = "";
      drPhone = "";
      persDigits = "";
    } else if (isSujathaOtCase) {
      otPersonName = drName;
      drName = "";
      drPhone = "";
      persDigits = "";
    }

    // If Dr and OT share the exact same number, keep drName if different from otPersonName, but clear drPhone
    if (persDigits && otDigits && persDigits === otDigits) {
      drPhone = "";
      persDigits = "";
    }

    const doctorInfo = {
      name: drName || undefined,
      phone: persDigits && persDigits.length >= 6 ? drPhone : undefined,
      waUrl: persDigits && persDigits.length >= 10 ? getWaUrl(persDigits) : undefined,
    };

    const otInfo = {
      name: otPersonName || undefined,
      phone: otDigits && otDigits.length >= 6 ? otRaw : undefined,
      waUrl: otDigits && otDigits.length >= 10 ? getWaUrl(otDigits) : undefined,
    };

    // Extra lines (Hospital reception or additional staff)
    const extraLines: Array<{ prefix: string; name?: string; phone?: string; waUrl?: string }> = [];

    const hospRaw = (cust.hospitalNumber || "").trim();
    const hospDigits = normalizeDigits(hospRaw);
    if (hospDigits && hospDigits.length >= 6 && hospDigits !== otDigits && hospDigits !== persDigits) {
      extraLines.push({
        prefix: "Hosp",
        phone: hospRaw,
        waUrl: getWaUrl(hospDigits),
      });
    }

    for (const c of contactsList) {
      if (!c) continue;
      const cDigits = normalizeDigits(c.phone);
      if (cDigits && (cDigits === otDigits || cDigits === persDigits || cDigits === hospDigits)) continue;
      const cName = toTitleCase(c.name);
      if (isGenericName(cName) && !cDigits) continue;
      if (drName && cleanName(cName) === cleanName(drName)) continue;
      if (otPersonName && cleanName(cName) === cleanName(otPersonName)) continue;

      const rawRole = (c.role || "").trim().toLowerCase();
      let normPrefix = "Staff";
      let badgeStyle = "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 font-extrabold";

      if (/ot\b|theatre|theater|sister|nurse/i.test(rawRole)) {
        normPrefix = "OT";
        badgeStyle = "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold";
      } else if (/doc|doctor|surg|ortho|consult/i.test(rawRole)) {
        normPrefix = "Dr";
        badgeStyle = "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300 font-extrabold";
      } else if (/hosp|board|recept|front|desk|landline/i.test(rawRole)) {
        normPrefix = "Hosp";
        badgeStyle = "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-300 font-extrabold";
      } else if (c.role) {
        normPrefix = toTitleCase(c.role.replace(/[^a-zA-Z]/g, "")).slice(0, 8) || "Staff";
      }

      extraLines.push({
        prefix: normPrefix,
        badgeStyle,
        name: isGenericName(cName) ? undefined : cName,
        phone: cDigits ? c.phone?.trim() : undefined,
        waUrl: cDigits ? getWaUrl(cDigits) : undefined,
      });
    }

    return { doctorInfo, otInfo, extraLines };
  };

  const getStructuredCustomerContacts = (cust: Customer) => {
    const { doctorInfo, otInfo, extraLines } = getHospitalDoctorAndOt(cust);
    const lines: Array<{
      prefix: "OT" | "Dr" | "Hosp" | string;
      badgeStyle: string;
      name?: string;
      phone?: string;
      waUrl?: string;
    }> = [];

    // 1. OT Line first (primary operational line for implants / delivery)
    if (otInfo.phone || otInfo.name) {
      lines.push({
        prefix: "OT",
        badgeStyle: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold",
        name: otInfo.name,
        phone: otInfo.phone,
        waUrl: otInfo.waUrl,
      });
    }

    // 2. Doctor / Incharge Line
    if (doctorInfo.name || doctorInfo.phone) {
      lines.push({
        prefix: "Dr",
        badgeStyle: "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300 font-extrabold",
        name: doctorInfo.name,
        phone: doctorInfo.phone,
        waUrl: doctorInfo.waUrl,
      });
    }

    // 3. Other Staff / Department Lines
    for (const el of extraLines) {
      lines.push({
        prefix: el.prefix,
        badgeStyle: el.badgeStyle || "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 font-extrabold",
        name: el.name,
        phone: el.phone,
        waUrl: el.waUrl,
      });
    }

    return lines;
  };

  const openAddModal = () => {
    setEditingCust(null);
    setFormName("");
    setFormAddress("");
    setFormEmail("");
    setFormNotes("");
    setFormContacts([]);
    setModalOpen(true);
  };

  const openEditModal = (cust: Customer) => {
    setEditingCust(cust);
    setFormName(cust.name || "");
    setFormAddress(cust.address || "");
    setFormEmail(cust.email || "");
    setFormNotes(cust.notes || "");

    const ot = (cust.otNumber || "").trim();
    const hosp = (cust.hospitalNumber || "").trim();
    const pers = (cust.personalNumber || cust.mobile || "").trim();
    const contactDoc = (cust.contactPerson || "").trim();

    const existingContacts: HospitalContact[] = [];

    if (Array.isArray(cust.contacts) && cust.contacts.length > 0) {
      cust.contacts.forEach((c) => {
        if (c && ((c.name && c.name.trim()) || (c.phone && c.phone.trim()))) {
          existingContacts.push({
            id: c.id || `c_${Math.random().toString(36).slice(2, 7)}`,
            role: normalizeToStandardRole(c.role),
            name: (c.name || "").trim(),
            phone: (c.phone || "").trim(),
          });
        }
      });
    }

    // Include legacy primary fields only if not already represented in contacts
    if (ot && !existingContacts.some(c => c.phone === ot)) {
      existingContacts.unshift({ id: `c_ot_${Date.now()}`, role: "OT Person", name: "OT Desk", phone: ot });
    }
    if (hosp && !existingContacts.some(c => c.phone === hosp)) {
      existingContacts.push({ id: `c_rec_${Date.now()}`, role: "Reception", name: "Reception", phone: hosp });
    }
    if (pers && !existingContacts.some(c => c.phone === pers)) {
      existingContacts.push({ id: `c_doc_${Date.now()}`, role: "Doctor", name: contactDoc || "Doctor", phone: pers });
    }

    setFormContacts(existingContacts);
    setModalOpen(true);
  };

  const handleAddRoleContact = (role: string) => {
    setFormContacts((prev) => [
      ...prev,
      { id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, role, name: "", phone: "" },
    ]);
  };

  const handleUpdateContact = (index: number, field: keyof HospitalContact, value: string) => {
    setFormContacts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveContact = (index: number) => {
    setFormContacts((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveCustomer = async () => {
    if (!formName.trim()) {
      toast.error("Hospital or Customer Name is required.");
      return;
    }

    setIsSaving(true);
    try {
      // Clean and sanitize contacts - only keep rows with a phone or name
      const finalContacts: HospitalContact[] = [];

      for (const c of formContacts) {
        const phone = (c.phone || "").trim();
        const name = (c.name || "").trim();

        if (phone || name) {
          finalContacts.push({
            id: c.id || `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            role: c.role || "Others",
            name,
            phone,
          });
        }
      }

      // Automatically populate compatibility fields from contacts for database backwards-compatibility
      const otContact = finalContacts.find(c => c.role === "OT Person" && c.phone);
      const recContact = finalContacts.find(c => c.role === "Reception" && c.phone);
      const docContact = finalContacts.find(c => c.role === "Doctor" && c.phone);
      const anyWithPhone = finalContacts.find(c => c.phone);

      const otNum = otContact?.phone || "";
      const hospNum = recContact?.phone || "";
      const persNum = docContact?.phone || "";
      const contactDoc = docContact?.name || finalContacts.find(c => c.role === "Doctor")?.name || finalContacts[0]?.name || "";
      const primaryMobile = (persNum || otNum || hospNum || anyWithPhone?.phone || "").trim();

      const previousName = editingCust?.name || "";
      const saved = await saveCustomer({
        id: editingCust?.id,
        name: formName.trim(),
        previousName,
        hospitalNumber: hospNum,
        otNumber: otNum,
        personalNumber: persNum,
        mobile: primaryMobile,
        phone: primaryMobile,
        contactPerson: contactDoc,
        contacts: finalContacts,
        address: formAddress.trim(),
        email: formEmail.trim(),
        notes: formNotes.trim(),
      });

      const wasRenamed = Boolean(previousName && previousName.toLowerCase().trim() !== formName.toLowerCase().trim());
      toast.success(
        wasRenamed
          ? `Updated "${saved.name}" and updated all associated Delivery Challans & Invoices.`
          : editingCust
          ? `Updated "${saved.name}" successfully.`
          : `Saved "${saved.name}" to directory.`
      );
      setModalOpen(false);
      setCustomers(getSavedCustomers());
      loadSavedDcs().then((dcs) => setSavedDcs(dcs)).catch(() => {});
    } catch (e: any) {
      toast.error(e.message || "Failed to save hospital.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = async (cust: Customer) => {
    const matched = customers.find(
      (c) => c.id === cust.id || c.name.toLowerCase().trim() === cust.name.toLowerCase().trim()
    ) || cust;

    setCustomerToDelete(matched);
    setMergeSourceId(matched.id);
    setDeletePassword("");

    // Auto-suggest a target if a similarly spelled hospital exists (e.g. Aiira Hospital for Aiira Hopsital)
    const cleanLetters = matched.name.toLowerCase().replace(/[^a-z]/g, "");
    const candidate = customers.find(
      (c) => c.id !== matched.id && (
        c.name.toLowerCase().replace(/[^a-z]/g, "").includes(cleanLetters.slice(0, 4)) ||
        cleanLetters.includes(c.name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 4))
      )
    );
    setMergeTargetId(candidate?.id || "");

    setIsCheckingDelete(true);
    try {
      const summary = await getCustomerRecordsSummary(matched.name);
      setDeleteSummary(summary);
      setDeleteModalOpen(true);
    } catch (err) {
      console.error("Error checking customer records:", err);
      setDeleteSummary({ dcCount: 0, invoiceCount: 0, totalOutstanding: 0, dcs: [], invoices: [] });
      setDeleteModalOpen(true);
    } finally {
      setIsCheckingDelete(false);
    }
  };

  const handleCautionMerge = async () => {
    if (!customerToDelete || !mergeTargetId) {
      toast.error("Please select a target hospital to merge into.");
      return;
    }
    setIsMerging(true);
    try {
      const res = await mergeCustomers(mergeTargetId, customerToDelete.id, {
        combineNotes: true,
        updateDcs: true,
        updateInvoices: true,
      });
      toast.success(
        `Merged "${customerToDelete.name}" into "${res.targetCustomer.name}". ${res.updatedDcsCount} DCs and ${res.updatedInvoicesCount} invoices updated.`
      );
      setDeleteModalOpen(false);
      setCustomerToDelete(null);
      setDeleteSummary(null);
      setCustomers(getSavedCustomers());
    } catch (err: any) {
      toast.error(err.message || "Failed to merge customer.");
    } finally {
      setIsMerging(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    const cleanPass = deletePassword.trim();
    if (cleanPass !== "srrortho" && cleanPass !== "admin") {
      toast.error("Incorrect password. Deleting a customer profile requires administrator password.");
      return;
    }
    setIsDeleting(true);
    try {
      await deleteCustomer(customerToDelete.id || customerToDelete.name, customerToDelete.name);
      setCustomers(getSavedCustomers());
      toast.success(`"${customerToDelete.name}" permanently deleted.`);
      setDeleteModalOpen(false);
      setCustomerToDelete(null);
      setDeleteSummary(null);
      setDeletePassword("");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete hospital profile.");
    } finally {
      setIsDeleting(false);
    }
  };


  const openMergeModal = (preselectedSource?: Customer, preselectedTarget?: Customer) => {
    if (preselectedSource) {
      setMergeSourceId(preselectedSource.id);
      // Default target to another customer if available
      const altTarget = customers.find((c) => c.id !== preselectedSource.id);
      setMergeTargetId(preselectedTarget?.id || altTarget?.id || "");
    } else {
      setMergeSourceId("");
      setMergeTargetId(preselectedTarget?.id || "");
    }
    setMergeCombineNotes(true);
    setMergeUpdateDcs(true);
    setMergeUpdateInvoices(true);
    setMergeModalOpen(true);
  };

  const handleSwapMerge = () => {
    const temp = mergeTargetId;
    setMergeTargetId(mergeSourceId);
    setMergeSourceId(temp);
  };

  const handleExecuteMerge = async () => {
    if (!mergeTargetId || !mergeSourceId) {
      toast.error("Please select both a Primary Hospital (to keep) and a Duplicate (to merge).");
      return;
    }
    if (mergeTargetId === mergeSourceId) {
      toast.error("Primary Hospital and Duplicate Hospital cannot be the same.");
      return;
    }

    const target = customers.find((c) => c.id === mergeTargetId);
    const source = customers.find((c) => c.id === mergeSourceId);

    if (!target || !source) {
      toast.error("Selected hospital profiles not found.");
      return;
    }

    setIsMerging(true);
    try {
      const res = await mergeCustomers(mergeTargetId, mergeSourceId, {
        combineNotes: mergeCombineNotes,
        updateDcs: mergeUpdateDcs,
        updateInvoices: mergeUpdateInvoices,
      });

      toast.success(
        `Merged "${source.name}" into "${target.name}"! (${res.mergedContactsCount} contacts combined, ${res.updatedDcsCount} DCs updated, ${res.updatedInvoicesCount} invoices linked)`
      );
      setMergeModalOpen(false);
      setCustomers(getSavedCustomers());
    } catch (err: any) {
      console.error("Merge error:", err);
      toast.error(err.message || "Failed to merge customer profiles.");
    } finally {
      setIsMerging(false);
    }
  };

  // Filtered list
  const filteredCustomers = useMemo(() => {
    const list = customers.filter((c) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          (c.name && c.name.toLowerCase().includes(q)) ||
          (c.otNumber && c.otNumber.includes(q)) ||
          (c.hospitalNumber && c.hospitalNumber.includes(q)) ||
          (c.personalNumber && c.personalNumber.includes(q)) ||
          (c.mobile && c.mobile.includes(q)) ||
          (c.contactPerson && c.contactPerson.toLowerCase().includes(q)) ||
          (c.address && c.address.toLowerCase().includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.notes && c.notes.toLowerCase().includes(q)) ||
          (Array.isArray(c.contacts) &&
            c.contacts.some(
              (item) =>
                (item.name && item.name.toLowerCase().includes(q)) ||
                (item.phone && item.phone.includes(q)) ||
                (item.role && item.role.toLowerCase().includes(q))
            ));
        if (!match) return false;
      }

      // Active pill filter
      if (activeFilter === "ot") {
        return Boolean(c.otNumber || c.contacts?.some((x) => /ot/i.test(x.role)));
      }
      if (activeFilter === "contacts") {
        return Boolean((c.contacts && c.contacts.length > 0) || c.personalNumber);
      }
      if (activeFilter === "dues") {
        const due = invoicesDuesMap[c.name.toLowerCase().trim()] || 0;
        return due > 0;
      }
      return true;
    });

    return deduplicateAndCleanCustomers(list);
  }, [customers, searchQuery, activeFilter, invoicesDuesMap]);

  // KPI counters
  const totalHospitals = customers.length;
  const totalOtNumbers = customers.filter(
    (c) => c.otNumber || c.contacts?.some((x) => /ot/i.test(x.role))
  ).length;
  const totalDirectContacts = customers.reduce(
    (acc, c) => acc + (c.contacts?.length || 0) + (c.personalNumber ? 1 : 0),
    0
  );
  const totalOutstanding = Object.values(invoicesDuesMap).reduce((a, b) => a + b, 0);

  return (
    <div className={embedded ? "w-full space-y-4" : "min-h-screen bg-gradient-hero overflow-x-hidden flex flex-col w-full"}>
      <main className={embedded ? "w-full space-y-4" : "flex-grow flex flex-col w-full px-1.5 sm:px-3 lg:px-4 py-2 sm:py-2.5 overflow-x-hidden"}>
        {!embedded && (
          <TopToolbar
            theme={theme}
            toggleTheme={toggleTheme}
            fetchProcedures={fetchProcedures}
            loading={loading}
            handlePrint={() => {}}
            navigate={navigate}
            handleLogout={handleLogout}
            setDcMode={(mode) => navigate(`/?mode=${mode}`)}
            setInitialFilterType={() => {}}
            setShowProcedureSelector={() => {}}
            setActiveProcedures={() => {}}
            setCollapsedProcedures={() => {}}
          />
        )}
        <div className="space-y-3 pt-0 pb-12 w-full">
            {/* Header & KPI Summary */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card/95 p-4 sm:p-5 rounded-2xl border border-border shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent border border-primary/20 flex items-center justify-center text-accent-foreground shadow-2xs shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold font-sans text-foreground tracking-tight">
                  Hospital &amp; Customer Directory
                </h1>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-bold rounded-full">
                  Admin Directory
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Maintain complete hospital profiles with OT Numbers, Landlines, Surgeon Direct Lines, and staff contacts.
              </p>
            </div>
          </div>

            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleScanAndShowAutoDeduplicateModal}
                className="h-9 text-xs gap-1.5 border-purple-300 text-purple-900 dark:text-purple-300 bg-purple-50 hover:bg-purple-100 dark:hover:bg-purple-950 font-bold rounded-md shadow-2xs"
                title="Scan entire directory and batch merge all detected duplicate hospitals in 1-click"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                Auto-Deduplicate
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => openMergeModal()}
                className="h-9 text-xs gap-1.5 border-amber-300 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950 font-bold rounded-md shadow-2xs"
                title="Merge duplicate customer accounts and combine all phone numbers"
              >
                <GitMerge className="w-3.5 h-3.5 text-amber-600" />
                Merge Customers
              </Button>

              <Button
                size="sm"
                onClick={openAddModal}
                className="h-9 text-xs gap-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-md shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Add Hospital / Customer
              </Button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-border shadow-sm p-4 rounded-xl">
              <div className="text-[11px] font-bold text-muted-foreground uppercase">Hospitals</div>
              <div className="text-xl sm:text-2xl font-black font-sans font-mono text-foreground mt-1">
                {totalHospitals}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Registered accounts</p>
            </Card>

            <Card className="border-border shadow-sm p-4 rounded-xl">
              <div className="text-[11px] font-bold text-teal-700 dark:text-teal-400 uppercase">OT Direct Lines</div>
              <div className="text-xl sm:text-2xl font-black font-sans font-mono text-teal-700 dark:text-teal-400 mt-1">
                {totalOtNumbers}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Direct OT contacts</p>
            </Card>

            <Card className="border-border shadow-sm p-4 rounded-xl">
              <div className="text-[11px] font-bold text-teal-700 dark:text-teal-400 uppercase">Total Contacts</div>
              <div className="text-xl sm:text-2xl font-black font-sans font-mono text-teal-700 dark:text-teal-400 mt-1">
                {totalDirectContacts}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Doctors, OT &amp; Purchase</p>
            </Card>

            <Card className="border-border shadow-sm p-4 rounded-xl">
              <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase flex items-center justify-between">
                <span>Cash Invoices Due</span>
                <span className="text-[9px] font-semibold bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded border border-rose-200">cash only</span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-sans font-mono text-rose-600 dark:text-rose-400 mt-1">
                ₹{totalOutstanding.toLocaleString("en-IN")}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Pending cash invoice balances</p>
            </Card>
          </div>

          {/* Outdated or Unmatched DC Names Reconciliation Banner */}
          {unmatchedDcsList.length > 0 && (
            <div className="p-4 rounded-2xl border-2 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 text-amber-950 dark:text-amber-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in-50">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-200 dark:bg-amber-900 flex items-center justify-center shrink-0 text-amber-800 dark:text-amber-300">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-xs sm:text-sm text-foreground dark:text-white">
                      Hospital Names from Delivery Challans ({unmatchedDcsList.reduce((sum, i) => sum + i.count, 0)} DCs)
                    </span>
                    <Badge className="bg-amber-200 text-amber-900 text-[10px] font-bold border-0">
                      Sync Available
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground dark:text-slate-400 mt-1">
                    The following hospital or customer names exist in your DCs and can be synced or added to your customer directory:
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {unmatchedDcsList.map((item) => (
                      <span
                        key={item.rawName}
                        className="inline-flex items-center gap-1.5 text-[11px] bg-card dark:bg-slate-900 border border-amber-200 dark:border-amber-900 px-2.5 py-1 rounded-lg text-foreground dark:text-slate-200 shadow-2xs"
                      >
                        {item.matchedCustomer ? (
                          <>
                            <span className="line-through text-slate-400 font-medium">{item.rawName}</span>
                            <span>→</span>
                            <strong className="text-teal-700 dark:text-teal-400 font-bold">{item.matchedCustomer.name}</strong>
                            <span className="text-[10px] text-slate-400">({item.count} DCs)</span>
                          </>
                        ) : (
                          <>
                            <Building2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <strong className="text-foreground dark:text-white font-bold">{item.rawName}</strong>
                            <span className="text-[10px] text-slate-400">({item.count} DCs)</span>
                            <button
                              type="button"
                              onClick={() => handleAddSingleUnmatchedToDirectory(item)}
                              className="ml-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 hover:bg-teal-200 dark:bg-teal-950 dark:hover:bg-teal-900 text-teal-800 dark:text-teal-300 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              Add to Directory
                            </button>
                          </>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                disabled={isSyncingUnmatched}
                onClick={handleSyncAllUnmatchedDcs}
                className="bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shrink-0 shadow-sm gap-2 h-9 px-4"
              >
                {isSyncingUnmatched ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Sync &amp; Import All to Directory
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="customers-search-input"
                name="customers_search_query"
                type="search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                data-form-type="other"
                aria-autocomplete="none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search hospital, OT number, doctor, mobile, location..."
                className="pl-9 h-9 text-xs bg-card dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-muted-foreground mr-1">Filter:</span>
              <Button
                variant={activeFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("all")}
                className={`h-7 text-xs rounded-lg ${
                  activeFilter === "all" ? "bg-teal-700 text-white font-bold" : ""
                }`}
              >
                All ({customers.length})
              </Button>
              <Button
                variant={activeFilter === "ot" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("ot")}
                className={`h-7 text-xs rounded-lg ${
                  activeFilter === "ot" ? "bg-teal-700 text-white font-bold" : ""
                }`}
              >
                🩺 Has OT Number ({totalOtNumbers})
              </Button>
              <Button
                variant={activeFilter === "contacts" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("contacts")}
                className={`h-7 text-xs rounded-lg ${
                  activeFilter === "contacts" ? "bg-teal-700 text-white font-bold" : ""
                }`}
              >
                👥 Has Multiple Contacts
              </Button>
              {totalOutstanding > 0 && (
                <Button
                  variant={activeFilter === "dues" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter("dues")}
                  className={`h-7 text-xs rounded-lg ${
                    activeFilter === "dues" ? "bg-amber-600 text-white font-bold" : "text-amber-700 border-amber-300"
                  }`}
                >
                  ⏳ Pending Dues
                </Button>
              )}

              {/* View Switcher: List (Default) vs Grid */}
              <div className="ml-auto sm:ml-2 flex items-center bg-muted dark:bg-slate-800 p-0.5 rounded-lg border border-border dark:border-slate-700">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className={`h-6 px-2.5 text-xs font-bold rounded-md gap-1.5 transition-all ${
                    viewMode === "list"
                      ? "bg-card dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs font-extrabold border border-border dark:border-slate-700"
                      : "text-muted-foreground hover:text-foreground dark:hover:text-slate-100"
                  }`}
                  title="List View (Professional Directory Table)"
                >
                  <LayoutList className="w-3.5 h-3.5" /> List
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className={`h-6 px-2.5 text-xs font-bold rounded-md gap-1.5 transition-all ${
                    viewMode === "grid"
                      ? "bg-card dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs font-extrabold border border-border dark:border-slate-700"
                      : "text-muted-foreground hover:text-foreground dark:hover:text-slate-100"
                  }`}
                  title="Grid Cards View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Cards
                </Button>
              </div>
            </div>
          </div>

          {/* Hospitals List / Table View */}
          {filteredCustomers.length === 0 ? (
            <div className="p-12 text-center bg-card/60 dark:bg-slate-900 rounded-2xl border border-border dark:border-slate-800 shadow-xs">
              <Building2 className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-base font-bold text-foreground dark:text-slate-200">
                No hospitals or customers match your search
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Try searching with a different hospital name, OT number, or click below to add a new customer.
              </p>
              <Button onClick={openAddModal} className="mt-4 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold">
                + Add New Hospital
              </Button>
            </div>
          ) : viewMode === "list" ? (
            /* ========================================================================= */
            /* Professional Enterprise Table List View (Default)                         */
            /* ========================================================================= */
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm w-full">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
                      <th className="py-3 px-3 w-[48px] text-center">#</th>
                      <th className="py-3 px-3.5 text-left w-[290px] min-w-[240px]">Hospital &amp; Location</th>
                      <th className="py-3 px-3.5 text-left min-w-[280px]">Contacts &amp; Department Lines</th>
                      <th className="py-3 px-3 w-[115px] text-center" title="Outstanding balance strictly from Cash Invoices">Cash Due</th>
                      <th className="py-3 px-3 w-[280px] min-w-[270px] text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {filteredCustomers.map((cust, idx) => {
                      const balance = invoicesDuesMap[cust.name.toLowerCase().trim()] || 0;
                      const contactLines = getStructuredCustomerContacts(cust);
                      return (
                        <tr
                          key={`${cust.id || "cust"}_${cust.name}_${idx}`}
                          className="group transition-colors duration-150 hover:bg-slate-50/80 dark:hover:bg-slate-900/60"
                        >
                          {/* Row Number with DC Tracker style left accent indicator */}
                          <td className="relative py-3.5 px-3 text-center text-slate-400 font-mono text-[11px] font-bold align-middle">
                            <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-teal-500 opacity-0 group-hover:opacity-100 transition-all duration-200" />
                            {String(idx + 1).padStart(2, "0")}
                          </td>

                          {/* Hospital Name & Location - wraps nicely to next line in same row for lengthy names */}
                          <td className="py-3.5 px-3.5 text-left align-middle w-[290px] min-w-[240px]">
                            <div className="font-extrabold text-slate-900 dark:text-slate-100 text-[13px] flex items-start gap-1.5 leading-snug">
                              <Building2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                              <span className="break-words whitespace-normal font-bold">
                                {cust.name}
                              </span>
                            </div>
                            {cust.address && (
                              <div className="text-[11px] text-slate-500 flex items-start gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                                <span className="break-words whitespace-normal text-slate-600 dark:text-slate-400">
                                  {cust.address}
                                </span>
                              </div>
                            )}
                            {cust.notes && (
                              <div className="text-[10px] text-amber-700 dark:text-amber-400 flex items-center gap-1 mt-1 font-medium bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 rounded w-fit">
                                <Clock className="w-2.5 h-2.5 shrink-0" />
                                <span className="break-words whitespace-normal">{cust.notes}</span>
                              </div>
                            )}
                          </td>

                          {/* Contacts & Department Lines (All numbers in single column: Role : Name : Number, multiple on next line) */}
                          <td className="py-3.5 px-3.5 text-left align-middle min-w-[280px]">
                            {contactLines.length > 0 ? (
                              <div className="space-y-1.5">
                                {contactLines.map((line, lIdx) => (
                                  <div
                                    key={lIdx}
                                    className="flex items-center gap-1.5 text-xs flex-wrap font-medium leading-relaxed"
                                  >
                                    <span
                                      className={`text-[9.5px] font-black px-1.5 py-0.5 rounded tracking-wide shrink-0 ${line.badgeStyle}`}
                                    >
                                      {line.prefix}
                                    </span>
                                    <span className="text-slate-400 font-bold">:</span>
                                    {line.name && (
                                      <>
                                        <span className="font-bold text-slate-900 dark:text-slate-100">
                                          {line.name}
                                        </span>
                                        {line.phone && (
                                          <span className="text-slate-400 font-bold">:</span>
                                        )}
                                      </>
                                    )}
                                    {line.phone && (
                                      <div className="inline-flex items-center gap-1 shrink-0">
                                        <a
                                          href={`tel:${line.phone}`}
                                          className="font-bold text-teal-700 dark:text-teal-400 hover:underline tracking-tight"
                                        >
                                          {line.phone}
                                        </a>
                                        {line.waUrl && (
                                          <a
                                            href={line.waUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-emerald-600 hover:scale-125 transition-transform inline-flex items-center ml-0.5"
                                            title={`WhatsApp ${line.prefix} ${line.name || ""} (${line.phone})`}
                                          >
                                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600 fill-emerald-100 dark:fill-emerald-950" />
                                          </a>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                                <span className="italic text-[11px]">No contacts</span>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(cust)}
                                  className="text-[11px] text-teal-600 hover:text-teal-700 dark:text-teal-400 inline-flex items-center gap-0.5 hover:underline font-semibold cursor-pointer"
                                >
                                  <Plus className="w-2.5 h-2.5" /> Add
                                </button>
                              </div>
                            )}
                          </td>

                          {/* Outstanding Balance */}
                          <td className="py-3.5 px-3 text-center align-middle w-[115px]">
                            <button
                              type="button"
                              onClick={() => setSelectedCustomerForLedger(cust)}
                              className="inline-flex items-center justify-center gap-1 cursor-pointer focus:outline-hidden hover:opacity-90 transition-all"
                              title="Click to view Customer Cash Invoice Ledger"
                            >
                              {balance > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-mono shadow-2xs">
                                  ₹{balance.toLocaleString("en-IN")}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] text-emerald-700 bg-emerald-50 border border-emerald-200 font-semibold hover:bg-emerald-100">
                                  Clear
                                </span>
                              )}
                            </button>
                          </td>

                          {/* Quick Actions - Centered with generous width and no-wrap */}
                          <td className="py-3.5 px-3 text-center align-middle w-[280px] min-w-[270px]">
                            <div className="flex items-center justify-center gap-1.5 flex-nowrap whitespace-nowrap">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedCustomerForLedger(cust)}
                                className="h-7 text-[11px] gap-1.5 border-indigo-200 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 font-bold px-2.5 rounded-lg shadow-2xs"
                                title="View Customer Cash Invoice Ledger (Debits, Credits, Statement)"
                              >
                                <BookOpen className="w-3 h-3 text-indigo-600 dark:text-indigo-400" /> Ledger
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  navigate(`/?mode=procedure&hospital=${encodeURIComponent(cust.name)}`)
                                }
                                className="h-7 text-[11px] gap-1.5 border-teal-300 text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950 font-bold px-2.5 rounded-lg shadow-2xs"
                                title="Create Delivery Challan for this hospital"
                              >
                                <FileText className="w-3 h-3 text-teal-600" /> + DC
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEditModal(cust)}
                                className="h-7 w-7 text-slate-400 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950 rounded-lg transition-colors"
                                title="Edit hospital numbers and staff"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteClick(cust)}
                                className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                                title="Delete hospital"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* Grid Cards View (Alternative)                                             */
            /* ========================================================================= */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredCustomers.map((cust, idx) => {
                const balance = invoicesDuesMap[cust.name.toLowerCase().trim()] || 0;
                return (
                  <div
                    key={`${cust.id || "cust"}_${cust.name}_${idx}`}
                    className="p-4 rounded-xl border border-border dark:border-slate-800 bg-card/80 dark:bg-slate-900 backdrop-blur-xs shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div>
                      {/* Top Row: Name & Quick Dues Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-extrabold text-foreground dark:text-slate-100 text-sm leading-snug">
                            {cust.name}
                          </h3>
                          {cust.address && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[240px]" title={cust.address}>
                                {cust.address}
                              </span>
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedCustomerForLedger(cust)}
                          className="cursor-pointer focus:outline-hidden hover:opacity-90 transition-all"
                          title="Click to view Customer Cash Invoice Ledger"
                        >
                          {balance > 0 ? (
                            <Badge className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-[10px] font-bold cursor-pointer">
                              Due ₹{balance.toFixed(0)}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 cursor-pointer hover:bg-emerald-50">
                              Clear
                            </Badge>
                          )}
                        </button>
                      </div>

                      {/* Contacts Box (OT & Doctor) */}
                      {(() => {
                        const lines = getStructuredCustomerContacts(cust);
                        if (lines.length === 0) {
                          return (
                            <div className="mt-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                              <span className="text-slate-400 italic text-[11px]">No contacts set</span>
                              <button
                                type="button"
                                onClick={() => openEditModal(cust)}
                                className="text-[10.5px] text-teal-600 hover:text-teal-700 dark:text-teal-400 inline-flex items-center gap-0.5 hover:underline font-semibold cursor-pointer"
                              >
                                <Plus className="w-2.5 h-2.5" /> Add
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div className="mt-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1.5">
                            {lines.map((line, lIdx) => (
                              <div
                                key={lIdx}
                                className="flex items-center justify-between text-xs gap-2"
                              >
                                <span className="flex items-center gap-1.5 min-w-0">
                                  <span className={`text-[9.5px] font-black px-1.5 py-0.5 rounded tracking-wide shrink-0 ${line.badgeStyle}`}>
                                    {line.prefix}:
                                  </span>
                                  {line.name && (
                                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                      {line.name}
                                    </span>
                                  )}
                                </span>
                                {line.phone && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <a
                                      href={`tel:${line.phone}`}
                                      className="font-bold text-teal-700 dark:text-teal-400 hover:underline text-xs tracking-tight"
                                    >
                                      {line.phone}
                                    </a>
                                    {line.waUrl && (
                                      <a
                                        href={line.waUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-emerald-600 hover:scale-125 transition-transform text-xs ml-0.5 inline-flex items-center"
                                        title={`WhatsApp ${line.prefix} (${line.phone})`}
                                      >
                                        <MessageCircle className="w-3 h-3 text-emerald-600 fill-emerald-100 dark:fill-emerald-950" />
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Notes / Timings */}
                      {cust.notes && (
                        <div className="mt-2 p-1.5 rounded-md bg-amber-50 dark:bg-amber-950 text-[10.5px] text-amber-800 dark:text-amber-300 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>{cust.notes}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate(`/?mode=procedure&hospital=${encodeURIComponent(cust.name)}`)
                          }
                          className="h-7 text-[11px] gap-1 border-teal-300 text-teal-800 hover:bg-teal-50 font-bold"
                          title="Create Delivery Challan for this hospital"
                        >
                          <FileText className="w-3 h-3 text-teal-600" /> New DC
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedCustomerForLedger(cust)}
                          className="h-7 text-[11px] gap-1 border-indigo-200 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 font-bold px-2"
                          title="View Customer Cash Invoice Ledger"
                        >
                          <BookOpen className="w-3 h-3 text-indigo-600 dark:text-indigo-400" /> Ledger
                        </Button>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditModal(cust)}
                          className="h-7 w-7 text-muted-foreground hover:text-teal-700"
                          title="Edit hospital numbers and staff"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteClick(cust)}
                          className="h-7 w-7 text-slate-400 hover:text-red-600"
                          title="Delete hospital"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add / Edit Hospital Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-extrabold text-teal-900 dark:text-teal-100">
                <Building2 className="w-5 h-5 text-teal-600" />
                {editingCust ? `Edit Hospital: ${editingCust.name}` : "Add New Hospital / Customer"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Maintain hospital profile, address, and direct contacts for OT, accounts, reception, doctors, or staff.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-1">
              {/* Hospital Name & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground dark:text-slate-200">
                    Hospital / Customer Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Yashoda Hospital, Secunderabad"
                    className="h-9 text-xs font-bold"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground dark:text-slate-200">
                    Location / Address (Optional)
                  </Label>
                  <Input
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="e.g. Alexander Road, Secunderabad"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Email & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground dark:text-slate-200">
                    Email Address (Optional)
                  </Label>
                  <Input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g. ortho@hospital.com"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground dark:text-slate-200">
                    Notes / Remarks (Optional)
                  </Label>
                  <Input
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="e.g. OT on 4th floor, payment on 15th"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Hospital Contacts & Numbers */}
              <div className="p-3.5 rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-950 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-extrabold text-teal-950 dark:text-teal-200 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-teal-600" />
                      Hospital Contacts &amp; Numbers
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Add only the contacts and direct phone lines you need.
                    </p>
                  </div>

                  {/* 1-Click Role Add Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-muted-foreground">Quick Add:</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddRoleContact("OT Person")}
                      className="h-6 px-2 text-[11px] font-bold border-emerald-300 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 bg-card dark:bg-slate-900"
                    >
                      <Plus className="w-2.5 h-2.5 mr-0.5 text-emerald-600" /> OT Person
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddRoleContact("Accounts")}
                      className="h-6 px-2 text-[11px] font-bold border-amber-300 text-amber-800 dark:text-amber-300 hover:bg-amber-50 bg-card dark:bg-slate-900"
                    >
                      <Plus className="w-2.5 h-2.5 mr-0.5 text-amber-600" /> Accounts
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddRoleContact("Reception")}
                      className="h-6 px-2 text-[11px] font-bold border-sky-300 text-sky-800 dark:text-sky-300 hover:bg-sky-50 bg-card dark:bg-slate-900"
                    >
                      <Plus className="w-2.5 h-2.5 mr-0.5 text-sky-600" /> Reception
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddRoleContact("Doctor")}
                      className="h-6 px-2 text-[11px] font-bold border-purple-300 text-purple-800 dark:text-purple-300 hover:bg-purple-50 bg-card dark:bg-slate-900"
                    >
                      <Plus className="w-2.5 h-2.5 mr-0.5 text-purple-600" /> Doctor
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddRoleContact("Others")}
                      className="h-6 px-2 text-[11px] font-bold border-slate-300 text-foreground dark:text-slate-300 hover:bg-muted bg-card dark:bg-slate-900"
                    >
                      <Plus className="w-2.5 h-2.5 mr-0.5" /> Others
                    </Button>
                  </div>
                </div>

                {/* Contacts List Rows */}
                {formContacts.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground border border-dashed rounded-lg bg-card/60 dark:bg-slate-900">
                    No contacts added yet. Click one of the buttons above to add.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {formContacts.map((contact, idx) => (
                      <div
                        key={contact.id || idx}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-card dark:bg-slate-900 p-2.5 rounded-lg border border-border dark:border-slate-800 shadow-2xs"
                      >
                        {/* 1. Category / Role Selection - ONLY the 5 clean options! */}
                        <div className="sm:col-span-4">
                          <select
                            value={contact.role}
                            onChange={(e) => handleUpdateContact(idx, "role", e.target.value)}
                            className="w-full h-8 text-xs font-bold rounded-md border border-slate-300 dark:border-slate-700 bg-muted dark:bg-slate-950 px-2 text-foreground dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-600"
                          >
                            <option value="OT Person">🩺 OT Person</option>
                            <option value="Accounts">💳 Accounts</option>
                            <option value="Reception">🏥 Reception</option>
                            <option value="Doctor">👨‍⚕️ Doctor</option>
                            <option value="Others">📋 Others</option>
                          </select>
                        </div>

                        {/* 2. Contact Person Name */}
                        <div className="sm:col-span-4">
                          <Input
                            placeholder="Person / Staff Name"
                            value={contact.name}
                            onChange={(e) => handleUpdateContact(idx, "name", e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>

                        {/* 3. Phone Number */}
                        <div className="sm:col-span-3">
                          <Input
                            type="tel"
                            placeholder="Phone Number"
                            value={contact.phone}
                            onChange={(e) => handleUpdateContact(idx, "phone", e.target.value)}
                            className="h-8 text-xs font-semibold"
                          />
                        </div>

                        {/* 4. Delete Action */}
                        <div className="sm:col-span-1 flex justify-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveContact(idx)}
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 p-0"
                            title="Remove Contact"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModalOpen(false)}
                  className="h-8 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={isSaving || !formName.trim()}
                  onClick={handleSaveCustomer}
                  className="h-8 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white gap-1.5 px-4 shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {editingCust ? "Update Hospital" : "Save Hospital"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {/* Full Hospital Staff Directory Modal */}
        <Dialog
          open={Boolean(selectedHospitalForContacts)}
          onOpenChange={(open) => !open && setSelectedHospitalForContacts(null)}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground dark:text-slate-100">
                <Building2 className="w-5 h-5 text-teal-600" />
                {selectedHospitalForContacts?.name} — Staff Directory
              </DialogTitle>
              <DialogDescription className="text-xs">
                Direct contacts for surgeons, OT incharge, nursing staff, and store managers.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              {/* Department Numbers Summary */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-muted dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <div className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">OT Desk</div>
                  <div className="font-bold text-foreground dark:text-slate-100 mt-0.5 truncate">
                    {selectedHospitalForContacts?.otNumber || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-sky-700 dark:text-sky-400">Board Line</div>
                  <div className="font-bold text-foreground dark:text-slate-100 mt-0.5 truncate">
                    {selectedHospitalForContacts?.hospitalNumber || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-purple-700 dark:text-purple-400">Doctor Mobile</div>
                  <div className="font-bold text-foreground dark:text-slate-100 mt-0.5 truncate">
                    {selectedHospitalForContacts?.personalNumber || selectedHospitalForContacts?.mobile || "—"}
                  </div>
                </div>
              </div>

              {/* Staff List */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                {selectedHospitalForContacts?.contacts && selectedHospitalForContacts.contacts.length > 0 ? (
                  selectedHospitalForContacts.contacts.map((c, i) => (
                    <div key={i} className="p-3 flex items-center justify-between gap-3 text-xs bg-card dark:bg-slate-900">
                      <div className="min-w-0">
                        <div className="font-bold text-foreground dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                          <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span>{c.name}</span>
                          <Badge variant="outline" className="text-[9.5px] px-1.5 py-0 text-muted-foreground dark:text-slate-300">
                            {c.role || "Staff"}
                          </Badge>
                        </div>
                        {c.email && (
                          <div className="text-[10.5px] text-muted-foreground mt-0.5 truncate">{c.email}</div>
                        )}
                      </div>

                      {c.phone && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={`tel:${c.phone}`}
                            className="px-2 py-1 rounded-md bg-teal-50 hover:bg-teal-100 dark:bg-teal-950 dark:hover:bg-teal-900 text-teal-800 dark:text-teal-300 font-bold text-xs flex items-center gap-1 transition-colors"
                          >
                            <Phone className="w-3 h-3 text-teal-600" />
                            {c.phone}
                          </a>
                          <a
                            href={`https://wa.me/${c.phone.replace(/[^0-9]/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-600 transition-colors"
                            title="WhatsApp"
                          >
                            💬
                          </a>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No staff contacts added yet.
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const cust = selectedHospitalForContacts;
                    setSelectedHospitalForContacts(null);
                    if (cust) openEditModal(cust);
                  }}
                  className="h-8 text-xs gap-1 border-teal-300 text-teal-800 hover:bg-teal-50"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit Hospital Staff
                </Button>

                <Button
                  size="sm"
                  onClick={() => setSelectedHospitalForContacts(null)}
                  className="h-8 text-xs bg-slate-800 hover:bg-slate-900 text-white font-bold"
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Merge Customers / Hospital Profiles Modal */}
        <Dialog open={mergeModalOpen} onOpenChange={setMergeModalOpen}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-amber-900 dark:text-amber-300">
                <GitMerge className="w-5 h-5 text-amber-600" />
                Merge Hospital / Customer Profiles
              </DialogTitle>
              <DialogDescription className="text-xs">
                Combine two hospital accounts into one. All phone numbers, OT lines, and doctor contacts will be preserved and merged. Duplicate entry will be cleaned up.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-1">
              {/* Step 1 & 2: Primary Profile vs Duplicate Profile */}
              <div className="space-y-3">
                {/* 1. Primary Hospital (Keep) */}
                <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      1. Primary Profile (To Keep &amp; Update)
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded-full">
                      Destination
                    </span>
                  </div>

                  <select
                    value={mergeTargetId}
                    onChange={(e) => setMergeTargetId(e.target.value)}
                    className="w-full h-9 text-xs font-bold rounded-lg border border-emerald-300 dark:border-emerald-700 bg-card dark:bg-slate-900 px-2.5 text-foreground dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Choose Primary Hospital (Profile to Keep) --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id} disabled={c.id === mergeSourceId}>
                        {c.name} {c.otNumber ? `(OT: ${c.otNumber})` : ""} {c.mobile ? `(${c.mobile})` : ""}
                      </option>
                    ))}
                  </select>

                  {/* Preview of target hospital */}
                  {(() => {
                    const target = customers.find((c) => c.id === mergeTargetId);
                    if (!target) return null;
                    return (
                      <div className="text-[11px] text-muted-foreground dark:text-slate-300 bg-card dark:bg-slate-900 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 space-y-1">
                        <div className="font-bold text-foreground dark:text-slate-100 truncate">{target.name}</div>
                        {target.address && <div className="text-muted-foreground truncate">📍 {target.address}</div>}
                        <div className="flex items-center gap-2 flex-wrap pt-0.5 text-[10px]">
                          {target.otNumber && <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">OT: {target.otNumber}</span>}
                          {target.hospitalNumber && <span className="bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-bold">Hosp: {target.hospitalNumber}</span>}
                          {target.personalNumber && <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-bold">Pers: {target.personalNumber}</span>}
                          <span className="text-muted-foreground font-semibold">
                            👥 {target.contacts?.length || 0} existing contacts
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Swap button */}
                <div className="flex justify-center -my-1 relative z-10">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSwapMerge}
                    className="h-7 px-3 text-[11px] font-bold rounded-full border-slate-300 bg-card dark:bg-slate-800 hover:bg-muted shadow-xs flex items-center gap-1.5"
                    title="Swap Destination and Duplicate profiles"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground dark:text-slate-400" />
                    Swap Keep &amp; Merge
                  </Button>
                </div>

                {/* 2. Duplicate Hospital (Merge & Remove) */}
                <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      2. Duplicate Profile (To Merge &amp; Delete)
                    </span>
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 dark:bg-amber-900 px-2 py-0.5 rounded-full">
                      Source
                    </span>
                  </div>

                  <select
                    value={mergeSourceId}
                    onChange={(e) => setMergeSourceId(e.target.value)}
                    className="w-full h-9 text-xs font-bold rounded-lg border border-amber-300 dark:border-amber-700 bg-card dark:bg-slate-900 px-2.5 text-foreground dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Choose Duplicate Hospital (Profile to Merge) --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id} disabled={c.id === mergeTargetId}>
                        {c.name} {c.otNumber ? `(OT: ${c.otNumber})` : ""} {c.mobile ? `(${c.mobile})` : ""}
                      </option>
                    ))}
                  </select>

                  {/* Preview of source hospital */}
                  {(() => {
                    const source = customers.find((c) => c.id === mergeSourceId);
                    if (!source) return null;
                    return (
                      <div className="text-[11px] text-muted-foreground dark:text-slate-300 bg-card dark:bg-slate-900 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800 space-y-1">
                        <div className="font-bold text-foreground dark:text-slate-100 truncate">{source.name}</div>
                        {source.address && <div className="text-muted-foreground truncate">📍 {source.address}</div>}
                        <div className="flex items-center gap-2 flex-wrap pt-0.5 text-[10px]">
                          {source.otNumber && <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">OT: {source.otNumber}</span>}
                          {source.hospitalNumber && <span className="bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-bold">Hosp: {source.hospitalNumber}</span>}
                          {source.personalNumber && <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-bold">Pers: {source.personalNumber}</span>}
                          <span className="text-muted-foreground font-semibold">
                            👥 {source.contacts?.length || 0} contacts to move over
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Merge Options */}
              <div className="p-3 bg-muted dark:bg-slate-900 rounded-xl border border-border dark:border-slate-800 space-y-2 text-xs">
                <div className="font-bold text-foreground dark:text-slate-200 text-[11px] uppercase tracking-wider">
                  Merge Settings:
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-foreground dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={mergeCombineNotes}
                    onChange={(e) => setMergeCombineNotes(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Combine notes, address and remarks into primary profile</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-foreground dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={mergeUpdateDcs}
                    onChange={(e) => setMergeUpdateDcs(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Update past Delivery Challans with primary hospital name</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-foreground dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={mergeUpdateInvoices}
                    onChange={(e) => setMergeUpdateInvoices(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Update past Cash Invoices / bills with primary hospital name</span>
                </label>
              </div>

              {/* Summary Impact Callout */}
              {mergeTargetId && mergeSourceId && mergeTargetId !== mergeSourceId && (
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-[11.5px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Summary: </span>
                    All unique phone numbers and staff from{" "}
                    <strong>{customers.find((c) => c.id === mergeSourceId)?.name}</strong> will be merged into{" "}
                    <strong>{customers.find((c) => c.id === mergeTargetId)?.name}</strong>. The duplicate entry will be deleted cleanly.
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMergeModalOpen(false)}
                  disabled={isMerging}
                  className="h-8 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isMerging || !mergeTargetId || !mergeSourceId || mergeTargetId === mergeSourceId}
                  onClick={handleExecuteMerge}
                  className="h-8 text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white gap-1.5 px-4 shadow-sm"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  {isMerging ? "Merging Profiles..." : "Confirm & Merge Profiles"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation & Caution Dialog */}
        <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
          <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-extrabold text-red-600 dark:text-red-400">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                {deleteSummary && (deleteSummary.dcCount > 0 || deleteSummary.invoiceCount > 0)
                  ? "Caution: Active Records Associated"
                  : "Delete Hospital Profile"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {deleteSummary && (deleteSummary.dcCount > 0 || deleteSummary.invoiceCount > 0)
                  ? `"${customerToDelete?.name}" has active transaction history on record.`
                  : "Are you sure you want to delete this customer profile from your directory?"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-1 text-xs">
              {/* Target Hospital Card */}
              <div className="p-3 rounded-xl bg-muted dark:bg-slate-900 border border-border dark:border-slate-800 space-y-1">
                <div className="text-sm font-extrabold text-foreground dark:text-slate-100 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>{customerToDelete?.name}</span>
                </div>
                {customerToDelete?.address && (
                  <div className="text-muted-foreground text-[11px] truncate">
                    📍 {customerToDelete.address}
                  </div>
                )}
                {customerToDelete?.otNumber && (
                  <div className="text-[11px] text-teal-700 dark:text-teal-400 font-semibold">
                    🩺 OT Line: {customerToDelete.otNumber}
                  </div>
                )}
              </div>

              {/* Records Breakdown Warning if records found */}
              {deleteSummary && (deleteSummary.dcCount > 0 || deleteSummary.invoiceCount > 0) ? (
                <div className="space-y-3">
                  {/* Warning banner & metrics */}
                  <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-200 space-y-2.5">
                    <div className="font-bold flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        Transaction Records on File:
                      </span>
                      <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-900 dark:text-amber-200 font-bold">
                        Active History
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="p-2 rounded-lg bg-card dark:bg-slate-900 border border-amber-200 dark:border-amber-900 shadow-2xs">
                        <div className="text-lg font-black text-amber-800 dark:text-amber-300">
                          {deleteSummary.dcCount}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                          Delivery Challans
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-card dark:bg-slate-900 border border-amber-200 dark:border-amber-900 shadow-2xs">
                        <div className="text-lg font-black text-amber-800 dark:text-amber-300">
                          {deleteSummary.invoiceCount}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                          Cash Invoices
                        </div>
                      </div>
                    </div>

                    {deleteSummary.totalOutstanding > 0 && (
                      <div className="text-[11px] font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950 p-2 rounded-lg border border-red-200 dark:border-red-900 flex justify-between items-center">
                        <span>Pending Outstanding Balance:</span>
                        <span className="font-extrabold text-xs">₹{deleteSummary.totalOutstanding.toFixed(0)}</span>
                      </div>
                    )}
                  </div>

                  {/* Recommendation: Merge Customer */}
                  <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                        <GitMerge className="w-4 h-4 text-emerald-600 shrink-0" />
                        Recommended: Merge into Another Profile
                      </span>
                      <span className="text-[9.5px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300 px-2 py-0.5 rounded-full uppercase">
                        Safe Option
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground dark:text-slate-300 leading-snug">
                      Preserve all {deleteSummary.dcCount} DCs and {deleteSummary.invoiceCount} invoices by re-linking them to another hospital profile (e.g. if this name is a typo or alternate spelling).
                    </p>

                    <div className="space-y-1.5 pt-1">
                      <Label className="text-[10.5px] font-bold text-foreground dark:text-slate-300">
                        Select Destination Hospital to receive these records:
                      </Label>
                      <select
                        value={mergeTargetId}
                        onChange={(e) => setMergeTargetId(e.target.value)}
                        className="w-full h-8 text-xs font-bold rounded-md border border-emerald-300 dark:border-emerald-700 bg-card dark:bg-slate-900 px-2.5 text-foreground dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="">-- Choose Hospital to Merge Into --</option>
                        {customers
                          .filter((c) => c.id !== customerToDelete?.id)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.otNumber ? `(OT: ${c.otNumber})` : ""}
                            </option>
                          ))}
                      </select>

                      <Button
                        type="button"
                        size="sm"
                        disabled={isMerging || !mergeTargetId}
                        onClick={handleCautionMerge}
                        className="w-full h-8 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 shadow-2xs mt-1"
                      >
                        <GitMerge className="w-3.5 h-3.5" />
                        {isMerging ? "Merging..." : "Merge & Transfer All Records"}
                      </Button>
                    </div>
                  </div>

                  {/* Force Delete Option */}
                  <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 space-y-2.5">
                    <div className="text-[11px] text-muted-foreground dark:text-slate-400">
                      Or, if you really want to permanently delete this hospital profile without re-linking its records:
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-red-900 dark:text-red-300 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-red-600" />
                        Administrator Password Required
                      </Label>
                      <Input
                        id="delete-customer-admin-password-1"
                        name="delete-customer-admin-password-1"
                        type="password"
                        autoComplete="new-password"
                        aria-autocomplete="none"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        data-form-type="other"
                        placeholder="Enter password (e.g. srrortho)"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleConfirmDelete();
                        }}
                        className="h-8 text-xs font-mono border-red-300 dark:border-red-800 bg-card dark:bg-slate-900 focus-visible:ring-red-500"
                      />
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={isDeleting || isMerging || !deletePassword.trim()}
                      onClick={handleConfirmDelete}
                      className="w-full h-8 text-xs font-bold gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {isDeleting ? "Deleting..." : "Force Delete Profile Anyway"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-lg bg-muted dark:bg-slate-900 border border-border dark:border-slate-800 text-xs text-muted-foreground dark:text-slate-300">
                    No active Delivery Challans or Cash Invoices are attached to this hospital. Deletion requires administrator password.
                  </div>

                  <div className="space-y-1 p-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950">
                    <Label className="text-[11px] font-bold text-red-900 dark:text-red-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-red-600" />
                      Administrator Password Required
                    </Label>
                    <Input
                      id="delete-customer-admin-password-2"
                      name="delete-customer-admin-password-2"
                      type="password"
                      autoComplete="new-password"
                      aria-autocomplete="none"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      data-form-type="other"
                      placeholder="Enter password (e.g. srrortho)"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleConfirmDelete();
                      }}
                      className="h-8 text-xs font-mono border-red-300 dark:border-red-800 bg-card dark:bg-slate-900 focus-visible:ring-red-500"
                    />
                  </div>
                </div>
              )}

              {/* Footer Cancel Button */}
              <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setCustomerToDelete(null);
                    setDeleteSummary(null);
                    setDeletePassword("");
                  }}
                  disabled={isDeleting || isMerging}
                  className="h-8 text-xs font-bold px-4"
                >
                  Cancel &amp; Keep Profile
                </Button>
                {(!deleteSummary || (deleteSummary.dcCount === 0 && deleteSummary.invoiceCount === 0)) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={isDeleting || !deletePassword.trim()}
                    onClick={handleConfirmDelete}
                    className="h-8 text-xs font-bold gap-1.5 ml-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isDeleting ? "Deleting..." : "Delete Permanently"}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 1-Click Auto-Deduplicate Directory Modal */}
        <Dialog open={autoDeduplicateModalOpen} onOpenChange={setAutoDeduplicateModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background border-border">
            <DialogHeader className="p-5 border-b border-border bg-purple-50 dark:bg-purple-950 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-700 dark:text-purple-300 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                    ⚡ 1-Click Auto-Deduplicate Directory
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Scanned {customers.length} registered hospitals and detected {detectedClusters.length} near-duplicate profile clusters.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {detectedClusters.length === 0 ? (
                <div className="p-8 text-center space-y-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <div className="font-bold text-sm text-emerald-950 dark:text-emerald-200">
                    No Duplicate Hospital Profiles Detected!
                  </div>
                  <p className="text-xs text-emerald-800 dark:text-emerald-400 max-w-md mx-auto">
                    All registered customer profiles are clean, unified, and free of duplicate punctuation or spelling variations.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-1">
                    <span>Selected ({selectedClusterIndices.size} of {detectedClusters.length} Duplicate Groups)</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedClusterIndices.size === detectedClusters.length) {
                          setSelectedClusterIndices(new Set());
                        } else {
                          setSelectedClusterIndices(new Set(detectedClusters.map((_, i) => i)));
                        }
                      }}
                      className="text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                    >
                      {selectedClusterIndices.size === detectedClusters.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {detectedClusters.map((cluster, idx) => {
                      const isSelected = selectedClusterIndices.has(idx);
                      const isExactMatch = cluster.score >= 0.98;
                      const cardStyle = isSelected
                        ? "bg-purple-50 dark:bg-purple-950 border-purple-300 dark:border-purple-800 shadow-xs"
                        : "bg-card border-border opacity-70 hover:opacity-100";
                      const badgeStyle = isExactMatch
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300";

                      return (
                        <div
                          key={idx}
                          onClick={() => handleToggleClusterSelection(idx)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${cardStyle}`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 rounded border-purple-400 text-purple-600 focus:ring-purple-500 shrink-0"
                            />
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs text-foreground truncate">
                                  {cluster.target.name}
                                </span>
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] py-0">
                                  Keep Primary
                                </Badge>
                                {(cluster.target.otNumber || cluster.target.mobile) && (
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    📞 {cluster.target.otNumber || cluster.target.mobile}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <ArrowRight className="w-3 h-3 text-amber-500 shrink-0" />
                                <span className="line-through text-rose-600 dark:text-rose-400 font-medium truncate">
                                  {cluster.source.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-normal shrink-0">
                                  (Merge duplicate)
                                </span>
                              </div>
                            </div>
                          </div>

                          <Badge className={`shrink-0 text-[10px] font-bold ${badgeStyle}`}>
                            {Math.round(cluster.score * 100)}% Match
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-border bg-card flex items-center justify-between gap-3 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoDeduplicateModalOpen(false)}
                disabled={isBatchMerging}
                className="h-9 text-xs font-bold"
              >
                Cancel
              </Button>
              {detectedClusters.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleExecuteBatchMerge}
                  disabled={isBatchMerging || selectedClusterIndices.size === 0}
                  className="h-9 text-xs font-bold gap-1.5 bg-purple-700 hover:bg-purple-800 text-white shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isBatchMerging
                    ? "Merging Duplicates..."
                    : `Merge & Clean Selected (${selectedClusterIndices.size} Pairs)`}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Customer Cash Invoice Ledger Modal */}
        <CustomerCashLedgerModal
          customer={selectedCustomerForLedger}
          isOpen={Boolean(selectedCustomerForLedger)}
          onClose={() => setSelectedCustomerForLedger(null)}
          cachedInvoices={allCashInvoices}
        />
      </main>
    </div>
  );
}
