import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Layers,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Truck,
  UserCheck,
  UserPlus,
  Users,
  Building2,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Edit2,
  Phone,
  GitMerge,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { loadSavedDcs, SavedDc } from "@/lib/savedDcStorage";
import {
  Personnel,
  PersonnelRole,
  getSavedPersonnel,
  savePersonnelList,
  addPersonnel,
  updatePersonnel,
  deletePersonnel,
  syncPersonnelFromDcs,
  normalizePersonnelName,
  mergePersonnel,
} from "@/lib/personnelStorage";

interface DeliveryPersonnelAdminProps {
  onBack: () => void;
}

export const DeliveryPersonnelAdmin: React.FC<DeliveryPersonnelAdminProps> = ({ onBack }) => {
  const { toast } = useToast();

  const [dcs, setDcs] = useState<SavedDc[]>([]);
  const [loading, setLoading] = useState(true);
  const [personnel, setPersonnel] = useState<Personnel[]>(getSavedPersonnel);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPersonFilter, setSelectedPersonFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<"all" | "7d" | "30d" | "this_month">("all");
  const [activeTab, setActiveTab] = useState("leaderboard");

  // Modal states
  const [addPersonModalOpen, setAddPersonModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Personnel | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [roleInput, setRoleInput] = useState<PersonnelRole>("Delivery Executive");
  const [notesInput, setNotesInput] = useState("");

  // Merge duplicates modal states
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [isMerging, setIsMerging] = useState(false);

  // Load data
  const fetchData = async () => {
    setLoading(true);
    try {
      let loadedDcs = await loadSavedDcs();

      // Auto-detect and merge "Prashanth" variations if present across loaded DCs
      const prashanthVariants = ["prasanth", "prashant", "prasanth kumar", "prashanth k"];
      const hasPrashanthDuplicates = loadedDcs.some((d) => {
        const deliv = d.deliveredBy?.trim().toLowerCase() || "";
        const ret = d.returnedBy?.trim().toLowerCase() || "";
        return prashanthVariants.includes(deliv) || prashanthVariants.includes(ret);
      });

      if (hasPrashanthDuplicates) {
        const mergeRes = await mergePersonnel(prashanthVariants, "Prashanth", loadedDcs);
        if (mergeRes.mergedDcsCount > 0) {
          loadedDcs = await loadSavedDcs();
          toast({
            title: "Duplicates Merged",
            description: `Consolidated ${mergeRes.mergedDcsCount} DC(s) with Prashanth variations into "Prashanth".`,
          });
        }
      }

      setDcs(loadedDcs);
      // Auto-sync any names from DCs
      const synced = syncPersonnelFromDcs(loadedDcs);
      setPersonnel(synced);
    } catch (err) {
      console.error("Error loading delivery data:", err);
      toast({
        title: "Error Loading Data",
        description: "Failed to load delivery challans.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handlePersonnelUpdate = () => {
      setPersonnel(getSavedPersonnel());
    };
    window.addEventListener("srrortho:personnel_updated", handlePersonnelUpdate);
    return () => {
      window.removeEventListener("srrortho:personnel_updated", handlePersonnelUpdate);
    };
  }, []);

  // Filter DCs by date range
  const filteredDcs = useMemo(() => {
    const now = new Date();
    return dcs.filter((dc) => {
      if (dc.status === "cancelled") return false;

      // Date filtering
      if (dateFilter !== "all" && dc.savedAt) {
        const dcDate = new Date(dc.savedAt);
        if (dateFilter === "7d") {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          if (dcDate < sevenDaysAgo) return false;
        } else if (dateFilter === "30d") {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);
          if (dcDate < thirtyDaysAgo) return false;
        } else if (dateFilter === "this_month") {
          if (
            dcDate.getMonth() !== now.getMonth() ||
            dcDate.getFullYear() !== now.getFullYear()
          ) {
            return false;
          }
        }
      }

      // Search query filtering
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDc = dc.dcNo?.toLowerCase().includes(q);
        const matchesHosp = dc.hospitalName?.toLowerCase().includes(q);
        const matchesDeliv = dc.deliveredBy?.toLowerCase().includes(q);
        const matchesRet = dc.returnedBy?.toLowerCase().includes(q);
        const matchesItems = dc.items?.some((it) => it.name?.toLowerCase().includes(q));
        if (!matchesDc && !matchesHosp && !matchesDeliv && !matchesRet && !matchesItems) {
          return false;
        }
      }

      return true;
    });
  }, [dcs, dateFilter, searchQuery]);

  // Comprehensive analytics per person
  const personnelStats = useMemo(() => {
    // Map of normalized person name -> statistics
    type Stat = {
      name: string;
      officialRecord?: Personnel;
      totalDcs: number;
      totalItems: number;
      pendingReturnsCount: number;
      completedReturnsCount: number;
      invoicedCount: number;
      cashCount: number;
      hospitals: Set<string>;
      itemsDeliveredMap: Map<string, { name: string; quantity: number; category?: string }>;
      dcs: SavedDc[];
      // Returns handled (where this person picked up the return)
      totalReturnsCollected: number;
      lastActiveDate?: string;
    };

    const statsMap = new Map<string, Stat>();

    const getOrCreate = (name: string): Stat => {
      const canonical = normalizePersonnelName(name);
      const key = canonical.toLowerCase();
      if (!statsMap.has(key)) {
        const official = personnel.find((p) => normalizePersonnelName(p.name).toLowerCase() === key);
        statsMap.set(key, {
          name: official ? official.name : canonical,
          officialRecord: official,
          totalDcs: 0,
          totalItems: 0,
          pendingReturnsCount: 0,
          completedReturnsCount: 0,
          invoicedCount: 0,
          cashCount: 0,
          hospitals: new Set(),
          itemsDeliveredMap: new Map(),
          dcs: [],
          totalReturnsCollected: 0,
        });
      }
      return statsMap.get(key)!;
    };

    // Ensure all registered personnel are in the map
    personnel.forEach((p) => {
      getOrCreate(p.name);
    });

    // Populate from filtered DCs
    filteredDcs.forEach((dc) => {
      // 1. Deliveries analysis
      const delivererName = normalizePersonnelName(dc.deliveredBy);
      if (delivererName) {
        const stat = getOrCreate(delivererName);
        stat.totalDcs += 1;
        stat.dcs.push(dc);

        if (dc.hospitalName) stat.hospitals.add(dc.hospitalName);

        // Count items
        const dcItemCount = dc.items?.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0) || 0;
        stat.totalItems += dcItemCount;

        // Group items
        dc.items?.forEach((item) => {
          const itKey = item.name.trim().toLowerCase();
          const existing = stat.itemsDeliveredMap.get(itKey);
          const qty = Number(item.quantity) || 1;
          if (existing) {
            existing.quantity += qty;
          } else {
            stat.itemsDeliveredMap.set(itKey, {
              name: item.name.trim(),
              quantity: qty,
              category: item.category,
            });
          }
        });

        // Status counts
        if (dc.status === "pending") {
          stat.pendingReturnsCount += 1;
        } else if (dc.status === "returned") {
          stat.completedReturnsCount += 1;
        } else if (dc.status === "invoiced") {
          stat.invoicedCount += 1;
        } else if (dc.status === "cash" || dc.status === "completed") {
          stat.cashCount += 1;
        }

        // Track last active date
        if (dc.savedAt) {
          if (!stat.lastActiveDate || new Date(dc.savedAt) > new Date(stat.lastActiveDate)) {
            stat.lastActiveDate = dc.savedAt;
          }
        }
      }

      // 2. Returns collected analysis
      const returnerName = normalizePersonnelName(dc.returnedBy);
      if (returnerName) {
        const returnerStat = getOrCreate(returnerName);
        returnerStat.totalReturnsCollected += 1;
      }
    });

    return Array.from(statsMap.values()).sort((a, b) => b.totalDcs - a.totalDcs);
  }, [filteredDcs, personnel]);

  // Overall Global KPI Totals
  const globalKpis = useMemo(() => {
    const totalDcs = filteredDcs.length;
    const totalItems = filteredDcs.reduce((acc, dc) => {
      return acc + (dc.items?.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0) || 0);
    }, 0);

    const activePersonnel = personnelStats.filter((p) => p.totalDcs > 0 || p.totalReturnsCollected > 0).length;
    const pendingReturns = filteredDcs.filter((d) => d.status === "pending").length;
    const completedReturns = filteredDcs.filter((d) => d.status !== "pending").length;
    const returnRate = totalDcs > 0 ? Math.round((completedReturns / totalDcs) * 100) : 0;

    const starDeliverer = personnelStats.length > 0 && personnelStats[0].totalDcs > 0
      ? personnelStats[0]
      : null;

    return {
      totalDcs,
      totalItems,
      activePersonnel,
      totalPersonnelCount: personnel.length,
      pendingReturns,
      completedReturns,
      returnRate,
      starDeliverer,
    };
  }, [filteredDcs, personnelStats, personnel]);

  // Item-level aggregate analysis (What was delivered across all or selected person)
  const itemDeliveryBreakdown = useMemo(() => {
    const targetDcs =
      selectedPersonFilter === "all"
        ? filteredDcs
        : filteredDcs.filter(
            (dc) =>
              normalizePersonnelName(dc.deliveredBy).toLowerCase() ===
              normalizePersonnelName(selectedPersonFilter).toLowerCase()
          );

    const itemMap = new Map<
      string,
      {
        name: string;
        totalQuantity: number;
        dcCount: number;
        hospitals: Set<string>;
        deliverers: Map<string, number>;
        pendingCount: number;
        returnedCount: number;
      }
    >();

    targetDcs.forEach((dc) => {
      const deliverer = normalizePersonnelName(dc.deliveredBy) || "Unspecified";
      const isPending = dc.status === "pending";

      dc.items?.forEach((it) => {
        const key = it.name.trim().toLowerCase();
        const qty = Number(it.quantity) || 1;

        if (!itemMap.has(key)) {
          itemMap.set(key, {
            name: it.name.trim(),
            totalQuantity: 0,
            dcCount: 0,
            hospitals: new Set(),
            deliverers: new Map(),
            pendingCount: 0,
            returnedCount: 0,
          });
        }

        const entry = itemMap.get(key)!;
        entry.totalQuantity += qty;
        entry.dcCount += 1;
        if (dc.hospitalName) entry.hospitals.add(dc.hospitalName);
        entry.deliverers.set(deliverer, (entry.deliverers.get(deliverer) || 0) + qty);

        if (isPending) {
          entry.pendingCount += qty;
        } else {
          entry.returnedCount += qty;
        }
      });
    });

    return Array.from(itemMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
  }, [filteredDcs, selectedPersonFilter]);

  // Outstanding/Pending returns at hospitals breakdown
  const pendingDeliveriesList = useMemo(() => {
    return filteredDcs
      .filter((d) => d.status === "pending")
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  }, [filteredDcs]);

  // Handle Save New or Edit Personnel
  const handleSavePersonnel = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      toast({
        title: "Name is Required",
        description: "Please enter the personnel name.",
        variant: "destructive",
      });
      return;
    }

    if (editingPerson) {
      updatePersonnel(editingPerson.id, {
        name: trimmed,
        phone: phoneInput.trim(),
        role: roleInput,
        notes: notesInput.trim(),
      });
      toast({
        title: "Personnel Updated",
        description: `Updated details for ${trimmed}.`,
      });
    } else {
      addPersonnel(trimmed, {
        phone: phoneInput.trim(),
        role: roleInput,
        notes: notesInput.trim(),
      });
      toast({
        title: "Personnel Added",
        description: `${trimmed} added to delivery personnel directory.`,
      });
    }

    setPersonnel(getSavedPersonnel());
    setAddPersonModalOpen(false);
    setEditingPerson(null);
    setNameInput("");
    setPhoneInput("");
    setRoleInput("Delivery Executive");
    setNotesInput("");
  };

  const handleOpenEdit = (p: Personnel) => {
    setEditingPerson(p);
    setNameInput(p.name);
    setPhoneInput(p.phone || "");
    setRoleInput(p.role);
    setNotesInput(p.notes || "");
    setAddPersonModalOpen(true);
  };

  const handleDeletePerson = (id: string, name: string) => {
    if (confirm(`Remove ${name} from personnel directory?`)) {
      deletePersonnel(id);
      setPersonnel(getSavedPersonnel());
      toast({
        title: "Removed",
        description: `${name} has been removed from directory.`,
      });
    }
  };

  // Detect potential duplicate personnel candidates
  const detectedDuplicates = useMemo(() => {
    const candidates: Array<{ source: string; target: string; reason: string }> = [];
    const names = personnel.map((p) => p.name);

    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = names[i].trim();
        const b = names[j].trim();
        const normA = normalizePersonnelName(a).toLowerCase();
        const normB = normalizePersonnelName(b).toLowerCase();

        if (normA === normB && a.toLowerCase() !== b.toLowerCase()) {
          candidates.push({ source: b, target: a, reason: "Spelling / alias variant" });
        } else if (
          a.toLowerCase().replace(/h/g, "") === b.toLowerCase().replace(/h/g, "") &&
          a.toLowerCase() !== b.toLowerCase()
        ) {
          const target = a.toLowerCase().includes("sh") ? a : b;
          const source = target === a ? b : a;
          candidates.push({ source, target, reason: "Phonetic variation" });
        }
      }
    }
    return candidates;
  }, [personnel]);

  const handleExecuteMerge = async (source: string, target: string) => {
    const cleanSource = source.trim();
    const cleanTarget = target.trim();
    if (!cleanSource || !cleanTarget) {
      toast({
        title: "Selection Required",
        description: "Please select both a duplicate to merge and a target name.",
        variant: "destructive",
      });
      return;
    }
    if (cleanSource.toLowerCase() === cleanTarget.toLowerCase()) {
      toast({
        title: "Identical Names",
        description: "Cannot merge a person into themselves.",
        variant: "destructive",
      });
      return;
    }

    setIsMerging(true);
    try {
      const res = await mergePersonnel([cleanSource], cleanTarget, dcs);
      toast({
        title: "Personnel Merged Successfully",
        description: `Consolidated "${cleanSource}" into "${res.targetPersonnel.name}". Updated ${res.mergedDcsCount} DC(s).`,
      });
      setMergeModalOpen(false);
      setMergeSource("");
      setMergeTarget("");
      await fetchData();
    } catch (e) {
      console.error("Error executing merge:", e);
      toast({
        title: "Merge Failed",
        description: "An error occurred while merging records.",
        variant: "destructive",
      });
    } finally {
      setIsMerging(false);
    }
  };

  // Export Delivery Analysis to CSV
  const handleExportCSV = () => {
    const headers = [
      "Personnel Name",
      "Role",
      "Total DCs Delivered",
      "Total Items Delivered",
      "Pending Returns Count",
      "Completed Returns Count",
      "Returns Collected By Person",
      "Hospitals Serviced Count",
      "Last Active Date",
    ];

    const rows = personnelStats.map((p) => [
      `"${p.name}"`,
      `"${p.officialRecord?.role || "Staff"}"`,
      p.totalDcs,
      p.totalItems,
      p.pendingReturnsCount,
      p.completedReturnsCount,
      p.totalReturnsCollected,
      p.hospitals.size,
      p.lastActiveDate ? new Date(p.lastActiveDate).toLocaleDateString("en-IN") : "-",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `srrortho_delivery_analysis_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Report Exported",
      description: "Delivery analytics downloaded as CSV.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation & Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack} className="gap-1.5 h-9 px-3">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-semibold text-xs">Back to Choice</span>
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Truck className="w-5 h-5 text-teal-600" />
              Delivery &amp; Field Personnel Analytics
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Complete operational analysis: who delivered what, items volume, hospital coverage, and return tracking.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-8 text-xs gap-1.5 border-teal-300 text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setMergeModalOpen(true)}
            className="h-8 text-xs gap-1.5 border-amber-300 text-amber-900 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950 font-bold"
          >
            <GitMerge className="w-3.5 h-3.5 text-amber-600" />
            Merge Duplicates {detectedDuplicates.length > 0 ? `(${detectedDuplicates.length})` : ""}
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setEditingPerson(null);
              setNameInput("");
              setPhoneInput("");
              setRoleInput("Delivery Executive");
              setNotesInput("");
              setAddPersonModalOpen(true);
            }}
            className="h-8 text-xs font-bold gap-1.5 bg-teal-700 hover:bg-teal-800 text-white shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Personnel
          </Button>
        </div>
      </div>

      {/* Detected Duplicates Alert Banner */}
      {detectedDuplicates.length > 0 && (
        <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/90 dark:bg-amber-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-black">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-amber-950 dark:text-amber-200">
                Potential Duplicate People Detected
              </div>
              <div className="text-[11px] text-amber-800 dark:text-amber-300 truncate">
                {detectedDuplicates.map((d) => `"${d.source}" → "${d.target}"`).join(", ")}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              const first = detectedDuplicates[0];
              setMergeSource(first.source);
              setMergeTarget(first.target);
              setMergeModalOpen(true);
            }}
            className="h-7 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shrink-0 shadow-xs"
          >
            <GitMerge className="w-3.5 h-3.5" />
            Merge Duplicates
          </Button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="personnel-search-input"
            name="personnel_search_query"
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
            placeholder="Search person, hospital, item or DC#..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-slate-700"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-teal-600" />
            Period:
          </span>
          <Select
            value={dateFilter}
            onValueChange={(val: any) => setDateFilter(val)}
          >
            <SelectTrigger className="h-8 text-xs w-[130px] font-medium bg-slate-50 dark:bg-slate-950">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Time</SelectItem>
              <SelectItem value="7d" className="text-xs">Last 7 Days</SelectItem>
              <SelectItem value="30d" className="text-xs">Last 30 Days</SelectItem>
              <SelectItem value="this_month" className="text-xs">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Global Executive KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card className="rounded-xl border border-teal-500/20 bg-gradient-to-br from-teal-50/60 to-white dark:from-teal-950/20 dark:to-slate-900 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-teal-800 dark:text-teal-300 uppercase tracking-wider">
                Total DCs Delivered
              </p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                {globalKpis.totalDcs}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Across {globalKpis.activePersonnel} active personnel
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Package className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-slate-900 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                Total Items &amp; Implants
              </p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                {globalKpis.totalItems}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Delivered to hospitals
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-slate-900 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                Pending Returns
              </p>
              <h3 className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1">
                {globalKpis.pendingReturns}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Return Rate: {globalKpis.returnRate}%
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs font-black">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-50/60 to-white dark:from-purple-950/20 dark:to-slate-900 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-purple-800 dark:text-purple-300 uppercase tracking-wider">
                Star Deliverer
              </p>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 mt-1 truncate max-w-[130px]">
                {globalKpis.starDeliverer?.name || "None yet"}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                {globalKpis.starDeliverer ? `${globalKpis.starDeliverer.totalDcs} DCs (${globalKpis.starDeliverer.totalItems} items)` : "-"}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <UserCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabbed Analysis Sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl grid grid-cols-2 sm:grid-cols-4 h-auto gap-1 border border-slate-200 dark:border-slate-800">
          <TabsTrigger value="leaderboard" className="text-xs py-1.5 font-bold gap-1.5">
            <Users className="w-3.5 h-3.5 text-teal-600" />
            Personnel Leaderboard
          </TabsTrigger>
          <TabsTrigger value="what_delivered" className="text-xs py-1.5 font-bold gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            What Delivered (Item Analysis)
          </TabsTrigger>
          <TabsTrigger value="pending_returns" className="text-xs py-1.5 font-bold gap-1.5">
            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
            Pending Returns ({globalKpis.pendingReturns})
          </TabsTrigger>
          <TabsTrigger value="roster" className="text-xs py-1.5 font-bold gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-purple-600" />
            Manage Personnel Directory
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PERSONNEL LEADERBOARD */}
        <TabsContent value="leaderboard" className="space-y-4">
          <Card className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <CardHeader className="p-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Users className="w-4 h-4 text-teal-600" />
                    Delivery Personnel Performance &amp; Activity
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Overview of all delivery staff, volume delivered, pending returns, and hospitals covered.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="self-start sm:self-auto text-xs px-2.5 py-0.5">
                  {personnelStats.length} Personnel Tracked
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-muted-foreground border-b border-slate-200 dark:border-slate-800 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4">Personnel Name</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3 text-center">DCs Delivered</th>
                    <th className="py-2.5 px-3 text-center">Items Delivered</th>
                    <th className="py-2.5 px-3 text-center">Pending Return</th>
                    <th className="py-2.5 px-3 text-center">Returns Handled</th>
                    <th className="py-2.5 px-3">Hospitals Covered</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {personnelStats.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-muted-foreground text-xs">
                        No delivery activity recorded for the selected filter.
                      </td>
                    </tr>
                  ) : (
                    personnelStats.map((stat, idx) => (
                      <tr
                        key={stat.name}
                        className="hover:bg-teal-50/40 dark:hover:bg-teal-950/20 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-200 flex items-center justify-center font-bold text-xs shrink-0 border border-teal-200 dark:border-teal-800">
                              {stat.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                {stat.name}
                                {idx === 0 && stat.totalDcs > 0 && (
                                  <Badge className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-[9px] h-4 px-1 font-black">
                                    ★ TOP
                                  </Badge>
                                )}
                              </div>
                              {stat.lastActiveDate && (
                                <div className="text-[10px] text-muted-foreground">
                                  Last active: {new Date(stat.lastActiveDate).toLocaleDateString("en-IN")}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant="outline" className="text-[10px] font-medium bg-slate-50 dark:bg-slate-900">
                            {stat.officialRecord?.role || "Staff"}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-extrabold text-teal-700 dark:text-teal-400 text-sm">
                            {stat.totalDcs}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {stat.totalItems}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {stat.pendingReturnsCount > 0 ? (
                            <Badge className="bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[10px] font-bold">
                              {stat.pendingReturnsCount} Out
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {stat.totalReturnsCollected}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1 flex-wrap max-w-[180px]">
                            {stat.hospitals.size > 0 ? (
                              Array.from(stat.hospitals)
                                .slice(0, 2)
                                .map((h) => (
                                  <span
                                    key={h}
                                    className="bg-slate-100 dark:bg-slate-800 text-[10px] px-1.5 py-0.5 rounded truncate max-w-[120px]"
                                    title={h}
                                  >
                                    {h}
                                  </span>
                                ))
                            ) : (
                              <span className="text-muted-foreground text-[10px]">-</span>
                            )}
                            {stat.hospitals.size > 2 && (
                              <span className="text-[10px] text-muted-foreground font-bold">
                                +{stat.hospitals.size - 2} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedPersonFilter(stat.name);
                              setActiveTab("what_delivered");
                            }}
                            className="h-7 text-[11px] font-bold text-teal-700 hover:text-teal-800 hover:bg-teal-50 gap-1 px-2"
                          >
                            What Delivered
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: WHAT DELIVERED (ITEM-LEVEL BREAKDOWN) */}
        <TabsContent value="what_delivered" className="space-y-4">
          <Card className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <CardHeader className="p-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    Complete Item &amp; Implant Delivery Breakdown
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Analysis of specific implants, instruments, and items delivered to hospitals.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Filter by Person:</span>
                  <Select
                    value={selectedPersonFilter}
                    onValueChange={setSelectedPersonFilter}
                  >
                    <SelectTrigger className="h-8 text-xs w-[180px] font-bold bg-white dark:bg-slate-900 border-teal-300">
                      <SelectValue placeholder="All Personnel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs font-semibold">
                        All Personnel ({filteredDcs.length} DCs)
                      </SelectItem>
                      {personnelStats.map((p) => (
                        <SelectItem key={p.name} value={p.name} className="text-xs">
                          {p.name} ({p.totalDcs} DCs)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-muted-foreground border-b border-slate-200 dark:border-slate-800 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4">Item / Implant Name</th>
                    <th className="py-2.5 px-3 text-center">Total Delivered</th>
                    <th className="py-2.5 px-3 text-center">In DCs</th>
                    <th className="py-2.5 px-3 text-center">Currently at Hospital</th>
                    <th className="py-2.5 px-3 text-center">Returned / Cleared</th>
                    <th className="py-2.5 px-4">Delivered By</th>
                    <th className="py-2.5 px-4">Hospitals Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {itemDeliveryBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                        No item deliveries found for the current selection.
                      </td>
                    </tr>
                  ) : (
                    itemDeliveryBreakdown.map((item) => (
                      <tr
                        key={item.name}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100 max-w-xs truncate" title={item.name}>
                            {item.name}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-black text-blue-700 dark:text-blue-400 text-sm">
                            {item.totalQuantity}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center text-muted-foreground font-semibold">
                          {item.dcCount}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {item.pendingCount > 0 ? (
                            <Badge className="bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 text-[10px] font-bold">
                              {item.pendingCount} Pending
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                            {item.returnedCount}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1 flex-wrap max-w-[200px]">
                            {Array.from(item.deliverers.entries()).map(([person, count]) => (
                              <span
                                key={person}
                                className="bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800 text-[10px] px-1.5 py-0.5 rounded font-medium truncate"
                                title={`${person}: ${count} delivered`}
                              >
                                {person} ({count})
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1 flex-wrap max-w-[220px]">
                            {Array.from(item.hospitals).slice(0, 2).map((hosp) => (
                              <span
                                key={hosp}
                                className="bg-slate-100 dark:bg-slate-800 text-[10px] px-1.5 py-0.5 rounded truncate max-w-[110px]"
                                title={hosp}
                              >
                                {hosp}
                              </span>
                            ))}
                            {item.hospitals.size > 2 && (
                              <span className="text-[10px] text-muted-foreground font-bold">
                                +{item.hospitals.size - 2}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* DC Dossier List for selected person */}
          {selectedPersonFilter !== "all" && (
            <Card className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <CardHeader className="p-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span>Challans Delivered by {selectedPersonFilter}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPersonFilter("all")}
                    className="h-6 text-[11px] text-muted-foreground"
                  >
                    Clear Filter
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-muted-foreground text-[10px] uppercase font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2 px-3">DC No</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Hospital / Party</th>
                      <th className="py-2 px-3">Items Count</th>
                      <th className="py-2 px-3">Current Status</th>
                      <th className="py-2 px-3">Returned By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredDcs
                      .filter(
                        (dc) => dc.deliveredBy?.trim().toLowerCase() === selectedPersonFilter.toLowerCase()
                      )
                      .map((dc) => (
                        <tr key={dc.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                          <td className="py-2.5 px-3 font-bold text-teal-700 dark:text-teal-400">
                            #{dc.dcNo}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                            {dc.savedAt ? new Date(dc.savedAt).toLocaleDateString("en-IN") : "-"}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            {dc.hospitalName}
                          </td>
                          <td className="py-2.5 px-3">
                            {dc.items?.length || 0} items (
                            {dc.items?.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0) || 0} qty)
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge
                              className={`text-[10px] font-bold ${
                                dc.status === "pending"
                                  ? "bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300"
                                  : dc.status === "returned"
                                  ? "bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-300"
                                  : "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300"
                              }`}
                            >
                              {dc.status.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                            {dc.returnedBy || "-"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB 3: PENDING RETURNS TRACKING */}
        <TabsContent value="pending_returns" className="space-y-4">
          <Card className="rounded-xl border border-amber-500/30 shadow-xs">
            <CardHeader className="p-4 pb-3 border-b border-amber-100 dark:border-slate-800 bg-amber-50/40 dark:bg-amber-950/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm sm:text-base font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    Challans Currently Out with Hospitals (Pending Return)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Deliveries requiring return pickup, grouped with deliverer accountability.
                  </CardDescription>
                </div>
                <Badge className="bg-amber-600 text-white text-xs px-2.5 py-0.5 self-start sm:self-auto font-bold">
                  {pendingDeliveriesList.length} Pending Pickups
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-muted-foreground border-b border-slate-200 dark:border-slate-800 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4">DC Number</th>
                    <th className="py-2.5 px-3">Delivery Date</th>
                    <th className="py-2.5 px-3">Hospital / Doctor</th>
                    <th className="py-2.5 px-3">Delivered By</th>
                    <th className="py-2.5 px-3">Received By Staff</th>
                    <th className="py-2.5 px-3 text-center">Items Out</th>
                    <th className="py-2.5 px-3 text-center">Days Elapsed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pendingDeliveriesList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                        🎉 All delivery challans have been returned or settled!
                      </td>
                    </tr>
                  ) : (
                    pendingDeliveriesList.map((dc) => {
                      const dcDate = dc.savedAt ? new Date(dc.savedAt) : new Date();
                      const daysAgo = Math.floor(
                        (Date.now() - dcDate.getTime()) / (1000 * 60 * 60 * 24)
                      );
                      const isOverdue = daysAgo >= 2;

                      return (
                        <tr
                          key={dc.id}
                          className="hover:bg-amber-50/30 dark:hover:bg-amber-950/10 transition-colors"
                        >
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                            #{dc.dcNo}
                          </td>
                          <td className="py-3 px-3 text-muted-foreground text-[11px]">
                            {dcDate.toLocaleDateString("en-IN")}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            {dc.hospitalName}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                              {dc.deliveredBy || "Unassigned"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-muted-foreground">
                            {dc.receivedBy || "-"}
                          </td>
                          <td className="py-3 px-3 text-center font-bold">
                            {dc.items?.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0) || 0}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <Badge
                              className={`text-[10px] font-bold ${
                                isOverdue
                                  ? "bg-red-500 hover:bg-red-600 text-white"
                                  : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                              }`}
                            >
                              {daysAgo} {daysAgo === 1 ? "day" : "days"} ago
                            </Badge>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: ROSTER MANAGEMENT */}
        <TabsContent value="roster" className="space-y-4">
          <Card className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <CardHeader className="p-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-purple-600" />
                    Delivery Personnel Directory
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Official list of staff who appear in the "Delivered By" and "Returned By" dropdown pickers.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingPerson(null);
                    setNameInput("");
                    setPhoneInput("");
                    setRoleInput("Delivery Executive");
                    setNotesInput("");
                    setAddPersonModalOpen(true);
                  }}
                  className="h-8 text-xs font-bold gap-1.5 bg-teal-700 hover:bg-teal-800 text-white self-start sm:self-auto"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Add New Person
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {personnel.map((p) => {
                  const matchingStat = personnelStats.find(
                    (s) => s.name.toLowerCase() === p.name.toLowerCase()
                  );

                  return (
                    <div
                      key={p.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col justify-between gap-3 hover:border-teal-500/40 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-teal-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate text-xs sm:text-sm">
                              {p.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                              <Badge variant="outline" className="text-[9.5px] px-1.5 py-0 font-normal">
                                {p.role}
                              </Badge>
                              {p.phone && (
                                <span className="flex items-center gap-1 text-[10px]">
                                  <Phone className="w-2.5 h-2.5" />
                                  {p.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(p)}
                            className="h-7 w-7 text-slate-500 hover:text-teal-700"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeletePerson(p.id, p.name)}
                            className="h-7 w-7 text-slate-400 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px] flex items-center justify-between text-muted-foreground">
                        <span>Total Historical Deliveries:</span>
                        <span className="font-extrabold text-teal-700 dark:text-teal-400">
                          {matchingStat?.totalDcs || 0} DCs
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add / Edit Personnel Modal */}
      <Dialog open={addPersonModalOpen} onOpenChange={setAddPersonModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-teal-600" />
              {editingPerson ? "Edit Delivery Personnel" : "Add New Delivery Personnel"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              This person will be immediately available in the "Delivered By" and "Returned By" selection menus.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-bold">Full Name *</Label>
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="mt-1 h-9 text-xs"
                autoFocus
              />
            </div>

            <div>
              <Label className="text-xs font-bold">Contact Phone (Optional)</Label>
              <Input
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="e.g. 9848012345"
                className="mt-1 h-9 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-bold">Role</Label>
              <Select value={roleInput} onValueChange={(val: any) => setRoleInput(val)}>
                <SelectTrigger className="mt-1 h-9 text-xs font-medium">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Delivery Executive" className="text-xs">Delivery Executive</SelectItem>
                  <SelectItem value="Field Staff" className="text-xs">Field Staff</SelectItem>
                  <SelectItem value="Coordinator" className="text-xs">Coordinator</SelectItem>
                  <SelectItem value="Driver" className="text-xs">Driver</SelectItem>
                  <SelectItem value="Other" className="text-xs">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-bold">Notes (Optional)</Label>
              <Input
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="e.g. Assigned to Secunderabad / Banjara Hills region"
                className="mt-1 h-9 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddPersonModalOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSavePersonnel}
                className="h-8 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white gap-1.5"
              >
                {editingPerson ? "Update Personnel" : "Save to Directory"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Merge Duplicate Personnel Modal */}
      <Dialog open={mergeModalOpen} onOpenChange={setMergeModalOpen}>
        <DialogContent className="max-w-md border-2 border-amber-500/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
              <GitMerge className="w-5 h-5 text-amber-600" />
              Merge Duplicate Personnel
            </DialogTitle>
            <DialogDescription className="text-xs">
              Consolidate duplicate spelling variations (e.g. "Prasanth" into "Prashanth"). This automatically updates all past DCs, item delivery history, and the personnel directory.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Suggested Merges if detected */}
            {detectedDuplicates.length > 0 && (
              <div className="space-y-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <div className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Auto-Detected Duplicate Variations:
                </div>
                <div className="space-y-1.5">
                  {detectedDuplicates.map((dup, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-200/60 dark:border-slate-800 text-xs gap-2"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {dup.source}
                        </span>
                        <span className="text-muted-foreground mx-1 text-[11px]">➔</span>
                        <span className="font-extrabold text-teal-700 dark:text-teal-400">
                          {dup.target}
                        </span>
                        <div className="text-[10px] text-muted-foreground">{dup.reason}</div>
                      </div>
                      <Button
                        size="sm"
                        disabled={isMerging}
                        onClick={() => handleExecuteMerge(dup.source, dup.target)}
                        className="h-7 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white shrink-0"
                      >
                        Merge into {dup.target}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manual Merge Form */}
            <div className="space-y-3 pt-1">
              <div>
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  1. Duplicate Person to Merge (Source)
                </Label>
                <Select value={mergeSource} onValueChange={setMergeSource}>
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue placeholder="Select duplicate person to remove..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {personnel.map((p) => (
                      <SelectItem key={p.id} value={p.name} className="text-xs">
                        {p.name} ({p.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  2. Canonical Person to Keep (Target)
                </Label>
                <Select value={mergeTarget} onValueChange={setMergeTarget}>
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue placeholder="Select canonical person to retain..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {personnel
                      .filter((p) => p.name !== mergeSource)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.name} className="text-xs font-semibold">
                          {p.name} ({p.role})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900 text-[11px] text-muted-foreground">
              ⚠️ All DCs matching the duplicate person will be re-assigned to the target person, consolidating all stats and leaving a single clean name.
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMergeModalOpen(false)}
                disabled={isMerging}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isMerging || !mergeSource || !mergeTarget}
                onClick={() => handleExecuteMerge(mergeSource, mergeTarget)}
                className="h-8 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-xs"
              >
                <GitMerge className="w-3.5 h-3.5" />
                {isMerging ? "Merging..." : "Confirm & Merge"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
