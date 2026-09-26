import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { TopToolbar } from "@/components/ortho/TopToolbar";
import { auth } from "@/firebase";
import { useProcedures } from "@/hooks/useProcedures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { toast } from "sonner";
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
} from "@/lib/customerStorage";
import { loadSavedDcs, SavedDc } from "@/lib/savedDcStorage";
import { findNearDuplicateHospital } from "@/lib/hospitalDuplicateDetector";

export default function Customers() {
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

    // Calculate customer dues from cash invoices if present in localStorage
    try {
      const rawInvoices = localStorage.getItem("im_saved_invoices");
      if (rawInvoices) {
        const invoices = JSON.parse(rawInvoices);
        if (Array.isArray(invoices)) {
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
      }
    } catch (e) {
      console.error("Error calculating dues:", e);
    }

    const handleUpdate = () => {
      setCustomers(deduplicateAndCleanCustomers(getSavedCustomers()));
    };
    window.addEventListener("srrortho:customers_updated", handleUpdate);
    return () => window.removeEventListener("srrortho:customers_updated", handleUpdate);
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
    <div className="min-h-screen bg-gradient-hero overflow-x-hidden flex flex-col">
      <main className="flex-grow flex flex-col w-full px-3 sm:px-6 lg:px-8 py-3 sm:py-4 overflow-x-hidden">
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

        <div className="space-y-6 pt-4 pb-12">
          {/* Header & KPI Summary */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-5 rounded-2xl border border-white/40 dark:border-slate-800 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                    Hospital &amp; Customer Directory
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Maintain complete hospital profiles with OT Numbers, Hospital Landlines, Personal Surgeon Numbers, and staff contacts.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openMergeModal()}
                className="h-9 text-xs gap-1.5 border-amber-300 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950 font-bold"
                title="Merge duplicate customer accounts and combine all phone numbers"
              >
                <GitMerge className="w-3.5 h-3.5 text-amber-600" />
                Merge Customers
              </Button>

              <Button
                size="sm"
                onClick={openAddModal}
                className="h-9 text-xs gap-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold shadow-md shadow-teal-700/20"
              >
                <Plus className="w-4 h-4" />
                Add Hospital / Customer
              </Button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-slate-200/80 bg-white/80 dark:bg-slate-900/60 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase">Hospitals</span>
                <span className="text-teal-600 font-bold text-sm">🏥</span>
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 font-display mt-1">
                {totalHospitals}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Registered accounts</p>
            </div>

            <div className="p-4 rounded-xl border border-teal-200/80 bg-teal-50/50 dark:bg-teal-950/20 dark:border-teal-900/50">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300 uppercase">OT Direct Lines</span>
                <span className="text-teal-600 font-bold text-sm">🩺</span>
              </div>
              <div className="text-2xl font-extrabold text-teal-900 dark:text-teal-200 font-display mt-1">
                {totalOtNumbers}
              </div>
              <p className="text-[10px] text-teal-700/80 dark:text-teal-400 mt-0.5">Operation theatre desks</p>
            </div>

            <div className="p-4 rounded-xl border border-purple-200/80 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-900/50">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-800 dark:text-purple-300 uppercase">Staff Contacts</span>
                <span className="text-purple-600 font-bold text-sm">👥</span>
              </div>
              <div className="text-2xl font-extrabold text-purple-900 dark:text-purple-200 font-display mt-1">
                {totalDirectContacts}
              </div>
              <p className="text-[10px] text-purple-700/80 dark:text-purple-400 mt-0.5">Doctors, sisters &amp; stores</p>
            </div>

            <div className="p-4 rounded-xl border border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase">Total Dues</span>
                <span className="text-amber-600 font-bold text-sm">⏳</span>
              </div>
              <div className="text-2xl font-extrabold text-amber-900 dark:text-amber-200 font-display mt-1">
                ₹{totalOutstanding.toFixed(0)}
              </div>
              <p className="text-[10px] text-amber-700/80 dark:text-amber-400 mt-0.5">Pending collection total</p>
            </div>
          </div>

          {/* Outdated or Unmatched DC Names Reconciliation Banner */}
          {unmatchedDcsList.length > 0 && (
            <div className="p-4 rounded-2xl border-2 border-amber-300 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in-50">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-200 dark:bg-amber-900/60 flex items-center justify-center shrink-0 text-amber-800 dark:text-amber-300">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                      Hospital Names from Delivery Challans ({unmatchedDcsList.reduce((sum, i) => sum + i.count, 0)} DCs)
                    </span>
                    <Badge className="bg-amber-200 text-amber-900 text-[10px] font-bold border-0">
                      Sync Available
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                    The following hospital or customer names exist in your DCs and can be synced or added to your customer directory:
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {unmatchedDcsList.map((item) => (
                      <span
                        key={item.rawName}
                        className="inline-flex items-center gap-1.5 text-[11px] bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900 px-2.5 py-1 rounded-lg text-slate-800 dark:text-slate-200 shadow-2xs"
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
                            <strong className="text-slate-900 dark:text-white font-bold">{item.rawName}</strong>
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
                className="pl-9 h-9 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded-xl"
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
              <div className="ml-auto sm:ml-2 flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className={`h-6 px-2.5 text-xs font-bold rounded-md gap-1.5 transition-all ${
                    viewMode === "list"
                      ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs font-extrabold border border-slate-200/60 dark:border-slate-700"
                      : "text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100"
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
                      ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs font-extrabold border border-slate-200/60 dark:border-slate-700"
                      : "text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100"
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
            <div className="p-12 text-center bg-white/60 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <Building2 className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
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
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-sm overflow-hidden backdrop-blur-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/90 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 select-none">
                      <th className="py-3.5 px-3.5 w-12 text-center">#</th>
                      <th className="py-3.5 px-4 min-w-[240px]">Hospital &amp; Location</th>
                      <th className="py-3.5 px-4 min-w-[290px]">Direct Department Lines</th>
                      <th className="py-3.5 px-4 min-w-[260px]">Staff Directory &amp; Contacts</th>
                      <th className="py-3.5 px-4 w-28 text-center">Outstanding</th>
                      <th className="py-3.5 px-4 w-48 text-right">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                    {filteredCustomers.map((cust, idx) => {
                      const balance = invoicesDuesMap[cust.name.toLowerCase().trim()] || 0;
                      return (
                        <tr
                          key={`${cust.id || "cust"}_${cust.name}_${idx}`}
                          className="hover:bg-teal-50/30 dark:hover:bg-slate-800/40 transition-colors group"
                        >
                          {/* Row Number */}
                          <td className="py-3.5 px-3.5 text-center text-slate-400 font-mono text-[11px] font-bold">
                            {String(idx + 1).padStart(2, "0")}
                          </td>

                          {/* Hospital Name & Info */}
                          <td className="py-3.5 px-4">
                            <div className="font-extrabold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-1.5">
                              <Building2 className="w-4 h-4 text-teal-600 shrink-0" />
                              <span>{cust.name}</span>
                            </div>
                            {cust.address && (
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate max-w-[280px]" title={cust.address}>
                                  {cust.address}
                                </span>
                              </div>
                            )}
                            {cust.contactPerson && (
                              <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                                <User className="w-3 h-3 text-teal-500 shrink-0" />
                                <span>Dr / Incharge: <strong className="text-slate-800 dark:text-slate-200">{cust.contactPerson}</strong></span>
                              </div>
                            )}
                            {cust.notes && (
                              <div className="text-[10px] text-amber-700 dark:text-amber-400 flex items-center gap-1 mt-1 font-medium bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded w-fit">
                                <Clock className="w-2.5 h-2.5 shrink-0" />
                                <span>{cust.notes}</span>
                              </div>
                            )}
                          </td>

                          {/* Direct Department Phone Numbers */}
                          <td className="py-3.5 px-4 space-y-1.5">
                            {/* OT Direct Line */}
                            <div className="flex items-center gap-2">
                              <span className="text-[9.5px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.5 rounded shrink-0">
                                OT
                              </span>
                              {cust.otNumber ? (
                                <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400 text-xs">
                                  <a href={`tel:${cust.otNumber}`} className="hover:underline flex items-center gap-1">
                                    <Phone className="w-2.5 h-2.5 shrink-0" />
                                    {cust.otNumber}
                                  </a>
                                  <a
                                    href={`https://wa.me/${cust.otNumber.replace(/[^0-9]/g, "")}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-emerald-600 hover:scale-110 transition-transform"
                                    title="WhatsApp OT Desk"
                                  >
                                    💬
                                  </a>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px] italic">Not set</span>
                              )}
                            </div>

                            {/* Hospital Board Line */}
                            <div className="flex items-center gap-2">
                              <span className="text-[9.5px] font-black bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 px-1.5 py-0.5 rounded shrink-0">
                                HOSP
                              </span>
                              {cust.hospitalNumber ? (
                                <a
                                  href={`tel:${cust.hospitalNumber}`}
                                  className="font-semibold text-sky-700 dark:text-sky-400 hover:underline text-xs flex items-center gap-1"
                                >
                                  <Phone className="w-2.5 h-2.5 shrink-0" />
                                  {cust.hospitalNumber}
                                </a>
                              ) : (
                                <span className="text-slate-400 text-[11px] italic">Not set</span>
                              )}
                            </div>

                            {/* Personal Doctor Mobile */}
                            <div className="flex items-center gap-2">
                              <span className="text-[9.5px] font-black bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 px-1.5 py-0.5 rounded shrink-0">
                                PERS
                              </span>
                              {cust.personalNumber || cust.mobile ? (
                                <div className="flex items-center gap-1.5 font-semibold text-purple-700 dark:text-purple-400 text-xs">
                                  <a
                                    href={`tel:${cust.personalNumber || cust.mobile}`}
                                    className="hover:underline flex items-center gap-1"
                                  >
                                    <Phone className="w-2.5 h-2.5 shrink-0" />
                                    {cust.personalNumber || cust.mobile}
                                  </a>
                                  <a
                                    href={`https://wa.me/${(cust.personalNumber || cust.mobile || "").replace(
                                      /[^0-9]/g,
                                      ""
                                    )}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-emerald-600 hover:scale-110 transition-transform"
                                    title="WhatsApp Doctor"
                                  >
                                    💬
                                  </a>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px] italic">Not set</span>
                              )}
                            </div>
                          </td>

                          {/* Staff Directory & Key Contacts */}
                          <td className="py-3.5 px-4">
                            {Array.isArray(cust.contacts) && cust.contacts.length > 0 ? (
                              <div className="space-y-1">
                                {cust.contacts.slice(0, 2).map((c, i) => (
                                  <div key={i} className="flex items-center justify-between gap-1 text-[11px]">
                                    <span className="truncate max-w-[150px]">
                                      <span className="font-bold text-slate-700 dark:text-slate-300">
                                        {c.role || "Staff"}:
                                      </span>{" "}
                                      {c.name}
                                    </span>
                                    {c.phone && (
                                      <a
                                        href={`tel:${c.phone}`}
                                        className="text-teal-700 dark:text-teal-400 font-semibold hover:underline flex items-center gap-0.5 shrink-0"
                                      >
                                        <Phone className="w-2.5 h-2.5" />
                                        {c.phone}
                                      </a>
                                    )}
                                  </div>
                                ))}
                                {cust.contacts.length > 2 && (
                                  <button
                                    onClick={() => setSelectedHospitalForContacts(cust)}
                                    className="text-[10px] font-bold text-teal-600 dark:text-teal-400 hover:underline pt-0.5 block"
                                  >
                                    +{cust.contacts.length - 2} more staff contacts...
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => openEditModal(cust)}
                                className="text-[11px] text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center gap-1 border border-dashed border-slate-200 dark:border-slate-800 px-2 py-1 rounded-md"
                              >
                                <Plus className="w-3 h-3" /> Add Staff Contacts
                              </button>
                            )}
                          </td>

                          {/* Outstanding Balance */}
                          <td className="py-3.5 px-4 text-center">
                            {balance > 0 ? (
                              <Badge className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-[10.5px] font-bold">
                                ₹{balance.toFixed(0)}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 font-semibold">
                                Clear
                              </Badge>
                            )}
                          </td>

                          {/* Quick Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  navigate(`/?mode=procedure&hospital=${encodeURIComponent(cust.name)}`)
                                }
                                className="h-7 text-[11px] gap-1 border-teal-300 text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950 font-bold px-2 shadow-2xs"
                                title="Create Delivery Challan for this hospital"
                              >
                                <FileText className="w-3 h-3 text-teal-600" /> + DC
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  navigate(`/cash-invoice?client=${encodeURIComponent(cust.name)}`)
                                }
                                className="h-7 text-[11px] gap-1 border-slate-300 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold px-2 shadow-2xs"
                                title="Create Cash Memo / Invoice"
                              >
                                <Receipt className="w-3 h-3 text-slate-600" /> + Bill
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openMergeModal(cust)}
                                className="h-7 w-7 text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                                title={`Merge "${cust.name}" into another profile...`}
                              >
                                <GitMerge className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEditModal(cust)}
                                className="h-7 w-7 text-slate-500 hover:text-teal-700"
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
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div>
                      {/* Top Row: Name & Quick Dues Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm leading-snug">
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
                        {balance > 0 ? (
                          <Badge className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-[10px] font-bold">
                            Due ₹{balance.toFixed(0)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200">
                            Clear
                          </Badge>
                        )}
                      </div>

                      {/* Phone Numbers Box */}
                      <div className="mt-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 space-y-2">
                        {/* OT Direct Number */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 font-bold text-teal-800 dark:text-teal-300">
                            <span className="text-[9.5px] font-black bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 px-1.5 py-0.5 rounded">
                              OT
                            </span>
                            OT Line:
                          </span>
                          {cust.otNumber ? (
                            <div className="flex items-center gap-1">
                              <a
                                href={`tel:${cust.otNumber}`}
                                className="font-bold text-teal-700 dark:text-teal-400 hover:underline"
                              >
                                {cust.otNumber}
                              </a>
                              <a
                                href={`https://wa.me/${cust.otNumber.replace(/[^0-9]/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-600 hover:scale-110 transition-transform text-xs"
                                title="Chat on WhatsApp"
                              >
                                💬
                              </a>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[10px] italic">Not set</span>
                          )}
                        </div>

                        {/* Hospital Board Number */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 font-bold text-sky-800 dark:text-sky-300">
                            <span className="text-[9.5px] font-black bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 px-1.5 py-0.5 rounded">
                              HOSP
                            </span>
                            Reception:
                          </span>
                          {cust.hospitalNumber ? (
                            <a
                              href={`tel:${cust.hospitalNumber}`}
                              className="font-bold text-sky-700 dark:text-sky-400 hover:underline"
                            >
                              {cust.hospitalNumber}
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-[10px] italic">Not set</span>
                          )}
                        </div>

                        {/* Personal Number */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 font-bold text-purple-800 dark:text-purple-300">
                            <span className="text-[9.5px] font-black bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 px-1.5 py-0.5 rounded">
                              PERS
                            </span>
                            Doctor / Mobile:
                          </span>
                          {cust.personalNumber || cust.mobile ? (
                            <div className="flex items-center gap-1">
                              <a
                                href={`tel:${cust.personalNumber || cust.mobile}`}
                                className="font-bold text-purple-700 dark:text-purple-400 hover:underline"
                              >
                                {cust.personalNumber || cust.mobile}
                              </a>
                              <a
                                href={`https://wa.me/${(cust.personalNumber || cust.mobile || "").replace(
                                  /[^0-9]/g,
                                  ""
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-600 hover:scale-110 transition-transform text-xs"
                                title="Chat on WhatsApp"
                              >
                                💬
                              </a>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[10px] italic">Not set</span>
                          )}
                        </div>
                      </div>

                      {/* Primary Contact Person & Staff */}
                      {(cust.contactPerson || (cust.contacts && cust.contacts.length > 0)) && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                          {cust.contactPerson && (
                            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 mb-1">
                              <User className="w-3.5 h-3.5 text-teal-600" />
                              <span>{cust.contactPerson}</span>
                            </div>
                          )}
                          {Array.isArray(cust.contacts) && cust.contacts.length > 0 && (
                            <div className="space-y-1 mt-1">
                              {cust.contacts.map((c, i) => (
                                <div
                                  key={i}
                                  className="text-[11px] text-muted-foreground flex items-center justify-between"
                                >
                                  <span className="truncate max-w-[150px]">
                                    <span className="font-bold text-slate-700 dark:text-slate-300">
                                      {c.role || "Staff"}:
                                    </span>{" "}
                                    {c.name || "Contact"}
                                  </span>
                                  {c.phone && (
                                    <a
                                      href={`tel:${c.phone}`}
                                      className="text-teal-700 font-semibold hover:underline"
                                    >
                                      {c.phone}
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Notes / Timings */}
                      {cust.notes && (
                        <div className="mt-2 p-1.5 rounded-md bg-amber-50/60 dark:bg-amber-950/20 text-[10.5px] text-amber-800 dark:text-amber-300 flex items-center gap-1">
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
                          onClick={() =>
                            navigate(`/cash-invoice?client=${encodeURIComponent(cust.name)}`)
                          }
                          className="h-7 text-[11px] gap-1 border-slate-300 text-slate-700 hover:bg-slate-50 font-bold"
                          title="Create Cash Invoice for this hospital"
                        >
                          <Receipt className="w-3 h-3 text-slate-600" /> Cash Memo
                        </Button>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openMergeModal(cust)}
                          className="h-7 w-7 text-slate-500 hover:text-amber-600 hover:bg-amber-50"
                          title="Merge hospital..."
                        >
                          <GitMerge className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditModal(cust)}
                          className="h-7 w-7 text-slate-500 hover:text-teal-700"
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
                  <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
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
                  <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
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
                  <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
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
                  <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
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
              <div className="p-3.5 rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/30 dark:bg-teal-950/20 space-y-3">
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
                    <span className="text-[11px] font-bold text-slate-500">Quick Add:</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddRoleContact("OT Person")}
                      className="h-6 px-2 text-[11px] font-bold border-emerald-300 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 bg-white dark:bg-slate-900"
                    >
                      <Plus className="w-2.5 h-2.5 mr-0.5 text-emerald-600" /> OT Person
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddRoleContact("Accounts")}
                      className="h-6 px-2 text-[11px] font-bold border-amber-300 text-amber-800 dark:text-amber-300 hover:bg-amber-50 bg-white dark:bg-slate-900"
                    >
                      <Plus className="w-2.5 h-2.5 mr-0.5 text-amber-600" /> Accounts
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddRoleContact("Reception")}
                      className="h-6 px-2 text-[11px] font-bold border-sky-300 text-sky-800 dark:text-sky-300 hover:bg-sky-50 bg-white dark:bg-slate-900"
                    >
                      <Plus className="w-2.5 h-2.5 mr-0.5 text-sky-600" /> Reception
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddRoleContact("Doctor")}
                      className="h-6 px-2 text-[11px] font-bold border-purple-300 text-purple-800 dark:text-purple-300 hover:bg-purple-50 bg-white dark:bg-slate-900"
                    >
                      <Plus className="w-2.5 h-2.5 mr-0.5 text-purple-600" /> Doctor
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddRoleContact("Others")}
                      className="h-6 px-2 text-[11px] font-bold border-slate-300 text-slate-700 dark:text-slate-300 hover:bg-slate-100 bg-white dark:bg-slate-900"
                    >
                      <Plus className="w-2.5 h-2.5 mr-0.5" /> Others
                    </Button>
                  </div>
                </div>

                {/* Contacts List Rows */}
                {formContacts.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground border border-dashed rounded-lg bg-white/60 dark:bg-slate-900/60">
                    No contacts added yet. Click one of the buttons above to add.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {formContacts.map((contact, idx) => (
                      <div
                        key={contact.id || idx}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs"
                      >
                        {/* 1. Category / Role Selection - ONLY the 5 clean options! */}
                        <div className="sm:col-span-4">
                          <select
                            value={contact.role}
                            onChange={(e) => handleUpdateContact(idx, "role", e.target.value)}
                            className="w-full h-8 text-xs font-bold rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-600"
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
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
                <Building2 className="w-5 h-5 text-teal-600" />
                {selectedHospitalForContacts?.name} — Staff Directory
              </DialogTitle>
              <DialogDescription className="text-xs">
                Direct contacts for surgeons, OT incharge, nursing staff, and store managers.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              {/* Department Numbers Summary */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <div className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">OT Desk</div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                    {selectedHospitalForContacts?.otNumber || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-sky-700 dark:text-sky-400">Board Line</div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                    {selectedHospitalForContacts?.hospitalNumber || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-purple-700 dark:text-purple-400">Doctor Mobile</div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                    {selectedHospitalForContacts?.personalNumber || selectedHospitalForContacts?.mobile || "—"}
                  </div>
                </div>
              </div>

              {/* Staff List */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                {selectedHospitalForContacts?.contacts && selectedHospitalForContacts.contacts.length > 0 ? (
                  selectedHospitalForContacts.contacts.map((c, i) => (
                    <div key={i} className="p-3 flex items-center justify-between gap-3 text-xs bg-white dark:bg-slate-900">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                          <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span>{c.name}</span>
                          <Badge variant="outline" className="text-[9.5px] px-1.5 py-0 text-slate-600 dark:text-slate-300">
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
                <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      1. Primary Profile (To Keep &amp; Update)
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                      Destination
                    </span>
                  </div>

                  <select
                    value={mergeTargetId}
                    onChange={(e) => setMergeTargetId(e.target.value)}
                    className="w-full h-9 text-xs font-bold rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 px-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60 space-y-1">
                        <div className="font-bold text-slate-900 dark:text-slate-100 truncate">{target.name}</div>
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
                    className="h-7 px-3 text-[11px] font-bold rounded-full border-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 shadow-xs flex items-center gap-1.5"
                    title="Swap Destination and Duplicate profiles"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                    Swap Keep &amp; Merge
                  </Button>
                </div>

                {/* 2. Duplicate Hospital (Merge & Remove) */}
                <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      2. Duplicate Profile (To Merge &amp; Delete)
                    </span>
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-full">
                      Source
                    </span>
                  </div>

                  <select
                    value={mergeSourceId}
                    onChange={(e) => setMergeSourceId(e.target.value)}
                    className="w-full h-9 text-xs font-bold rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 px-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800/60 space-y-1">
                        <div className="font-bold text-slate-900 dark:text-slate-100 truncate">{source.name}</div>
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
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <div className="font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider">
                  Merge Settings:
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={mergeCombineNotes}
                    onChange={(e) => setMergeCombineNotes(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Combine notes, address and remarks into primary profile</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={mergeUpdateDcs}
                    onChange={(e) => setMergeUpdateDcs(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Update past Delivery Challans with primary hospital name</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
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
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11.5px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
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
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
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
                  <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 space-y-2.5">
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
                      <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 shadow-2xs">
                        <div className="text-lg font-black text-amber-800 dark:text-amber-300">
                          {deleteSummary.dcCount}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                          Delivery Challans
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 shadow-2xs">
                        <div className="text-lg font-black text-amber-800 dark:text-amber-300">
                          {deleteSummary.invoiceCount}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                          Cash Invoices
                        </div>
                      </div>
                    </div>

                    {deleteSummary.totalOutstanding > 0 && (
                      <div className="text-[11px] font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2 rounded-lg border border-red-200 dark:border-red-900/50 flex justify-between items-center">
                        <span>Pending Outstanding Balance:</span>
                        <span className="font-extrabold text-xs">₹{deleteSummary.totalOutstanding.toFixed(0)}</span>
                      </div>
                    )}
                  </div>

                  {/* Recommendation: Merge Customer */}
                  <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                        <GitMerge className="w-4 h-4 text-emerald-600 shrink-0" />
                        Recommended: Merge into Another Profile
                      </span>
                      <span className="text-[9.5px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 px-2 py-0.5 rounded-full uppercase">
                        Safe Option
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                      Preserve all {deleteSummary.dcCount} DCs and {deleteSummary.invoiceCount} invoices by re-linking them to another hospital profile (e.g. if this name is a typo or alternate spelling).
                    </p>

                    <div className="space-y-1.5 pt-1">
                      <Label className="text-[10.5px] font-bold text-slate-700 dark:text-slate-300">
                        Select Destination Hospital to receive these records:
                      </Label>
                      <select
                        value={mergeTargetId}
                        onChange={(e) => setMergeTargetId(e.target.value)}
                        className="w-full h-8 text-xs font-bold rounded-md border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 px-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/10 space-y-2.5">
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      Or, if you really want to permanently delete this hospital profile without re-linking its records:
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-red-900 dark:text-red-300 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-red-600" />
                        Administrator Password Required
                      </Label>
                      <Input
                        type="password"
                        autoComplete="off"
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
                        className="h-8 text-xs font-mono border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 focus-visible:ring-red-500"
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
                  <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                    No active Delivery Challans or Cash Invoices are attached to this hospital. Deletion requires administrator password.
                  </div>

                  <div className="space-y-1 p-3 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/10">
                    <Label className="text-[11px] font-bold text-red-900 dark:text-red-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-red-600" />
                      Administrator Password Required
                    </Label>
                    <Input
                      type="password"
                      autoComplete="off"
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
                      className="h-8 text-xs font-mono border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 focus-visible:ring-red-500"
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
      </main>
    </div>
  );
}
