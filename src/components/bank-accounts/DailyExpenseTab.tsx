import React, { useState, useMemo } from "react";
import {
  BankTransaction,
  BankAccount,
  ExpenseCategory,
} from "@/services/bankAccountFirebaseService";
import {
  getDeliveryTeamPersonnelNames,
  normalizePersonnelName,
} from "@/lib/personnelStorage";
import {
  calculateExpenseAnalytics,
  ExpensePeriod,
  PersonnelExpenseSummary,
} from "@/lib/expenseAnalyticsEngine";
import { parseTransactionDate } from "@/lib/autoExpenseTagEngine";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  Fuel,
  Utensils,
  Car,
  Wrench,
  BadgeIndianRupee,
  Search,
  Filter,
  User,
  Zap,
  Tag,
  Clock,
  Sparkles,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Building2,
  MapPin,
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
import { toast } from "sonner";

interface DailyExpenseTabProps {
  transactions: BankTransaction[];
  accounts: BankAccount[];
  onRefresh: () => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Fuel / Petrol": <Fuel className="w-3.5 h-3.5 text-amber-500" />,
  "Food / Meals": <Utensils className="w-3.5 h-3.5 text-orange-500" />,
  "Travel / Vehicle": <Car className="w-3.5 h-3.5 text-blue-500" />,
  "Vehicle Maintenance": <Wrench className="w-3.5 h-3.5 text-slate-500" />,
  "Salary / Advance": <BadgeIndianRupee className="w-3.5 h-3.5 text-emerald-500" />,
  "Spot Payout / Allowance": <Zap className="w-3.5 h-3.5 text-purple-500" />,
};

