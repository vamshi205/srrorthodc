import { db } from '../firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs, 
  deleteDoc,
  query,
  orderBy,
  limit,
  writeBatch
} from 'firebase/firestore';

export const DB_CACHE_KEY = 'srr_quotation_full_cache';

/**
 * Reads full quotation database snapshot from localStorage cache.
 */
export const getCachedDatabase = () => {
  try {
    const raw = localStorage.getItem(DB_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data || null;
  } catch (e) {
    console.warn('Error reading quotation database cache:', e);
    return null;
  }
};

/**
 * Saves full quotation database snapshot to localStorage cache.
 */
export const setCachedDatabase = (data) => {
  try {
    if (!data) return;
    localStorage.setItem(DB_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      data
    }));
  } catch (e) {
    console.warn('Error writing quotation database cache:', e);
  }
};

/**
 * Saves company metadata to a single Firestore document and updates local cache.
 */
export const saveCompanyData = async (data) => {
  try {
    const cached = getCachedDatabase();
    if (cached) {
      setCachedDatabase({ ...cached, companyData: data });
    }
    localStorage.setItem('srr_company_data', JSON.stringify(data));

    const docRef = doc(db, 'settings', 'company');
    await setDoc(docRef, data);
    return true;
  } catch (err) {
    console.error('Firestore Save Error (Company):', err);
    return false;
  }
};

/**
 * Saves a template to the 'templates' collection and updates local cache.
 */
export const saveTemplate = async (template) => {
  try {
    const cached = getCachedDatabase();
    if (cached) {
      const existingTemplates = cached.templates || [];
      const idx = existingTemplates.findIndex(t => t.id === template.id);
      const updated = idx >= 0
        ? existingTemplates.map((t, i) => i === idx ? { ...template } : t)
        : [template, ...existingTemplates];
      setCachedDatabase({ ...cached, templates: updated });
      localStorage.setItem('srr_templates', JSON.stringify(updated));
    }

    const docRef = doc(db, 'templates', template.id);
    // Sanitize for Firestore (No nested arrays allowed)
    const sanitized = {
      ...template,
      content: JSON.stringify(template.content || [])
    };
    await setDoc(docRef, sanitized);
    return true;
  } catch (err) {
    console.error('Firestore Save Error (Template):', err);
    return false;
  }
};

/**
 * Deletes a template from the 'templates' collection and updates local cache.
 */
