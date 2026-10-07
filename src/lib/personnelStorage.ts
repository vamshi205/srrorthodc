import { SavedDc, updateSavedDc } from "./savedDcStorage";

export type PersonnelRole = 'Delivery Executive' | 'Field Staff' | 'Coordinator' | 'Driver' | 'Other';

export type Personnel = {
  id: string;
  name: string;
  phone?: string;
  role: PersonnelRole;
  active: boolean;
  createdAt: string;
  notes?: string;
};

const STORAGE_KEY = 'srrortho:personnel_directory';
const EVENT_KEY = 'srrortho:personnel_updated';

// Known aliases to prevent and automatically merge common spelling variations
export const KNOWN_NAME_ALIASES: Record<string, string> = {
  'prasanth': 'Prashanth',
  'prashanth': 'Prashanth',
  'prashant': 'Prashanth',
  'prashanth k': 'Prashanth',
  'prasanth k': 'Prashanth',
};

export const DISALLOWED_PERSONNEL_NAMES = new Set([
  'hospital purchased',
  'hospital purchase',
  'hospital staff',
  'hospital',
  'patient',
  'patient purchase',
  'purchased by hospital',
  'purchased',
  'purchase',
  'none',
  'nil',
  'na',
  'n/a',
  'test',
  'direct',
  'self',
  'counter',
  'other',
  'unknown',
  'no return',
  'received',
  'vendor',
  '-',
  '--',
]);

export const LOGISTICS_TRANSPORT_NAMES = [
  'courier',
  'rapido',
  'porter',
  'uber',
  'ola',
  'dunzo',
  'swiggy genie',
  'vendor',
  'supplier',
  'vendor person',
];

export const isTransportLogisticsName = (rawName?: string): boolean => {
  if (!rawName) return false;
  const lower = rawName.trim().toLowerCase();
  return LOGISTICS_TRANSPORT_NAMES.some(
    name => lower === name || lower.startsWith(`${name} `) || lower.startsWith(`${name}-`) || lower.startsWith(`${name}/`)
  );
};

const IGNORED_STORAGE_KEY = 'srrortho:ignored_personnel';

export const getIgnoredPersonnel = (): Set<string> => {
  try {
    const raw = localStorage.getItem(IGNORED_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map((s: string) => String(s).toLowerCase().trim()) : []);
  } catch {
    return new Set();
  }
};