export const DailyExpenseTab: React.FC<DailyExpenseTabProps> = ({
  transactions,
  accounts,
  onRefresh,
}) => {
  const [periodFilter, setPeriodFilter] = useState<ExpensePeriod>("month");
  const [selectedPersonnel, setSelectedPersonnel] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const deliveryTeamNames = useMemo(() => getDeliveryTeamPersonnelNames(), []);

  // Compute analytics
  const analytics = useMemo(() => {
    return calculateExpenseAnalytics(transactions, periodFilter, selectedPersonnel);
  }, [transactions, periodFilter, selectedPersonnel]);

  // Filter individual transaction logs within executive accordions
  const filteredSummaries = useMemo(() => {
    if (!searchQuery.trim()) return analytics.personnelSummaries;
    const q = searchQuery.toLowerCase();
    return analytics.personnelSummaries.filter((s) => {
      const matchName = s.personnelName.toLowerCase().includes(q);
      const matchTx = s.transactions.some(
        (t) =>
          (t.description || "").toLowerCase().includes(q) ||
          (t.referenceNumber || "").toLowerCase().includes(q) ||
          (t.expenseCategory || "").toLowerCase().includes(q)
      );
      return matchName || matchTx;
    });
  }, [analytics.personnelSummaries, searchQuery]);

  const toggleExpand = (name: string) => {
    setExpandedCards((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  // Export Analytics report as CSV
  const handleExportCSV = () => {
    const headers = [
      "Delivery Executive",
      "Today Spent (₹)",
      "This Week Spent (₹)",
      "This Month Spent (₹)",
      "Selected Period Total (₹)",
      "Transaction Count",
      "Top Category",
    ];

    const rows = analytics.personnelSummaries.map((s) => [
      `"${s.personnelName}"`,
      s.todayAmount,
      s.weekAmount,
      s.monthAmount,
      s.filteredAmount,
      s.transactionCount,
      `"${s.categoryBreakdown[0]?.category || "None"}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `daily_delivery_expenses_${periodFilter}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Downloaded Daily Expense CSV Report");
  };

  return (
    <div className="space-y-4 font-sans text-foreground">
      {/* 1. Executive Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border shadow-xs bg-card rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {periodFilter === "today"
                ? "Today's Spent"
                : periodFilter === "week"
                ? "This Week's Spent"
                : periodFilter === "month"
                ? "This Month's Spent"
                : "Total Spent"}
            </div>
            <div className="text-xl font-mono font-extrabold text-teal-700 dark:text-teal-400 mt-1">
              ₹{analytics.totalSpent.toLocaleString("en-IN")}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Today: ₹{analytics.todayTotal.toLocaleString("en-IN")}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-300 flex items-center justify-center shrink-0">
            <BadgeIndianRupee className="w-5 h-5" />
          </div>
        </Card>

        <Card className="border-border shadow-xs bg-card rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Top Spender
            </div>
            <div className="text-base font-bold text-foreground mt-1 truncate max-w-[130px]">
              {analytics.topSpenderName}
            </div>
            <div className="text-[10px] text-emerald-600 font-mono font-semibold mt-0.5">
              ₹{analytics.topSpenderAmount.toLocaleString("en-IN")} in period
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </Card>

        <Card className="border-border shadow-xs bg-card rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Top Expense Type
            </div>
            <div className="text-sm font-bold text-foreground mt-1 truncate max-w-[130px]">
              {analytics.topCategoryName}
            </div>
            <div className="text-[10px] text-amber-600 font-mono font-semibold mt-0.5">
              ₹{analytics.topCategoryAmount.toLocaleString("en-IN")} total
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 flex items-center justify-center shrink-0">
            <Fuel className="w-5 h-5" />
          </div>
        </Card>

        <Card className="border-border shadow-xs bg-card rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Active Roster Staff
            </div>
            <div className="text-xl font-bold text-foreground mt-1">
              {deliveryTeamNames.length} Executives
            </div>
            <div className="text-[10px] text-purple-600 font-semibold mt-0.5">
              Configured in Settings
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 flex items-center justify-center shrink-0">
            <User className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* 2. Control Toolbar & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card p-3 rounded-xl border border-border shadow-xs">
        {/* Search */}
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search person, fuel, narration..."
            className="pl-9 text-xs h-9 rounded-md"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {/* Time Period Filter Toggle */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border text-xs">
            <button
              onClick={() => setPeriodFilter("today")}
              className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors ${
                periodFilter === "today"
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setPeriodFilter("week")}
              className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors ${
                periodFilter === "week"
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setPeriodFilter("month")}
              className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors ${
                periodFilter === "month"
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setPeriodFilter("all")}
              className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors ${
                periodFilter === "all"
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Time
            </button>
          </div>

          {/* Export Report */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCSV}
            className="h-8 text-xs font-semibold gap-1.5 border-teal-300 text-teal-800 dark:text-teal-300 hover:bg-teal-50"
          >
            <Download className="w-3.5 h-3.5" /> Export Report
          </Button>
        </div>
      </div>

      {/* 3. Delivery Executive Cards Grid & Accordions */}
      <div className="space-y-3">
        {filteredSummaries.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground border-dashed">
            <User className="w-8 h-8 mx-auto text-slate-400 mb-2" />
            <p className="text-sm font-semibold">No expense records found for selected period.</p>
          </Card>
        ) : (
          filteredSummaries.map((person) => {
            const isExpanded = expandedCards[person.personnelName] ?? false;

            return (
              <Card
                key={person.personnelName}
                className="border-border shadow-xs bg-card rounded-xl overflow-hidden transition-all"
              >
                {/* Header Row */}
                <div
                  onClick={() => toggleExpand(person.personnelName)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-300 font-bold text-sm shrink-0 shadow-2xs">
                      {person.personnelName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-foreground">
                          {person.personnelName}
                        </h3>
                        <Badge variant="outline" className="text-[10px] font-semibold text-teal-700 bg-teal-50 border-teal-200">
                          Delivery Executive
                        </Badge>
                      </div>

                      {/* Mini Period Totals Pills */}
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                        <span className="font-medium">
                          Today: <strong className="text-foreground">₹{person.todayAmount.toLocaleString("en-IN")}</strong>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="font-medium">
                          Week: <strong className="text-foreground">₹{person.weekAmount.toLocaleString("en-IN")}</strong>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="font-medium">
                          Month: <strong className="text-foreground">₹{person.monthAmount.toLocaleString("en-IN")}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Total Filtered Spent & Toggle Drawer */}
                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-right">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase">
                        Selected Period Spent
                      </div>
                      <div className="text-lg font-mono font-extrabold text-teal-700 dark:text-teal-400">
                        ₹{person.filteredAmount.toLocaleString("en-IN")}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {person.transactionCount} transactions
                      </div>
                    </div>

                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-teal-600" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Category Pills Bar (Always Visible) */}
                {person.categoryBreakdown.length > 0 && (
                  <div className="px-4 pb-3 flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-2.5 bg-slate-50/50 dark:bg-slate-950/40">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase mr-1">
                      Spent On:
                    </span>
                    {person.categoryBreakdown.map((cat) => (
                      <div
                        key={cat.category}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shadow-2xs"
                      >
                        {CATEGORY_ICONS[cat.category] || <Tag className="w-3.5 h-3.5 text-teal-500" />}
                        <span>{cat.category}:</span>
                        <span className="font-mono text-teal-700 dark:text-teal-400">
                          ₹{cat.amount.toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Expandable Detailed Transaction History & Daily Route Timeline */}
                {isExpanded && (
                  <div className="border-t border-border bg-slate-50 dark:bg-slate-950/80 p-4 space-y-4 animate-in fade-in duration-200">
                    {/* Daily Route Chain Timeline Grouped by Date */}
                    {(() => {
                      // Group transactions by date
                      const dateGroups = new Map<string, BankTransaction[]>();
                      person.transactions.forEach((tx) => {
                        const dateKey = tx.date || "Unknown Date";
                        if (!dateGroups.has(dateKey)) {
                          dateGroups.set(dateKey, []);
                        }
                        dateGroups.get(dateKey)!.push(tx);
                      });

                      const sortedDates = Array.from(dateGroups.keys()).sort((a, b) => b.localeCompare(a));

                      return (
                        <div className="bg-card p-3.5 rounded-xl border border-border shadow-2xs space-y-3">
                          <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-teal-600" />
                            <span>Daily Travel Route Timeline &amp; Full Day Chain</span>
                          </h4>

                          {sortedDates.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">No routes recorded for this period.</p>
                          ) : (
                            <div className="space-y-2.5">
                              {sortedDates.map((dateKey) => {
                                const dayTxs = dateGroups.get(dateKey) || [];
                                const totalDaySpent = dayTxs.reduce((sum, t) => sum + (t.amount || 0), 0);
                                const totalDayDistance = dayTxs.reduce((sum, t) => sum + (t.travelDistanceKm || 0), 0);

                                // Collect stops in chronological order
                                const stops: string[] = [];
                                dayTxs.forEach((t) => {
                                  const fromLoc = t.travelFromLocation || "SRR Warehouse";
                                  const toLoc = t.travelToLocation || (t.expenseNotes ? `Destination (${t.expenseNotes})` : "Hospital / Site");

                                  if (stops.length === 0) {
                                    stops.push(fromLoc);
                                  }
                                  if (toLoc && stops[stops.length - 1] !== toLoc) {
                                    stops.push(toLoc);
                                  }
                                });

                                return (
                                  <div
                                    key={dateKey}
                                    className="p-3 bg-muted/40 rounded-lg border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                  >
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <Badge className="bg-teal-700 text-white font-mono text-[10px] px-2 py-0.5 rounded-md">
                                          {new Date(dateKey).toLocaleDateString("en-IN", {
                                            weekday: "short",
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                          })}
                                        </Badge>
                                        <span className="text-muted-foreground text-[11px]">
                                          ({dayTxs.length} transfer{dayTxs.length > 1 ? "s" : ""})
                                        </span>
                                        {totalDayDistance > 0 && (
                                          <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-[10px]">
                                            Total Distance: {totalDayDistance.toFixed(1)} km
                                          </Badge>
                                        )}
                                      </div>

                                      {/* Chained Route Sequence */}
                                      <div className="flex flex-wrap items-center gap-1 mt-1 text-xs font-semibold text-foreground">
                                        <span className="text-muted-foreground font-bold mr-1">Day Route Chain:</span>
                                        {stops.map((stop, idx) => (
                                          <React.Fragment key={idx}>
                                            <span className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded-md text-teal-800 dark:text-teal-300 font-bold">
                                              {stop}
                                            </span>
                                            {idx < stops.length - 1 && (
                                              <span className="text-teal-600 font-extrabold text-sm">➔</span>
                                            )}
                                          </React.Fragment>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="text-left sm:text-right shrink-0">
                                      <div className="text-[10px] font-semibold text-muted-foreground uppercase">
                                        Day Total Spent
                                      </div>
                                      <div className="text-sm font-mono font-extrabold text-teal-700 dark:text-teal-400">
                                        ₹{totalDaySpent.toLocaleString("en-IN")}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Itemized Transaction Log Table */}
                    <div>
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 mb-2">
                        <Layers className="w-4 h-4 text-teal-600" />
                        <span>Itemized Transaction Log for {person.personnelName}</span>
                      </h4>

                      {person.transactions.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-2">
                          No transactions recorded for this executive in the selected time period.
                        </p>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-border bg-card">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                                <th className="p-2.5 text-left">Date &amp; Time</th>
                                <th className="p-2.5 text-left">Account</th>
                                <th className="p-2.5 text-left">Payee / Narration / UTR</th>
                                <th className="p-2.5 text-left">Category</th>
                                <th className="p-2.5 text-right">Amount (₹)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {person.transactions.map((tx) => {
                                const acc = accounts.find((a) => a.id === tx.accountId);
                                return (
                                  <tr key={tx.id} className="hover:bg-muted/20">
                                    <td className="p-2.5 whitespace-nowrap">
                                      <div className="font-bold text-foreground">
                                        {new Date(tx.date).toLocaleDateString("en-IN", {
                                          day: "2-digit",
                                          month: "short",
                                          year: "numeric",
                                        })}
                                      </div>
                                      {tx.time && <div className="text-[10px] text-muted-foreground">{tx.time}</div>}
                                    </td>
                                    <td className="p-2.5 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
                                      {acc?.accountName || "Bank Account"}
                                    </td>
                                    <td className="p-2.5">
                                      <div className="font-medium text-foreground">
                                        {tx.description}
                                      </div>
                                      {tx.referenceNumber && (
                                        <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                                          Ref: {tx.referenceNumber}
                                        </div>
                                      )}
                                      {(tx.travelFromLocation || tx.travelToLocation || tx.travelDistanceKm) && (
                                        <div className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 px-2 py-0.5 rounded-md inline-flex">
                                          <MapPin className="w-3 h-3 text-teal-600 shrink-0" />
                                          <span>
                                            Route: {tx.travelFromLocation || "SRR Warehouse"} ➔ {tx.travelToLocation || "Hospital"}
                                            {tx.travelDistanceKm ? ` (${tx.travelDistanceKm} km)` : ''}
                                          </span>
                                          {tx.travelPurposeNote && (
                                            <span className="text-slate-500 font-normal">({tx.travelPurposeNote})</span>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-2.5 whitespace-nowrap">
                                      <Badge variant="outline" className="text-[10px] font-semibold bg-slate-50 text-slate-800 border-slate-300 gap-1">
                                        {CATEGORY_ICONS[tx.expenseCategory || ""] || <Tag className="w-3 h-3 text-teal-600" />}
                                        <span>{tx.expenseCategory || "General"}</span>
                                      </Badge>
                                    </td>
                                    <td className="p-2.5 text-right whitespace-nowrap font-mono font-bold text-sm text-rose-600 dark:text-rose-400">
                                      -₹{tx.amount.toLocaleString("en-IN")}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