export const deleteTemplate = async (templateId) => {
  try {
    const cached = getCachedDatabase();
    if (cached) {
      const updated = (cached.templates || []).filter(t => t.id !== templateId);
      setCachedDatabase({ ...cached, templates: updated });
      localStorage.setItem('srr_templates', JSON.stringify(updated));
    }

    const docRef = doc(db, 'templates', templateId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error('Firestore Delete Error (Template):', err);
    return false;
  }
};

/**
 * Saves a quotation history item to the 'history' collection and updates local cache.
 */
export const saveHistoryItem = async (item) => {
  try {
    const cached = getCachedDatabase();
    if (cached) {
      const updated = [item, ...(cached.history || []).filter(h => h.id !== item.id)].slice(0, 100);
      setCachedDatabase({ ...cached, history: updated });
      localStorage.setItem('srr_history', JSON.stringify(updated.slice(0, 20)));
    }

    const docRef = doc(db, 'history', item.id);
    // Sanitize for Firestore (No nested arrays allowed)
    const sanitized = {
      ...item,
      content: JSON.stringify(item.content || [])
    };
    await setDoc(docRef, sanitized);
    return true;
  } catch (err) {
    console.error('Firestore Save Error (History):', err);
    return false;
  }
};

/**
 * Saves an email history record to the 'emailHistory' collection and updates local cache.
 */
export const saveEmailHistoryItem = async (item) => {
  try {
    const cached = getCachedDatabase();
    if (cached) {
      const updated = [item, ...(cached.emailHistory || []).filter(e => e.id !== item.id)];
      setCachedDatabase({ ...cached, emailHistory: updated });
    }

    const docRef = doc(db, 'emailHistory', item.id);
    await setDoc(docRef, item);
    return true;
  } catch (err) {
    console.error('Firestore Save Error (Email History):', err);
    return false;
  }
};

/**
 * Loads all data from Firestore collections in parallel and refreshes local cache.
 */
export const loadDatabase = async () => {
  let companyData = null;
  let templates = [];
  let history = [];
  let emailHistory = [];
  let priceLists = [];
  let driveFilesData = [];
  let allFolders = [];

  // Execute all Firestore queries concurrently in parallel
  const [
    companyRes,
    templatesRes,
    historyRes,
    emailHistoryRes,
    priceListsRes,
    driveFilesRes,
    driveFoldersRes
  ] = await Promise.allSettled([
    // 1. Company Data
    getDoc(doc(db, 'settings', 'company')),
    
    // 2. Templates
    getDocs(collection(db, 'templates')),
    
    // 3. History
    (async () => {
      try {
        const historyQuery = query(collection(db, 'history'), orderBy('id', 'desc'), limit(100));
        return await getDocs(historyQuery);
      } catch (err) {
        return await getDocs(collection(db, 'history'));
      }
    })(),
    
    // 4. Email History
    (async () => {
      try {
        const emailHistoryQuery = query(collection(db, 'emailHistory'), orderBy('sentAt', 'desc'), limit(50));
        return await getDocs(emailHistoryQuery);
      } catch (err) {
        return await getDocs(collection(db, 'emailHistory'));
      }
    })(),
    
    // 5. Price Lists
    getDocs(collection(db, 'priceLists')),
    
    // 6. Drive Files
    getDocs(collection(db, 'driveFiles')),
    
    // 7. Drive Folders
    getDocs(collection(db, 'driveFolders'))
  ]);

  // Parse Company Data
  if (companyRes.status === 'fulfilled' && companyRes.value?.exists?.()) {
    companyData = companyRes.value.data();
  }

  // Parse Templates
  if (templatesRes.status === 'fulfilled' && templatesRes.value?.docs) {
    templates = templatesRes.value.docs.map(doc => {
      const data = doc.data();
      try {
        return { ...data, content: typeof data.content === 'string' ? JSON.parse(data.content) : (data.content || []) };
      } catch (e) {
        return data;
      }
    });
  }

  // Parse History
  if (historyRes.status === 'fulfilled' && historyRes.value?.docs) {
    history = historyRes.value.docs.map(doc => {
      const data = doc.data();
      let parsedContent = [];
      try {
        parsedContent = typeof data.content === 'string' ? JSON.parse(data.content) : (data.content || []);
      } catch (e) {
        parsedContent = data.content || [];
      }
      return {
        id: data.id || doc.id,
        hospital: data.hospital || data.formData?.hospitalName || 'Unnamed Hospital',
        ref: data.ref || data.formData?.referenceNumber || 'SRR/QUOT/000000',
        templateName: data.templateName || 'Standard Template',
        date: data.date || data.formData?.date || '',
        formData: data.formData || null,
        content: parsedContent,
        isEmailed: data.isEmailed || false,
        lastEmailedTo: data.lastEmailedTo || '',
        lastEmailedAt: data.lastEmailedAt || '',
        parentRef: data.parentRef || data.formData?.parentRef || null,
        originalRef: data.originalRef || data.formData?.originalRef || null,
        revisionCount: data.revisionCount ?? data.formData?.revisionCount ?? 0,
        modificationHistory: data.modificationHistory || data.formData?.modificationHistory || []
      };
    });
  }

  // Parse Email History
  if (emailHistoryRes.status === 'fulfilled' && emailHistoryRes.value?.docs) {
    emailHistory = emailHistoryRes.value.docs.map(doc => doc.data());
  }

  // Parse Price Lists
  if (priceListsRes.status === 'fulfilled' && priceListsRes.value?.docs) {
    priceLists = priceListsRes.value.docs.map(doc => doc.data());
  }

  // Parse Drive Files
  if (driveFilesRes.status === 'fulfilled' && driveFilesRes.value?.docs) {
    driveFilesData = driveFilesRes.value.docs.map(doc => doc.data());
  }

  // Parse Drive Folders
  if (driveFoldersRes.status === 'fulfilled' && driveFoldersRes.value?.docs) {
    allFolders = driveFoldersRes.value.docs.map(doc => doc.data());
  }

  // Reconstruct driveFiles structure
  const srr = driveFilesData.filter(f => f.type === 'drive_srr');
  const personal = driveFilesData.filter(f => f.type === 'drive_personal');
  
  const vendorMap = {};
  const personalMap = {};
  
  driveFilesData.forEach(file => {
    if (file.type === 'drive_vendor_files') {
      if (!vendorMap[file.folderId]) vendorMap[file.folderId] = [];
      vendorMap[file.folderId].push(file);
    } else if (file.type === 'drive_personal_files') {
      if (!personalMap[file.folderId]) personalMap[file.folderId] = [];
      personalMap[file.folderId].push(file);
    }
  });

  const vendorFolders = allFolders
    .filter(f => f.type === 'drive_folders' || !f.type) 
    .map(folder => ({ ...folder, files: vendorMap[folder.id] || [] }));
    
  const personalFolders = allFolders
    .filter(f => f.type === 'drive_personal_folders')
    .map(folder => ({ ...folder, files: personalMap[folder.id] || [] }));

  // Fallback to cache if any query failed (e.g. offline)
  const cached = getCachedDatabase();
  const finalResult = {
    companyData: companyData || cached?.companyData || null,
    templates: (templates.length > 0 ? templates : cached?.templates) || [],
    history: (history.length > 0 ? history : cached?.history) || [],
    emailHistory: (emailHistory.length > 0 ? emailHistory : cached?.emailHistory) || [],
    priceLists: (priceLists.length > 0 ? priceLists : cached?.priceLists) || [],
    driveFiles: { srr, vendor: vendorFolders, personal, personalFolders }
  };

  // Persist updated snapshot to local storage cache for next instant retrieval
  setCachedDatabase(finalResult);

  return finalResult;
};

// Legacy support
export const saveDatabase = async (data) => {
  return true; 
};

/**
 * Updates quotation audit record in Firestore to track Drive updates.
 */
export const updateQuotationAudit = async (actionType = 'drive_updated') => {
  try {
    const auditRef = doc(db, 'settings', 'quotation_audit');
    await setDoc(auditRef, {
      driveUpdatedAt: Date.now(),
      lastAction: actionType
    }, { merge: true });
    return true;
  } catch (e) {
    console.warn('Audit update failed:', e);
    return false;
  }
};

/**
 * Gets quotation audit record from Firestore.
 */
export const getQuotationAudit = async () => {
  try {
    const auditRef = doc(db, 'settings', 'quotation_audit');
    const snap = await getDoc(auditRef);
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    return null;
  }
};

/**
 * Generic sync function for drive files and folders.
 */
export const syncItem = async (collectionName, item, isDelete = false) => {
  try {
    const docRef = doc(db, collectionName, item.id);
    if (isDelete) {
      await deleteDoc(docRef);
    } else {
      await setDoc(docRef, item);
    }

    // Trigger audit update if drive files or folders modified
    if (collectionName.startsWith('drive') || collectionName === 'priceLists') {
      await updateQuotationAudit(`sync_${collectionName}_${isDelete ? 'delete' : 'save'}`);
    }

    return true;
  } catch (err) {
    console.error(`Firestore Sync Error (${collectionName}):`, err);
    return false;
  }
};
