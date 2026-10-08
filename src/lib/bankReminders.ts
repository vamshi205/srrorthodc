import { BankTransaction } from "@/services/bankAccountFirebaseService";

export interface BankReminderItem {
  transaction: BankTransaction;
  kind: "debit_untagged" | "credit_unmapped";
  title: string;
  reason: string;
}

export function hasBankAccountsAccess(): boolean {
  try {
    const authData = localStorage.getItem("srrortho:auth");
    if (authData) {
      const parsed = JSON.parse(authData);
      if (parsed?.permissions && parsed.permissions.bankAccounts === false) {
        return false;
      }
    }
    const moduleAccess = localStorage.getItem("srrortho:module_access_bank_accounts");
    if (moduleAccess === "false") {
      return false;
    }
  } catch {
    // ignore
  }
  return true;
}

export function getTodayYmd(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function is1538Account(t: Partial<BankTransaction>): boolean {
  const accId = String(t.accountId || "").toLowerCase();
  const suffix = String(t.accountSuffix || "");
  const desc = String(t.description || "").toLowerCase();
  return accId.includes("1538") || suffix === "1538" || desc.includes("1538");
}

export function getTodayBankReminders(): {
  items: BankReminderItem[];
  count: number;
  untaggedDebitsCount: number;
  unmappedCreditsCount: number;
  totalDebitAmount: number;
  totalCreditAmount: number;
} {
  if (!hasBankAccountsAccess()) {
    return {
      items: [],
      count: 0,
      untaggedDebitsCount: 0,
      unmappedCreditsCount: 0,
      totalDebitAmount: 0,
      totalCreditAmount: 0,
    };
  }

  try {
    const rawTx = localStorage.getItem("srrortho:bank_transactions_cache");
    if (!rawTx) {
      return {
        items: [],
        count: 0,
        untaggedDebitsCount: 0,
        unmappedCreditsCount: 0,
        totalDebitAmount: 0,
        totalCreditAmount: 0,
      };
    }

    const txs: BankTransaction[] = JSON.parse(rawTx);
    if (!Array.isArray(txs)) {
      return {
        items: [],
        count: 0,
        untaggedDebitsCount: 0,
        unmappedCreditsCount: 0,
        totalDebitAmount: 0,
        totalCreditAmount: 0,
      };
    }

    const todayYmd = getTodayYmd();
    const items: BankReminderItem[] = [];
    let untaggedDebitsCount = 0;
    let unmappedCreditsCount = 0;
    let totalDebitAmount = 0;
    let totalCreditAmount = 0;

    txs.forEach((t) => {
      // Must be TODAY
      const tDate = String(t.date || "").trim();
      if (tDate !== todayYmd) return;

      // Must be 1538 account
      if (!is1538Account(t)) return;

      const tType = String(t.type || "").toLowerCase();

      // Debits for 1538 account today that are untagged in autoexpense
      if (tType === "debit") {
        const isTagged = Boolean(
          t.isExpenseTagged === true ||
          (t.expenseCategory && String(t.expenseCategory).trim() !== "") ||
          (t.expensePersonnelName && String(t.expensePersonnelName).trim() !== "")
        );
        if (!isTagged) {
          untaggedDebitsCount++;
          totalDebitAmount += Number(t.amount) || 0;
          items.push({
            transaction: t,
            kind: "debit_untagged",
            title: `Untagged Debit: ₹${(Number(t.amount) || 0).toLocaleString("en-IN")}`,
            reason: `1538 Account Debit from today pending AutoExpense tagging`,
          });
        }
      }

      // Credits for 1538 account today that are unmapped
      if (tType === "credit") {
        const isMapped = Boolean(
          t.linkedInvoiceId ||
          t.linkedInvoiceNumber ||
          t.linkedCustomerName ||
          t.linkedHospital ||
          t.transferTargetAccountId ||
          (t.category && t.category !== "Uncategorized" && t.category !== "General")
        );
        if (!isMapped) {
          unmappedCreditsCount++;
          totalCreditAmount += Number(t.amount) || 0;
          items.push({
            transaction: t,
            kind: "credit_unmapped",
            title: `Unmapped Credit: ₹${(Number(t.amount) || 0).toLocaleString("en-IN")}`,
            reason: `1538 Account Credit from today pending mapping`,
          });
        }
      }
    });

    return {
      items,
      count: items.length,
      untaggedDebitsCount,
      unmappedCreditsCount,
      totalDebitAmount,
      totalCreditAmount,
    };
  } catch (err) {
    console.warn("Error computing bank reminders:", err);
    return {
      items: [],
      count: 0,
      untaggedDebitsCount: 0,
      unmappedCreditsCount: 0,
      totalDebitAmount: 0,
      totalCreditAmount: 0,
    };
  }
}
