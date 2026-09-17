import {
  fetchCashCustomersFromFirestore,
  saveCashCustomerToFirestore,
  deleteCashCustomerFromFirestore,
  CashCustomerData,
} from "@/services/cashInvoiceFirebaseService";

export interface Customer {
  id: string;
  name: string; // Hospital / Clinic / Party / Customer name
  mobile?: string; // Contact mobile number
  phone?: string;
  address?: string;
  email?: string;
  contactPerson?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

const STORAGE_KEY = "srrortho:customers";
const CASH_STORAGE_KEY = "im_saved_customers";
const CASH_LEGACY_KEY = "im_customers";
const EVENT_KEY = "srrortho:customers_updated";

const DEFAULT_HOSPITALS: Customer[] = [
  { id: "hosp_1", name: "Apollo Hospital, Jubilee Hills", mobile: "9848011223", address: "Road No 72, Jubilee Hills, Hyderabad", contactPerson: "OT Incharge", createdAt: "2025-01-01T00:00:00.000Z" },
  { id: "hosp_2", name: "Care Hospital, Banjara Hills", mobile: "9848022334", address: "Road No 1, Banjara Hills, Hyderabad", contactPerson: "Store Incharge", createdAt: "2025-01-01T00:00:00.000Z" },
  { id: "hosp_3", name: "Yashoda Hospital, Somajiguda", mobile: "9848033445", address: "Raj Bhavan Road, Somajiguda, Hyderabad", contactPerson: "Pharmacy / OT", createdAt: "2025-01-01T00:00:00.000Z" },
  { id: "hosp_4", name: "KIMS Hospital, Secunderabad", mobile: "9848044556", address: "Minister Road, Secunderabad", contactPerson: "Purchase Team", createdAt: "2025-01-01T00:00:00.000Z" },
  { id: "hosp_5", name: "Sunshine Hospital, Gachibowli", mobile: "9848055667", address: "Gachibowli, Hyderabad", contactPerson: "Ortho Dept", createdAt: "2025-01-01T00:00:00.000Z" },
  { id: "hosp_6", name: "Continental Hospital, Nanakramguda", mobile: "9848066778", address: "Financial District, Nanakramguda, Hyderabad", contactPerson: "Logistics Desk", createdAt: "2025-01-01T00:00:00.000Z" },
];

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `cust_${crypto.randomUUID()}`;
  }
  return `cust_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

export const normalizeHospitalName = (name?: string): string => {
  if (!name) return "";
  return name.trim().replace(/\s+/g, " ");
};

/**
 * Retrieve saved customers from local storage, harmonizing across DC and Cash Invoice keys
 */
export const getSavedCustomers = (): Customer[] => {
  try {
    const rawPrimary = localStorage.getItem(STORAGE_KEY);
    const rawCash = localStorage.getItem(CASH_STORAGE_KEY) || localStorage.getItem(CASH_LEGACY_KEY);

    const map = new Map<string, Customer>();

    // 1. Load defaults
    DEFAULT_HOSPITALS.forEach((h) => {
      map.set(h.name.toLowerCase().trim(), h);
    });

    // 2. Load primary saved
    if (rawPrimary) {
      try {
        const parsed = JSON.parse(rawPrimary);
        if (Array.isArray(parsed)) {
          parsed.forEach((c: Customer) => {
            if (c && c.name) {
              const key = c.name.toLowerCase().trim();
              const existing = map.get(key);
              map.set(key, { ...existing, ...c });
            }
          });
        }
      } catch (e) {
        console.error("Error parsing primary customers:", e);
      }
    }

    // 3. Load from Cash Invoice app keys
    if (rawCash) {
      try {
        const parsedCash = JSON.parse(rawCash);
        if (Array.isArray(parsedCash)) {
          parsedCash.forEach((c: any) => {
            if (c && c.name) {
              const key = c.name.toLowerCase().trim();
              const existing = map.get(key);
              map.set(key, {
                id: c.id || existing?.id || createId(),
                name: c.name.trim(),
                mobile: c.mobile || existing?.mobile || "",
                address: c.address || existing?.address || "",
                email: c.email || existing?.email || "",
                contactPerson: c.contactPerson || existing?.contactPerson || "",
                notes: c.notes || existing?.notes || "",
                createdAt: c.createdAt || existing?.createdAt || new Date().toISOString(),
              });
            }
          });
        }
      } catch (e) {
        console.error("Error parsing cash customers:", e);
      }
    }

    const result = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    return result;
  } catch (error) {
    console.error("Error loading customers:", error);
    return DEFAULT_HOSPITALS;
  }
};

/**
 * Save customers list locally across all storage keys and broadcast update event
 */
export const saveCustomerListLocally = (list: Customer[]): void => {
  try {
    const serialized = JSON.stringify(list);
    localStorage.setItem(STORAGE_KEY, serialized);
    localStorage.setItem(CASH_STORAGE_KEY, serialized);
    localStorage.setItem(CASH_LEGACY_KEY, serialized);
    window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: list }));
  } catch (error) {
    console.error("Error saving customer list locally:", error);
  }
};

/**
 * Fetch unified customers from Firestore and sync with local storage
 */
export const fetchUnifiedCustomers = async (): Promise<Customer[]> => {
  try {
    const firestoreCustomers = await fetchCashCustomersFromFirestore();
    const localCustomers = getSavedCustomers();
    const map = new Map<string, Customer>();

    // Put local first
    localCustomers.forEach((c) => {
      map.set(c.name.toLowerCase().trim(), c);
    });

    // Merge Firestore
    firestoreCustomers.forEach((fc: CashCustomerData) => {
      if (fc && fc.name) {
        const key = fc.name.toLowerCase().trim();
        const existing = map.get(key);
        map.set(key, {
          id: fc.id || existing?.id || createId(),
          name: fc.name.trim(),
          mobile: fc.mobile || existing?.mobile || "",
          address: fc.address || existing?.address || "",
          email: fc.email || existing?.email || "",
          contactPerson: (fc as any).contactPerson || existing?.contactPerson || "",
          notes: (fc as any).notes || existing?.notes || "",
          createdAt: (fc as any).createdAt || existing?.createdAt || new Date().toISOString(),
        });
      }
    });

    const combined = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    saveCustomerListLocally(combined);
    return combined;
  } catch (error) {
    console.error("Error fetching unified customers:", error);
    return getSavedCustomers();
  }
};

/**
 * Save or update a single customer/hospital across LocalStorage and Firestore
 */
export const saveCustomer = async (data: {
  id?: string;
  name: string;
  mobile?: string;
  phone?: string;
  address?: string;
  email?: string;
  contactPerson?: string;
  notes?: string;
}): Promise<Customer> => {
  const cleanName = normalizeHospitalName(data.name);
  if (!cleanName) {
    throw new Error("Hospital / Customer name is required.");
  }

  const currentList = getSavedCustomers();
  const lower = cleanName.toLowerCase();
  const existingIndex = currentList.findIndex(
    (c) => c.name.toLowerCase().trim() === lower || (data.id && c.id === data.id)
  );

  const customerRecord: Customer = {
    id: data.id || (existingIndex >= 0 ? currentList[existingIndex].id : createId()),
    name: cleanName,
    mobile: (data.mobile || data.phone || (existingIndex >= 0 ? currentList[existingIndex].mobile : "") || "").trim(),
    address: (data.address || (existingIndex >= 0 ? currentList[existingIndex].address : "") || "").trim(),
    email: (data.email || (existingIndex >= 0 ? currentList[existingIndex].email : "") || "").trim(),
    contactPerson: (data.contactPerson || (existingIndex >= 0 ? currentList[existingIndex].contactPerson : "") || "").trim(),
    notes: (data.notes || (existingIndex >= 0 ? currentList[existingIndex].notes : "") || "").trim(),
    updatedAt: new Date().toISOString(),
    createdAt: existingIndex >= 0 ? currentList[existingIndex].createdAt : new Date().toISOString(),
  };

  let updatedList: Customer[];
  if (existingIndex >= 0) {
    updatedList = [...currentList];
    updatedList[existingIndex] = customerRecord;
  } else {
    updatedList = [...currentList, customerRecord];
  }

  // 1. Save locally immediately
  saveCustomerListLocally(updatedList);

  // 2. Sync to Firestore in background
  try {
    await saveCashCustomerToFirestore({
      id: customerRecord.id,
      name: customerRecord.name,
      mobile: customerRecord.mobile,
      address: customerRecord.address,
      email: customerRecord.email,
      contactPerson: customerRecord.contactPerson,
      notes: customerRecord.notes,
      updatedAt: customerRecord.updatedAt,
      createdAt: customerRecord.createdAt,
    });
  } catch (err) {
    console.warn("Could not sync customer to Firestore immediately:", err);
  }

  return customerRecord;
};

/**
 * Delete a customer from LocalStorage and Firestore
 */
export const deleteCustomer = async (idOrName: string): Promise<boolean> => {
  const currentList = getSavedCustomers();
  const lower = idOrName.toLowerCase().trim();
  const filtered = currentList.filter(
    (c) => c.id !== idOrName && c.name.toLowerCase().trim() !== lower
  );

  if (filtered.length === currentList.length) return false;

  saveCustomerListLocally(filtered);

  try {
    await deleteCashCustomerFromFirestore(idOrName);
  } catch (err) {
    console.warn("Could not delete customer from Firestore:", err);
  }

  return true;
};

/**
 * Automatically harvest hospital names from DC history into the customer directory
 */
export const syncCustomersFromDcs = (dcs: Array<{ hospitalName?: string }>): Customer[] => {
  const current = getSavedCustomers();
  const nameSet = new Set(current.map((c) => c.name.toLowerCase().trim()));
  const additions: Customer[] = [];

  dcs.forEach((dc) => {
    const raw = dc.hospitalName;
    if (!raw) return;
    const clean = normalizeHospitalName(raw);
    if (!clean || clean === "-" || clean.toLowerCase() === "none") return;

    if (!nameSet.has(clean.toLowerCase())) {
      nameSet.add(clean.toLowerCase());
      additions.push({
        id: createId(),
        name: clean,
        mobile: "",
        address: "",
        notes: "Auto-discovered from DC history",
        createdAt: new Date().toISOString(),
      });
    }
  });

  if (additions.length > 0) {
    const combined = [...current, ...additions];
    saveCustomerListLocally(combined);
    return combined;
  }

  return current;
};

/**
 * Get unified list of all hospital/customer names for autocomplete
 */
export const getAllHospitalNames = (savedDcs?: Array<{ hospitalName?: string }>): string[] => {
  const customers = getSavedCustomers();
  const nameSet = new Set<string>();

  customers.forEach((c) => {
    if (c.name) nameSet.add(c.name.trim());
  });

  if (savedDcs && savedDcs.length > 0) {
    savedDcs.forEach((dc) => {
      const clean = normalizeHospitalName(dc.hospitalName);
      if (clean && clean !== "-") {
        nameSet.add(clean);
      }
    });
  }

  return Array.from(nameSet).sort((a, b) => a.localeCompare(b));
};
