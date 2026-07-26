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
      invoices.push(docSnap.data() as CashInvoiceData);
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