export const addIgnoredPersonnel = (name: string): void => {
  try {
    const set = getIgnoredPersonnel();
    const lower = name.trim().toLowerCase();
    if (!lower) return;
    set.add(lower);
    localStorage.setItem(IGNORED_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.error('Error saving ignored personnel:', e);
  }
};

export const isDisallowedPersonnel = (rawName?: string): boolean => {
  if (!rawName) return true;
  const lower = rawName.trim().toLowerCase();
  if (DISALLOWED_PERSONNEL_NAMES.has(lower)) return true;
  if (lower.startsWith('hospital purch') || lower.startsWith('purchased by')) return true;
  return false;
};

export const toTitleCase = (str: string): string => {
  if (!str) return "";
  const trimmed = str.trim().replace(/\s+/g, " ");
  const lower = trimmed.toLowerCase();
  if (KNOWN_NAME_ALIASES[lower]) {
    return KNOWN_NAME_ALIASES[lower];
  }
  return trimmed
    .split(" ")
    .map((word) => {
      if (!word) return "";
      if (word.toUpperCase() === "DC" || word.toUpperCase() === "N/A") {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
};

/**
 * Normalizes a personnel name:
 * - Trims and collapses multiple whitespace
 * - Checks known alias variations (e.g., Prasanth -> Prashanth)
 * - Formats in Title Case (e.g., naresh -> Naresh)
 * - Rejects disallowed or ignored non-personnel terms
 */
export const normalizePersonnelName = (rawName?: string): string => {
  if (!rawName) return '';
  const trimmed = rawName.trim().replace(/\s+/g, ' ');
  if (!trimmed || isDisallowedPersonnel(trimmed)) return '';
  const lower = trimmed.toLowerCase();
  if (getIgnoredPersonnel().has(lower)) return '';
  if (KNOWN_NAME_ALIASES[lower]) {
    return KNOWN_NAME_ALIASES[lower];
  }
  return toTitleCase(trimmed);
};

const DEFAULT_PERSONNEL: Personnel[] = [];

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `pers_${crypto.randomUUID()}`;
  }
  return `pers_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

/**
 * Deduplicate an array of personnel, consolidating names that map to the same normalized name
 */
export const deduplicatePersonnelList = (list: Personnel[]): { deduped: Personnel[]; hasDuplicates: boolean } => {
  const map = new Map<string, Personnel>();
  let hasDuplicates = false;

  for (const item of list) {
    const canonicalName = normalizePersonnelName(item.name);
    if (!canonicalName) continue;
    const key = canonicalName.toLowerCase();

    if (!map.has(key)) {
      map.set(key, {
        ...item,
        name: canonicalName,
      });
    } else {
      hasDuplicates = true;
      const existing = map.get(key)!;
      // Merge properties: retain any non-empty phone, notes, or active status
      map.set(key, {
        ...existing,
        name: canonicalName,
        phone: existing.phone || item.phone || '',
        notes: existing.notes || item.notes || '',
        active: existing.active || item.active,
      });
    }
  }

  return {
    deduped: Array.from(map.values()),
    hasDuplicates,
  };
};

/**
 * Retrieve all registered personnel from localStorage with automatic de-duplication and scrubbing
 */
export const getSavedPersonnel = (): Personnel[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const ignored = getIgnoredPersonnel();
      const filtered = parsed.filter(p => p?.name && !isDisallowedPersonnel(p?.name) && !ignored.has(String(p?.name || '').toLowerCase().trim()));
      const { deduped, hasDuplicates } = deduplicatePersonnelList(filtered);
      if (hasDuplicates || filtered.length !== parsed.length) {
        // Automatically save the cleaned deduped version
        localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
      }
      return deduped;
    }
    return [];
  } catch (error) {
    console.error('Error loading personnel:', error);
    return [];
  }
};

/**
 * Save personnel array to localStorage and notify listeners
 */
export const savePersonnelList = (list: Personnel[]): void => {
  try {
    const ignored = getIgnoredPersonnel();
    const cleanList = list.filter(p => !ignored.has(p.name.trim().toLowerCase()));
    const { deduped } = deduplicatePersonnelList(cleanList);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
    window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: deduped }));
  } catch (error) {
    console.error('Error saving personnel list:', error);
  }
};

/**
 * Add a new person to the directory
 */
export const addPersonnel = (
  name: string,
  details?: Partial<Omit<Personnel, 'id' | 'name' | 'createdAt'>>
): Personnel => {
  const list = getSavedPersonnel();
  const canonical = normalizePersonnelName(name);
  if (!canonical) {
    throw new Error("Invalid personnel name");
  }
  
  // Check if exists case-insensitively or alias
  const existing = list.find(p => normalizePersonnelName(p.name).toLowerCase() === canonical.toLowerCase());
  if (existing) {
    if (!existing.active) {
      existing.active = true;
      savePersonnelList(list);
    }
    return existing;
  }

  const newPerson: Personnel = {
    id: createId(),
    name: canonical,
    phone: details?.phone || '',
    role: details?.role || 'Delivery Executive',
    active: details?.active !== undefined ? details?.active : true,
    createdAt: new Date().toISOString(),
    notes: details?.notes || '',
  };

  const updated = [...list, newPerson];
  savePersonnelList(updated);
  return newPerson;
};

/**
 * Update an existing person
 */
export const updatePersonnel = (id: string, updates: Partial<Personnel>): boolean => {
  const list = getSavedPersonnel();
  const index = list.findIndex(p => p.id === id);
  if (index === -1) return false;

  const newName = updates.name ? normalizePersonnelName(updates.name) : list[index].name;

  list[index] = {
    ...list[index],
    ...updates,
    name: newName,
  };

  savePersonnelList(list);
  return true;
};

/**
 * Delete a person and prevent resurrection from DC history
 */
export const deletePersonnel = (idOrName: string): boolean => {
  const list = getSavedPersonnel();
  const target = list.find(p => p.id === idOrName || p.name.toLowerCase() === idOrName.toLowerCase());
  const filtered = list.filter(p => p.id !== idOrName && p.name.toLowerCase() !== idOrName.toLowerCase());
  
  if (target) {
    addIgnoredPersonnel(target.name);
  } else {
    addIgnoredPersonnel(idOrName);
  }

  savePersonnelList(filtered);
  return true;
};

/**
 * Merge duplicate personnel names into a single canonical target name
 * 1. Consolidates roster entries in localStorage
 * 2. Updates all DCs where deliveredBy or returnedBy matches any of sourceNames
 */
export const mergePersonnel = async (
  sourceNames: string[],
  targetName: string,
  allDcs?: SavedDc[]
): Promise<{ mergedDcsCount: number; targetPersonnel: Personnel }> => {
  const canonicalTarget = normalizePersonnelName(targetName) || targetName.trim();
  const lowerSources = new Set(
    sourceNames.map(s => s.trim().toLowerCase()).filter(s => s && s !== canonicalTarget.toLowerCase())
  );

  // 1. Merge in Personnel Directory
  const list = getSavedPersonnel();
  let targetEntry = list.find(p => p.name.toLowerCase() === canonicalTarget.toLowerCase());
  
  if (!targetEntry) {
    targetEntry = {
      id: createId(),
      name: canonicalTarget,
      phone: '',
      role: 'Delivery Executive',
      active: true,
      createdAt: new Date().toISOString(),
      notes: 'Merged Canonical Person',
    };
  }

  // Find info from sources to enrich target
  const remainingList: Personnel[] = [];
  for (const item of list) {
    const itemLower = item.name.trim().toLowerCase();
    if (lowerSources.has(itemLower)) {
      if (!targetEntry.phone && item.phone) targetEntry.phone = item.phone;
      if (!targetEntry.notes && item.notes) targetEntry.notes = item.notes;
      // Drop duplicate item
    } else if (itemLower !== canonicalTarget.toLowerCase()) {
      remainingList.push(item);
    }
  }

  remainingList.push(targetEntry);
  savePersonnelList(remainingList);

  // 2. Update DCs if provided
  let mergedDcsCount = 0;
  if (allDcs && allDcs.length > 0) {
    for (const dc of allDcs) {
      let needsUpdate = false;
      const updates: Partial<SavedDc> = {};

      if (dc.deliveredBy && lowerSources.has(dc.deliveredBy.trim().toLowerCase())) {
        updates.deliveredBy = canonicalTarget;
        needsUpdate = true;
      }

      if (dc.returnedBy && lowerSources.has(dc.returnedBy.trim().toLowerCase())) {
        updates.returnedBy = canonicalTarget;
        needsUpdate = true;
      }

      if (needsUpdate) {
        try {
          await updateSavedDc(dc.id, updates);
          mergedDcsCount++;
        } catch (e) {
          console.error(`Error updating DC #${dc.dcNo} during merge:`, e);
        }
      }
    }
  }

  return {
    mergedDcsCount,
    targetPersonnel: targetEntry,
  };
};

