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
 * Predicts personnel name and expense category for a given debit transaction.
 * Learns from direct personnel name matching, full-text search, and historical tagged debit transactions.
 */
export function predictExpenseTag(
  tx: BankTransaction,
  availablePersonnelNames?: string[],
  allTransactions?: BankTransaction[]
): ExpenseTagSuggestion | null {
  if (tx.type !== "debit" && tx.amount >= 0) {
    // Only analyze debits for expense tagging
  }

  const personnelNames = availablePersonnelNames || getDeliveryTeamPersonnelNames();
  const rawText = `${tx.description || ""} ${tx.referenceNumber || ""} ${tx.emailSubject || ""} ${tx.rawEmailBody || ""}`.toLowerCase();

  let matchedPerson: string | undefined = undefined;
  let personScore = 0;
  let matchReason = "";

  // 1. Direct personnel name match in narration/UPI/text
  for (const pName of personnelNames) {
    if (!pName || isDisallowedPersonnel(pName) || isTransportLogisticsName(pName)) continue;
    
    const lowerPName = pName.toLowerCase();
    const parts = lowerPName.split(" ").filter((p) => p.length >= 3);

    // Exact match of full personnel name or any major name part (e.g. "Vinay" from "Vinay Kumar Meesa")
    if (rawText.includes(lowerPName)) {
      matchedPerson = pName;
      personScore = 95;
      matchReason = `Direct name match '${pName}'`;
      break;
    } else {
      for (const part of parts) {
        if (rawText.includes(part)) {
          if (!matchedPerson || personScore < 85) {
            matchedPerson = pName;
            personScore = 85;
            matchReason = `Name token match '${part}' -> ${pName}`;
          }
        }
      }
    }
  }

  // 2. Historical Transaction Pattern Match (UPI Handle / Payee Name / Reference matching)
  // If an earlier transaction with similar UPI handle or payee was tagged to a person, recommend that person!
  if (!matchedPerson && allTransactions && allTransactions.length > 0) {
    const txDescClean = (tx.description || "").toLowerCase().trim();
    // Extract UPI handle if present (e.g. "9618173595@slc" or "vinay kumar meesa")
    const upiMatch = txDescClean.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9]+)/);
    const upiHandle = upiMatch ? upiMatch[1] : null;

    for (const prevTx of allTransactions) {
      if (prevTx.id !== tx.id && prevTx.expensePersonnelName && prevTx.isExpenseTagged) {
        const prevDesc = (prevTx.description || "").toLowerCase().trim();
        
        // Exact UPI Handle match
        if (upiHandle && prevDesc.includes(upiHandle)) {
          matchedPerson = prevTx.expensePersonnelName;
          personScore = 90;
          matchReason = `Historical UPI match '${upiHandle}' tagged to ${prevTx.expensePersonnelName}`;
          break;
        }

        // High overlap in description text
        if (txDescClean.length > 10 && prevDesc.length > 10) {
          const wordsA = txDescClean.split(/\s+/).filter((w) => w.length > 3);
          const wordsB = prevDesc.split(/\s+/).filter((w) => w.length > 3);
          const commonWords = wordsA.filter((w) => wordsB.includes(w));
          if (commonWords.length >= 2 && !commonWords.every((w) => ["upi", "ref", "val", "transfer", "debit"].includes(w))) {
            matchedPerson = prevTx.expensePersonnelName;
            personScore = 80;
            matchReason = `Historical pattern similarity (${commonWords.join(", ")}) tagged to ${prevTx.expensePersonnelName}`;
            break;
          }
        }
      }
    }
  }

  // 3. Predict Category based on keyword analysis
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
      ? `${matchReason || `Matched personnel '${matchedPerson}'`} & category '${matchedCat}'`
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
      const result = predictExpenseTag(tx, personnelNames, transactions);
      if (result) {
        suggestions.set(tx.id, result);
      }
    }
  });

  return suggestions;
}
