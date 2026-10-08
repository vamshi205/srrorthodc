import { db } from '@/firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';

const CASH_INVOICES_COLLECTION = 'cash_invoices';
const CASH_CUSTOMERS_COLLECTION = 'cash_customers';
const LOCAL_STORAGE_CASH_INVOICES_KEY = 'srrortho:cash_invoices_cache';

export interface CashInvoiceData {
  invNumber: string;
  dcNumber?: string;
  invDate: string;
  invDue?: string;
  clientName: string;
  clientAddress?: string;
  clientMobile?: string;
  clientEmail?: string;
  items: Array<{
    description: string;
    sku?: string;
    size?: string;
    note?: string;
    subDescription?: string;
    qty: number;
    rate: number;
    amount?: number;
  }>;
  subtotal: number;
  discount: number;
  taxPercent?: number;
  taxAmount?: number;
  grandTotal: number;
  paymentReceived: number;
  status?: string;
  savedAt: number;
  [key: string]: any;
}

export interface CashCustomerData {
  id: string;
  name: string;
  address?: string;
  mobile?: string;
  email?: string;
  [key: string]: any;
}

/**
 * Fetch all Cash Invoices from LocalStorage instantly with background sync to Firestore
 */
export async function fetchCashInvoicesFromFirestore(): Promise<CashInvoiceData[]> {
  const cached = localStorage.getItem(LOCAL_STORAGE_CASH_INVOICES_KEY);
  let localList: CashInvoiceData[] = [];
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) localList = parsed;
    } catch {}
  }

  // Background fetch from Firestore with 4s timeout to avoid hanging UI
  const fetchWithTimeout = Promise.race([
    getDocs(collection(db, CASH_INVOICES_COLLECTION)),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 4000))
  ]);

  fetchWithTimeout
    .then((querySnapshot) => {
      const invoices: CashInvoiceData[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const rawList = Array.isArray(data.items) && data.items.length > 0
          ? data.items
          : Array.isArray(data.invoiceItems)
            ? data.invoiceItems
            : [];
        
        const normalizedItems = rawList.map((it: any) => ({
          description: it.description || it.name || "",
          sku: it.sku || "",
          size: it.size || "",
          qty: Number(it.qty) || 1,
          rate: Number(it.rate) || 0,
          amount: Number(it.amount) || (Number(it.qty) || 1) * (Number(it.rate) || 0),
        }));

        invoices.push({
          ...data,
          items: normalizedItems,
          invoiceItems: normalizedItems,
        } as CashInvoiceData);
      });

      invoices.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

      if (invoices.length > 0) {
        localStorage.setItem(LOCAL_STORAGE_CASH_INVOICES_KEY, JSON.stringify(invoices));
        window.dispatchEvent(new CustomEvent("srrortho:cash_invoices_updated", { detail: invoices }));
      }
    })
    .catch((err) => {
      console.warn('Firestore load fallback to local storage:', err?.message || err);
    });

  if (localList.length > 0) {
    return localList;
  }

  try {
    const querySnapshot = await fetchWithTimeout;
    const invoices: CashInvoiceData[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const rawList = Array.isArray(data.items) && data.items.length > 0
        ? data.items
        : Array.isArray(data.invoiceItems)
          ? data.invoiceItems
          : [];
      const normalizedItems = rawList.map((it: any) => ({
        description: it.description || it.name || "",
        sku: it.sku || "",
        size: it.size || "",
        qty: Number(it.qty) || 1,
        rate: Number(it.rate) || 0,
        amount: Number(it.amount) || (Number(it.qty) || 1) * (Number(it.rate) || 0),
      }));
      invoices.push({
        ...data,
        items: normalizedItems,
        invoiceItems: normalizedItems,
      } as CashInvoiceData);
    });
    invoices.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    localStorage.setItem(LOCAL_STORAGE_CASH_INVOICES_KEY, JSON.stringify(invoices));
    return invoices;
  } catch {
    return localList;
  }
}

/**
 * Save or update a Cash Invoice with instant local-first persistence
 */
export async function saveCashInvoiceToFirestore(invoice: CashInvoiceData): Promise<boolean> {
  const sanitized = JSON.parse(JSON.stringify(invoice));
  if (sanitized.items && !sanitized.invoiceItems) {
    sanitized.invoiceItems = sanitized.items;
  }
  if (sanitized.invoiceItems && !sanitized.items) {
    sanitized.items = sanitized.invoiceItems;
  }

  // 1. Local-first update (0ms latency)
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_CASH_INVOICES_KEY);
    let list: CashInvoiceData[] = cached ? JSON.parse(cached) : [];
    if (!Array.isArray(list)) list = [];
    const idx = list.findIndex((i) => i.invNumber === sanitized.invNumber);
    if (idx >= 0) {
      list[idx] = sanitized;
    } else {
      list.unshift(sanitized);
    }
    localStorage.setItem(LOCAL_STORAGE_CASH_INVOICES_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("srrortho:cash_invoices_updated", { detail: list }));
  } catch (e) {
    console.warn("Failed to update local cash invoice cache:", e);
  }

  // 2. Asynchronous background sync to Firestore
  try {
    const docId = invoice.invNumber ? invoice.invNumber.replace(/\//g, '_') : `INV_${Date.now()}`;
    const ref = doc(db, CASH_INVOICES_COLLECTION, docId);
    setDoc(ref, sanitized).catch((error) => {
      console.warn('Background Firestore cash invoice save failed:', error);
    });
  } catch (error) {
    console.warn('Firestore doc ref error:', error);
  }

  return true;
}

