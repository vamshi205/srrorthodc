/**
 * Google Apps Script for SRR Ortho DC - Drive Uploads
 * 
 * INSTRUCTIONS:
 * 1. Open your existing Google Apps Script project.
 * 2. You can PASTE this code at the end of your existing script OR in a new file (e.g., Code.gs).
 *    If combining, ensure you don't duplicate the `doPost` function.
 *    
 *    CRITICAL: If you already have a `doPost` function (which you likely do for Sheets), 
 *    you must MERGE this logic into it. See the "MERGE INSTRUCTIONS" below.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================
const ROOT_FOLDER_NAME = "SRR Procedure Images";

// ============================================================================
// DRIVE HANDLING LOGIC
// ============================================================================

/**
 * Handle Image Upload
 * Expects params: { action: 'uploadImage', data: { imageBase64: '...', procedureName: '...', fileName: '...' } }
 */
function handleImageUpload(data) {
  try {
    const folder = getOrCreateProcedureFolder(data.procedureName);

    // Decode base64
    const blob = Utilities.newBlob(Utilities.base64Decode(data.imageBase64), MimeType.JPEG, data.fileName);

    // Create file
    const file = folder.createFile(blob);

    // Make public (so app can verify/display it initially if needed, though usually we store the link)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      success: true,
      fileId: file.getId(),
      url: file.getDownloadUrl(), // Or file.getUrl() for the viewer
      viewLink: file.getUrl()
    };

  } catch (e) {
    Logger.log("Upload Error: " + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Get or create the root folder and the procedure specific subfolder
 */
function getOrCreateProcedureFolder(procedureName) {
  // 1. Get Root Folder
  const rootFolders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  let rootFolder;

  if (rootFolders.hasNext()) {
    rootFolder = rootFolders.next();
  } else {
    rootFolder = DriveApp.createFolder(ROOT_FOLDER_NAME);
  }

  // 2. Get/Create Subfolder
  // Sanitize procedure name for folder creation
  const safeName = procedureName.replace(/[\/\\:*?"<>|]/g, "_");
  const subFolders = rootFolder.getFoldersByName(safeName);

  if (subFolders.hasNext()) {
    return subFolders.next();
  } else {
    return rootFolder.createFolder(safeName);
  }
}

// ============================================================================
// MAIN HANDLERS
// ============================================================================

function doGet(e) {
  return ContentService.createTextOutput("Drive Upload Service is Running");
}

function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    const data = requestData.data;

    let result;

    switch (action) {
      case 'uploadImage':
        result = handleImageUpload(data);
        break;
      default:
        result = { success: false, message: "Unknown action: " + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
