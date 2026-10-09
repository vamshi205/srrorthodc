import React, { useState } from "react";
import {
  Truck,
  RotateCcw,
  Wallet,
  CheckCircle2,
  Ban,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Receipt,
  Link,
  ShoppingBag,
  AlertCircle,
  Undo2,
  Layers,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SavedDcStatus } from "@/lib/savedDcStorage";

interface DcWorkflowMapProps {
  activeQueue: SavedDcStatus;
  onSelectQueue: (queue: SavedDcStatus) => void;
  statusCounts: Record<SavedDcStatus, number>;
}

export const DcWorkflowMap: React.FC<DcWorkflowMapProps> = ({
  activeQueue,
  onSelectQueue,
  statusCounts,
}) => {
  // Default hide it as requested by user
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full mb-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden shadow-2xs transition-all duration-300">
      {/* Header Banner Strip (Click to Expand / Collapse) */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-3.5 py-2.5 bg-slate-50/90 dark:bg-slate-900/80 hover:bg-slate-100/90 dark:hover:bg-slate-900 flex items-center justify-between cursor-pointer select-none transition-colors border-b border-slate-200/60 dark:border-slate-800/60"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-7 w-7 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 border border-teal-300 dark:border-teal-800">
            <Layers className="h-3.5 w-3.5" />
          </div>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
              DC Lifecycle Workflow Map
            </span>
            <Badge className="bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800 text-[10px] px-1.5 py-0 font-semibold">
              All Pathways & Possibilities
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline">
            {isOpen ? "Hide Workflow Map" : "View Workflow Map"}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 p-0 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Expanded Workflow Map Nodes */}
      {isOpen && (
        <div className="p-3.5 sm:p-4 bg-slate-50/40 dark:bg-slate-950/40 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            Click any status node to filter the table directly. Every Delivery Challan (DC) progresses through these decision nodes:
          </p>

          {/* Workflow Nodes Grid / Sequence */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
            {/* NODE 1: Delivered (Pending) */}
            <div
              onClick={() => onSelectQueue("pending")}
              className={`rounded-xl border p-3 flex flex-col justify-between transition-all duration-200 cursor-pointer relative group ${
                activeQueue === "pending"
                  ? "bg-teal-50/90 dark:bg-teal-950/40 border-teal-500 ring-2 ring-teal-500/20 shadow-sm"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-teal-300 dark:hover:border-teal-700 hover:shadow-2xs"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-teal-800 dark:text-teal-300">
                    <Truck className="h-4 w-4 text-teal-600" />
                    <span>1. Delivered</span>
                  </div>
                  <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-950 text-[10px] font-bold px-1.5">
                    {statusCounts.pending}
                  </Badge>
                </div>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug mb-3">
                  Implant sets & instruments delivered to hospital for surgery.
                </p>
              </div>

              <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[9.5px] font-extrabold uppercase text-slate-400 block mb-1">
                  Possibilities / Actions
                </span>
                <div className="flex flex-col gap-1 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1 bg-teal-100/70 text-teal-900 dark:bg-teal-950 dark:text-teal-200 px-1.5 py-0.5 rounded">
                    <RotateCcw className="w-2.5 h-2.5 text-teal-600" /> → Record Return
                  </span>
                  <span className="inline-flex items-center gap-1 bg-amber-100/70 text-amber-900 dark:bg-amber-950 dark:text-amber-200 px-1.5 py-0.5 rounded">
                    <ShoppingBag className="w-2.5 h-2.5 text-amber-600" /> → Direct Purchase
                  </span>
                  <span className="inline-flex items-center gap-1 bg-rose-100/70 text-rose-900 dark:bg-rose-950 dark:text-rose-200 px-1.5 py-0.5 rounded">
                    <AlertCircle className="w-2.5 h-2.5 text-rose-600" /> → Cancel Case
                  </span>
                </div>
              </div>
            </div>

            {/* NODE 2: Returned Queue */}
            <div
              onClick={() => onSelectQueue("returned")}
              className={`rounded-xl border p-3 flex flex-col justify-between transition-all duration-200 cursor-pointer relative group ${
                activeQueue === "returned"
                  ? "bg-purple-50/90 dark:bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/20 shadow-sm"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-2xs"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-purple-900 dark:text-purple-300">
                    <RotateCcw className="h-4 w-4 text-purple-600" />
                    <span>2. Returned</span>
                  </div>
                  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950 text-[10px] font-bold px-1.5">
                    {statusCounts.returned}
                  </Badge>
                </div>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug mb-3">
                  Unused implants & trays returned to office & verified.
                </p>
              </div>

              <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[9.5px] font-extrabold uppercase text-slate-400 block mb-1">
                  Possibilities / Actions
                </span>
                <div className="flex flex-col gap-1 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1 bg-blue-100/70 text-blue-900 dark:bg-blue-950 dark:text-blue-200 px-1.5 py-0.5 rounded">
                    <Receipt className="w-2.5 h-2.5 text-blue-600" /> → Cash Invoice
                  </span>
                  <span className="inline-flex items-center gap-1 bg-indigo-100/70 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200 px-1.5 py-0.5 rounded">
                    <Link className="w-2.5 h-2.5 text-indigo-600" /> → Link Invoice
                  </span>
                </div>
              </div>
            </div>

            {/* NODE 3: Cash Queue (Awaiting Payment) */}
            <div
              onClick={() => onSelectQueue("cash")}
              className={`rounded-xl border p-3 flex flex-col justify-between transition-all duration-200 cursor-pointer relative group ${
                activeQueue === "cash"
                  ? "bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-2xs"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-900 dark:text-emerald-300">
                    <Wallet className="h-4 w-4 text-emerald-600" />
                    <span>3. Cash Queue</span>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 text-[10px] font-bold px-1.5">
                    {statusCounts.cash}
                  </Badge>
                </div>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug mb-3">
                  Cash Memo issued; awaiting cash/bank collection.
                </p>
              </div>

              <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[9.5px] font-extrabold uppercase text-slate-400 block mb-1">
                  Possibilities / Actions
                </span>
                <div className="flex flex-col gap-1 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1 bg-emerald-100/70 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 px-1.5 py-0.5 rounded">
                    <Wallet className="w-2.5 h-2.5 text-emerald-600" /> → Record Payment
                  </span>
                  <span className="inline-flex items-center gap-1 bg-amber-100/70 text-amber-900 dark:bg-amber-950 dark:text-amber-200 px-1.5 py-0.5 rounded">
                    ⚡ Part Payment / Cut
                  </span>
                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-1.5 py-0.5 rounded">
                    <Undo2 className="w-2.5 h-2.5 text-slate-500" /> ↺ Delink Payment
                  </span>
                </div>
              </div>
            </div>

            {/* NODE 4: Completed Queue */}
            <div
              onClick={() => onSelectQueue("completed")}
              className={`rounded-xl border p-3 flex flex-col justify-between transition-all duration-200 cursor-pointer relative group ${
                activeQueue === "completed"
                  ? "bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-2xs"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-900 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>4. Completed</span>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 text-[10px] font-bold px-1.5">
                    {statusCounts.completed}
                  </Badge>
                </div>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug mb-3">
                  Fully settled via payment or linked tax invoice.
                </p>
              </div>

              <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[9.5px] font-extrabold uppercase text-slate-400 block mb-1">
                  Possibilities / Actions
                </span>
                <div className="flex flex-col gap-1 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1 bg-emerald-100/70 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 px-1.5 py-0.5 rounded">
                    ✓ Paid & Settled
                  </span>
                  <span className="inline-flex items-center gap-1 bg-purple-100/70 text-purple-900 dark:bg-purple-950 dark:text-purple-200 px-1.5 py-0.5 rounded">
                    ✓ Tax Invoice Attached
                  </span>
                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-1.5 py-0.5 rounded">
                    <Undo2 className="w-2.5 h-2.5 text-slate-500" /> ↺ Delink to Edit
                  </span>
                </div>
              </div>
            </div>

            {/* NODE 5: Cancelled Queue */}
            <div
              onClick={() => onSelectQueue("cancelled")}
              className={`rounded-xl border p-3 flex flex-col justify-between transition-all duration-200 cursor-pointer relative group ${
                activeQueue === "cancelled"
                  ? "bg-rose-50/90 dark:bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/20 shadow-sm"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-700 hover:shadow-2xs"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-rose-900 dark:text-rose-300">
                    <Ban className="h-4 w-4 text-rose-600" />
                    <span>5. Cancelled</span>
                  </div>
                  <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950 text-[10px] font-bold px-1.5">
                    {statusCounts.cancelled}
                  </Badge>
                </div>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug mb-3">
                  Surgery cancelled; items returned & archived.
                </p>
              </div>

              <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[9.5px] font-extrabold uppercase text-slate-400 block mb-1">
                  Possibilities / Actions
                </span>
                <div className="flex flex-col gap-1 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-1.5 py-0.5 rounded">
                    <Undo2 className="w-2.5 h-2.5 text-slate-500" /> ↺ Restore to Pending
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