/**
 * Delete a Cash Invoice with instant local-first persistence
 */
export async function deleteCashInvoiceFromFirestore(invNumberOrDcNo: string): Promise<boolean> {
  if (!invNumberOrDcNo) return false;
  const cleanTarget = String(invNumberOrDcNo).trim().toLowerCase();
  const cleanRawNo = cleanTarget.replace(/^dc\s*#?\s*/i, '');

  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_CASH_INVOICES_KEY);
    if (cached) {
      let list: CashInvoiceData[] = JSON.parse(cached);
      if (Array.isArray(list)) {
        list = list.filter((i) => {
          const iNum = String(i.invNumber || '').trim().toLowerCase();
          const iDc = String(i.dcNumber || '').trim().toLowerCase();
          if (iNum === cleanTarget || iNum === cleanRawNo || iNum === `dc #${cleanRawNo}`) return false;
          if (iDc === cleanTarget || iDc === cleanRawNo) return false;
          return true;
        });
        localStorage.setItem(LOCAL_STORAGE_CASH_INVOICES_KEY, JSON.stringify(list));
        window.dispatchEvent(new CustomEvent("srrortho:cash_invoices_updated", { detail: list }));
      }
    }
  } catch {}

  // Async background delete from Firestore
  try {
    const targetDocId = String(invNumberOrDcNo).trim().replace(/\//g, '_');
    const directRef = doc(db, CASH_INVOICES_COLLECTION, targetDocId);
    deleteDoc(directRef).catch(() => {});

    // Also query collection to delete matching documents by invNumber, dcNumber, or doc snapshot id
    getDocs(collection(db, CASH_INVOICES_COLLECTION)).then((snapshot) => {
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const iNum = String(data.invNumber || '').trim().toLowerCase();
        const iDc = String(data.dcNumber || '').trim().toLowerCase();
        const docIdLower = docSnap.id.trim().toLowerCase();

        if (
          iNum === cleanTarget ||
          iNum === cleanRawNo ||
          iNum === `dc #${cleanRawNo}` ||
          iDc === cleanTarget ||
          iDc === cleanRawNo ||
          docIdLower === cleanTarget ||
          docIdLower === cleanRawNo ||
          docIdLower === targetDocId.toLowerCase()
        ) {
          deleteDoc(docSnap.ref).catch((e) => console.warn('Failed to delete doc:', docSnap.id, e));
        }
      });
    }).catch((e) => console.warn('Firestore collection query for delete failed:', e));
  } catch (err) {
    console.warn('Firestore delete cash invoice error:', err);
  }

  return true;
}

/**
 * Fetch all Cash Customers from Firestore
 */
export async function fetchCashCustomersFromFirestore(): Promise<CashCustomerData[]> {
  try {
    const querySnapshot = await getDocs(collection(db, CASH_CUSTOMERS_COLLECTION));
    const customers: CashCustomerData[] = [];
    querySnapshot.forEach((docSnap) => {
      customers.push(docSnap.data() as CashCustomerData);
    });
    return customers;
  } catch (error) {
    console.error('Error fetching cash customers from Firestore:', error);
    return [];
  }
}

/**
 * Save a Cash Customer to Firestore
 */
export async function saveCashCustomerToFirestore(customer: CashCustomerData): Promise<boolean> {
  try {
    const docId = customer.id || customer.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const ref = doc(db, CASH_CUSTOMERS_COLLECTION, docId);
    const sanitized = JSON.parse(JSON.stringify(customer));
    setDoc(ref, sanitized).catch((err) => console.warn('Background save customer failed:', err));
    return true;
  } catch (error) {
    console.error('Error saving cash customer to Firestore:', error);
    return true;
  }
}

/**
 * Delete a Cash Customer from Firestore
 */
export async function deleteCashCustomerFromFirestore(idOrName: string, secondaryName?: string): Promise<boolean> {
  if (!idOrName) return false;
  try {
    const targetsToDelete = new Set<string>();
    targetsToDelete.add(idOrName);
    targetsToDelete.add(idOrName.toLowerCase().replace(/[^a-z0-9]/g, '_'));

    if (secondaryName) {
      targetsToDelete.add(secondaryName);
      targetsToDelete.add(secondaryName.toLowerCase().replace(/[^a-z0-9]/g, '_'));
    }

    for (const docId of targetsToDelete) {
      try {
        deleteDoc(doc(db, CASH_CUSTOMERS_COLLECTION, docId)).catch(() => {});
      } catch {}
    }

    return true;
  } catch (error) {
    console.error('Error deleting cash customer from Firestore:', error);
    return true;
  }
}