/**
 * Automatically extract any distinct names from saved DCs that might not yet be in the directory
 */
export const syncPersonnelFromDcs = (dcs: Array<{ deliveredBy?: string; returnedBy?: string }>): Personnel[] => {
  const current = getSavedPersonnel();
  const ignored = getIgnoredPersonnel();
  const nameSet = new Set(current.map(p => normalizePersonnelName(p.name).toLowerCase()));
  const additions: Personnel[] = [];

  dcs.forEach(dc => {
    [dc.deliveredBy, dc.returnedBy].forEach(rawName => {
      if (isDisallowedPersonnel(rawName)) return;
      const clean = normalizePersonnelName(rawName);
      if (!clean) return;
      const cleanLower = clean.toLowerCase();
      if (ignored.has(cleanLower)) return; // Do not resurrect explicitly deleted/ignored personnel
      if (cleanLower === 'courier' || isTransportLogisticsName(clean)) return; // Do not register transport/courier modes as staff
      if (!nameSet.has(cleanLower)) {
        nameSet.add(cleanLower);
        additions.push({
          id: createId(),
          name: clean,
          phone: '',
          role: 'Delivery Executive',
          active: true,
          createdAt: new Date().toISOString(),
          notes: 'Auto-discovered from DC history',
        });
      }
    });
  });

  if (additions.length > 0) {
    const combined = [...current, ...additions];
    savePersonnelList(combined);
    return combined;
  }

  return current;
};

