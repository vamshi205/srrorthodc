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
  | "RESTORE_FROM_CANCELLED";
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
  cashAt?: string;
  cashAmount?: number;
  cashRemarks?: string;
  cancelledAt?: string;
  cancelledRemarks?: string;
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
 * Load DCs from Firestore
 */
export const loadSavedDcs = async (): Promise<SavedDc[]> => {
  try {
    const dcs = await fetchDcsFromFirestore();
    return dcs;
  } catch (error) {
    console.error('Error loading DCs from Firestore:', error);
    // Fallback to localStorage if Firestore fails
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as SavedDc[];
    } catch {
      return [];
    }
  }
};

/**
 * Save a new DC to Firestore
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

  try {
    await saveDcToFirestore(saved);
    return saved;
  } catch (error) {
    console.error('Error saving DC to Firestore:', error);
    throw error;
  }
};

/**
 * Delete a DC from Firestore
 */
export const deleteSavedDc = async (id: string): Promise<void> => {
  try {
    await deleteDcFromFirestore(id);
  } catch (error) {
    console.error('Error deleting DC from Firestore:', error);
    throw error;
  }
};

/**
 * Update a DC in Firestore
 */
export const updateSavedDc = async (id: string, updates: Partial<SavedDc>): Promise<SavedDc> => {
  // ...
  try {
    // First, fetch all DCs to get the current DC
    const dcs = await loadSavedDcs();
    const dc = dcs.find((d) => d.id === id);

    if (!dc) {
      throw new Error(`DC not found with id: ${id}`);
    }

    // Merge updates with existing DC
    const updatedDc: SavedDc = { ...dc, ...updates };

    // Update in Firestore
    await updateDcInFirestore(updatedDc);

    return updatedDc;
  } catch (error) {
    console.error('Error updating DC in Firestore:', error);
    throw error;
  }
};

/**
 * Transition a DC to a new status with history tracking
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
  try {
    // Fetch all DCs to get the current DC
    const dcs = await loadSavedDcs();
    const dc = dcs.find((d) => d.id === id);

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

    // Update in Firestore
    await updateDcInFirestore(updatedDc);

    return updatedDc;
  } catch (error) {
    console.error('Error transitioning DC in Firestore:', error);
    throw error;
  }
};

/**
 * Clear all DCs from Firestore (use with caution!)
 */
export const clearSavedDcs = async (): Promise<void> => {
  try {
    // Note: Clearing all documents in a Firestore collection requires iterating and deleting,
    // which can be costly. For a full clear, it's better to use the Firebase Console.
    // For now, we'll keep the logic to delete one by one, but with a warning.
    const dcs = await loadSavedDcs();
    for (const dc of dcs) {
      await deleteDcFromFirestore(dc.id);
    }
  } catch (error) {
    console.error('Error clearing DCs from Firestore:', error);
    throw error;
  }
};

