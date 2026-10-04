import {
  fetchDcsFromFirestore,
  saveDcToFirestore,
  updateDcInFirestore,
  deleteDcFromFirestore,
} from '@/services/firestoreService';

export type SavedDcItemSize = {
  size: string;
  qty: number;
};

export type SavedDcItem = {
  name: string;
  sizes: SavedDcItemSize[];
  procedure: string;
  isSelectable: boolean;
};

export type SavedDcStatus = "pending" | "returned" | "completed" | "cash" | "cancelled";

export type SavedDcHistoryEvent = {
  at: string; // ISO timestamp
  action:
  | "CREATED"
  | "MARK_RETURNED"
  | "LINK_INVOICE"
  | "MOVE_TO_CASH"
  | "MOVE_BACK_TO_PENDING"
  | "MOVE_BACK_TO_RETURNED"
  | "MOVE_CASH_TO_COMPLETED"
  | "CANCEL_CASE"
  | "RESTORE_FROM_CANCELLED"
  | "PURCHASE"
  | "DELINK_PAYMENT_MOVE_TO_CASH"
  | "DELINK_PAYMENT_MOVE_TO_RETURNED"
  | "DELETE_PART_PAYMENT_INSTALLMENT";
  fromStatus?: SavedDcStatus;
  toStatus: SavedDcStatus;
  meta?: Record<string, unknown>;
};

export type SavedDc = {
  id: string;
  hospitalName: string;
  dcNo: string;
  materialType: string;
  savedAt: string;
  deliveredBy: string;
  receivedBy: string;
  doctorName?: string;
  remarks: string;
  status: SavedDcStatus;
  items: SavedDcItem[];
  instruments: string[];
  boxNumbers: string[];
  returnedBy?: string;
  returnedAt?: string;
  returnedRemarks?: string;
  invoiceRef?: string;
  invoiceRemarks?: string;
  invoiceUrl?: string;
  isTaxInvoice?: boolean;
  isPurchase?: boolean;
  cashAt?: string;
  cashAmount?: number;
  billedAmount?: number;
  hospitalMargin?: number;
  cashRemarks?: string;
  paymentMethod?: "cash" | "bank_transfer";
  collectedBy?: string;
  paidAt?: string;
  cancelledAt?: string;
  cancelledRemarks?: string;
  partPayments?: Array<{
    at: string;
    amount: number;
    paymentMethod: "cash" | "bank_transfer";
    collectedBy?: string;
    utrNo?: string;
    remarks?: string;
  }>;
  history?: SavedDcHistoryEvent[];
};

const STORAGE_KEY = "srrortho:saved-dcs";

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * Get local cached DCs synchronously
 */
export const getLocalSavedDcs = (): SavedDc[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedDc[]) : [];
  } catch {
    return [];
  }
};

/**
 * Save to local cache and broadcast update
 */
export const saveLocalDcs = (dcs: SavedDc[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dcs));
    window.dispatchEvent(new CustomEvent("srrortho:saved_dcs_updated", { detail: dcs }));
  } catch (err) {
    console.warn("Failed to write to localStorage:", err);
  }
};

/**
 * Load DCs from Local Storage instantly, with background sync to Firestore
 */
export const loadSavedDcs = async (): Promise<SavedDc[]> => {
  const localDcs = getLocalSavedDcs();
  
  // Background fetch from Firestore with 4-second timeout to prevent UI hanging
  const fetchWithTimeout = Promise.race([
    fetchDcsFromFirestore(),
    new Promise<SavedDc[]>((_, reject) => 
      setTimeout(() => reject(new Error('Firestore timeout')), 4000)
    )
  ]);

  fetchWithTimeout
    .then((firestoreDcs) => {
      if (Array.isArray(firestoreDcs) && firestoreDcs.length >= 0) {
        saveLocalDcs(firestoreDcs);
      }
    })
    .catch((err) => {
      console.warn('Firestore load fallback to local storage:', err?.message || err);
    });

  // Always return local cache immediately if present
  if (localDcs.length > 0) {
    return localDcs;
  }

  // If local cache is empty, wait for Firestore attempt
  try {
    const dcs = await fetchWithTimeout;
    saveLocalDcs(dcs);
    return dcs;
  } catch {
    return getLocalSavedDcs();
  }
};

/**
 * Save a new DC with instant local-first persistence
 */
