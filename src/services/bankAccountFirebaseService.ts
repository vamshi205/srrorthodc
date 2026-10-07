import { db } from '@/firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  getDoc,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import {
  CashInvoiceData,
  fetchCashInvoicesFromFirestore,
  saveCashInvoiceToFirestore,
} from './cashInvoiceFirebaseService';
import { fetchDcsFromFirestore, updateDcInFirestore } from './firestoreService';

export interface BankAccount {
  id: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
  accountType: 'current' | 'savings' | 'od_cc' | 'cash_in_hand';
  upiId?: string;
  openingBalance: number;
  colorTheme?: 'emerald' | 'blue' | 'indigo' | 'violet' | 'amber' | 'teal' | 'rose' | 'slate';
  isDefault?: boolean;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type ExpenseCategory =
  | 'Fuel / Petrol'
  | 'Food / Meals'
  | 'Travel / Vehicle'
  | 'Salary / Advance'
  | 'Vehicle Maintenance'
  | 'Spot Payout / Allowance'
  | 'Other Operational Expense';

export interface BankTransaction {
  id: string;
  accountId: string;
  type: 'credit' | 'debit';
  amount: number;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  category: string;
  description: string;
  referenceNumber?: string; // UTR, Cheque #, UPI Ref, Txn ID
  linkedInvoiceId?: string;
  linkedInvoiceNumber?: string;
  linkedCustomerName?: string;
  linkedHospital?: string;
  transferTargetAccountId?: string;
  createdSource?: 'manual' | 'cash_invoice_link' | 'quick_deposit' | 'transfer' | 'gmail_connector' | 'sheet_import';
  accountSuffix?: string;
  availableBalance?: number; // Real-time available balance stated in bank alerts
  emailSubject?: string;
  rawEmailBody?: string;
  // Expense Tagging Fields
  expensePersonnelName?: string;
  expenseCategory?: ExpenseCategory;
  expenseNotes?: string;
  isExpenseTagged?: boolean;
  taggedAt?: string;
  autoTagConfidence?: number;
  // Travel Route & Purpose Justification Fields
  travelFromLocation?: string;
  travelToLocation?: string;
  travelDistanceKm?: number;
  linkedDcNumbers?: string[];
  travelPurposeNote?: string;
  createdAt: number;
  updatedAt: number;
}


const BANK_ACCOUNTS_COLLECTION = 'bank_accounts';
const BANK_TRANSACTIONS_COLLECTION = 'bank_transactions';
const LOCAL_STORAGE_ACCOUNTS_KEY = 'srrortho:bank_accounts_cache';
const LOCAL_STORAGE_TRANSACTIONS_KEY = 'srrortho:bank_transactions_cache';

const DEFAULT_ACCOUNTS: BankAccount[] = [
  {
    id: 'acc_hdfc_main_6569',
    accountName: 'SRR Ortho Main (6569)',
    bankName: 'HDFC Bank',
    accountNumber: '50200000006569',
    ifscCode: 'HDFC0001234',
    branch: 'Kalyan Nagar, Hyderabad',
    accountType: 'current',
    upiId: 'srrmain@hdfcbank',
    openingBalance: 0,
    colorTheme: 'teal',
    isDefault: true,
    notes: 'Primary Business Current Account for Hospital Collections & Supplier NEFTs',
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
  },
  {
    id: 'acc_hdfc_savings_1538',
    accountName: 'SRR Savings / UPI (1538)',
    bankName: 'HDFC Bank',
    accountNumber: '50100000001538',
    ifscCode: 'HDFC0001234',
    branch: 'Kalyan Nagar, Hyderabad',
    accountType: 'savings',
    upiId: '9396857455@hdfcbank',
    openingBalance: 0,
    colorTheme: 'blue',
    isDefault: false,
    notes: 'Savings & UPI Operations Account',
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
  },
  {
    id: 'acc_cash_in_hand',
    accountName: 'Cash In Hand (Petty Cash)',
    bankName: 'Cash In Hand',
    accountNumber: 'CASH-001',
    ifscCode: 'CASH',
    branch: 'Main Desk, Hyderabad',
    accountType: 'cash_in_hand',
    openingBalance: 0,
    colorTheme: 'emerald',
    isDefault: false,
    notes: 'Daily counter cash and spot customer cash receipts',
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
  },
];

/**
 * Fetch all bank accounts from Firestore (with localStorage fallback)
 */
export async function fetchBankAccountsFromFirestore(): Promise<BankAccount[]> {
  try {
    const querySnapshot = await getDocs(collection(db, BANK_ACCOUNTS_COLLECTION));
    const accounts: BankAccount[] = [];

    querySnapshot.forEach((docSnap) => {
      accounts.push(docSnap.data() as BankAccount);
    });

    if (accounts.length === 0) {
      const cached = localStorage.getItem(LOCAL_STORAGE_ACCOUNTS_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        } catch {
          // ignore
        }
      }
    }

    // Ensure default accounts are present
    DEFAULT_ACCOUNTS.forEach((defAcc) => {
      if (!accounts.some((a) => a.id === defAcc.id)) {
        accounts.push(defAcc);
      }
    });

    // Deduplicate accounts so duplicate 6569, 1538, or Cash cards don't show up twice
    const uniqueAccountsMap = new Map<string, BankAccount>();
    accounts.forEach((acc) => {
      const accNum = acc.accountNumber || '';
      const accName = acc.accountName || '';

      if (acc.id === 'acc_hdfc_main_6569' || accNum.includes('6569') || accName.includes('6569')) {
        if (!uniqueAccountsMap.has('acc_hdfc_main_6569')) {
          uniqueAccountsMap.set('acc_hdfc_main_6569', {
            ...DEFAULT_ACCOUNTS[0],
            ...acc,
            id: 'acc_hdfc_main_6569',
            accountName: 'SRR Ortho Main (6569)',
          });
        }
      } else if (acc.id === 'acc_hdfc_savings_1538' || accNum.includes('1538') || accName.includes('1538')) {
        if (!uniqueAccountsMap.has('acc_hdfc_savings_1538')) {
          uniqueAccountsMap.set('acc_hdfc_savings_1538', {
            ...DEFAULT_ACCOUNTS[1],
            ...acc,
            id: 'acc_hdfc_savings_1538',
            accountName: 'SRR Savings / UPI (1538)',
          });
        }
      } else if (acc.id === 'acc_cash_in_hand' || acc.accountType === 'cash_in_hand' || accName.toLowerCase().includes('cash')) {
        if (!uniqueAccountsMap.has('acc_cash_in_hand')) {
          uniqueAccountsMap.set('acc_cash_in_hand', {
            ...DEFAULT_ACCOUNTS[2],
            ...acc,
            id: 'acc_cash_in_hand',
            accountName: 'Cash In Hand (Petty Cash)',
          });
        }
      } else {
        if (!uniqueAccountsMap.has(acc.id)) {
          uniqueAccountsMap.set(acc.id, acc);
        }
      }
    });

    const finalAccounts = Array.from(uniqueAccountsMap.values());
    localStorage.setItem(LOCAL_STORAGE_ACCOUNTS_KEY, JSON.stringify(finalAccounts));
    return finalAccounts;
  } catch (error) {
    console.warn('Error fetching bank accounts from Firestore, checking localStorage:', error);
    return DEFAULT_ACCOUNTS;
  }
}

