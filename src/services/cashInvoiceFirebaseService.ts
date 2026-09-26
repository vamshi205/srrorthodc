import { db } from '@/firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';

const CASH_INVOICES_COLLECTION = 'cash_invoices';
const CASH_CUSTOMERS_COLLECTION = 'cash_customers';

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
 * Fetch all Cash Invoices from Firestore
 */
export async function fetchCashInvoicesFromFirestore(): Promise<CashInvoiceData[]> {
  try {
    const querySnapshot = await getDocs(collection(db, CASH_INVOICES_COLLECTION));
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
    // Sort manually in memory by savedAt descending
    invoices.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    return invoices;
  } catch (error) {
    console.error('Error fetching cash invoices from Firestore:', error);
    return [];
  }
}

/**
 * Save or update a Cash Invoice in Firestore
 */
export async function saveCashInvoiceToFirestore(invoice: CashInvoiceData): Promise<boolean> {
  try {
    const docId = invoice.invNumber ? invoice.invNumber.replace(/\//g, '_') : `INV_${Date.now()}`;
    const ref = doc(db, CASH_INVOICES_COLLECTION, docId);
    const sanitized = JSON.parse(JSON.stringify(invoice));
    // Ensure both items and invoiceItems exist for legacy and native compatibility
    if (sanitized.items && !sanitized.invoiceItems) {
      sanitized.invoiceItems = sanitized.items;
    }
    if (sanitized.invoiceItems && !sanitized.items) {
      sanitized.items = sanitized.invoiceItems;
    }
    await setDoc(ref, sanitized);
    return true;
  } catch (error) {
    console.error('Error saving cash invoice to Firestore:', error);
    return false;
  }
}

/**
 * Delete a Cash Invoice from Firestore
 */
export async function deleteCashInvoiceFromFirestore(invNumber: string): Promise<boolean> {
  try {
    const docId = invNumber.replace(/\//g, '_');
    const ref = doc(db, CASH_INVOICES_COLLECTION, docId);
    await deleteDoc(ref);
    return true;
  } catch (error) {
    console.error('Error deleting cash invoice from Firestore:', error);
    return false;
  }
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
    await setDoc(ref, sanitized);
    return true;
  } catch (error) {
    console.error('Error saving cash customer to Firestore:', error);
    return false;
  }
}

/**
 * Delete a Cash Customer from Firestore (checks direct doc ID, sanitized name doc ID, and queries documents by name or id)
 */
export async function deleteCashCustomerFromFirestore(idOrName: string, secondaryName?: string): Promise<boolean> {
  if (!idOrName) return false;
  try {
    const targetsToDelete = new Set<string>();
    
    // Direct ID doc
    targetsToDelete.add(idOrName);
    targetsToDelete.add(idOrName.toLowerCase().replace(/[^a-z0-9]/g, '_'));

    if (secondaryName) {
      targetsToDelete.add(secondaryName);
      targetsToDelete.add(secondaryName.toLowerCase().replace(/[^a-z0-9]/g, '_'));
    }

    for (const docId of targetsToDelete) {
      try {
        await deleteDoc(doc(db, CASH_CUSTOMERS_COLLECTION, docId));
      } catch {
        // ignore individual doc delete error
      }
    }

    // Also scan collection to delete any documents matching name or ID
    const searchTerms = [idOrName.toLowerCase().trim()];
    if (secondaryName) searchTerms.push(secondaryName.toLowerCase().trim());

    const snapshot = await getDocs(collection(db, CASH_CUSTOMERS_COLLECTION));
    const deletePromises: Promise<void>[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const docName = (data.name || "").toLowerCase().trim();
      const docDataId = (data.id || "").toLowerCase().trim();
      const docSnapId = docSnap.id.toLowerCase().trim();

      const matches = searchTerms.some(
        (term) => term === docName || term === docDataId || term === docSnapId
      );

      if (matches) {
        deletePromises.push(deleteDoc(docSnap.ref));
      }
    });

    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
    }

    return true;
  } catch (error) {
    console.error('Error deleting cash customer from Firestore:', error);
    return false;
  }
}