export const saveSavedDc = async (
  data: Omit<SavedDc, "id" | "savedAt" | "status"> & { status?: SavedDcStatus; customAt?: string },
): Promise<SavedDc> => {
  const now = new Date().toISOString();
  const savedAt = data.customAt || now;
  const saved: SavedDc = {
    ...data,
    id: createId(),
    savedAt: savedAt,
    status: data.status ?? "pending",
    history: [
      {
        at: savedAt,
        action: "CREATED",
        toStatus: (data.status ?? "pending") as SavedDcStatus,
      },
    ],
  };

  const currentDcs = getLocalSavedDcs();
  const updatedList = [saved, ...currentDcs.filter((d) => d.id !== saved.id)];
  saveLocalDcs(updatedList);

  // Sync with Firestore asynchronously in background
  saveDcToFirestore(saved).catch((error) => {
    console.warn('Background Firestore save failed (offline/slow network):', error);
  });

  return saved;
};

/**
 * Delete a DC with instant local-first persistence
 */
export const deleteSavedDc = async (id: string): Promise<void> => {
  const currentDcs = getLocalSavedDcs();
  const filtered = currentDcs.filter((d) => d.id !== id);
  saveLocalDcs(filtered);

  // Sync with Firestore asynchronously in background
  deleteDcFromFirestore(id).catch((error) => {
    console.warn('Background Firestore delete failed:', error);
  });
};

/**
 * Update a DC with instant local-first persistence
 */
export const updateSavedDc = async (id: string, updates: Partial<SavedDc>): Promise<SavedDc> => {
  const dcs = getLocalSavedDcs();
  let dc = dcs.find((d) => d.id === id);

  if (!dc) {
    const fetched = await fetchDcsFromFirestore().catch(() => []);
    dc = fetched.find((d) => d.id === id);
  }

  if (!dc) {
    throw new Error(`DC not found with id: ${id}`);
  }

  const updatedDc: SavedDc = { ...dc, ...updates };
  const updatedList = dcs.map((d) => (d.id === id ? updatedDc : d));
  if (!dcs.some(d => d.id === id)) {
    updatedList.unshift(updatedDc);
  }
  saveLocalDcs(updatedList);

  // Sync with Firestore asynchronously in background
  updateDcInFirestore(updatedDc).catch((error) => {
    console.warn('Background Firestore update failed:', error);
  });

  return updatedDc;
};

/**
 * Transition a DC to a new status with instant local-first persistence and history tracking
 */
export const transitionSavedDc = async (
  id: string,
  args: {
    toStatus: SavedDcStatus;
    action: SavedDcHistoryEvent["action"];
    updates?: Partial<SavedDc>;
    clear?: Array<keyof SavedDc>;
    meta?: Record<string, unknown>;
  },
): Promise<SavedDc> => {
  let dcs = getLocalSavedDcs();
  let dc = dcs.find((d) => d.id === id);

  if (!dc) {
    const fetched = await fetchDcsFromFirestore().catch(() => []);
    dc = fetched.find((d) => d.id === id);
    if (fetched.length > 0) {
      dcs = fetched;
    }
  }

  if (!dc) {
    throw new Error(`DC not found with id: ${id}`);
  }

  const now = new Date().toISOString();
  const fromStatus = (dc.status ?? "pending") as SavedDcStatus;

  const clearedSnapshot: Record<string, unknown> = {};
  const cleared: Partial<SavedDc> = {};
  for (const key of args.clear ?? []) {
    clearedSnapshot[key as string] = (dc as any)[key];
    (cleared as any)[key] = undefined;
  }

  const nextHistory: SavedDcHistoryEvent[] = [
    ...(dc.history ?? []),
    {
      at: now,
      action: args.action,
      fromStatus,
      toStatus: args.toStatus,
      meta: {
        ...(args.meta ?? {}),
        ...(args.clear?.length ? { cleared: clearedSnapshot } : {}),
      },
    },
  ];

  const updatedDc: SavedDc = {
    ...dc,
    ...cleared,
    ...(args.updates ?? {}),
    status: args.toStatus,
    history: nextHistory,
  };

  const updatedList = dcs.map((d) => (d.id === id ? updatedDc : d));
  if (!dcs.some(d => d.id === id)) {
    updatedList.unshift(updatedDc);
  }
  saveLocalDcs(updatedList);

  // Sync with Firestore asynchronously in background
  updateDcInFirestore(updatedDc).catch((error) => {
    console.warn('Background Firestore transition failed:', error);
  });

  return updatedDc;
};

/**
 * Clear all DCs from Firestore & Local Storage
 */
export const clearSavedDcs = async (): Promise<void> => {
  saveLocalDcs([]);
  try {
    const dcs = await fetchDcsFromFirestore().catch(() => []);
    for (const dc of dcs) {
      await deleteDcFromFirestore(dc.id).catch(() => {});
    }
  } catch (error) {
    console.error('Error clearing DCs from Firestore:', error);
  }
};