/**
 * Save or update a Bank Account in Firestore & LocalStorage
 */
export async function saveBankAccountToFirestore(account: BankAccount): Promise<boolean> {
  try {
    const docId = account.id || `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const updatedAccount: BankAccount = {
      ...account,
      id: docId,
      updatedAt: Date.now(),
      createdAt: account.createdAt || Date.now(),
    };

    const ref = doc(db, BANK_ACCOUNTS_COLLECTION, docId);
    const sanitized = JSON.parse(JSON.stringify(updatedAccount));
    await setDoc(ref, sanitized);

    // Update local cache
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_ACCOUNTS_KEY);
      const accounts: BankAccount[] = cached ? JSON.parse(cached) : [];
      const idx = accounts.findIndex((a) => a.id === docId);
      if (idx >= 0) {
        accounts[idx] = updatedAccount;
      } else {
        accounts.unshift(updatedAccount);
      }
      localStorage.setItem(LOCAL_STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch (e) {
      console.warn('Could not update accounts local cache', e);
    }

    return true;
  } catch (error) {
    console.error('Error saving bank account to Firestore:', error);
    // Still save to local storage as fallback
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_ACCOUNTS_KEY);
      const accounts: BankAccount[] = cached ? JSON.parse(cached) : [];
      const idx = accounts.findIndex((a) => a.id === account.id);
      if (idx >= 0) {
        accounts[idx] = account;
      } else {
        accounts.unshift(account);
      }
      localStorage.setItem(LOCAL_STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Delete a Bank Account and all its transactions
 */
export async function deleteBankAccountFromFirestore(accountId: string): Promise<boolean> {
  try {
    const ref = doc(db, BANK_ACCOUNTS_COLLECTION, accountId);
    await deleteDoc(ref);

    // Also delete all associated transactions
    try {
      const txSnapshot = await getDocs(
        query(collection(db, BANK_TRANSACTIONS_COLLECTION), where('accountId', '==', accountId))
      );
      const deletePromises: Promise<void>[] = [];
      txSnapshot.forEach((docSnap) => {
        deletePromises.push(deleteDoc(docSnap.ref));
      });
      await Promise.all(deletePromises);
    } catch (e) {
      console.warn('Could not delete sub-transactions for account', e);
    }

    // Update local storage cache
    try {
      const cachedAcc = localStorage.getItem(LOCAL_STORAGE_ACCOUNTS_KEY);
      if (cachedAcc) {
        const accounts: BankAccount[] = JSON.parse(cachedAcc).filter((a: BankAccount) => a.id !== accountId);
        localStorage.setItem(LOCAL_STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
      }
      const cachedTx = localStorage.getItem(LOCAL_STORAGE_TRANSACTIONS_KEY);
      if (cachedTx) {
        const txs: BankTransaction[] = JSON.parse(cachedTx).filter((t: BankTransaction) => t.accountId !== accountId);
        localStorage.setItem(LOCAL_STORAGE_TRANSACTIONS_KEY, JSON.stringify(txs));
      }
    } catch {
      // ignore
    }

    return true;
  } catch (error) {
    console.error('Error deleting bank account from Firestore:', error);
    return false;
  }
}

/**
 * Fetch bank transactions (Defaults to latest 150 in a single fast query)
 */
export async function fetchBankTransactionsFromFirestore(
  accountId?: string,
  maxLimit: number = 150
): Promise<BankTransaction[]> {
  try {
    const transactionsRef = collection(db, BANK_TRANSACTIONS_COLLECTION);
    const fetchCap = Math.max(maxLimit, 500);
    const q = accountId
      ? query(transactionsRef, where('accountId', '==', accountId), limit(fetchCap))
      : query(transactionsRef, limit(fetchCap));

    const querySnapshot = await getDocs(q);

    const transactions: BankTransaction[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as BankTransaction;
      
      // Ensure accountId resolves to one of the 3 standard accounts
      if (data.accountSuffix === '1538' || (data.accountId && data.accountId.includes('1538'))) {
        data.accountId = 'acc_hdfc_savings_1538';
      } else if (data.accountSuffix === '6569' || (data.accountId && data.accountId.includes('6569'))) {
        data.accountId = 'acc_hdfc_main_6569';
      } else if (data.createdSource === 'quick_deposit' || (data.accountId && data.accountId.includes('cash'))) {
        data.accountId = 'acc_cash_in_hand';
      } else if (!data.accountId || data.accountId === 'default') {
        data.accountId = 'acc_hdfc_main_6569';
      }
      transactions.push(data);
    });

    if (transactions.length === 0 && !accountId) {
      const cached = localStorage.getItem(LOCAL_STORAGE_TRANSACTIONS_KEY);
      if (cached) {
        try {
          const parsed: BankTransaction[] = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed.forEach((t) => {
              if (!t.accountId || t.accountId === 'default') {
                if (t.accountSuffix === '1538') t.accountId = 'acc_hdfc_savings_1538';
                else t.accountId = 'acc_hdfc_main_6569';
              }
            });
            return parsed.slice(0, maxLimit);
          }
        } catch {
          // ignore
        }
      }
      return [];
    }

    // Sort by full timestamp: date + time, then createdAt descending
    transactions.sort((a, b) => {
      const timeAStr = `${a.date || ''}T${a.time || '00:00'}:00`;
      const timeBStr = `${b.date || ''}T${b.time || '00:00'}:00`;
      const dateA = new Date(timeAStr).getTime() || a.createdAt || 0;
      const dateB = new Date(timeBStr).getTime() || b.createdAt || 0;
      return dateB - dateA;
    });

    if (!accountId) {
      localStorage.setItem(LOCAL_STORAGE_TRANSACTIONS_KEY, JSON.stringify(transactions));
    }

    return transactions;
  } catch (error) {
    console.warn('Error fetching transactions from Firestore, checking localStorage:', error);
    const cached = localStorage.getItem(LOCAL_STORAGE_TRANSACTIONS_KEY);
    if (cached) {
      try {
        const parsed: BankTransaction[] = JSON.parse(cached);
        parsed.forEach((t) => {
          if (!t.accountId || t.accountId === 'default') {
            if (t.accountSuffix === '1538') t.accountId = 'acc_hdfc_savings_1538';
            else t.accountId = 'acc_hdfc_main_6569';
          }
        });
        if (accountId) {
          return parsed.filter((t) => t.accountId === accountId).slice(0, maxLimit);
        }
        return parsed.slice(0, maxLimit);
      } catch {
        return [];
      }
    }
    return [];
  }
}

/**
 * Real-time listener for Bank Transactions using Firestore onSnapshot
 * Updates UI instantly (sub-second) whenever a transaction is added or updated in Firestore
 */
export function subscribeToBankTransactions(
  onUpdate: (transactions: BankTransaction[]) => void,
  onError?: (error: any) => void,
  maxLimit: number = 500
): () => void {
  try {
    const transactionsRef = collection(db, BANK_TRANSACTIONS_COLLECTION);
    const q = query(transactionsRef, limit(Math.max(maxLimit, 500)));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const transactions: BankTransaction[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as BankTransaction;
          if (data.accountSuffix === '1538' || (data.accountId && data.accountId.includes('1538'))) {
            data.accountId = 'acc_hdfc_savings_1538';
          } else if (data.accountSuffix === '6569' || (data.accountId && data.accountId.includes('6569'))) {
            data.accountId = 'acc_hdfc_main_6569';
          } else if (data.createdSource === 'quick_deposit' || (data.accountId && data.accountId.includes('cash'))) {
            data.accountId = 'acc_cash_in_hand';
          } else if (!data.accountId || data.accountId === 'default') {
            data.accountId = 'acc_hdfc_main_6569';
          }
          transactions.push(data);
        });

        // Sort by full timestamp: date + time, then createdAt descending
        transactions.sort((a, b) => {
          const timeAStr = `${a.date || ''}T${a.time || '00:00'}:00`;
          const timeBStr = `${b.date || ''}T${b.time || '00:00'}:00`;
          const dateA = new Date(timeAStr).getTime() || a.createdAt || 0;
          const dateB = new Date(timeBStr).getTime() || b.createdAt || 0;
          return dateB - dateA;
        });

        if (transactions.length > 0) {
          localStorage.setItem(LOCAL_STORAGE_TRANSACTIONS_KEY, JSON.stringify(transactions));
        }

        onUpdate(transactions);
      },
      (error) => {
        console.warn('Real-time transactions subscription warning:', error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.error('Failed to setup real-time listener for transactions:', err);
    return () => {};
  }
}

/**
 * Save or update a Bank Transaction in Firestore
 * If linked to a cash invoice and syncWithInvoice is true, it automatically updates the invoice's paymentReceived in Firestore!
 */
export async function saveBankTransactionToFirestore(
  transaction: BankTransaction,
  syncWithInvoice: boolean = true
): Promise<{ success: boolean; updatedInvoice?: CashInvoiceData | null }> {
  try {
    const docId =
      transaction.id ||
      `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const updatedTx: BankTransaction = {
      ...transaction,
      id: docId,
      updatedAt: Date.now(),
      createdAt: transaction.createdAt || Date.now(),
    };

    const ref = doc(db, BANK_TRANSACTIONS_COLLECTION, docId);
    const sanitized = JSON.parse(JSON.stringify(updatedTx));
    await setDoc(ref, sanitized);

    // Update local cache
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_TRANSACTIONS_KEY);
      const txs: BankTransaction[] = cached ? JSON.parse(cached) : [];
      const idx = txs.findIndex((t) => t.id === docId);
      if (idx >= 0) {
        txs[idx] = updatedTx;
      } else {
        txs.unshift(updatedTx);
      }
      localStorage.setItem(LOCAL_STORAGE_TRANSACTIONS_KEY, JSON.stringify(txs));
    } catch (e) {
      console.warn('Failed to update transactions cache', e);
    }

    let updatedInvoice: CashInvoiceData | null = null;

    // Direct Cash Invoice Link synchronization
    if (
      syncWithInvoice &&
      updatedTx.type === 'credit' &&
      (updatedTx.linkedInvoiceNumber || updatedTx.linkedInvoiceId) &&
      updatedTx.amount > 0
    ) {
      try {
        const invoices = await fetchCashInvoicesFromFirestore();
        const targetInvNum = updatedTx.linkedInvoiceNumber || updatedTx.linkedInvoiceId;
        const matchingInvoice = invoices.find(
          (inv) =>
            inv.invNumber?.toLowerCase().trim() === targetInvNum?.toLowerCase().trim() ||
            inv.invNumber?.replace(/\//g, '_') === targetInvNum
        );

        if (matchingInvoice) {
          const currentReceived = Number(matchingInvoice.paymentReceived) || 0;
          const grandTotal = Number(matchingInvoice.grandTotal) || 0;
          const newReceived = currentReceived + Number(updatedTx.amount);
          
          let newStatus = matchingInvoice.status || 'Unpaid';
          if (newReceived >= grandTotal && grandTotal > 0) {
            newStatus = 'Paid';
          } else if (newReceived > 0) {
            newStatus = 'Partial';
          }

          const invToUpdate: CashInvoiceData = {
            ...matchingInvoice,
            paymentReceived: newReceived,
            status: newStatus,
            lastBankPaymentRef: updatedTx.referenceNumber || '',
            lastBankPaymentDate: updatedTx.date,
            lastBankPaymentAccountId: updatedTx.accountId,
            savedAt: Date.now(),
          };

          await saveCashInvoiceToFirestore(invToUpdate);
          updatedInvoice = invToUpdate;
        }
      } catch (invErr) {
        console.warn('Could not auto-update cash invoice payment:', invErr);
      }
    }

    return { success: true, updatedInvoice };
  } catch (error) {
    console.error('Error saving bank transaction to Firestore:', error);
    return { success: false };
  }
}

