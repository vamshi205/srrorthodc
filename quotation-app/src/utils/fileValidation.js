/**
 * Utility for file validation and processing
 */

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit for Storage uploads
export const LEGACY_FIRESTORE_LIMIT_BYTES = 800 * 1024; // 800KB for legacy Base64

/**
 * Validates a file for upload
 * @param {File} file - The file object from input
 * @returns {Object} - { isValid: boolean, error: string|null }
 */
export const validateFile = (file) => {
  if (!file) return { isValid: false, error: 'No file selected.' };
  
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { 
      isValid: false, 
      error: `File is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Max limit is 5MB.` 
    };
  }

  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { 
      isValid: false, 
      error: 'Invalid file type. Only PDF and Images are allowed.' 
    };
  }

  return { isValid: true, error: null };
};

/**
 * Converts a file to data URL (Base64) - only use for preview or small legacy data
 */
export const fileToDataUrl = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
};
