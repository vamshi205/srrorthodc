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

/**
 * Saves company metadata to a single Firestore document.
 */
export const saveCompanyData = async (data) => {
  try {
    const docRef = doc(db, 'settings', 'company');
    await setDoc(docRef, data);
    return true;
  } catch (err) {
    console.error('Firestore Save Error (Company):', err);
    return false;
  }
};

/**
 * Saves a template to the 'templates' collection.
 */
export const saveTemplate = async (template) => {
  try {
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
 * Deletes a template from the 'templates' collection.
 */
export const deleteTemplate = async (templateId) => {
  try {
    const docRef = doc(db, 'templates', templateId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error('Firestore Delete Error (Template):', err);
    return false;
  }
};

/**
 * Saves a quotation history item to the 'history' collection.
 */
export const saveHistoryItem = async (item) => {
  try {
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
 * Saves an email history record to the 'emailHistory' collection.
 */
export const saveEmailHistoryItem = async (item) => {
  try {
    const docRef = doc(db, 'emailHistory', item.id);
    await setDoc(docRef, item);
    return true;
  } catch (err) {
    console.error('Firestore Save Error (Email History):', err);
    return false;
  }
};

/**
 * Loads all data from Firestore collections.
 */
export const loadDatabase = async () => {
  try {
    // Load Company Data
    const companyRef = doc(db, 'settings', 'company');
    const companySnap = await getDoc(companyRef);
    const companyData = companySnap.exists() ? companySnap.data() : null;

    // Load Templates
    const templatesSnap = await getDocs(collection(db, 'templates'));
    const templates = templatesSnap.docs.map(doc => {
      const data = doc.data();
      try {
        // Unpack sanitized content
        return { ...data, content: typeof data.content === 'string' ? JSON.parse(data.content) : (data.content || []) };
      } catch (e) {
        return data;
      }
    });

    // Load History (Limited to recent 100 for performance)
    const historyQuery = query(collection(db, 'history'), orderBy('id', 'desc'), limit(100));
    const historySnap = await getDocs(historyQuery);
    const history = historySnap.docs.map(doc => {
      const data = doc.data();
      try {
        // Unpack sanitized content
        return { ...data, content: typeof data.content === 'string' ? JSON.parse(data.content) : (data.content || []) };
      } catch (e) {
        return data;
      }
    });

    // Load Email History
    const emailHistoryQuery = query(collection(db, 'emailHistory'), orderBy('sentAt', 'desc'), limit(50));
    const emailHistorySnap = await getDocs(emailHistoryQuery);
    const emailHistory = emailHistorySnap.docs.map(doc => doc.data());

    // Load Price Lists
    const plSnap = await getDocs(collection(db, 'priceLists'));
    const priceLists = plSnap.docs.map(doc => doc.data());

    // Load Drive Files
    const dfSnap = await getDocs(collection(db, 'driveFiles'));
    const driveFilesData = dfSnap.docs.map(doc => doc.data());
    
    // Reconstruct driveFiles structure (srr/vendor/personal)
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

    const foldersSnap = await getDocs(collection(db, 'driveFolders'));
    const allFolders = foldersSnap.docs.map(doc => doc.data());
    
    const vendorFolders = allFolders
      .filter(f => f.type === 'drive_folders' || !f.type) 
      .map(folder => ({ ...folder, files: vendorMap[folder.id] || [] }));
      
    const personalFolders = allFolders
      .filter(f => f.type === 'drive_personal_folders')
      .map(folder => ({ ...folder, files: personalMap[folder.id] || [] }));

    return {
      companyData,
      templates,
      history,
      emailHistory,
      priceLists,
      driveFiles: { srr, vendor: vendorFolders, personal, personalFolders }
    };
  } catch (err) {
    console.error('Firestore Load Error:', err);
    return null;
  }
};

// Legacy support
export const saveDatabase = async (data) => {
  return true; 
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
    return true;
  } catch (err) {
    console.error(`Firestore Sync Error (${collectionName}):`, err);
    return false;
  }
};