/**
 * Delete a Bank Transaction from Firestore
 */
/**
 * Helper to revert a matching Delivery Challan (DC) back to Cash Queue as unpaid
 * when a linked bank transaction is unlinked or deleted.
 */
export async function revertMatchingDcToCashQueue(tx: Partial<BankTransaction>): Promise<boolean> {
  try {
    const invRef = tx.linkedInvoiceNumber || tx.linkedInvoiceId || '';
    const cleanDcNo = invRef.replace(/^DC\s*#?\s*/i, '').trim().toLowerCase();
    const txRefNo = (tx.referenceNumber || '').trim().toLowerCase();

    if (!invRef && !cleanDcNo && !txRefNo) return false;

    const dcs = await fetchDcsFromFirestore();
    const matchingDc = dcs.find((d) => {
      const dDcNo = (d.dcNo || '').replace(/^DC\s*#?\s*/i, '').trim().toLowerCase();
      const dInvRef = (d.invoiceRef || '').trim().toLowerCase();
      const dUtr = ((d as any).utrNo || '').trim().toLowerCase();
      const dId = (d.id || '').trim().toLowerCase();

      if (invRef && (dId === invRef || dInvRef === invRef || dInvRef.replace(/\//g, '_') === invRef)) {
        return true;
      }
      if (cleanDcNo && (dDcNo === cleanDcNo || d.dcNo?.toLowerCase() === cleanDcNo)) {
        return true;
      }
      if (txRefNo && dUtr && txRefNo === dUtr) {
        return true;
      }
      return false;
    });

    if (matchingDc && (matchingDc.status === 'completed' || matchingDc.status === 'cash')) {
      const now = new Date().toISOString();
      const updatedDc = {
        ...matchingDc,
        status: 'cash' as const,
        history: [
          ...(matchingDc.history || []),
          {
            at: now,
            action: 'MOVE_TO_CASH' as const,
            fromStatus: matchingDc.status,
            toStatus: 'cash' as const,
            meta: { reason: 'Transaction unlinked or deleted from Bank Treasury' },
          },
        ],
      };

      // Remove payment details so DC is clean & unpaid in Cash Queue
      delete (updatedDc as any).paidAt;
      delete (updatedDc as any).paymentMethod;
      delete (updatedDc as any).bankAccountId;
      delete (updatedDc as any).bankName;
      delete (updatedDc as any).accountNumber;
      delete (updatedDc as any).utrNo;

      await updateDcInFirestore(updatedDc);

      // Also update localStorage & broadcast event for active React views
      try {
        const raw = localStorage.getItem('srrortho:saved-dcs');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const idx = list.findIndex((item: any) => item.id === matchingDc.id);
            if (idx >= 0) {
              list[idx] = updatedDc;
            } else {
              list.unshift(updatedDc);
            }
            localStorage.setItem('srrortho:saved-dcs', JSON.stringify(list));
            window.dispatchEvent(new CustomEvent('srrortho:saved_dcs_updated', { detail: list }));
          }
        }
      } catch {}

      return true;
    }
  } catch (err) {
    console.warn('Error reverting matching DC to cash queue:', err);
  }
  return false;
}

export async function deleteBankTransactionFromFirestore(
  transactionId: string,
  revertInvoicePayment: boolean = false,
  transactionData?: BankTransaction
): Promise<boolean> {
  try {
    let txData = transactionData;
    if (!txData) {
      try {
        const txDocRef = doc(db, BANK_TRANSACTIONS_COLLECTION, transactionId);
        const txSnap = await getDoc(txDocRef);
        if (txSnap.exists()) {
          txData = txSnap.data() as BankTransaction;
        }
      } catch {}
    }

    const ref = doc(db, BANK_TRANSACTIONS_COLLECTION, transactionId);
    await deleteDoc(ref);

    // Update local cache
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_TRANSACTIONS_KEY);
      if (cached) {
        const txs: BankTransaction[] = JSON.parse(cached).filter((t: BankTransaction) => t.id !== transactionId);
        localStorage.setItem(LOCAL_STORAGE_TRANSACTIONS_KEY, JSON.stringify(txs));
      }
    } catch {
      // ignore
    }

    // Revert matching Delivery Challan in DC Tracker back to Cash Queue as unpaid
    if (txData) {
      await revertMatchingDcToCashQueue(txData);
    }

    // Optional revert of cash invoice payment
    if (
      revertInvoicePayment &&
      txData &&
      txData.type === 'credit' &&
      (txData.linkedInvoiceNumber || txData.linkedInvoiceId) &&
      txData.amount > 0
    ) {
      try {
        const invoices = await fetchCashInvoicesFromFirestore();
        const targetInvNum = txData.linkedInvoiceNumber || txData.linkedInvoiceId;
        const matchingInvoice = invoices.find(
          (inv) =>
            inv.invNumber?.toLowerCase().trim() === targetInvNum?.toLowerCase().trim() ||
            inv.invNumber?.replace(/\//g, '_') === targetInvNum
        );

        if (matchingInvoice) {
          const currentReceived = Number(matchingInvoice.paymentReceived) || 0;
          const grandTotal = Number(matchingInvoice.grandTotal) || 0;
          const newReceived = Math.max(0, currentReceived - Number(txData.amount));

          let newStatus = 'Unpaid';
          if (newReceived >= grandTotal && grandTotal > 0) {
            newStatus = 'Paid';
          } else if (newReceived > 0) {
            newStatus = 'Partial';
          }

          await saveCashInvoiceToFirestore({
            ...matchingInvoice,
            paymentReceived: newReceived,
            status: newStatus,
            savedAt: Date.now(),
          });
        }
      } catch (revErr) {
        console.warn('Could not revert cash invoice payment:', revErr);
      }
    }

    return true;
  } catch (error) {
    console.error('Error deleting bank transaction:', error);
    return false;
  }
}

/**
 * Delete all Bank Transactions from Firestore and localStorage (Clean reset)
 */
export async function clearAllBankTransactionsFromFirestore(): Promise<{ success: boolean; count: number }> {
  try {
    const querySnapshot = await getDocs(collection(db, BANK_TRANSACTIONS_COLLECTION));
    const count = querySnapshot.size;
    const deletePromises = querySnapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));

    for (let i = 0; i < deletePromises.length; i += 25) {
      await Promise.all(deletePromises.slice(i, i + 25));
    }

    try {
      localStorage.removeItem(LOCAL_STORAGE_TRANSACTIONS_KEY);
    } catch {
      // ignore
    }

    return { success: true, count };
  } catch (error) {
    console.error('Error clearing all bank transactions:', error);
    return { success: false, count: 0 };
  }
}

