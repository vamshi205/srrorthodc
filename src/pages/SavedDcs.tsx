import React, { useEffect, useMemo, useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  Download,
  Edit,
  Eye,
  FileText,
  Filter,
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
  Search,
  Share2,
  Trash2,
  TrendingUp,
  Undo2,
  User,
  Wallet,
  Wrench,
  X,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InstrumentImageModal } from "@/components/ortho/InstrumentImageModal";
import { TopToolbar } from "@/components/ortho/TopToolbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useProcedures } from "@/hooks/useProcedures";
import { deleteSavedDc, loadSavedDcs, SavedDc, SavedDcHistoryEvent, SavedDcStatus, transitionSavedDc, updateSavedDc } from "@/lib/savedDcStorage";
import { AppLoadingSpinner } from '@/components/ui/LoadingSpinner';
import { auth } from "@/firebase";
import html2pdf from "html2pdf.js";

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
  const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
};

const getTotalQty = (dc: SavedDc) =>
  dc.items.reduce((total, item) => total + item.sizes.reduce((sum, size) => sum + size.qty, 0), 0);
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
  return date ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date) : "Select date";
};

const DateFilterPicker = ({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) => {
  const [open, setOpen] = useState(false);
  const selectedDate = parseDateInput(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" aria-label={`${label}: ${formatFilterDate(value)}`} className="h-8 w-36 justify-start gap-1.5 border-slate-300 bg-white px-2 text-left text-xs font-normal text-slate-700 hover:bg-slate-50 focus-visible:ring-teal-600">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-teal-700" />
          <span className="truncate">{formatFilterDate(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" sideOffset={6} collisionPadding={16} className="z-[100] w-auto p-0">
        <DatePickerCalendar mode="single" selected={selectedDate} onSelect={(date) => {
          if (!date) return;
          onChange(toDateInputValue(date));
          setOpen(false);
        }} initialFocus />
        {value && <div className="border-t border-slate-200 p-2 text-right"><Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700" onClick={() => onChange("")}>Clear date</Button></div>}
      </PopoverContent>
    </Popover>
  );
};

const SavedDcs = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { fetchProcedures, loading: proceduresLoading } = useProcedures();

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('srrortho:theme') as 'light' | 'dark') || 'dark';
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('srrortho:theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
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
  const [sortBy, setSortBy] = useState<"date" | "dcNo" | "party" | "items" | "days" | "status">("date");
  const [activeQueue, setActiveQueue] = useState<SavedDcStatus>("pending");
  const [actionDialog, setActionDialog] = useState<{
    type: "return" | "invoice" | "cash" | "cancel" | null;
    dc: SavedDc | null;
  }>({ type: null, dc: null });
  const [returnedByInput, setReturnedByInput] = useState("");
  const [invoiceRefInput, setInvoiceRefInput] = useState("");
  const [returnedRemarksInput, setReturnedRemarksInput] = useState("");
  const [invoiceRemarksInput, setInvoiceRemarksInput] = useState("");
  const [cashRemarksInput, setCashRemarksInput] = useState("");
  const [cancelledRemarksInput, setCancelledRemarksInput] = useState("");
  const [cashAmountInput, setCashAmountInput] = useState("");
  const [selectedDcId, setSelectedDcId] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [dcDocumentModalOpen, setDcDocumentModalOpen] = useState(false);
  const [cashMemoModalOpen, setCashMemoModalOpen] = useState(false);
  const [viewingCashMemoRef, setViewingCashMemoRef] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; dc: SavedDc | null }>({ open: false, dc: null });
  const [deletePassword, setDeletePassword] = useState("");
  const [adminPasswordOpen, setAdminPasswordOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; dc: SavedDc | null }>({ open: false, dc: null });
  const [paymentAmountInput, setPaymentAmountInput] = useState("");
  const [paymentRemarksInput, setPaymentRemarksInput] = useState("");

  useEffect(() => {
    const fetchDcs = async () => {
      setIsLoading(true);
      try {
        const dcs = await loadSavedDcs();
        setSavedDcs(dcs);
      } catch (error) {
        console.error('Error loading DCs:', error);
        toast({
          title: 'Error loading DCs',
          description: error instanceof Error ? error.message : 'Failed to load DCs from Google Sheets',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchDcs();
  }, [toast]);

  const normalizedDcs = useMemo(
    () =>
      savedDcs.map((dc) => ({
        ...dc,
        status: (dc.status ?? "pending") as SavedDcStatus,
        receivedBy: dc.receivedBy ?? "",
        deliveredBy: dc.deliveredBy ?? "",
        remarks: dc.remarks ?? "",
      })),
    [savedDcs],
  );

  const dcCounts = useMemo(() => {
    return {
      all: normalizedDcs.length,
      pending: normalizedDcs.filter(d => d.status === "pending").length,
      returned: normalizedDcs.filter(d => d.status === "returned").length,
      cash: normalizedDcs.filter(d => d.status === "cash").length,
      completed: normalizedDcs.filter(d => d.status === "completed").length,
      cancelled: normalizedDcs.filter(d => d.status === "cancelled").length,
    };
  }, [normalizedDcs]);

  const cashQueueStats = useMemo(() => {
    const cashDcs = normalizedDcs.filter(d => d.status === "cash");
    const totalOutstanding = cashDcs.reduce((acc, d) => acc + (d.cashAmount || 0), 0);
    return { count: cashDcs.length, totalOutstanding };
  }, [normalizedDcs]);

  const completedQueueStats = useMemo(() => {
    const completedDcs = normalizedDcs.filter(d => d.status === "completed");
    const totalCollected = completedDcs.reduce((acc, d) => acc + (d.cashAmount || 0), 0);
    return { count: completedDcs.length, totalCollected };
  }, [normalizedDcs]);



  const handleShareWhatsApp = (dc: SavedDc) => {
    const statusText = dc.status === 'completed' ? 'PAID ✅' : 'UNPAID ⏳';
    const text = `*SRI RAJA RAJESHWARI ORTHO PLUS*\n*Cash Memo Details*\n\n` +
      `📄 *Memo No:* ${dc.invoiceRef || 'N/A'}\n` +
      `🚚 *DC No:* ${dc.dcNo}\n` +
      `🏥 *Party Name:* ${dc.hospitalName}\n` +
      `💰 *Amount:* ₹${dc.cashAmount || 0}\n` +
      `📌 *Status:* ${statusText}\n\n` +
      `Thank you!`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const getCashMemoAgingDays = (dc: SavedDc) => {
    const cashEvent = dc.history?.find(h => h.action === 'MOVE_TO_CASH');
    const cashDate = cashEvent ? new Date(cashEvent.at) : (dc.savedAt ? new Date(dc.savedAt) : new Date());
    const diff = Math.floor((new Date().getTime() - cashDate.getTime()) / (1000 * 3600 * 24));
    return Math.max(0, diff);
  };

  const handleQuickRecordPayment = async () => {
    if (!paymentDialog.dc) return;
    const dc = paymentDialog.dc;
    const paidAmount = parseFloat(paymentAmountInput) || (dc.cashAmount || 0);
    try {
      setLoadingDcIds(prev => new Set(prev).add(dc.id));
      await transitionSavedDc(dc.id, {
        toStatus: "completed",
        action: "MOVE_CASH_TO_COMPLETED",
        updates: {
          cashAmount: paidAmount,
          cashRemarks: paymentRemarksInput.trim() || `Payment recorded: ₹${paidAmount}`,
        },
        meta: {
          paidAt: new Date().toISOString(),
          paidAmount,
          remarks: paymentRemarksInput.trim() || `Payment recorded: ₹${paidAmount}`,
        }
      });
      setSavedDcs(prev => prev.map(d => d.id === dc.id ? { ...d, status: "completed", cashAmount: paidAmount } : d));
      toast({ title: "Payment Recorded", description: `DC ${dc.dcNo} Cash Memo marked as PAID and moved to Completed Queue.` });
      setPaymentDialog({ open: false, dc: null });
      setPaymentAmountInput("");
      setPaymentRemarksInput("");
    } catch (err) {
      toast({ title: "Payment Failed", description: err instanceof Error ? err.message : "Failed to record payment.", variant: "destructive" });
    } finally {
      setLoadingDcIds(prev => {
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
        return dcs.filter((dc) => dc.status === "pending" && getDaysPending(dc) > 7);
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
        { pending: 0, returned: 0, completed: 0, cash: 0, cancelled: 0 } as Record<SavedDcStatus, number>,
      ),
    [normalizedDcs],
  );

  const selectedDc = useMemo(() => {
    if (!selectedDcId) return null;
    return normalizedDcs.find((dc) => dc.id === selectedDcId) ?? null;
  }, [normalizedDcs, selectedDcId]);

  const getDisplayDate = (dc: SavedDc) =>
    dc.status === "pending" ? dc.savedAt : dc.returnedAt || dc.savedAt;

  const filteredDcs = useMemo(() => {
    const term = filterText.trim().toLowerCase();
    const filtered = normalizedDcs.filter((dc) => dc.status === activeQueue);
    const quickFiltered = applyQuickFilter(filtered);
    const byParty = term
      ? quickFiltered.filter((dc) =>
        dc.hospitalName.toLowerCase().includes(term) ||
        dc.dcNo.toLowerCase().includes(term) ||
        (dc.deliveredBy && dc.deliveredBy.toLowerCase().includes(term)) ||
        (dc.receivedBy && dc.receivedBy.toLowerCase().includes(term))
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
  }, [activeQueue, dateFrom, dateTo, filterText, normalizedDcs, sortBy, sortOrder, quickFilter]);

  // Dashboard metrics
  const dashboardMetrics = useMemo(() => {
    const totalDcs = normalizedDcs.length;
    const pendingDcs = statusCounts.pending;
    const avgTurnaround = normalizedDcs
      .filter((dc) => dc.status !== "pending")
      .reduce((sum, dc) => sum + getDaysPending(dc), 0) / (totalDcs - pendingDcs || 1);
    const totalItemsOut = normalizedDcs
      .filter((dc) => dc.status === "pending" || dc.status === "returned")
      .reduce((sum, dc) => sum + getTotalQty(dc), 0);
    return {
      totalDcs,
      pendingDcs,
      avgTurnaround: Math.round(avgTurnaround),
      totalItemsOut,
    };
  }, [normalizedDcs, statusCounts.pending]);

  const handleDelete = async (id: string) => {
    setLoadingDcIds(prev => new Set(prev).add(id));
    try {
      await deleteSavedDc(id);
      const dcs = await loadSavedDcs();
      setSavedDcs(dcs);
      toast({ title: "DC deleted" });
    } catch (error) {
      console.error('Error deleting DC:', error);
      toast({
        title: "Error deleting DC",
        description: error instanceof Error ? error.message : 'Failed to delete DC',
        variant: 'destructive'
      });
    } finally {
      setLoadingDcIds(prev => {
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

  const confirmProtectedDelete = () => {
    const dc = deleteDialog.dc;
    if (!dc) return;
    if (deletePassword.trim() !== "srrortho") {
      toast({ title: "Incorrect password", variant: "destructive" });
      return;
    }
    handleDelete(dc.id);
    setDeleteDialog({ open: false, dc: null });
    setDeletePassword("");
    setSelectedDcId(null);
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
    localStorage.removeItem('srrortho:procedures_cache');
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleExportCSV = () => {
    if (filteredDcs.length === 0) {
      toast({ title: "Export Empty", description: "No records to export in current queue view.", variant: "destructive" });
      return;
    }
    const headers = ["Date", "DC No", "Invoice/Memo No", "Party Name", "Items Count", "Days Pending", "Delivered By", "Received By", "Returned By", "Status", "Cash Amount (INR)"];
    const rows = filteredDcs.map((dc) => [
      formatDate(getDisplayDate(dc)),
      `"${dc.dcNo || ''}"`,
      `"${dc.invoiceRef || ''}"`,
      `"${(dc.hospitalName || '').replace(/"/g, '""')}"`,
      getTotalQty(dc).toString(),
      getDaysPending(dc).toString(),
      `"${dc.deliveredBy || ''}"`,
      `"${dc.receivedBy || ''}"`,
      `"${dc.returnedBy || ''}"`,
      dc.status.toUpperCase(),
      dc.cashAmount || 0
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
      const file = new File([blob], `DC-${dc.dcNo}.pdf`, { type: "application/pdf" });
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
            const totalQty = item.sizes.reduce((sum, size) => sum + size.qty, 0);
            const sizes = item.sizes
              .filter((size) => size.size)
              .map((size) => `${size.size} (Qty: ${size.qty})`)
              .join(", ");
            const desc = sizes ? `<div style="font-size: 9.5px; color: #555; margin-top: 2px;">${sizes}</div>` : "";
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
    if (status === "pending") return "bg-rose-100 text-rose-800 border-rose-300 font-bold";
    if (status === "returned") return "bg-teal-100 text-teal-800 border-teal-300 font-bold";
    if (status === "completed") return "bg-teal-100 text-teal-900 border-teal-400 font-bold";
    if (status === "cash") return "bg-blue-100 text-blue-800 border-blue-300 font-bold";
    if (status === "cancelled") return "bg-slate-100 text-slate-700 border-slate-300 font-bold";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  const getStatusIcon = (status: SavedDcStatus) => {
    if (status === "pending") return <AlertCircle className="h-3.5 w-3.5" />;
    if (status === "returned") return <Undo2 className="h-3.5 w-3.5" />;
    if (status === "cash") return <Wallet className="h-3.5 w-3.5" />;
    if (status === "cancelled") return <X className="h-3.5 w-3.5" />;
    return <CheckCircle2 className="h-3.5 w-3.5" />;
  };

  const openActionDialog = (type: "return" | "invoice" | "cash" | "cancel", dc: SavedDc) => {
    // Close details modal so we don't see it behind the action dialog
    setDetailsDialogOpen(false);
    setActionDialog({ type, dc });
    setReturnedByInput(dc.returnedBy || "");
    setInvoiceRefInput(dc.invoiceRef || "");
    setReturnedRemarksInput(dc.returnedRemarks || "");
    setInvoiceRemarksInput(dc.invoiceRemarks || "");
    setCashRemarksInput(dc.cashRemarks || "");
    setCancelledRemarksInput(dc.cancelledRemarks || "");
  };

  const closeActionDialog = () => {
    setActionDialog({ type: null, dc: null });
    setReturnedByInput("");
    setInvoiceRefInput("");
    setReturnedRemarksInput("");
    setInvoiceRemarksInput("");
    setCashRemarksInput("");
    setCancelledRemarksInput("");
    setCashAmountInput("");
  };

  const handleConfirmReturn = async (dc: SavedDc) => {
    const returnedBy = returnedByInput.trim();
    if (!returnedBy) {
      toast({ title: "Returned By is required" });
      return;
    }
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
      });
      const dcs = await loadSavedDcs();
      setSavedDcs(dcs);
      closeActionDialog();
      toast({ title: "DC marked as returned" });
    } catch (error) {
      console.error('Error marking DC as returned:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update DC',
        variant: 'destructive'
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmInvoice = async (dc: SavedDc) => {
    const invoiceRef = invoiceRefInput.trim();
    if (!invoiceRef) {
      toast({ title: "Invoice number is required" });
      return;
    }
    setIsActionLoading(true);
    try {
      await transitionSavedDc(dc.id, {
        toStatus: "completed",
        action: dc.status === "cash" ? "MOVE_CASH_TO_COMPLETED" : "LINK_INVOICE",
        // When cash -> completed, clear cash fields (but keep them in history via meta.cleared)
        clear: dc.status === "cash" ? (["cashAt", "cashAmount", "cashRemarks"] as any) : [],
        updates: {
          invoiceRef,
          invoiceRemarks: invoiceRemarksInput.trim() || "",
          isTaxInvoice: true,
        },
      });
      const dcs = await loadSavedDcs();
      setSavedDcs(dcs);
      closeActionDialog();
      toast({ title: "Invoice linked. Moved to Completed." });
    } catch (error) {
      console.error('Error linking invoice:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update DC',
        variant: 'destructive'
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmCash = async (dc: SavedDc) => {
    const amount = parseFloat(cashAmountInput);
    if (!cashAmountInput.trim() || isNaN(amount) || amount <= 0) {
      toast({ title: "Valid cash amount is required" });
      return;
    }
    setIsActionLoading(true);
    try {
      await transitionSavedDc(dc.id, {
        toStatus: "cash",
        action: "MOVE_TO_CASH",
        updates: {
          cashAt: new Date().toISOString(),
          cashAmount: amount,
          cashRemarks: cashRemarksInput.trim() || "",
        },
      });
      const dcs = await loadSavedDcs();
      setSavedDcs(dcs);
      closeActionDialog();
      toast({ title: "Moved to Cash queue" });
    } catch (error) {
      console.error('Error moving to cash:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update DC',
        variant: 'destructive'
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCreateCashMemoForDc = (dc: SavedDc) => {
    sessionStorage.setItem('prefill_cash_dc_no', dc.dcNo || '');
    sessionStorage.setItem('prefill_cash_client_name', dc.hospitalName || '');
    closeActionDialog();
    navigate(`/cash-invoice?dcNo=${encodeURIComponent(dc.dcNo || '')}&client=${encodeURIComponent(dc.hospitalName || '')}`);
  };

  const handleConfirmCancel = async (dc: SavedDc) => {
    const remarks = cancelledRemarksInput.trim();
    if (!remarks) {
      toast({ title: "Cancellation reason is required" });
      return;
    }
    setIsActionLoading(true);
    try {
      await transitionSavedDc(dc.id, {
        toStatus: "cancelled",
        action: "CANCEL_CASE",
        updates: {
          cancelledAt: new Date().toISOString(),
          cancelledRemarks: remarks,
        },
      });
      const dcs = await loadSavedDcs();
      setSavedDcs(dcs);
      closeActionDialog();
      toast({ title: "Case cancelled successfully" });
    } catch (error) {
      console.error('Error cancelling case:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to cancel case',
        variant: 'destructive'
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const restoreFromCancelled = async (dc: SavedDc) => {
    setLoadingDcIds(prev => new Set(prev).add(dc.id));
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
      console.error('Error restoring case:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to restore case',
        variant: 'destructive'
      });
    } finally {
      setLoadingDcIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(dc.id);
        return newSet;
      });
    }
  };

  const moveBackToReturned = async (dc: SavedDc) => {
    setLoadingDcIds(prev => new Set(prev).add(dc.id));
    try {
      await transitionSavedDc(dc.id, {
        toStatus: "returned",
        action: "MOVE_BACK_TO_RETURNED",
        clear: ["invoiceRef", "invoiceRemarks"],
      });
      const dcs = await loadSavedDcs();
      setSavedDcs(dcs);
      toast({ title: "Moved back to Returned" });
    } catch (error) {
      console.error('Error moving to returned:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update DC',
        variant: 'destructive'
      });
    } finally {
      setLoadingDcIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(dc.id);
        return newSet;
      });
    }
  };

  const cancelReturnToPending = async (dc: SavedDc) => {
    setLoadingDcIds(prev => new Set(prev).add(dc.id));
    try {
      await transitionSavedDc(dc.id, {
        toStatus: "pending",
        action: "MOVE_BACK_TO_PENDING",
        clear: ["returnedBy", "returnedAt", "returnedRemarks"],
      });
      const dcs = await loadSavedDcs();
      setSavedDcs(dcs);
      toast({ title: "Moved back to Pending" });
    } catch (error) {
      console.error('Error moving to pending:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update DC',
        variant: 'destructive'
      });
    } finally {
      setLoadingDcIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(dc.id);
        return newSet;
      });
    }
  };

  const SortableHeader = ({
    children,
    sortKey,
    className = ""
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
      <ArrowUpDown className={`h-3 w-3 ${sortBy === sortKey ? 'text-slate-700' : 'text-slate-400'}`} />
      {sortBy === sortKey && (
        <span className="text-xs font-bold text-slate-700">
          {sortOrder === "desc" ? "↓" : "↑"}
        </span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-hero overflow-x-hidden">
      <div className="flex min-h-screen">
        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 overflow-x-hidden">
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

          <div className="space-y-8">
            {/* Dashboard Metrics */}
            {savedDcs.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                <Card className="glass-card border border-slate-200 bg-white hover:shadow-md transition-all duration-200">
                  <CardContent className="p-3 sm:p-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Total DCs</p>
                        <p className="text-xl sm:text-3xl font-extrabold text-teal-700">{dashboardMetrics.totalDcs}</p>
                      </div>
                      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-teal-700" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card border border-slate-200 bg-white hover:shadow-md transition-all duration-200">
                  <CardContent className="p-3 sm:p-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Pending</p>
                        <p className="text-xl sm:text-3xl font-extrabold text-rose-600">{dashboardMetrics.pendingDcs}</p>
                      </div>
                      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card border border-slate-200 bg-white hover:shadow-md transition-all duration-200">
                  <CardContent className="p-3 sm:p-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Avg. Turn</p>
                        <p className="text-xl sm:text-3xl font-extrabold text-teal-800">{dashboardMetrics.avgTurnaround}d</p>
                      </div>
                      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-teal-800" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card border border-slate-200 bg-white hover:shadow-md transition-all duration-200">
                  <CardContent className="p-3 sm:p-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Items Out</p>
                        <p className="text-xl sm:text-3xl font-extrabold text-blue-700">{dashboardMetrics.totalItemsOut}</p>
                      </div>
                      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
                        <Package className="w-4 h-4 sm:w-5 sm:h-5 text-blue-700" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {isLoading ? (
              <AppLoadingSpinner message="Loading DCs..." subtext="Fetching Delivery Challans from database" />
            ) : savedDcs.length === 0 ? (
              <Card className="glass-card border-2 border-border/60">
                <CardHeader>
                  <CardTitle>No DCs Tracked Yet</CardTitle>
                  <CardDescription>Save a DC from the generator to start tracking.</CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <Card className="glass-card rounded-xl border-2 border-border/60 shadow-md">
                <CardHeader className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                    {/* Modern Advanced Control Toolbar */}
                    <div className="space-y-4">
                      {/* Top Bar: Search, Quick Filters & Export */}
                      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60 p-3 sm:p-4 rounded-xl border border-slate-200/80">
                        {/* Search Input */}
                        <div className="relative flex-1 min-w-[240px]">
                          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <Input
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            placeholder="Search Party, DC No, or Personnel..."
                            className="pl-9 h-9 text-xs sm:text-sm border-slate-300 bg-white focus:border-teal-600 focus:ring-teal-600 rounded-lg"
                          />
                          {filterText && (
                            <button
                              onClick={() => setFilterText("")}
                              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        {/* Quick Time Pills */}
                        <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-lg">
                          {["all", "today", "week", "month", ...(activeQueue === "pending" ? ["overdue"] : [])].map((filter) => (
                            <button
                              key={filter}
                              onClick={() => setQuickFilter(filter)}
                              className={`px-3 py-1 text-xs font-bold rounded-md transition-all capitalize ${
                                quickFilter === filter
                                  ? filter === 'overdue'
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'bg-teal-700 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                              }`}
                            >
                              {filter}
                            </button>
                          ))}
                        </div>

                        {/* Export CSV Button */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleExportCSV}
                          className="h-9 px-3 text-xs font-bold border-slate-300 bg-white hover:bg-teal-50 hover:text-teal-800 text-slate-700 gap-1.5 shrink-0"
                        >
                          <Download className="h-3.5 w-3.5 text-teal-700" /> Export CSV
                        </Button>
                      </div>

                      {/* Date Filter & Active Badges Row */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="order-2 ml-auto flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-teal-700" /> Date:
                          </span>
                          <DateFilterPicker label="From date" value={dateFrom} onChange={setDateFrom} />
                          <span className="text-slate-400 text-xs font-bold">to</span>
                          <DateFilterPicker label="To date" value={dateTo} onChange={setDateTo} />
                        </div>

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
                            className="order-1 h-7 px-2 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          >
                            Reset Filters
                          </Button>
                        )}
                      </div>
                    </div>

                  {/* Queue Tabs */}
                  <Tabs value={activeQueue} onValueChange={(value) => setActiveQueue(value as SavedDcStatus)}>
                    <TabsList className="grid h-auto min-h-[52px] grid-cols-5 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1.5">
                      <TabsTrigger
                        value="pending"
                        className="relative flex h-10 w-full items-center justify-center gap-1.5 rounded-lg px-2 text-xs leading-none sm:text-sm data-[state=active]:bg-rose-600 data-[state=active]:text-white font-bold transition-all shadow-2xs"
                      >
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Pending</span>
                        {statusCounts.pending > 0 && (
                          <Badge
                            className="h-5 min-w-5 flex items-center justify-center text-[10px] px-1 bg-rose-700 text-white font-extrabold"
                          >
                            {statusCounts.pending > 99 ? '99+' : statusCounts.pending}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger
                        value="returned"
                        className="relative flex h-10 w-full items-center justify-center gap-1.5 rounded-lg px-2 text-xs leading-none sm:text-sm data-[state=active]:bg-teal-600 data-[state=active]:text-white font-bold transition-all shadow-2xs"
                      >
                        <User className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Returned</span>
                        {statusCounts.returned > 0 && (
                          <Badge
                            className="h-5 min-w-5 flex items-center justify-center text-[10px] px-1 bg-teal-700 text-white font-extrabold"
                          >
                            {statusCounts.returned > 99 ? '99+' : statusCounts.returned}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger
                        value="completed"
                        className="relative flex h-10 w-full items-center justify-center gap-1.5 rounded-lg px-2 text-xs leading-none sm:text-sm data-[state=active]:bg-teal-700 data-[state=active]:text-white font-bold transition-all shadow-2xs"
                      >
                        <Receipt className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Completed</span>
                        {statusCounts.completed > 0 && (
                          <Badge
                            className="h-5 min-w-5 flex items-center justify-center text-[10px] px-1 bg-teal-800 text-white font-extrabold"
                          >
                            {statusCounts.completed > 99 ? '99+' : statusCounts.completed}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger
                        value="cash"
                        className="relative flex h-10 w-full items-center justify-center gap-1.5 rounded-lg px-2 text-xs leading-none sm:text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold transition-all shadow-2xs"
                      >
                        <Wallet className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Cash</span>
                        {statusCounts.cash > 0 && (
                          <Badge
                            className="h-5 min-w-5 flex items-center justify-center text-[10px] px-1 bg-blue-700 text-white font-extrabold"
                          >
                            {statusCounts.cash > 99 ? '99+' : statusCounts.cash}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger
                        value="cancelled"
                        className="relative flex h-10 w-full items-center justify-center gap-1.5 rounded-lg px-2 text-xs leading-none sm:text-sm data-[state=active]:bg-slate-600 data-[state=active]:text-white font-bold transition-all shadow-2xs"
                      >
                        <X className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Cancelled</span>
                        {statusCounts.cancelled > 0 && (
                          <Badge
                            className="h-5 min-w-5 flex items-center justify-center text-[10px] px-1 bg-slate-700 text-white font-extrabold"
                          >
                            {statusCounts.cancelled > 99 ? '99+' : statusCounts.cancelled}
                          </Badge>
                        )}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardHeader>

                  {activeQueue === "cash" && (
                    <div className="mx-3 sm:mx-4 mt-1 mb-3 p-4 rounded-xl border border-blue-200 bg-blue-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-100 text-blue-700 rounded-lg">
                          <Wallet className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">Cash Queue Financial Summary</h4>
                          <p className="text-xs text-slate-500 font-medium">Unpaid & partial cash memo balances awaiting collection</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block">Total Memos</span>
                          <span className="text-lg font-black text-slate-900">{cashQueueStats.count} Pending</span>
                        </div>
                        <div className="h-8 w-px bg-slate-200" />
                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block">Total Outstanding</span>
                          <span className="text-lg font-black text-blue-700">₹{cashQueueStats.totalOutstanding.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeQueue === "completed" && (
                    <div className="mx-3 sm:mx-4 mt-1 mb-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg">
                          <Receipt className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">Completed Queue Summary</h4>
                          <p className="text-xs text-slate-500 font-medium">Successfully processed transactions & collections</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block">Completed Transactions</span>
                          <span className="text-lg font-black text-slate-900">{completedQueueStats.count} Processed</span>
                        </div>
                        <div className="h-8 w-px bg-slate-200" />
                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block">Total Revenue (Cash)</span>
                          <span className="text-lg font-black text-emerald-700">₹{completedQueueStats.totalCollected.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                <CardContent className="p-0">
                  {selectedDc && (
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t-2 border-teal-500 bg-gradient-to-r from-teal-900 to-slate-900 text-white shadow-md">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Badge className="bg-teal-500 text-white text-xs font-extrabold px-2 py-0.5">
                          {selectedDc.dcNo}
                        </Badge>
                        <span className="font-bold text-sm text-slate-100 truncate max-w-[200px] sm:max-w-[320px]">
                          {selectedDc.hospitalName}
                        </span>
                        <span className="text-teal-300/80 text-xs hidden sm:inline">• {getTotalQty(selectedDc)} Items</span>
                      </div>

                      {/* Quick Action Trigger Buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs font-bold text-white hover:bg-white/20 gap-1 px-2.5"
                          onClick={() => setDcDocumentModalOpen(true)}
                        >
                          <Eye className="h-3.5 w-3.5 text-teal-300" /> View DC
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs font-bold text-white hover:bg-white/20 gap-1 px-2.5"
                          onClick={() => setDetailsDialogOpen(true)}
                        >
                          <Activity className="h-3.5 w-3.5 text-amber-300" /> Track Status
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs font-bold text-white hover:bg-white/20 gap-1 px-2.5"
                          onClick={() => handlePrint(selectedDc)}
                        >
                          <Printer className="h-3.5 w-3.5 text-cyan-300" /> Print
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs font-bold text-white hover:bg-white/20 gap-1 px-2.5"
                          onClick={() => handleShare(selectedDc)}
                        >
                          <Share2 className="h-3.5 w-3.5 text-emerald-300" /> Share PDF
                        </Button>

                        {selectedDc.status === "pending" && (
                          <Button
                            size="sm"
                            className="h-7 text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 gap-1 px-2.5"
                            onClick={() => openActionDialog("return", selectedDc)}
                          >
                            <User className="h-3.5 w-3.5" /> Mark Returned
                          </Button>
                        )}

                        {selectedDc.status === "returned" && (
                          <Button
                            size="sm"
                            className="h-7 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 gap-1 px-2.5"
                            onClick={() => openActionDialog("invoice", selectedDc)}
                          >
                            <Receipt className="h-3.5 w-3.5" /> Link Invoice
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-white/20 rounded-lg ml-1"
                          onClick={() => setSelectedDcId(null)}
                          title="Deselect"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  {/* DC Table */}
                  <div className="border-t-2 border-border/60">
                    {filteredDcs.length === 0 ? (
                      <div className="p-8 sm:p-12 text-center">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-muted/20 flex items-center justify-center mx-auto mb-4">
                          <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-base sm:text-lg font-semibold mb-2">No DCs found</h3>
                        <p className="text-sm text-muted-foreground mb-4">No delivery challans match your current filters.</p>
                        {(filterText || dateFrom || dateTo || quickFilter !== "all") && (
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
                                className={`p-3 transition-all ${isSelected
                                  ? 'bg-blue-50 border-l-4 border-l-blue-500'
                                  : 'bg-white border-l-4 border-l-transparent'
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
                                      <Badge className={`${getStatusBadgeClass(dc.status)} flex items-center gap-1 text-[10px] font-medium border px-1.5 py-0.5`}>
                                        {getStatusIcon(dc.status)}
                                        {dc.status.charAt(0).toUpperCase() + dc.status.slice(1)}
                                      </Badge>
                                    </div>
                                    <div className="text-sm font-semibold text-slate-900 mt-1 break-words whitespace-normal">
                                      {dc.hospitalName}
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
                                      <span className={`flex items-center gap-1 ${daysPending > 7 && dc.status === 'pending' ? 'text-red-600 font-medium' : ''}`}>
                                        {daysPending}d
                                        {daysPending > 7 && dc.status === 'pending' && (
                                          <AlertCircle className="h-3 w-3" />
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedDcId(dc.id);
                                        setDcDocumentModalOpen(true);
                                      }}
                                      className="w-8 h-8 flex items-center justify-center bg-teal-50 border border-teal-200 rounded-full text-teal-700 hover:bg-teal-100 transition-all shadow-xs"
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
                                      className="w-8 h-8 flex items-center justify-center bg-blue-50 border border-blue-200 rounded-full text-blue-700 hover:bg-blue-100 transition-all shadow-xs"
                                      title="Track Status & History"
                                    >
                                      <Activity className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePrint(dc);
                                      }}
                                      className="w-8 h-8 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-full text-slate-700 hover:bg-slate-100 transition-all shadow-xs"
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
                                      <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem
                                          onClick={() => {
                                            setSelectedDcId(dc.id);
                                            setDcDocumentModalOpen(true);
                                          }}
                                          className="gap-2"
                                        >
                                          <Eye className="h-4 w-4 text-teal-600" />
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
                                        <DropdownMenuItem onClick={() => handlePrint(dc)} className="gap-2">
                                          <Printer className="h-4 w-4 text-indigo-600" />
                                          Print DC
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleShare(dc)} className="gap-2">
                                          <Share2 className="h-4 w-4 text-amber-600" />
                                          Share PDF
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() => openActionDialog("return", dc)}
                                          disabled={dc.status !== "pending"}
                                          className="gap-2"
                                        >
                                          <User className="h-4 w-4" />
                                          Mark as Returned
                                        </DropdownMenuItem>
                                        {dc.status === "pending" && (
                                          <DropdownMenuItem onClick={() => openActionDialog("cancel", dc)} className="gap-2 text-orange-600">
                                            <AlertCircle className="h-4 w-4" />
                                            Cancel Case
                                          </DropdownMenuItem>
                                        )}
                                        {dc.status === "cancelled" && (
                                          <DropdownMenuItem onClick={() => restoreFromCancelled(dc)} className="gap-2">
                                            <Undo2 className="h-4 w-4" />
                                            Restore to Pending
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem
                                          onClick={() => openActionDialog("invoice", dc)}
                                          disabled={dc.status !== "returned"}
                                          className="gap-2"
                                        >
                                          <Receipt className="h-4 w-4" />
                                          Link Invoice
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleCreateCashMemoForDc(dc)}
                                          disabled={dc.status === "pending" || dc.status === "cancelled"}
                                          className="gap-2 font-bold text-blue-700 hover:bg-blue-50"
                                        >
                                          <Receipt className="h-4 w-4 text-blue-600" />
                                          Create Cash Memo
                                        </DropdownMenuItem>
                                        {dc.status === "completed" && (
                                          <DropdownMenuItem onClick={() => moveBackToReturned(dc)} className="gap-2">
                                            <Undo2 className="h-4 w-4" />
                                            Move back to Returned
                                          </DropdownMenuItem>
                                        )}
                                        {dc.status === "returned" && (
                                          <DropdownMenuItem onClick={() => cancelReturnToPending(dc)} className="gap-2">
                                            <Undo2 className="h-4 w-4" />
                                            Cancel Return
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => requestDelete(dc)} className="text-destructive gap-2">
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
                        <div className="hidden md:block border-2 border-slate-300 rounded-xl overflow-hidden shadow-xs bg-white">
                          <div className="max-h-[60vh] overflow-y-auto">
                            <table className="w-full border-separate border-spacing-0">
                              <thead>
                                <tr className="bg-slate-100/90 border-b-2 border-slate-300 sticky top-0 z-10 text-slate-800">
                                  <th className="text-center p-3 text-xs font-bold text-slate-700 w-[50px] border-r border-slate-300">
                                    Select
                                  </th>
                                  <th className="text-left p-3 text-xs font-bold text-slate-700 w-[110px] border-r border-slate-300">
                                    <SortableHeader sortKey="date">
                                      <Calendar className="h-3.5 w-3.5 mr-1" />
                                      Date
                                    </SortableHeader>
                                  </th>
                                  <th className="text-left p-3 text-xs font-bold text-slate-700 w-[100px] border-r border-slate-300">
                                    <SortableHeader sortKey="dcNo">
                                      DC No
                                    </SortableHeader>
                                  </th>
                                  {(activeQueue === "cash" || activeQueue === "completed" || activeQueue === "all") && (
                                    <th className="text-left p-3 text-xs font-bold text-slate-700 w-[150px] border-r border-slate-300">
                                      Invoice / Memo No
                                    </th>
                                  )}
                                  <th className="text-left p-3 text-xs font-bold text-slate-700 border-r border-slate-300 min-w-[200px]">
                                    <SortableHeader sortKey="party">
                                      Party Name
                                    </SortableHeader>
                                  </th>
                                  <th className="text-center p-3 text-xs font-bold text-slate-700 w-[80px] border-r border-slate-300">
                                    <SortableHeader sortKey="items">
                                      <Package className="h-3.5 w-3.5 mr-1" />
                                      Items
                                    </SortableHeader>
                                  </th>
                                  <th className="text-center p-3 text-xs font-bold text-slate-700 w-[70px] border-r border-slate-300">
                                    <SortableHeader sortKey="days">
                                      Days
                                    </SortableHeader>
                                  </th>
                                  <th className="text-left p-3 text-xs font-bold text-slate-700 w-[120px] border-r border-slate-300">
                                    Delivered
                                  </th>
                                  {(activeQueue === "returned" || activeQueue === "completed" || activeQueue === "cash") && (
                                    <th className="text-left p-3 text-xs font-bold text-slate-700 w-[120px] border-r border-slate-300">
                                      Returned
                                    </th>
                                  )}
                                  <th className="text-center p-3 text-xs font-bold text-slate-700 w-[100px] border-r border-slate-300">
                                    <SortableHeader sortKey="status">
                                      Status
                                    </SortableHeader>
                                  </th>
                                  <th className="text-center p-3 text-xs font-bold text-slate-700 w-[60px]">
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
                                      className={`border-b transition-colors cursor-pointer ${selectedDcId === dc.id
                                        ? 'bg-teal-50/80 border-teal-300 shadow-2xs font-semibold'
                                        : 'border-slate-200 hover:bg-slate-50'
                                        }`}
                                      onClick={() => {
                                        setSelectedDcId(dc.id);
                                      }}
                                    >
                                      <td className="p-3 text-center border-r-2 border-slate-200">
                                        <input
                                          type="radio"
                                          name="selected-dc"
                                          className="h-4 w-4 accent-blue-600 cursor-pointer"
                                          checked={selectedDcId === dc.id}
                                          onChange={() => setSelectedDcId(dc.id)}
                                          aria-label={`Select DC ${dc.dcNo}`}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      </td>
                                      <td className="p-3 border-r-2 border-slate-200">
                                        <div className="flex items-center gap-2">
                                          <Calendar className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedDcId(dc.id);
                                              setDetailsDialogOpen(true);
                                            }}
                                            className="text-sm font-medium hover:text-blue-700 transition-colors text-left"
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
                                          className="text-sm font-extrabold text-teal-800 hover:text-teal-900 hover:underline transition-colors"
                                        >
                                          {dc.dcNo}
                                        </button>
                                      </td>
                                      {(activeQueue === "cash" || activeQueue === "completed" || activeQueue === "all") && (
                                        <td className="p-3 border-r-2 border-slate-200">
                                          {dc.invoiceRef ? (
                                            (dc.isTaxInvoice || (!dc.cashAmount && !dc.invoiceRef.startsWith("SRR-"))) ? (
                                              <span
                                                className="inline-flex items-center gap-1 text-[11px] font-extrabold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-1 rounded shadow-2xs"
                                                title={`Tax Invoice Number: ${dc.invoiceRef}`}
                                              >
                                                <FileText className="w-3.5 h-3.5 text-purple-600" />
                                                <span>{dc.invoiceRef}</span>
                                              </span>
                                            ) : (
                                              <div className="flex flex-col gap-1 items-start">
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setViewingCashMemoRef(dc.invoiceRef!);
                                                    setCashMemoModalOpen(true);
                                                  }}
                                                  className="inline-flex items-center gap-1 text-[11px] font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded hover:bg-blue-100 hover:text-blue-800 transition-all cursor-pointer shadow-2xs"
                                                  title="Click to View Cash Memo"
                                                >
                                                  <Receipt className="w-3.5 h-3.5 text-blue-600" />
                                                  <span>{dc.invoiceRef}</span>
                                                </button>
                                                {dc.status === "cash" && (
                                                   <span
                                                     className={`inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded border ${
                                                       getCashMemoAgingDays(dc) > 15
                                                         ? "bg-rose-100 text-rose-800 border-rose-300 animate-pulse"
                                                         : getCashMemoAgingDays(dc) > 7
                                                         ? "bg-amber-100 text-amber-800 border-amber-300"
                                                         : "bg-blue-50 text-blue-700 border-blue-200"
                                                     }`}
                                                     title={`Unpaid for ${getCashMemoAgingDays(dc)} days`}
                                                   >
                                                     ● UNPAID {dc.cashAmount ? `₹${dc.cashAmount}` : ''} ({getCashMemoAgingDays(dc)}d)
                                                   </span>
                                                 )}
                                                {dc.status === "completed" && dc.cashAmount && (
                                                  <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-1.5 py-0.2 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded" title="Cash Memo Paid">
                                                    ✓ PAID ₹{dc.cashAmount}
                                                  </span>
                                                )}
                                              </div>
                                            )
                                          ) : (
                                            <span className="text-xs text-slate-400 font-medium">-</span>
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
                                          className="text-sm font-semibold text-slate-900 hover:text-teal-800 transition-colors text-left break-words whitespace-normal"
                                        >
                                          {dc.hospitalName}
                                        </button>
                                      </td>
                                      <td className="p-3 text-center border-r-2 border-slate-200">
                                        <div className="flex items-center justify-center gap-1">
                                          <Badge variant="outline" className="text-xs font-medium border-slate-300">
                                            {totalQty}
                                          </Badge>
                                        </div>
                                      </td>
                                      <td className="p-3 text-center border-r-2 border-slate-200">
                                        <div className={`text-sm font-medium ${daysPending > 7 && dc.status === 'pending' ? 'text-red-600' : 'text-slate-600'}`}>
                                          {daysPending}d
                                          {daysPending > 7 && dc.status === 'pending' && (
                                            <AlertCircle className="h-3 w-3 inline ml-1" />
                                          )}
                                        </div>
                                      </td>
                                      <td className="p-3 border-r-2 border-slate-200">
                                        <div className="text-xs font-medium truncate max-w-[110px]" title={dc.deliveredBy}>
                                          {dc.deliveredBy || "-"}
                                        </div>
                                      </td>
                                      {(activeQueue === "returned" || activeQueue === "completed" || activeQueue === "cash") && (
                                        <td className="p-3 border-r-2 border-slate-200">
                                          <div className="text-xs font-medium truncate max-w-[110px]" title={dc.returnedBy}>
                                            {dc.returnedBy || "-"}
                                          </div>
                                        </td>
                                      )}
                                      <td className="p-3 border-r-2 border-slate-200">
                                        <div className="flex justify-center">
                                          <Badge className={`${getStatusBadgeClass(dc.status)} flex items-center gap-1 text-xs font-medium border px-1.5 py-0.5`}>
                                            {getStatusIcon(dc.status)}
                                            {dc.status.charAt(0).toUpperCase() + dc.status.slice(1)}
                                          </Badge>
                                        </div>
                                      </td>
                                      <td className="p-3 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedDcId(dc.id);
                                              setDcDocumentModalOpen(true);
                                            }}
                                            className="w-8 h-8 flex items-center justify-center bg-teal-50 border border-teal-200 rounded-full text-teal-700 hover:bg-teal-100 transition-all shadow-xs"
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
                                            className="w-8 h-8 flex items-center justify-center bg-blue-50 border border-blue-200 rounded-full text-blue-700 hover:bg-blue-100 transition-all shadow-xs"
                                            title="Track Status & History"
                                          >
                                            <Activity className="w-4 h-4 text-blue-700" />
                                          </button>
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handlePrint(dc);
                                            }}
                                            className="w-8 h-8 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-full text-slate-700 hover:bg-slate-100 transition-all shadow-xs"
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
                                                disabled={loadingDcIds.has(dc.id)}
                                                title="Actions"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                {loadingDcIds.has(dc.id) ? (
                                                  <RefreshCw className="h-4 w-4 text-slate-600 animate-spin" />
                                                ) : (
                                                  <Edit className="h-4 w-4 text-slate-600" />
                                                )}
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                              <DropdownMenuItem
                                                onClick={() => {
                                                  setSelectedDcId(dc.id);
                                                  setDcDocumentModalOpen(true);
                                                }}
                                                className="gap-2"
                                              >
                                                <Eye className="h-4 w-4 text-teal-600" />
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
                                              <DropdownMenuItem onClick={() => handlePrint(dc)} className="gap-2">
                                                <Printer className="h-4 w-4 text-indigo-600" />
                                                Print DC
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => handleShare(dc)} className="gap-2">
                                                <Share2 className="h-4 w-4 text-amber-600" />
                                                Share PDF
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                              onClick={() => openActionDialog("return", dc)}
                                              disabled={dc.status !== "pending"}
                                              className="gap-2"
                                            >
                                              <User className="h-4 w-4" />
                                              Mark as Returned
                                            </DropdownMenuItem>
                                            {dc.status === "pending" && (
                                              <DropdownMenuItem onClick={() => openActionDialog("cancel", dc)} className="gap-2 text-orange-600">
                                                <AlertCircle className="h-4 w-4" />
                                                Cancel Case
                                              </DropdownMenuItem>
                                            )}
                                            {dc.status === "cancelled" && (
                                              <DropdownMenuItem onClick={() => restoreFromCancelled(dc)} className="gap-2">
                                                <Undo2 className="h-4 w-4" />
                                                Restore to Pending
                                              </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem
                                              onClick={() => openActionDialog("invoice", dc)}
                                              disabled={dc.status !== "returned"}
                                              className="gap-2"
                                            >
                                              <Receipt className="h-4 w-4" />
                                              Link Invoice
                                            </DropdownMenuItem>
                                            {dc.status === "returned" && !dc.invoiceRef && (
                                              <DropdownMenuItem
                                                onClick={() => handleCreateCashMemoForDc(dc)}
                                                className="gap-2 font-bold text-blue-700 hover:bg-blue-50"
                                              >
                                                <Receipt className="h-4 w-4 text-blue-600" />
                                                Create Cash Memo
                                              </DropdownMenuItem>
                                            )}
                                            {dc.invoiceRef && (dc.isTaxInvoice || (!dc.cashAmount && !dc.invoiceRef.startsWith("SRR-"))) && (
                                              <DropdownMenuItem disabled className="gap-2 font-bold text-purple-800 bg-purple-50">
                                                <FileText className="h-4 w-4 text-purple-600" />
                                                Tax Invoice: {dc.invoiceRef}
                                              </DropdownMenuItem>
                                            )}
                                            {dc.invoiceRef && !(dc.isTaxInvoice || (!dc.cashAmount && !dc.invoiceRef.startsWith("SRR-"))) && (
                                              <>
                                                <DropdownMenuItem
                                                  onClick={() => {
                                                    setViewingCashMemoRef(dc.invoiceRef!);
                                                    setCashMemoModalOpen(true);
                                                  }}
                                                  className="gap-2 font-bold text-blue-700 hover:bg-blue-50"
                                                >
                                                  <Receipt className="h-4 w-4 text-blue-600" />
                                                  View Cash Memo ({dc.invoiceRef})
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleShareWhatsApp(dc)} className="gap-2">
                                                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                                                  Share via WhatsApp
                                                </DropdownMenuItem>
                                                {dc.status === "cash" && (
                                                  <DropdownMenuItem
                                                    onClick={() => {
                                                      setPaymentDialog({ open: true, dc });
                                                    }}
                                                    className="gap-2 font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                                                  >
                                                    <Wallet className="h-4 w-4 text-emerald-600" />
                                                    Record Cash Payment
                                                  </DropdownMenuItem>
                                                )}
                                              </>
                                            )}
                                            {dc.status === "completed" && (
                                              <DropdownMenuItem onClick={() => moveBackToReturned(dc)} className="gap-2">
                                                <Undo2 className="h-4 w-4" />
                                                Move back to Returned
                                              </DropdownMenuItem>
                                            )}
                                            {dc.status === "returned" && (
                                              <DropdownMenuItem onClick={() => cancelReturnToPending(dc)} className="gap-2">
                                                <Undo2 className="h-4 w-4" />
                                                Cancel Return (Back to Pending)
                                              </DropdownMenuItem>
                                            )}
                                            {dc.status === "cash" && (
                                              <DropdownMenuItem
                                                onClick={() => openActionDialog("invoice", dc)}
                                                className="gap-2"
                                              >
                                                <Receipt className="h-4 w-4" />
                                                Link Invoice (Move to Completed)
                                              </DropdownMenuItem>
                                            )}
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => requestDelete(dc)} className="text-destructive gap-2">
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

                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>

      {/* Action Dialogs */}
      <Dialog
        open={actionDialog.type !== null && actionDialog.dc !== null}
        onOpenChange={(open) => {
          if (!open) closeActionDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === "return" && "Mark as Returned"}
              {actionDialog.type === "invoice" && "Link Invoice"}
              {actionDialog.type === "cash" && "Move to Cash Queue"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Update the selected delivery challan status and related fields.
            </DialogDescription>
          </DialogHeader>
          {actionDialog.type === "return" && actionDialog.dc && (
            <div className="space-y-4 pt-2">
              <div>
                <Label>Returned By *</Label>
                <Input
                  value={returnedByInput}
                  onChange={(e) => setReturnedByInput(e.target.value)}
                  placeholder="Enter name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Return Remarks</Label>
                <Textarea
                  value={returnedRemarksInput}
                  onChange={(e) => setReturnedRemarksInput(e.target.value)}
                  placeholder="Add return remarks"
                  className="mt-1 resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleConfirmReturn(actionDialog.dc!)}
                  disabled={isActionLoading}
                  className="gap-2"
                >
                  {isActionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {isActionLoading ? 'Saving...' : 'Confirm Return'}
                </Button>
                <Button variant="outline" onClick={closeActionDialog} disabled={isActionLoading}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {actionDialog.type === "invoice" && actionDialog.dc && (
            <div className="space-y-4 pt-2">
              <div>
                <Label>Invoice No *</Label>
                <Input
                  value={invoiceRefInput}
                  onChange={(e) => setInvoiceRefInput(e.target.value)}
                  placeholder="Enter invoice number"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Invoice Remarks</Label>
                <Textarea
                  value={invoiceRemarksInput}
                  onChange={(e) => setInvoiceRemarksInput(e.target.value)}
                  placeholder="Add invoice remarks"
                  className="mt-1 resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleConfirmInvoice(actionDialog.dc!)}
                  disabled={isActionLoading}
                  className="gap-2"
                >
                  {isActionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {isActionLoading ? 'Saving...' : 'Link Invoice'}
                </Button>
                <Button variant="outline" onClick={closeActionDialog} disabled={isActionLoading}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {actionDialog.type === "cash" && actionDialog.dc && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                This will move the DC to the Cash queue.
              </p>
              <div>
                <Label className="flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-blue-700" />
                  Cash Amount *
                </Label>
                <div className="mt-1 flex items-center rounded-md border border-slate-300 bg-slate-50 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/30">
                  <span className="px-3 text-sm font-medium text-slate-600">₹</span>
                  <Input
                    type="number"
                    value={cashAmountInput}
                    onChange={(e) => setCashAmountInput(e.target.value)}
                    placeholder="0.00"
                    className="h-9 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                    min="0"
                    step="0.01"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Required to move the DC to Cash queue.</p>
              </div>
              <div>
                <Label>Cash Remarks</Label>
                <Textarea
                  value={cashRemarksInput}
                  onChange={(e) => setCashRemarksInput(e.target.value)}
                  placeholder="Add cash remarks"
                  className="mt-1 resize-none"
                  rows={3}
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={() => handleCreateCashMemoForDc(actionDialog.dc!)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 flex-1"
                >
                  <Receipt className="w-4 h-4" />
                  Create Cash Memo (Prefilled)
                </Button>
                <Button
                  onClick={() => handleConfirmCash(actionDialog.dc!)}
                  disabled={isActionLoading}
                  variant="outline"
                  className="gap-2"
                >
                  {isActionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {isActionLoading ? 'Saving...' : 'Move to Cash Queue'}
                </Button>
                <Button variant="ghost" onClick={closeActionDialog} disabled={isActionLoading}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {actionDialog.type === "cancel" && actionDialog.dc && (
            <div className="space-y-4 pt-2">
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
                <p className="text-sm text-orange-800">
                  <strong>Warning:</strong> You are about to cancel this case. Add details why case is cancelled
                </p>
              </div>
              <div>
                <Label>Cancellation Reason *</Label>
                <Textarea
                  value={cancelledRemarksInput}
                  onChange={(e) => setCancelledRemarksInput(e.target.value)}
                  placeholder="Why is this case being cancelled?"
                  className="mt-1 resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleConfirmCancel(actionDialog.dc!)}
                  disabled={isActionLoading}
                  className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {isActionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {isActionLoading ? 'Submitting...' : 'Submit'}
                </Button>
                <Button variant="outline" onClick={closeActionDialog} disabled={isActionLoading}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cash Memo Viewer Modal Popup */}
      <Dialog open={cashMemoModalOpen} onOpenChange={setCashMemoModalOpen}>
        <DialogContent className="max-w-5xl h-[90vh] p-0 flex flex-col overflow-hidden bg-slate-900 border-slate-700">
          <DialogHeader className="p-3 sm:p-4 bg-slate-900 text-white flex flex-row items-center justify-between border-b border-slate-800">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-white">
              <Receipt className="h-5 w-5 text-blue-400" />
              Cash Memo Details — {viewingCashMemoRef}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full h-full bg-slate-950">
            {viewingCashMemoRef && (
              <iframe
                src={`/cash-invoice/index.html?viewInv=${encodeURIComponent(viewingCashMemoRef)}`}
                className="w-full h-full border-0"
                title={`Cash Memo ${viewingCashMemoRef}`}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* DC Document Preview Modal (View DC like Print) */}
      <Dialog open={dcDocumentModalOpen} onOpenChange={setDcDocumentModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-3 sm:p-6 bg-slate-100 dark:bg-slate-900">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-300">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-slate-900">
              <FileText className="h-5 w-5 text-teal-700" />
              Delivery Challan Document — {selectedDc?.dcNo}
            </DialogTitle>
            <div className="flex items-center gap-2">
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
                <Share2 className="h-3.5 w-3.5 text-amber-600" /> Share PDF
              </Button>
            </div>
          </DialogHeader>

          {!selectedDc ? (
            <div className="text-sm text-slate-600 p-4">Select a DC to view document preview.</div>
          ) : (
            <div className="bg-white p-4 sm:p-8 rounded-xl shadow-lg border border-slate-300 text-slate-900 space-y-5 font-sans">
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
                    Hyderabad, India • Mobile: +91 9396857455, +91 8686559393 • Web: srrorthoplus.com
                  </p>
                </div>
                <div className="bg-teal-50 border border-teal-200 px-4 py-2 rounded-xl text-left sm:text-right shrink-0">
                  <div className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">DELIVERY CHALLAN</div>
                  <div className="text-base sm:text-xl font-black text-teal-950">{selectedDc.dcNo}</div>
                  <div className="text-xs text-slate-600 font-semibold">{formatDate(getDisplayDate(selectedDc))}</div>
                </div>
              </div>

              {/* Party & Personnel Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">Hospital / Party Name:</span>
                  <span className="font-extrabold text-slate-900 text-sm">{selectedDc.hospitalName}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">Material Type:</span>
                  <span className="font-semibold text-slate-800">{selectedDc.materialType || 'SS'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">Delivered By:</span>
                  <span className="font-semibold text-slate-800">{selectedDc.deliveredBy || '-'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">Received By:</span>
                  <span className="font-semibold text-slate-800">{selectedDc.receivedBy || '-'}</span>
                </div>
              </div>

              {/* Despatched Items Table - Clean procedure bold header, no procedure column */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Despatched Items List</h3>
                  <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    Total Qty: {getTotalQty(selectedDc)}
                  </span>
                </div>
                <div className="border border-slate-300 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white font-bold">
                        <th className="p-2.5 border-r border-slate-700 w-10 text-center">S.No</th>
                        <th className="p-2.5 border-r border-slate-700">Item Description</th>
                        <th className="p-2.5 text-center w-20">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(() => {
                        const grouped: Record<string, typeof selectedDc.items> = {};
                        selectedDc.items.forEach((item) => {
                          const proc = item.procedure || 'General Items';
                          if (!grouped[proc]) grouped[proc] = [];
                          grouped[proc].push(item);
                        });

                        return Object.entries(grouped).map(([procName, items]) => (
                          <Fragment key={procName}>
                            {/* Procedure Header Row - Bold in first cell */}
                            <tr className="bg-slate-100 font-bold border-b border-slate-300">
                              <td colSpan={3} className="p-2.5 text-left font-bold text-slate-900 bg-slate-100">
                                {procName}
                              </td>
                            </tr>
                            {items.map((item, idx) => {
                              const totalQty = item.sizes.reduce((sum, size) => sum + size.qty, 0);
                              const sizeStr = item.sizes
                                .filter((s) => s.size)
                                .map((s) => `${s.size} (Qty: ${s.qty})`)
                                .join(', ');

                              return (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                  <td className="p-2.5 text-center font-bold text-slate-500 border-r border-slate-200">{idx + 1}</td>
                                  <td className="p-2.5 font-bold text-slate-900 border-r border-slate-200">
                                    <div>{item.name}</div>
                                    {sizeStr && <div className="text-[11px] text-slate-600 font-normal mt-0.5">{sizeStr}</div>}
                                  </td>
                                  <td className="p-2.5 text-center font-extrabold text-teal-800 text-sm">{totalQty}</td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Instruments Details */}
              {selectedDc.instruments && selectedDc.instruments.length > 0 && (
                <div className="border-t border-slate-200 pt-3 text-xs">
                  <span className="font-bold text-slate-800 block uppercase tracking-wider text-[10px] mb-1">Instruments Details:</span>
                  <div className="text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-medium">
                    {selectedDc.instruments.join(', ')}
                  </div>
                </div>
              )}

              {/* Box Numbers */}
              {selectedDc.boxNumbers && selectedDc.boxNumbers.length > 0 && (
                <div className="border-t border-slate-200 pt-3 text-xs">
                  <span className="font-bold text-slate-800 block uppercase tracking-wider text-[10px] mb-1">Box Numbers:</span>
                  <div className="text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-medium">
                    {selectedDc.boxNumbers.join(', ')}
                  </div>
                </div>
              )}

              {/* Remarks */}
              {selectedDc.remarks && (
                <div className="border-t border-slate-200 pt-2 text-xs">
                  <span className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">Remarks / Instructions:</span>
                  <p className="text-slate-700 mt-0.5 italic bg-amber-50/60 p-2 rounded border border-amber-200">{selectedDc.remarks}</p>
                </div>
              )}

              {/* Signatures */}
              <div className="flex justify-between items-end border-t-2 border-slate-300 pt-12 mt-12 text-xs text-slate-600">
                <div>
                  <div className="border-t-2 border-slate-400 w-36 text-center pt-1 font-bold text-slate-800">Receiver Sign</div>
                </div>
                <div>
                  <div className="border-t-2 border-slate-400 w-48 text-center pt-1 font-extrabold text-teal-900">For Sri Raja Rajeshwari Ortho Plus</div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Details Modal */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto p-4 sm:p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-700" />
              {selectedDc ? `DC ${selectedDc.dcNo}` : "DC Details"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              View delivery challan details, items, instruments, notes, and history.
            </DialogDescription>
          </DialogHeader>

          {!selectedDc ? (
            <div className="text-sm text-slate-600">Select a DC to view details.</div>
          ) : (
            <div className="space-y-3">
              {/* Header strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge className={`${getStatusBadgeClass(selectedDc.status)} flex items-center gap-1.5 text-xs font-medium border px-2 py-1`}>
                      {getStatusIcon(selectedDc.status)}
                      {selectedDc.status.toUpperCase()}
                    </Badge>
                    <div className="text-sm font-semibold text-slate-900 truncate">{selectedDc.hospitalName}</div>
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    Date: <span className="font-medium text-slate-800">{formatDate(getDisplayDate(selectedDc))}</span>
                    <span className="mx-2 text-slate-300">|</span>
                    Items: <span className="font-medium text-slate-800">{getTotalQty(selectedDc)}</span>
                    <span className="mx-2 text-slate-300">|</span>
                    Received: <span className="font-medium text-slate-800">{selectedDc.receivedBy || "-"}</span>
                    <span className="mx-2 text-slate-300">|</span>
                    Delivered: <span className="font-medium text-slate-800">{selectedDc.deliveredBy || "-"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                    onClick={() => handlePrint(selectedDc)}
                    title="Print"
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                    onClick={() => handleShare(selectedDc)}
                    title="Share PDF"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => requestDelete(selectedDc)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="overview">
                <TabsList className="w-full justify-start bg-slate-50 border border-slate-200">
                  <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="items" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    Items & Instruments
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    Notes
                  </TabsTrigger>
                  <TabsTrigger value="history" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    History
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-3 space-y-3">
                  {/* Tracking + actions (courier-tracking style) */}
                  <div className="rounded-md border border-slate-200 bg-white p-2.5 sm:p-3">
                    <div className="space-y-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-700">Tracking</div>
                        <div className="mt-2 text-xs text-slate-600">
                          {(() => {
                            const step1Done = true;
                            const step2Done = selectedDc.status !== "pending" && selectedDc.status !== "cancelled";
                            const step3Done = selectedDc.status === "completed" || selectedDc.status === "cash";
                            const step3Label = selectedDc.status === "cash" ? "Cash" : "Done";
                            const isCancelled = selectedDc.status === "cancelled";

                            const dot = (done: boolean, active: boolean, cancelled?: boolean) =>
                              cancelled
                                ? "bg-slate-500 border-slate-500"
                                : done
                                  ? "bg-blue-600 border-blue-600"
                                  : active
                                    ? "bg-white border-blue-600"
                                    : "bg-white border-slate-300";
                            const line = (done: boolean) => (done ? "bg-blue-600" : "bg-slate-200");

                            return (
                              <div className="flex items-center gap-1.5 sm:gap-2 w-full">
                                <div className="flex items-center gap-1 sm:gap-2">
                                  <span className={`h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full border flex-shrink-0 ${dot(step1Done, selectedDc.status === "pending")}`} />
                                  <span className="font-medium text-slate-800 text-[10px] sm:text-xs">Created</span>
                                </div>
                                <div className={`h-0.5 flex-1 rounded ${line(step2Done)}`} />
                                {isCancelled ? (
                                  <div className="flex items-center gap-1 sm:gap-2">
                                    <span className={`h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full border flex-shrink-0 ${dot(true, true, true)}`} />
                                    <span className="font-bold text-slate-800 text-[10px] sm:text-xs">CANCELLED</span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-1 sm:gap-2">
                                      <span className={`h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full border flex-shrink-0 ${dot(step2Done, selectedDc.status === "returned")}`} />
                                      <span className="font-medium text-slate-800 text-[10px] sm:text-xs">Return</span>
                                    </div>
                                    <div className={`h-0.5 flex-1 rounded ${line(step3Done)}`} />
                                    <div className="flex items-center gap-1 sm:gap-2">
                                      <span className={`h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full border flex-shrink-0 ${dot(step3Done, selectedDc.status === "completed" || selectedDc.status === "cash")}`} />
                                      <span className="font-medium text-slate-800 text-[10px] sm:text-xs">{step3Label}</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="mt-2 text-[10px] sm:text-xs text-slate-600">
                          <span className="block sm:inline">Created: <span className="font-medium text-slate-800">{formatDateTime(selectedDc.savedAt)}</span></span>
                          <span className="hidden sm:inline mx-2 text-slate-300">|</span>
                          <span className="block sm:inline mt-0.5 sm:mt-0">Returned: <span className="font-medium text-slate-800">{selectedDc.returnedAt ? formatDateTime(selectedDc.returnedAt) : "-"}</span></span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 sm:gap-2 h-7 sm:h-8 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
                          disabled={selectedDc.status !== "pending"}
                          onClick={() => openActionDialog("return", selectedDc)}
                        >
                          <User className="h-3 w-3 sm:h-4 sm:w-4" /> Return
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 sm:gap-2 h-7 sm:h-8 text-xs border-green-300 text-green-700 hover:bg-green-50 hover:text-green-800"
                          disabled={selectedDc.status !== "returned"}
                          onClick={() => openActionDialog("invoice", selectedDc)}
                        >
                          <Receipt className="h-3 w-3 sm:h-4 sm:w-4" /> Invoice
                        </Button>
                        {selectedDc.status === "returned" && !selectedDc.invoiceRef && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 sm:gap-2 h-7 sm:h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-50 hover:text-blue-800 font-bold"
                            onClick={() => handleCreateCashMemoForDc(selectedDc)}
                          >
                            <Receipt className="h-3 w-3 sm:h-4 sm:w-4" /> Create Cash Memo
                          </Button>
                        )}
                        {selectedDc.invoiceRef && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 sm:gap-2 h-7 sm:h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-50 hover:text-blue-800 font-bold"
                            onClick={() => {
                              setDetailsDialogOpen(false);
                              setViewingCashMemoRef(selectedDc.invoiceRef!);
                              setCashMemoModalOpen(true);
                            }}
                          >
                            <Receipt className="h-3 w-3 sm:h-4 sm:w-4" /> View Cash Memo ({selectedDc.invoiceRef})
                          </Button>
                        )}
                        {selectedDc.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 sm:gap-2 h-7 sm:h-8 text-xs border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                            onClick={() => openActionDialog("cancel", selectedDc)}
                          >
                            <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" /> Cancel Case
                          </Button>
                        )}
                        {selectedDc.status === "cancelled" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 sm:gap-2 h-7 sm:h-8 text-xs border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-800"
                            onClick={() => restoreFromCancelled(selectedDc)}
                          >
                            <Undo2 className="h-3 w-3 sm:h-4 sm:w-4" /> Restore
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="text-xs font-semibold text-slate-700 mb-2">Timeline</div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
                          <span className="text-slate-500">Delivered By</span>
                          <span className="font-medium text-slate-800">{selectedDc.deliveredBy || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
                          <span className="text-slate-500">Created</span>
                          <span className="font-medium text-slate-800">{formatDateTime(selectedDc.savedAt)}</span>
                        </div>
                        {selectedDc.status === "cancelled" && (
                          <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
                            <span className="text-slate-500">Cancelled At</span>
                            <span className="font-medium text-red-600">{selectedDc.cancelledAt ? formatDateTime(selectedDc.cancelledAt) : "-"}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Returned</span>
                          <span className="font-medium text-slate-800">{selectedDc.returnedAt ? formatDateTime(selectedDc.returnedAt) : "-"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Cash At</span>
                          <span className="font-medium text-slate-800">{(selectedDc as any).cashAt ? formatDateTime((selectedDc as any).cashAt) : "-"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-slate-600" />
                        Invoice / Cash
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Invoice No</span>
                          <span className="font-medium text-slate-800">{selectedDc.invoiceRef || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Cash Amount</span>
                          <span className="font-semibold text-green-700">
                            {typeof (selectedDc as any).cashAmount === "number"
                              ? `₹${(selectedDc as any).cashAmount.toFixed(2)}`
                              : "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-3">
                  <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50">
                      <div className="text-xs font-semibold text-slate-700">Detailed Transaction Audit</div>
                      <Badge variant="outline" className="border-slate-300 text-slate-700">{selectedDc.history?.length || 0} events</Badge>
                    </div>
                    <div className="p-3">
                      <div className="space-y-4">
                        {(selectedDc.history || [])
                          .slice()
                          .reverse()
                          .map((h, idx) => (
                            <div key={`${h.at}-${idx}`} className="relative pl-6 pb-4 last:pb-0 border-l-2 border-slate-100 last:border-l-0">
                              <div className="absolute left-[-9px] top-0 h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-sm" />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-1">
                                  <div className="font-semibold text-sm text-slate-900">
                                    {h.action.replace(/_/g, " ")}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    {formatDateTime(h.at)}
                                  </div>
                                </div>
                                <div className="text-xs text-slate-600 mb-2">
                                  {h.fromStatus ? (
                                    <span className="inline-flex items-center">
                                      <Badge variant="outline" className="text-[9px] h-4 py-0 px-1 font-normal opacity-70 uppercase">{h.fromStatus}</Badge>
                                      <span className="mx-1 text-slate-400">→</span>
                                      <Badge variant="outline" className="text-[9px] h-4 py-0 px-1 font-normal uppercase">{h.toStatus}</Badge>
                                    </span>
                                  ) : (
                                    <Badge variant="outline" className="text-[9px] h-4 py-0 px-1 font-normal uppercase">{h.toStatus}</Badge>
                                  )}
                                </div>
                                {h.meta && Object.keys(h.meta).length > 0 && (
                                  <div className="bg-slate-50 rounded border border-slate-100 p-2 mt-1">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {Object.entries(h.meta).map(([key, val]) => (
                                        <div key={key} className="text-[10px]">
                                          <span className="text-slate-500 font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>{" "}
                                          <span className="text-slate-800">{String(val)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        {(selectedDc.history || []).length === 0 && (
                          <div className="text-center py-6 text-slate-500 text-sm">
                            No history available for this DC.
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
                        <div className="text-xs font-semibold text-slate-700">Items</div>
                        <Badge variant="outline" className="border-slate-300 text-slate-700">{getTotalQty(selectedDc)} qty</Badge>
                      </div>
                      <div className="max-h-[35vh] overflow-auto">
                        <table className="w-full text-sm border-separate border-spacing-0">
                          <thead className="sticky top-0 z-10">
                            <tr className="bg-slate-100 border-b border-slate-200">
                              <th className="text-left px-3 py-2 text-xs font-semibold text-slate-700 border-b border-slate-200">Item</th>
                              <th className="text-left px-3 py-2 text-xs font-semibold text-slate-700 border-b border-slate-200">Procedure</th>
                              <th className="text-left px-3 py-2 text-xs font-semibold text-slate-700 border-b border-slate-200">Sizes</th>
                              <th className="text-right px-3 py-2 text-xs font-semibold text-slate-700 border-b border-slate-200">Qty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedDc.items.map((item, idx) => {
                              const itemQty = item.sizes.reduce((sum, size) => sum + size.qty, 0);
                              const sizeDetails = item.sizes
                                .filter((size) => size.size)
                                .map((size) => `${size.size} (${size.qty})`)
                                .join(", ");
                              return (
                                <tr key={idx} className="border-b border-slate-200">
                                  <td className="px-3 py-2 font-medium text-slate-900">{item.name}</td>
                                  <td className="px-3 py-2 text-slate-600">{item.procedure}</td>
                                  <td className="px-3 py-2 text-slate-600">{sizeDetails || "-"}</td>
                                  <td className="px-3 py-2 text-right font-semibold text-slate-900">{itemQty}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="text-xs font-semibold text-slate-700 mb-2">Instruments</div>
                        <div className="text-sm bg-slate-50 border border-slate-200 rounded px-2 py-2 min-h-[60px]">
                          {selectedDc.instruments?.length ? selectedDc.instruments.join(", ") : "-"}
                        </div>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="text-xs font-semibold text-slate-700 mb-2">Box Numbers</div>
                        <div className="text-sm bg-slate-50 border border-slate-200 rounded px-2 py-2 min-h-[60px]">
                          {selectedDc.boxNumbers?.length ? selectedDc.boxNumbers.join(", ") : "-"}
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="notes" className="mt-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="text-xs font-semibold text-slate-700 mb-2">Initial Remarks</div>
                      <div className="text-sm bg-slate-50 border border-slate-200 rounded px-2 py-2 min-h-[72px]">
                        {selectedDc.remarks || "-"}
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="text-xs font-semibold text-slate-700 mb-2">Return Remarks</div>
                      <div className="text-sm bg-slate-50 border border-slate-200 rounded px-2 py-2 min-h-[72px]">
                        {selectedDc.returnedRemarks || "-"}
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="text-xs font-semibold text-slate-700 mb-2">Invoice Remarks</div>
                      <div className="text-sm bg-slate-50 border border-slate-200 rounded px-2 py-2 min-h-[72px]">
                        {selectedDc.invoiceRemarks || "-"}
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="text-xs font-semibold text-slate-700 mb-2">Cash Remarks</div>
                      <div className="text-sm bg-slate-50 border border-slate-200 rounded px-2 py-2 min-h-[72px]">
                        {selectedDc.cashRemarks || "-"}
                      </div>
                    </div>
                    {selectedDc.status === "cancelled" && (
                      <div className="rounded-md border border-slate-200 bg-orange-50 p-3 md:col-span-2">
                        <div className="text-xs font-semibold text-orange-700 mb-2">Cancellation Remarks</div>
                        <div className="text-sm bg-white border border-orange-200 rounded px-2 py-2 min-h-[72px] text-orange-900 font-medium">
                          {selectedDc.cancelledRemarks || "No reason provided."}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold text-slate-700 mb-2">History</div>
                    {selectedDc.history?.length ? (
                      <div className="space-y-2">
                        {[...selectedDc.history]
                          .slice(-12)
                          .reverse()
                          .map((h: SavedDcHistoryEvent, idx: number) => (
                            <div key={`${h.at}-${idx}`} className="flex items-start justify-between gap-3 text-xs">
                              <div className="min-w-0">
                                <div className="font-medium text-slate-900">
                                  {h.action.replace(/_/g, " ")}
                                </div>
                                <div className="text-slate-600">
                                  {h.fromStatus ? `${h.fromStatus.toUpperCase()} → ` : ""}
                                  {h.toStatus.toUpperCase()}
                                </div>
                              </div>
                              <div className="text-slate-500 whitespace-nowrap">{formatDateTime(h.at)}</div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-600">No history yet.</div>
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
        onOpenChange={(open) => setDeleteDialog({ open, dc: open ? deleteDialog.dc : null })}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription className="sr-only">
              Enter password to delete non-pending delivery challans.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Deleting a <span className="font-medium">{deleteDialog.dc?.status?.toUpperCase()}</span> DC requires a password.
            </p>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter password"
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDeleteDialog({ open: false, dc: null })}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmProtectedDelete}>
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Password Dialog */}
      <Dialog open={adminPasswordOpen} onOpenChange={setAdminPasswordOpen}>
        <DialogContent className="max-w-sm border-2 border-slate-300 shadow-xl rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-blue-700" />
              Admin Access
            </DialogTitle>
            <DialogDescription>
              Please enter the administrator password to manage procedures and items.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="admin-pass">Password</Label>
              <Input
                id="admin-pass"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Manager password"
                className="border-slate-300 focus:border-blue-500 rounded-lg"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmAdminAccess();
                }}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAdminPasswordOpen(false)} className="rounded-lg">
                Cancel
              </Button>
              <Button onClick={confirmAdminAccess} className="bg-blue-700 hover:bg-blue-800 text-white rounded-lg">
                Enter Admin Panel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Record Payment Dialog */}
      <Dialog
        open={paymentDialog.open}
        onOpenChange={(open) => setPaymentDialog({ open, dc: open ? paymentDialog.dc : null })}
      >
        <DialogContent className="max-w-sm border-2 border-slate-300 shadow-xl rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-600" />
              Record Cash Payment
            </DialogTitle>
            <DialogDescription>
              Record cash memo payment for DC <strong>{paymentDialog.dc?.dcNo}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Paid Amount (INR)</Label>
              <Input
                id="payment-amount"
                type="number"
                value={paymentAmountInput}
                onChange={(e) => setPaymentAmountInput(e.target.value)}
                placeholder={paymentDialog.dc?.cashAmount ? String(paymentDialog.dc.cashAmount) : "Enter amount"}
                className="border-slate-300 focus:border-emerald-500 rounded-lg font-bold text-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-remarks">Payment Notes</Label>
              <Input
                id="payment-remarks"
                type="text"
                value={paymentRemarksInput}
                onChange={(e) => setPaymentRemarksInput(e.target.value)}
                placeholder="e.g. Received full cash payment"
                className="border-slate-300 focus:border-emerald-500 rounded-lg text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPaymentDialog({ open: false, dc: null })} className="rounded-lg">
                Cancel
              </Button>
              <Button onClick={handleQuickRecordPayment} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1">
                Confirm Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SavedDcs;