/**
 * Get unified list of delivery team personnel names configured in Settings roster (active delivery personnel)
 */
export const getDeliveryTeamPersonnelNames = (
  savedDcs?: Array<{ deliveredBy?: string; returnedBy?: string }>,
  onlyActive = true
): string[] => {
  const saved = getSavedPersonnel();
  const ignored = getIgnoredPersonnel();
  const deliveryRoles: PersonnelRole[] = ['Delivery Executive', 'Field Staff', 'Driver', 'Coordinator'];
  
  const teamMembers = saved.filter(p => {
    if (onlyActive && !p.active) return false;
    return !p.role || deliveryRoles.includes(p.role);
  });

  const nameSet = new Set<string>();
  teamMembers.forEach(p => {
    const canonical = normalizePersonnelName(p.name);
    if (canonical && !ignored.has(canonical.toLowerCase()) && !isDisallowedPersonnel(canonical) && !isTransportLogisticsName(canonical)) {
      nameSet.add(canonical);
    }
  });

  return Array.from(nameSet).sort((a, b) => a.localeCompare(b));
};

/**
 * Get unified list of all personnel names available for selection (combining saved directory and DC history)
 */
export const getAllPersonnelNames = (
  savedDcs?: Array<{ deliveredBy?: string; returnedBy?: string }>,
  onlyActive = false
): string[] => {
  return getDeliveryTeamPersonnelNames(savedDcs, onlyActive);
};

export interface PersonnelUsageStats {
  name: string;
  totalUsage: number;
  returnCount: number;
  deliveryCount: number;
}

/**
 * Calculates usage frequency of personnel across DC history.
 * Returns map of lowercase name to stats.
 */
export const getPersonnelUsageStats = (
  savedDcs?: Array<{ deliveredBy?: string; returnedBy?: string }>
): Map<string, PersonnelUsageStats> => {
  const statsMap = new Map<string, PersonnelUsageStats>();

  if (savedDcs && savedDcs.length > 0) {
    savedDcs.forEach((dc) => {
      // Returned By
      const ret = normalizePersonnelName(dc.returnedBy);
      if (ret && !isDisallowedPersonnel(ret) && !isTransportLogisticsName(ret)) {
        const key = ret.toLowerCase();
        const existing = statsMap.get(key) || {
          name: ret,
          totalUsage: 0,
          returnCount: 0,
          deliveryCount: 0,
        };
        existing.totalUsage += 1;
        existing.returnCount += 1;
        statsMap.set(key, existing);
      }

      // Delivered By
      const deliv = normalizePersonnelName(dc.deliveredBy);
      if (deliv && !isDisallowedPersonnel(deliv) && !isTransportLogisticsName(deliv)) {
        const key = deliv.toLowerCase();
        const existing = statsMap.get(key) || {
          name: deliv,
          totalUsage: 0,
          returnCount: 0,
          deliveryCount: 0,
        };
        existing.totalUsage += 1;
        existing.deliveryCount += 1;
        statsMap.set(key, existing);
      }
    });
  }

  return statsMap;
};
