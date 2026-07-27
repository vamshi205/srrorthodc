import { storage, db } from '../firebase';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject,
  getMetadata,
  getBlob 
} from 'firebase/storage';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

/**
 * Gets metadata (like size) for a file from Firebase Storage.
 */
const getFileMetadataFromStorage = async (path) => {
  try {
    if (!path) return null;
    const storageRef = ref(storage, path);
    const metadata = await getMetadata(storageRef);
    return metadata;
  } catch (err) {
    console.error('Metadata Fetch Error:', err);
    return null;
  }
};

/**
 * Fetches actual file data (bytes) from Firebase Storage.
 * Required for PDF merging.
 */
const getFileData = async (dataUrl, fileId) => {
  try {
    // If it's already a base64 string (legacy), we might need to handle it
    if (dataUrl && dataUrl.startsWith('data:')) {
      const response = await fetch(dataUrl);
      return await response.arrayBuffer();
    }
    
    // Otherwise, it's a Firebase Storage path or URL
    // We prefer the path for getBlob
    const path = dataUrl && !dataUrl.startsWith('http') ? dataUrl : `documents/${fileId}`;
    const storageRef = ref(storage, path);
    const blob = await getBlob(storageRef);
    return await blob.arrayBuffer();
  } catch (err) {
    console.error('getFileData Error:', err);
    return null;
  }
};

/**
 * Uploads a file to Firebase Storage and saves its metadata to Firestore.
 */
const uploadFile = async (file, folder = 'documents', onProgress = null) => {
  try {
    const fileId = Date.now().toString() + '_' + file.name;
    const path = `${folder}/${fileId}`;
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error) => {
          console.error('Firebase Upload Error:', error);
          reject(error);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            success: true,
            fileId: fileId,
            path: path,
            url: downloadURL,
            size: file.size
          });
        }
      );
    });
  } catch (err) {
    console.error('Upload Process Error:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Deletes a file from Firebase Storage.
 */
const deleteFile = async (fullPath) => {
  try {
    if (!fullPath) return true;
    const storageRef = ref(storage, fullPath);
    await deleteObject(storageRef);
    return true;
  } catch (err) {
    console.error('Firebase Delete Error:', err);
    return false;
  }
};

/**
 * Saves file metadata to Firestore.
 */
const saveFileMetadata = async (collectionName, fileMetadata) => {
  try {
    const docRef = doc(db, collectionName, fileMetadata.id);
    await setDoc(docRef, fileMetadata);
    return true;
  } catch (err) {
    console.error('Firestore Metadata Save Error:', err);
    return false;
  }
};

/**
 * Deletes file metadata from Firestore.
 */
const deleteFileMetadata = async (collectionName, fileId) => {
  try {
    const docRef = doc(db, collectionName, fileId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error('Firestore Metadata Delete Error:', err);
    return false;
  }
};

export {
  getFileMetadataFromStorage,
  getFileData,
  uploadFile,
  deleteFile,
  saveFileMetadata,
  deleteFileMetadata
};
