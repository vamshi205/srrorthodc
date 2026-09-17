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

/**
 * Normalizes a personnel name:
 * - Trims and collapses multiple whitespace
 * - Checks known alias variations (e.g., Prasanth -> Prashanth)
 */
export const normalizePersonnelName = (rawName?: string): string => {
  if (!rawName) return '';
  const trimmed = rawName.trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'none') return '';
  const lower = trimmed.toLowerCase();
  if (KNOWN_NAME_ALIASES[lower]) {
    return KNOWN_NAME_ALIASES[lower];
  }
  return trimmed;
};

const DEFAULT_PERSONNEL: Personnel[] = [
  { id: 'p_1', name: 'Ramesh Rao', phone: '9848012345', role: 'Delivery Executive', active: true, createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'p_2', name: 'Suresh Kumar', phone: '9848023456', role: 'Delivery Executive', active: true, createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'p_3', name: 'Prashanth', phone: '9848034567', role: 'Delivery Executive', active: true, createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'p_4', name: 'Venkatesh', phone: '9848045678', role: 'Field Staff', active: true, createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'p_5', name: 'Praveen', phone: '9848056789', role: 'Delivery Executive', active: true, createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'p_6', name: 'Kiran', phone: '9848067890', role: 'Field Staff', active: true, createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'p_7', name: 'Vijay', phone: '9848078901', role: 'Coordinator', active: true, createdAt: '2025-01-01T00:00:00.000Z' },
];

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
 * Retrieve all registered personnel from localStorage with automatic de-duplication
 */
export const getSavedPersonnel = (): Personnel[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PERSONNEL));
      return DEFAULT_PERSONNEL;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const { deduped, hasDuplicates } = deduplicatePersonnelList(parsed);
      if (hasDuplicates) {
        // Automatically save the cleaned deduped version
        localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
      }
      return deduped;
    }
    return DEFAULT_PERSONNEL;
  } catch (error) {
    console.error('Error loading personnel:', error);
    return DEFAULT_PERSONNEL;
  }
};

/**
 * Save personnel array to localStorage and notify listeners
 */
export const savePersonnelList = (list: Personnel[]): void => {
  try {
    const { deduped } = deduplicatePersonnelList(list);
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
 * Delete a person
 */
export const deletePersonnel = (id: string): boolean => {
  const list = getSavedPersonnel();
  const filtered = list.filter(p => p.id !== id);
  if (filtered.length === list.length) return false;

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
  const nameSet = new Set(current.map(p => normalizePersonnelName(p.name).toLowerCase()));
  const additions: Personnel[] = [];

  dcs.forEach(dc => {
    [dc.deliveredBy, dc.returnedBy].forEach(rawName => {
      const clean = normalizePersonnelName(rawName);
      if (!clean) return;
      if (!nameSet.has(clean.toLowerCase())) {
        nameSet.add(clean.toLowerCase());
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
 * Get unified list of all personnel names available for selection (combining saved directory and DC history)
 */
export const getAllPersonnelNames = (
  savedDcs?: Array<{ deliveredBy?: string; returnedBy?: string }>,
  onlyActive = false
): string[] => {
  const saved = getSavedPersonnel();
  const activeNames = (onlyActive ? saved.filter(p => p.active) : saved).map(p => normalizePersonnelName(p.name));

  const nameSet = new Set<string>();
  activeNames.forEach(n => {
    if (n) nameSet.add(n);
  });

  if (savedDcs && savedDcs.length > 0) {
    savedDcs.forEach(dc => {
      const deliv = normalizePersonnelName(dc.deliveredBy);
      if (deliv) nameSet.add(deliv);
      const ret = normalizePersonnelName(dc.returnedBy);
      if (ret) nameSet.add(ret);
    });
  }

  return Array.from(nameSet).sort((a, b) => a.localeCompare(b));
};
