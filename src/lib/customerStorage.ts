import {
  fetchCashCustomersFromFirestore,
  saveCashCustomerToFirestore,
  deleteCashCustomerFromFirestore,
  fetchCashInvoicesFromFirestore,
  saveCashInvoiceToFirestore,
  CashCustomerData,
  CashInvoiceData,
} from "@/services/cashInvoiceFirebaseService";
import { loadSavedDcs, SavedDc } from "@/lib/savedDcStorage";
import { updateDcInFirestore } from "@/services/firestoreService";

export interface HospitalContact {
  id: string;
  name: string;        // e.g. "Sister Sujatha (OT)", "Dr. Reddy (Surgeon)", "Store Desk"
  role: string;        // e.g. "OT Number", "Hospital Number", "Personal Number", "Pharmacy/Store", "Doctor", "Purchase", "Accounts"
  phone: string;       // Phone / Mobile number
  email?: string;
  isPrimary?: boolean;
}

export interface Customer {
  id: string;
  name: string; // Hospital / Clinic / Party / Customer name
  mobile?: string; // Contact mobile number
  phone?: string;
  address?: string;
  email?: string;
  contactPerson?: string;
  otNumber?: string;       // Operation Theatre desk / Incharge direct line
  hospitalNumber?: string; // Main Hospital Reception / Board number
  personalNumber?: string; // Doctor / Incharge personal mobile
  contacts?: HospitalContact[]; // Dynamic list of multiple names & numbers
  gstNumber?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

const STORAGE_KEY = "srrortho:customers";
const CASH_STORAGE_KEY = "im_saved_customers";
const CASH_LEGACY_KEY = "im_customers";
const EVENT_KEY = "srrortho:customers_updated";
const DELETED_CUSTOMERS_KEY = "srrortho:deleted_customers";

export const getDeletedCustomers = (): string[] => {
  try {
    const raw = localStorage.getItem(DELETED_CUSTOMERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const addDeletedCustomer = (name: string): void => {
  if (!name) return;
  const current = getDeletedCustomers();
  const lower = name.toLowerCase().trim();
  if (!current.includes(lower)) {
    const updated = [...current, lower];
    localStorage.setItem(DELETED_CUSTOMERS_KEY, JSON.stringify(updated));
  }
};

export const removeDeletedCustomer = (name: string): void => {
  if (!name) return;
  const current = getDeletedCustomers();
  const lower = name.toLowerCase().trim();
  const filtered = current.filter((item) => item !== lower);
  localStorage.setItem(DELETED_CUSTOMERS_KEY, JSON.stringify(filtered));
};

export const harmonizeCustomerRecord = (cust: Partial<Customer>): Customer => {
  const name = normalizeHospitalName(cust.name || "");
  const id = cust.id || createId();
  
  // Clean up contacts array
  let rawContacts: HospitalContact[] = Array.isArray(cust.contacts)
    ? cust.contacts.filter((c) => c && (c.name?.trim() || c.phone?.trim()))
    : [];

  // Extract from contacts only if primary fields are completely undefined
  const otContact = rawContacts.find((c) => c.phone?.trim() && (/ot|theatre|sister|nurse/i.test(c.role) || /ot|sister/i.test(c.name)));
  const hospContact = rawContacts.find((c) => c.phone?.trim() && (/hosp|board|recept|landline/i.test(c.role) || /hosp|board|recept/i.test(c.name)));
  const persContact = rawContacts.find((c) => c.phone?.trim() && (/person|doc|dr|surg|mobile/i.test(c.role) || /doc|dr|surgeon/i.test(c.name)));

  const otNumber = (cust.otNumber !== undefined ? cust.otNumber : (otContact?.phone || "")).trim();
  const hospitalNumber = (cust.hospitalNumber !== undefined ? cust.hospitalNumber : (hospContact?.phone || "")).trim();
  const personalNumber = (cust.personalNumber !== undefined ? cust.personalNumber : (persContact?.phone || "")).trim();
  const contactPerson = (cust.contactPerson !== undefined ? cust.contactPerson : (persContact?.name || otContact?.name || "")).trim();
  const mobile = (cust.mobile !== undefined ? cust.mobile : (personalNumber || otNumber || hospitalNumber || rawContacts.find(c => c.phone?.trim())?.phone || "")).trim();
  const phone = (cust.phone !== undefined ? cust.phone : (cust.mobile !== undefined ? cust.mobile : (mobile || personalNumber))).trim();

  // Ensure primary numbers are represented in contacts list
  const contacts: HospitalContact[] = [...rawContacts];

  if (otNumber && !contacts.some((c) => (c.phone && c.phone.trim() === otNumber) || /ot/i.test(c.role))) {
    contacts.unshift({
      id: "c_ot",
      role: "OT Person",
      name: "OT Desk / Incharge",
      phone: otNumber,
    });
  }
  if (hospitalNumber && !contacts.some((c) => (c.phone && c.phone.trim() === hospitalNumber) || /recept|hosp/i.test(c.role))) {
    contacts.push({
      id: "c_hosp",
      role: "Reception",
      name: "Reception / Board",
      phone: hospitalNumber,
    });
  }
  if (personalNumber && !contacts.some((c) => (c.phone && c.phone.trim() === personalNumber) || /doc|person/i.test(c.role))) {
    contacts.push({
      id: "c_pers",
      role: "Doctor",
      name: contactPerson || "Doctor / Consultant",
      phone: personalNumber,
      isPrimary: true,
    });
  }

  return {
    id,
    name,
    mobile: mobile || personalNumber || otNumber || hospitalNumber,
    phone,
    address: (cust.address || "").trim(),
    email: (cust.email || "").trim(),
    contactPerson,
    otNumber,
    hospitalNumber,
    personalNumber,
    contacts,
    gstNumber: (cust.gstNumber || "").trim(),
    notes: (cust.notes || "").trim(),
    createdAt: cust.createdAt || new Date().toISOString(),
    updatedAt: cust.updatedAt || new Date().toISOString(),
  };
};

export const normalizeCustomerContacts = (customer: Partial<Customer>): HospitalContact[] => {
  return harmonizeCustomerRecord(customer).contacts || [];
};

const DEFAULT_HOSPITALS: Customer[] = [];

const DEMO_HOSPITAL_IDS = new Set([
  "hosp_1",
  "hosp_2",
  "hosp_3",
  "hosp_4",
  "hosp_5",
  "hosp_6",
]);

export const isDemoHospital = (c: Partial<Customer>): boolean => {
  if (c.id && DEMO_HOSPITAL_IDS.has(c.id)) return true;
  const nameLower = (c.name || "").toLowerCase().trim();
  const contactLower = (c.contactPerson || "").toLowerCase().trim();
  const otNum = (c.otNumber || "").trim();

  // Strict check for the 6 hardcoded mock records
  if (nameLower === "apollo hospital, jubilee hills" && (c.id === "hosp_1" || otNum === "040-23607777" || contactLower.includes("sujatha"))) {
    return true;
  }
  if (nameLower === "care hospital, banjara hills" && (c.id === "hosp_2" || otNum === "040-30418888" || contactLower.includes("store incharge"))) {
    return true;
  }
  if (nameLower === "continental hospital, nanakramguda" && (c.id === "hosp_6" || otNum === "040-67000000" || contactLower.includes("logistics desk"))) {
    return true;
  }
  if (nameLower === "kims hospital, secunderabad" && (c.id === "hosp_4" || otNum === "040-44885000" || contactLower.includes("purchase team"))) {
    return true;
  }
  if (nameLower === "sunshine hospital, gachibowli" && (c.id === "hosp_5" || otNum === "040-44550000" || contactLower.includes("ortho dept"))) {
    return true;
  }
  if (nameLower === "yashoda hospital, somajiguda" && (c.id === "hosp_3" || otNum === "040-45674567" || contactLower.includes("pharmacy / ot"))) {
    return true;
  }
  return false;
};

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

    const deletedSet = new Set(getDeletedCustomers().map((n) => n.toLowerCase().trim()));
    const map = new Map<string, Customer>();
    let hadDemoData = false;

    // 1. Load primary saved (skipping any mock demo or deleted hospitals)
    if (rawPrimary) {
      try {
        const parsed = JSON.parse(rawPrimary);
        if (Array.isArray(parsed)) {
          parsed.forEach((c: Customer) => {
            if (c && c.name) {
              const nameLower = c.name.toLowerCase().trim();
              if (isDemoHospital(c) || deletedSet.has(nameLower)) {
                hadDemoData = true;
                return;
              }
              map.set(nameLower, harmonizeCustomerRecord(c));
            }
          });
        }
      } catch (e) {
        console.error("Error parsing primary customers:", e);
      }
    }

    // 2. Load from Cash Invoice app keys (NEVER clobber existing populated fields with empty values)
    if (rawCash) {
      try {
        const parsedCash = JSON.parse(rawCash);
        if (Array.isArray(parsedCash)) {
          parsedCash.forEach((c: any) => {
            if (c && c.name) {
              const nameLower = c.name.toLowerCase().trim();
              if (isDemoHospital(c) || deletedSet.has(nameLower)) {
                hadDemoData = true;
                return;
              }
              if (!map.has(nameLower)) {
                map.set(nameLower, harmonizeCustomerRecord(c));
              }
            }
          });
        }
      } catch (e) {
        console.error("Error parsing cash customers:", e);
      }
    }

    const result = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));

    // If mock demo records were cleansed from local storage, write clean state immediately
    if (hadDemoData) {
      saveCustomerListLocally(result);
    }

    return result;
  } catch (error) {
    console.error("Error loading customers:", error);
    return [];
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

    const deletedSet = new Set(getDeletedCustomers().map((n) => n.toLowerCase().trim()));

    // Merge Firestore (skipping and deleting any mock demo or deleted hospitals)
    firestoreCustomers.forEach((fc: CashCustomerData) => {
      if (fc && fc.name) {
        const key = fc.name.toLowerCase().trim();
        if (isDemoHospital(fc as any) || deletedSet.has(key)) {
          // Permanently purge from Firestore
          deleteCashCustomerFromFirestore(fc.id, fc.name).catch(() => {});
          return;
        }
        const existing = map.get(key);
        if (!existing) {
          map.set(key, harmonizeCustomerRecord(fc as any));
        } else {
          // Compare timestamps: if local has been updated more recently or equal, local wins!
          const localTime = new Date(existing.updatedAt || 0).getTime();
          const remoteTime = new Date((fc as any).updatedAt || 0).getTime();
          if (localTime >= remoteTime) {
            // Local is newer: ensure Firestore is also synced with the new local state!
            saveCashCustomerToFirestore(existing as CashCustomerData).catch(() => {});
            return;
          }

          // If remote is strictly newer, accept remote record
          map.set(key, harmonizeCustomerRecord(fc as any));
        }
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
export const saveCustomer = async (data: Partial<Customer> & { name: string }): Promise<Customer> => {
  const cleanName = normalizeHospitalName(data.name);
  if (!cleanName) {
    throw new Error("Hospital / Customer name is required.");
  }

  // Remove from deleted blacklist if user deliberately saves/re-adds
  removeDeletedCustomer(cleanName);

  const currentList = getSavedCustomers();
  const lower = cleanName.toLowerCase();
  const existingIndex = currentList.findIndex(
    (c) => c.name.toLowerCase().trim() === lower || (Boolean(data.id) && c.id === data.id)
  );
  const existing = existingIndex >= 0 ? currentList[existingIndex] : null;

  // Prefer explicitly provided data fields (even if empty string ""), then fallback to existing
  const otNumber = (data.otNumber !== undefined ? data.otNumber : (existing?.otNumber || "")).trim();
  const hospitalNumber = (data.hospitalNumber !== undefined ? data.hospitalNumber : (existing?.hospitalNumber || "")).trim();
  const personalNumber = (data.personalNumber !== undefined ? data.personalNumber : (existing?.personalNumber || "")).trim();
  const contactPerson = (data.contactPerson !== undefined ? data.contactPerson : (existing?.contactPerson || "")).trim();
  const mobile = (data.mobile !== undefined ? data.mobile : (personalNumber || otNumber || hospitalNumber || existing?.mobile || "")).trim();
  const phone = (data.phone !== undefined ? data.phone : (data.mobile !== undefined ? data.mobile : (mobile || existing?.phone || ""))).trim();
  const address = (data.address !== undefined ? data.address : (existing?.address || "")).trim();
  const email = (data.email !== undefined ? data.email : (existing?.email || "")).trim();
  const gstNumber = (data.gstNumber !== undefined ? data.gstNumber : (existing?.gstNumber || "")).trim();
  const notes = (data.notes !== undefined ? data.notes : (existing?.notes || "")).trim();

  let contacts = Array.isArray(data.contacts) ? data.contacts : (existing?.contacts || []);

  const customerRecord = harmonizeCustomerRecord({
    id: data.id || existing?.id || createId(),
    name: cleanName,
    mobile: mobile || personalNumber || otNumber || hospitalNumber,
    phone,
    address,
    email,
    contactPerson,
    otNumber,
    hospitalNumber,
    personalNumber,
    contacts,
    gstNumber,
    notes,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

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
    await saveCashCustomerToFirestore(customerRecord as CashCustomerData);
  } catch (err) {
    console.warn("Could not sync customer to Firestore immediately:", err);
  }

  return customerRecord;
};

/**
 * Delete a customer from LocalStorage and Firestore permanently
 * Adds customer name to persistent deleted blacklist to prevent re-harvesting from old DCs.
 */
export const deleteCustomer = async (idOrName: string, optionalName?: string): Promise<boolean> => {
  const currentList = getSavedCustomers();
  const lower = idOrName.toLowerCase().trim();
  const lowerOpt = (optionalName || "").toLowerCase().trim();

  const target = currentList.find(
    (c) =>
      c.id === idOrName ||
      c.name.toLowerCase().trim() === lower ||
      (lowerOpt && c.name.toLowerCase().trim() === lowerOpt)
  );

  const nameToBlacklist = target?.name || optionalName || (!idOrName.startsWith("cust_") ? idOrName : "");
  if (nameToBlacklist) {
    addDeletedCustomer(nameToBlacklist);
  }

  const filtered = currentList.filter(
    (c) =>
      c.id !== idOrName &&
      c.name.toLowerCase().trim() !== lower &&
      (!lowerOpt || c.name.toLowerCase().trim() !== lowerOpt) &&
      (!target || c.id !== target.id)
  );

  saveCustomerListLocally(filtered);

  try {
    await deleteCashCustomerFromFirestore(idOrName, target?.name || optionalName);
  } catch (err) {
    console.warn("Could not delete customer from Firestore:", err);
  }

  return true;
};

export interface CustomerRecordsSummary {
  dcCount: number;
  invoiceCount: number;
  totalOutstanding: number;
  dcs: SavedDc[];
  invoices: CashInvoiceData[];
}

/**
 * Check if there are active Delivery Challans or Cash Invoices associated with a hospital
 */
export const getCustomerRecordsSummary = async (hospitalName: string): Promise<CustomerRecordsSummary> => {
  const nameLower = hospitalName.toLowerCase().trim();
  let dcs: SavedDc[] = [];
  try {
    const allDcs = await loadSavedDcs();
    dcs = allDcs.filter(
      (dc) => dc.hospitalName && dc.hospitalName.toLowerCase().trim() === nameLower
    );
  } catch (e) {
    console.warn("Error fetching DCs for customer summary:", e);
  }

  let invoices: CashInvoiceData[] = [];
  let totalOutstanding = 0;
  try {
    const allInvoices = await fetchCashInvoicesFromFirestore();
    invoices = allInvoices.filter(
      (inv) => inv.clientName && inv.clientName.toLowerCase().trim() === nameLower
    );
    // Fallback to local storage invoices if firestore query empty
    const rawLocal = localStorage.getItem("im_saved_invoices");
    if (rawLocal && invoices.length === 0) {
      try {
        const parsed = JSON.parse(rawLocal);
        if (Array.isArray(parsed)) {
          invoices = parsed.filter(
            (inv: any) => inv.clientName && inv.clientName.toLowerCase().trim() === nameLower
          );
        }
      } catch {}
    }

    invoices.forEach((inv) => {
      const balance = (Number(inv.grandTotal) || 0) - (Number(inv.paymentReceived) || 0);
      if (balance > 0) totalOutstanding += balance;
    });
  } catch (e) {
    console.warn("Error fetching invoices for customer summary:", e);
  }

  return {
    dcCount: dcs.length,
    invoiceCount: invoices.length,
    totalOutstanding,
    dcs,
    invoices,
  };
};

/**
 * Automatically harvest hospital names from DC history into the customer directory
 * Skips any hospitals that the user has previously deleted.
 */
export const syncCustomersFromDcs = (dcs: Array<{ hospitalName?: string }>): Customer[] => {
  const current = getSavedCustomers();
  const deletedSet = new Set(getDeletedCustomers().map((n) => n.toLowerCase().trim()));
  const nameSet = new Set(current.map((c) => c.name.toLowerCase().trim()));
  const additions: Customer[] = [];

  dcs.forEach((dc) => {
    const raw = dc.hospitalName;
    if (!raw) return;
    const clean = normalizeHospitalName(raw);
    if (!clean || clean === "-" || clean.toLowerCase() === "none") return;

    const lowerClean = clean.toLowerCase();
    // Do NOT re-harvest if previously deleted by user or if it's mock demo hospital!
    if (deletedSet.has(lowerClean) || isDemoHospital({ name: clean })) return;

    if (!nameSet.has(lowerClean)) {
      nameSet.add(lowerClean);
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

export interface MergeCustomersResult {
  success: boolean;
  targetCustomer: Customer;
  sourceCustomer: Customer;
  mergedContactsCount: number;
  updatedDcsCount: number;
  updatedInvoicesCount: number;
}

/**
 * Merge a duplicate / source customer into a primary / target customer.
 * - Combines all phone numbers & staff contacts from source into target.
 * - Fills any missing address, email, notes, or department numbers in target.
 * - Updates historical Delivery Challans referencing the source name.
 * - Updates historical Cash Invoices referencing the source name.
 * - Deletes the duplicate source customer so only one clean profile remains.
 */
export const mergeCustomers = async (
  targetId: string,
  sourceId: string,
  options?: {
    customTargetName?: string;
    combineNotes?: boolean;
    updateDcs?: boolean;
    updateInvoices?: boolean;
  }
): Promise<MergeCustomersResult> => {
  const currentList = getSavedCustomers();
  const target = currentList.find(
    (c) => c.id === targetId || c.name.toLowerCase().trim() === targetId.toLowerCase().trim()
  );
  const source = currentList.find(
    (c) => c.id === sourceId || c.name.toLowerCase().trim() === sourceId.toLowerCase().trim()
  );

  if (!target || !source) {
    throw new Error("Both target and source customers must exist.");
  }
  if (target.id === source.id || target.name.toLowerCase().trim() === source.name.toLowerCase().trim()) {
    throw new Error("Cannot merge a customer into itself.");
  }

  // 1. Combine contacts from source into target without duplicating numbers
  const targetContacts = Array.isArray(target.contacts) ? [...target.contacts] : [];
  const sourceContacts = normalizeCustomerContacts(source);
  let mergedContactsCount = 0;

  sourceContacts.forEach((sc) => {
    const cleanPhone = (sc.phone || "").replace(/[^0-9]/g, "");
    const cleanName = (sc.name || "").trim().toLowerCase();

    const alreadyExists = targetContacts.some((tc) => {
      const tcPhone = (tc.phone || "").replace(/[^0-9]/g, "");
      const tcName = (tc.name || "").trim().toLowerCase();
      if (cleanPhone && tcPhone && cleanPhone === tcPhone) return true;
      if (cleanName && tcName && cleanName === tcName) return true;
      return false;
    });

    if (!alreadyExists) {
      targetContacts.push({
        ...sc,
        id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        isPrimary: false,
      });
      mergedContactsCount++;
    }
  });

  // Combine notes
  let combinedNotes = target.notes || "";
  if (options?.combineNotes !== false && source.notes?.trim()) {
    if (combinedNotes.trim()) {
      combinedNotes = `${combinedNotes}\n[Merged from ${source.name}]: ${source.notes.trim()}`;
    } else {
      combinedNotes = source.notes.trim();
    }
  }

  const targetName = options?.customTargetName?.trim() || target.name;
  const mergedTargetData: Partial<Customer> & { name: string } = {
    ...target,
    id: target.id,
    name: targetName,
    address: target.address?.trim() || source.address?.trim() || "",
    email: target.email?.trim() || source.email?.trim() || "",
    gstNumber: target.gstNumber?.trim() || source.gstNumber?.trim() || "",
    notes: combinedNotes,
    otNumber: target.otNumber?.trim() || source.otNumber?.trim() || "",
    hospitalNumber: target.hospitalNumber?.trim() || source.hospitalNumber?.trim() || "",
    personalNumber: target.personalNumber?.trim() || source.personalNumber?.trim() || "",
    mobile: target.mobile?.trim() || source.mobile?.trim() || "",
    contactPerson: target.contactPerson?.trim() || source.contactPerson?.trim() || "",
    contacts: targetContacts,
    updatedAt: new Date().toISOString(),
  };

  // 2. Update Delivery Challans that reference source name
  let updatedDcsCount = 0;
  if (options?.updateDcs !== false) {
    try {
      const dcs = await loadSavedDcs();
      const sourceNameLower = source.name.toLowerCase().trim();
      let dcsChanged = false;
      const updatedDcsList = await Promise.all(
        dcs.map(async (dc) => {
          if (dc.hospitalName && dc.hospitalName.toLowerCase().trim() === sourceNameLower) {
            const updatedDc: SavedDc = { ...dc, hospitalName: targetName };
            try {
              await updateDcInFirestore(updatedDc);
            } catch (err) {
              console.warn("Error updating DC in Firestore:", err);
            }
            updatedDcsCount++;
            dcsChanged = true;
            return updatedDc;
          }
          return dc;
        })
      );
      if (dcsChanged) {
        localStorage.setItem("srrortho:saved-dcs", JSON.stringify(updatedDcsList));
        window.dispatchEvent(new CustomEvent("srrortho:saved_dcs_updated", { detail: updatedDcsList }));
      }
    } catch (e) {
      console.warn("Error updating DCs during customer merge:", e);
    }
  }

  // 3. Update Cash Invoices that reference source name
  let updatedInvoicesCount = 0;
  if (options?.updateInvoices !== false) {
    try {
      const invoices = await fetchCashInvoicesFromFirestore();
      const sourceNameLower = source.name.toLowerCase().trim();
      for (const inv of invoices) {
        if (inv.clientName && inv.clientName.toLowerCase().trim() === sourceNameLower) {
          const updatedInv: CashInvoiceData = { ...inv, clientName: targetName };
          try {
            await saveCashInvoiceToFirestore(updatedInv);
          } catch (err) {
            console.warn("Error updating cash invoice in Firestore:", err);
          }
          updatedInvoicesCount++;
        }
      }
      // Also update local storage cash invoices
      ["im_saved_invoices", "im_invoices"].forEach((key) => {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              let localUpdated = false;
              const mapped = parsed.map((inv: any) => {
                if (inv.clientName && inv.clientName.toLowerCase().trim() === sourceNameLower) {
                  localUpdated = true;
                  return { ...inv, clientName: targetName };
                }
                return inv;
              });
              if (localUpdated) {
                localStorage.setItem(key, JSON.stringify(mapped));
              }
            }
          }
        } catch {
          // ignore local storage json errors
        }
      });
      if (updatedInvoicesCount > 0) {
        window.dispatchEvent(new CustomEvent("srrortho:cash_invoices_updated"));
      }
    } catch (e) {
      console.warn("Error updating invoices during customer merge:", e);
    }
  }

  // 4. Save merged target customer
  const finalSavedTarget = await saveCustomer(mergedTargetData);

  // 5. Delete source customer
  await deleteCustomer(source.id);

  return {
    success: true,
    targetCustomer: finalSavedTarget,
    sourceCustomer: source,
    mergedContactsCount,
    updatedDcsCount,
    updatedInvoicesCount,
  };
};