/**
 * Completely wipe ALL Bank Accounts AND Bank Transactions from Firestore and localStorage (Total Clean Slate)
 */
export async function clearAllBankDataAndAccountsFromFirestore(): Promise<{
  success: boolean;
  txCount: number;
  accCount: number;
}> {
  try {
    // 1. Delete all transactions
    const txSnap = await getDocs(collection(db, BANK_TRANSACTIONS_COLLECTION));
    const txCount = txSnap.size;
    const txPromises = txSnap.docs.map((d) => deleteDoc(d.ref));
    for (let i = 0; i < txPromises.length; i += 25) {
      await Promise.all(txPromises.slice(i, i + 25));
    }

    // 2. Delete all accounts
    const accSnap = await getDocs(collection(db, BANK_ACCOUNTS_COLLECTION));
    const accCount = accSnap.size;
    const accPromises = accSnap.docs.map((d) => deleteDoc(d.ref));
    for (let i = 0; i < accPromises.length; i += 25) {
      await Promise.all(accPromises.slice(i, i + 25));
    }

    // 3. Clear local cache
    try {
      localStorage.removeItem(LOCAL_STORAGE_ACCOUNTS_KEY);
      localStorage.removeItem(LOCAL_STORAGE_TRANSACTIONS_KEY);
    } catch {
      // ignore
    }

    return { success: true, txCount, accCount };
  } catch (error) {
    console.error('Error clearing all bank data and accounts:', error);
    return { success: false, txCount: 0, accCount: 0 };
  }
}

