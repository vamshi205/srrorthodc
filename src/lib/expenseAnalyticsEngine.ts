import { BankTransaction, ExpenseCategory } from "@/services/bankAccountFirebaseService";
import { getDeliveryTeamPersonnelNames, normalizePersonnelName } from "@/lib/personnelStorage";
import { parseTransactionDate } from "@/lib/autoExpenseTagEngine";

export type ExpensePeriod = "today" | "week" | "month" | "all";

export interface CategoryBreakdown {
  category: ExpenseCategory;
  amount: number;
  count: number;
}

export interface PersonnelExpenseSummary {
  personnelName: string;
  todayAmount: number;
  weekAmount: number;
  monthAmount: number;
  filteredAmount: number;
  transactionCount: number;
  categoryBreakdown: CategoryBreakdown[];
  transactions: BankTransaction[];
}

export interface GlobalExpenseAnalytics {
  totalSpent: number;
  todayTotal: number;
  weekTotal: number;
  monthTotal: number;
  topSpenderName: string;
  topSpenderAmount: number;
  topCategoryName: string;
  topCategoryAmount: number;
  personnelSummaries: PersonnelExpenseSummary[];
}

/**
 * Checks if date string falls into the given period filter
 */
export function isDateInPeriod(dateStr: string, period: ExpensePeriod): boolean {
  if (!dateStr) return false;
  const d = parseTransactionDate(dateStr);
  const now = new Date();
  
  if (isNaN(d.getTime())) return false;

  if (period === "today") {
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  }

  if (period === "week") {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    return d >= sevenDaysAgo;
  }

  if (period === "month") {
    return (
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  }

  return true;
}

/**
 * Main analytics calculation function
 */
export function calculateExpenseAnalytics(
  transactions: BankTransaction[],
  periodFilter: ExpensePeriod = "month",
  targetPersonnelFilter: string = "all"
): GlobalExpenseAnalytics {
  const taggedDebits = transactions.filter(
    (t) => t.type === "debit" && t.isExpenseTagged && (t.expensePersonnelName || t.expenseCategory)
  );

  const deliveryTeam = getDeliveryTeamPersonnelNames();
  const summaryMap = new Map<string, PersonnelExpenseSummary>();

  // Initialize roster personnel
  deliveryTeam.forEach((pName) => {
    summaryMap.set(pName.toLowerCase(), {
      personnelName: pName,
      todayAmount: 0,
      weekAmount: 0,
      monthAmount: 0,
      filteredAmount: 0,
      transactionCount: 0,
      categoryBreakdown: [],
      transactions: [],
    });
  });

  let globalTodayTotal = 0;
  let globalWeekTotal = 0;
  let globalMonthTotal = 0;
  let globalFilteredTotal = 0;

  // Process tagged transactions
  taggedDebits.forEach((tx) => {
    const rawPerson = tx.expensePersonnelName || "Unassigned";
    const canonical = normalizePersonnelName(rawPerson) || rawPerson.trim();
    const key = canonical.toLowerCase();

    if (!summaryMap.has(key)) {
      summaryMap.set(key, {
        personnelName: canonical,
        todayAmount: 0,
        weekAmount: 0,
        monthAmount: 0,
        filteredAmount: 0,
        transactionCount: 0,
        categoryBreakdown: [],
        transactions: [],
      });
    }

    const item = summaryMap.get(key)!;
    const amount = Number(tx.amount) || 0;
    const txDate = tx.date;

    if (isDateInPeriod(txDate, "today")) {
      item.todayAmount += amount;
      globalTodayTotal += amount;
    }
    if (isDateInPeriod(txDate, "week")) {
      item.weekAmount += amount;
      globalWeekTotal += amount;
    }
    if (isDateInPeriod(txDate, "month")) {
      item.monthAmount += amount;
      globalMonthTotal += amount;
    }

    if (isDateInPeriod(txDate, periodFilter)) {
      item.filteredAmount += amount;
      item.transactionCount += 1;
      item.transactions.push(tx);
      globalFilteredTotal += amount;
    }
  });

  // Calculate per-person category breakdowns
  const categoryGlobalMap = new Map<ExpenseCategory, number>();

  summaryMap.forEach((summary) => {
    const catMap = new Map<ExpenseCategory, { amount: number; count: number }>();
    
    summary.transactions.forEach((tx) => {
      const cat = (tx.expenseCategory || "Other Operational Expense") as ExpenseCategory;
      const amt = Number(tx.amount) || 0;

      const existing = catMap.get(cat) || { amount: 0, count: 0 };
      existing.amount += amt;
      existing.count += 1;
      catMap.set(cat, existing);

      categoryGlobalMap.set(cat, (categoryGlobalMap.get(cat) || 0) + amt);
    });

    summary.categoryBreakdown = Array.from(catMap.entries())
      .map(([cat, val]) => ({
        category: cat,
        amount: val.amount,
        count: val.count,
      }))
      .sort((a, b) => b.amount - a.amount);

    summary.transactions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  });

  // Filter summaries if specific person selected
  let personnelSummaries = Array.from(summaryMap.values());
  if (targetPersonnelFilter !== "all") {
    personnelSummaries = personnelSummaries.filter(
      (s) => s.personnelName.toLowerCase() === targetPersonnelFilter.toLowerCase()
    );
  }

  // Sort summaries by highest spent in current period
  personnelSummaries.sort((a, b) => b.filteredAmount - a.filteredAmount);

  // Determine top spender
  const topSpender = personnelSummaries.length > 0 ? personnelSummaries[0] : null;

  // Determine top category
  let topCategoryName: string = "None";
  let topCategoryAmount = 0;
  categoryGlobalMap.forEach((amt, cat) => {
    if (amt > topCategoryAmount) {
      topCategoryAmount = amt;
      topCategoryName = cat;
    }
  });

  return {
    totalSpent: globalFilteredTotal,
    todayTotal: globalTodayTotal,
    weekTotal: globalWeekTotal,
    monthTotal: globalMonthTotal,
    topSpenderName: topSpender && topSpender.filteredAmount > 0 ? topSpender.personnelName : "None",
    topSpenderAmount: topSpender ? topSpender.filteredAmount : 0,
    topCategoryName,
    topCategoryAmount,
    personnelSummaries,
  };
}
