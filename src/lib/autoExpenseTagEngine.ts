import { BankTransaction, ExpenseCategory } from "@/services/bankAccountFirebaseService";
import { getSavedPersonnel, getDeliveryTeamPersonnelNames, isDisallowedPersonnel, isTransportLogisticsName } from "@/lib/personnelStorage";

export interface ExpenseTagSuggestion {
  transactionId: string;
  suggestedPersonnelName?: string;
  suggestedCategory: ExpenseCategory;
  confidenceScore: number; // 0 to 100
  matchedKeywords: string[];
  reason: string;
}

// Category keyword match dictionary
const CATEGORY_KEYWORDS: Record<ExpenseCategory, string[]> = {
  "Fuel / Petrol": [
    "petrol",
    "fuel",
    "hpcl",
    "bpcl",
    "iocl",
    "shell",
    "bunk",
    "diesel",
    "filling station",
    "petroleum",
    "indian oil",
    "hindustan petroleum",
    "bharat petroleum",
  ],
  "Food / Meals": [
    "food",
    "tea",
    "coffee",
    "tiffin",
    "hotel",
    "restaurant",
    "lunch",
    "dinner",
    "snack",
    "snacks",
    "swiggy",
    "zomato",
    "bakery",
    "canteen",
    "breakfast",
    "mess",
  ],
  "Travel / Vehicle": [
    "toll",
    "fastag",
    "auto",
    "bus",
    "cab",
    "uber",
    "ola",
    "rapido",
    "porter",
    "travel",
    "fare",
    "ticket",
    "parking",
  ],
  "Salary / Advance": [
    "salary",
    "advance",
    "sal",
    "stipend",
    "wages",
    "monthly pay",
    "pay advance",
  ],
  "Vehicle Maintenance": [
    "service",
    "repair",
    "repairs",
    "puncture",
    "oil",
    "garage",
    "mechanic",
    "tyre",
    "tire",
    "spare",
    "bike service",
    "wash",
  ],
  "Spot Payout / Allowance": [
    "allowance",
    "bta",
    "da",
    "ot",
    "overtime",
    "spot",
    "payout",
    "incentive",
    "surgery payout",
    "ot allowance",
  ],
  "Other Operational Expense": [
    "expense",
    "charge",
    "misc",
    "office",
    "courier",
    "stationery",
    "print",
  ],
};

/**
 * Predicts personnel name and expense category for a given debit transaction
 */
export function predictExpenseTag(
  tx: BankTransaction,
  availablePersonnelNames?: string[]
): ExpenseTagSuggestion | null {
  if (tx.type !== "debit" && tx.amount >= 0) {
    // Only analyze debits for expense tagging
  }

  const personnelNames = availablePersonnelNames || getDeliveryTeamPersonnelNames();
  const rawText = `${tx.description || ""} ${tx.referenceNumber || ""} ${tx.emailSubject || ""} ${tx.rawEmailBody || ""}`.toLowerCase();

  let matchedPerson: string | undefined = undefined;
  let personScore = 0;

  // 1. Check direct personnel name match in text
  for (const pName of personnelNames) {
    if (!pName || isDisallowedPersonnel(pName) || isTransportLogisticsName(pName)) continue;
    
    const lowerPName = pName.toLowerCase();
    const firstName = lowerPName.split(" ")[0];

    if (rawText.includes(lowerPName)) {
      matchedPerson = pName;
      personScore = 95;
      break;
    } else if (firstName.length >= 4 && rawText.includes(firstName)) {
      if (!matchedPerson || personScore < 80) {
        matchedPerson = pName;
        personScore = 80;
      }
    }
  }

  // 2. Predict Category based on keyword analysis
  let matchedCat: ExpenseCategory = "Other Operational Expense";
  let catScore = 30;
  const matchedKeywords: string[] = [];

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [ExpenseCategory, string[]][]) {
    for (const kw of keywords) {
      if (rawText.includes(kw)) {
        matchedCat = category;
        matchedKeywords.push(kw);
        catScore = 90;
        break;
      }
    }
    if (catScore >= 90) break;
  }

  const overallScore = matchedPerson ? Math.round((personScore + catScore) / 2) : catScore;

  return {
    transactionId: tx.id,
    suggestedPersonnelName: matchedPerson,
    suggestedCategory: matchedCat,
    confidenceScore: overallScore,
    matchedKeywords,
    reason: matchedPerson
      ? `Matched personnel '${matchedPerson}' and category '${matchedCat}' (${matchedKeywords.join(", ") || "keyword"})`
      : `Matched category '${matchedCat}' (${matchedKeywords.join(", ") || "pattern"})`,
  };
}

/**
 * Runs smart auto-tagging prediction on a list of bank transactions
 */
export function runAutoExpenseTagRules(
  transactions: BankTransaction[]
): Map<string, ExpenseTagSuggestion> {
  const suggestions = new Map<string, ExpenseTagSuggestion>();
  const personnelNames = getDeliveryTeamPersonnelNames();

  transactions.forEach((tx) => {
    if (tx.type === "debit") {
      const result = predictExpenseTag(tx, personnelNames);
      if (result) {
        suggestions.set(tx.id, result);
      }
    }
  });

  return suggestions;
}