/**
 * Fast 1-Click Helper: Deposit a Cash Invoice directly into a Bank Account as a Credit
 */
export async function depositCashInvoiceToBankAccount({
  accountId,
  invoice,
  creditAmount,
  referenceNumber,
  date,
  category = 'Invoice Collection',
  description,
}: {
  accountId: string;
  invoice: CashInvoiceData;
  creditAmount: number;
  referenceNumber?: string;
  date?: string;
  category?: string;
  description?: string;
}): Promise<{ success: boolean; transaction?: BankTransaction; updatedInvoice?: CashInvoiceData }> {
  try {
    const txDate = date || new Date().toISOString().split('T')[0];
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const defaultDesc = description || `Payment received for Invoice ${invoice.invNumber} (${invoice.clientName || 'Customer'})`;

    const tx: BankTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      accountId,
      type: 'credit',
      amount: Number(creditAmount),
      date: txDate,
      time: timeStr,
      category,
      description: defaultDesc,
      referenceNumber: referenceNumber || `DEP-${Date.now().toString().slice(-6)}`,
      linkedInvoiceId: invoice.invNumber ? invoice.invNumber.replace(/\//g, '_') : undefined,
      linkedInvoiceNumber: invoice.invNumber,
      linkedCustomerName: invoice.clientName || '',
      linkedHospital: invoice.clientName || '',
      createdSource: 'cash_invoice_link',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const res = await saveBankTransactionToFirestore(tx, true);
    return {
      success: res.success,
      transaction: tx,
      updatedInvoice: res.updatedInvoice || undefined,
    };
  } catch (error) {
    console.error('Error in depositCashInvoiceToBankAccount:', error);
    return { success: false };
  }
}

/**
 * Link an existing Bank Transaction to a Cash Invoice directly
 */
export async function linkBankTransactionToCashInvoice(
  transactionId: string,
  invoice: CashInvoiceData,
  applyPaymentToInvoice: boolean = true
): Promise<{ success: boolean; updatedInvoice?: CashInvoiceData }> {
  try {
    const txDocRef = doc(db, BANK_TRANSACTIONS_COLLECTION, transactionId);
    const txSnap = await getDoc(txDocRef);
    if (!txSnap.exists()) {
      throw new Error('Transaction not found');
    }
    const targetTx = txSnap.data() as BankTransaction;

    const updatedTx: BankTransaction = {
      ...targetTx,
      linkedInvoiceId: invoice.invNumber ? invoice.invNumber.replace(/\//g, '_') : undefined,
      linkedInvoiceNumber: invoice.invNumber,
      linkedCustomerName: invoice.clientName || '',
      linkedHospital: invoice.clientName || '',
      updatedAt: Date.now(),
    };

    const res = await saveBankTransactionToFirestore(updatedTx, applyPaymentToInvoice);
    return {
      success: res.success,
      updatedInvoice: res.updatedInvoice || undefined,
    };
  } catch (error) {
    console.error('Error linking transaction to invoice:', error);
    return { success: false };
  }
}

/**
 * Unlink a Bank Transaction from a Cash Invoice
 */
export async function unlinkBankTransactionFromCashInvoice(
  transactionId: string,
  revertPayment: boolean = true
): Promise<boolean> {
  try {
    const txDocRef = doc(db, BANK_TRANSACTIONS_COLLECTION, transactionId);
    const txSnap = await getDoc(txDocRef);
    if (!txSnap.exists()) return false;
    const targetTx = txSnap.data() as BankTransaction;

    const oldInvoiceNumber = targetTx.linkedInvoiceNumber || targetTx.linkedInvoiceId;
    const oldAmount = targetTx.amount;

    // Revert matching Delivery Challan back to Cash Queue as unpaid
    await revertMatchingDcToCashQueue(targetTx);

    const updatedTx: BankTransaction = {
      ...targetTx,
      linkedInvoiceId: undefined,
      linkedInvoiceNumber: undefined,
      linkedCustomerName: undefined,
      linkedHospital: undefined,
      updatedAt: Date.now(),
    };

    const ref = doc(db, BANK_TRANSACTIONS_COLLECTION, transactionId);
    const sanitized = JSON.parse(JSON.stringify(updatedTx));
    await setDoc(ref, sanitized);

    // Update local cache
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_TRANSACTIONS_KEY);
      if (cached) {
        const txs: BankTransaction[] = JSON.parse(cached);
        const idx = txs.findIndex((t) => t.id === transactionId);
        if (idx >= 0) txs[idx] = updatedTx;
        localStorage.setItem(LOCAL_STORAGE_TRANSACTIONS_KEY, JSON.stringify(txs));
      }
    } catch {
      // ignore
    }

    // Revert payment on invoice if requested
    if (revertPayment && oldInvoiceNumber && oldAmount > 0) {
      try {
        const invoices = await fetchCashInvoicesFromFirestore();
        const matchingInvoice = invoices.find(
          (inv) =>
            inv.invNumber?.toLowerCase().trim() === oldInvoiceNumber?.toLowerCase().trim() ||
            inv.invNumber?.replace(/\//g, '_') === oldInvoiceNumber
        );

        if (matchingInvoice) {
          const currentReceived = Number(matchingInvoice.paymentReceived) || 0;
          const grandTotal = Number(matchingInvoice.grandTotal) || 0;
          const newReceived = Math.max(0, currentReceived - Number(oldAmount));

          let newStatus = 'Unpaid';
          if (newReceived >= grandTotal && grandTotal > 0) {
            newStatus = 'Paid';
          } else if (newReceived > 0) {
            newStatus = 'Partial';
          }

          await saveCashInvoiceToFirestore({
            ...matchingInvoice,
            paymentReceived: newReceived,
            status: newStatus,
            savedAt: Date.now(),
          });
        }
      } catch (revErr) {
        console.warn('Could not revert invoice payment on unlink:', revErr);
      }
    }

    return true;
  } catch (error) {
    console.error('Error unlinking transaction:', error);
    return false;
  }
}

/**
 * Batch import parsed bank statement transactions (from CSV / Sheet / Gmail alert)
 */
export async function importBatchBankTransactions(
  transactions: BankTransaction[]
): Promise<{ count: number; success: boolean }> {
  try {
    let savedCount = 0;
    const chunkSize = 25;

    for (let i = 0; i < transactions.length; i += chunkSize) {
      const chunk = transactions.slice(i, i + chunkSize);
      const results = await Promise.all(
        chunk.map((tx) => saveBankTransactionToFirestore(tx, false))
      );
      savedCount += results.filter((r) => r.success).length;
    }

    return { count: savedCount, success: true };
  } catch (error) {
    console.error('Error batch importing transactions:', error);
    return { count: 0, success: false };
  }
}

/**
 * Helper to automatically record cash collection into Cash In Hand bank account
 */
export async function recordCashPaymentToCashInHand(
  dc: { id?: string; dcNo: string; hospitalName: string; invoiceRef?: string },
  paidAmount: number,
  collectedBy: string = '',
  remarks?: string
): Promise<boolean> {
  try {
    const accounts = await fetchBankAccountsFromFirestore();
    let cashAcc = accounts.find(
      (a) =>
        a.accountType === 'cash_in_hand' ||
        a.id === 'acc_cash_in_hand' ||
        (a.bankName && a.bankName.toLowerCase().includes('cash in hand')) ||
        (a.accountName && a.accountName.toLowerCase().includes('cash in hand'))
    );

    if (!cashAcc) {
      cashAcc = {
        id: 'acc_cash_in_hand',
        accountName: 'Cash In Hand (Petty Cash)',
        bankName: 'Cash In Hand',
        accountNumber: 'CASH-001',
        ifscCode: 'CASH',
        branch: 'Main Desk',
        accountType: 'cash_in_hand',
        openingBalance: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    const invNum = dc.invoiceRef || `DC #${dc.dcNo}`;
    const desc = remarks || `Cash Received for ${invNum} (${dc.hospitalName})${collectedBy ? ` - Collected by ${collectedBy}` : ''}`;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);

    const tx: BankTransaction = {
      id: `tx_cash_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      accountId: cashAcc.id,
      type: 'credit',
      amount: paidAmount,
      date: dateStr,
      time: timeStr,
      category: 'Cash Sales',
      description: desc,
      referenceNumber: `CASH-${dc.dcNo}`,
      linkedInvoiceId: invNum.replace(/\//g, '_'),
      linkedInvoiceNumber: invNum,
      linkedCustomerName: dc.hospitalName,
      linkedHospital: dc.hospitalName,
      createdSource: 'cash_invoice_link',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const res = await saveBankTransactionToFirestore(tx, false);
    return res.success;
  } catch (err) {
    console.error('Failed to record cash payment in Cash In Hand account:', err);
    return false;
  }
}



