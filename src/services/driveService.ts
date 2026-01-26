
// Configure your GAS Web App URL here or in .env
// Example: https://script.google.com/macros/s/AKfycbx.../exec
const GAS_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';

export interface UploadResult {
    success: boolean;
    fileId?: string;
    url?: string; // Download/View URL
    viewLink?: string;
    error?: string;
}

export const driveService = {
    /**
     * Upload an image to Google Drive via GAS
     * @param imageBase64 Base64 string of the image (without the data:image/jpeg;base64, prefix if possible, but we handle splitting)
     * @param procedureName Name of the procedure (used for folder name)
     * @param fileName Name of the file (e.g., 'image.jpg')
     */
    async uploadImage(imageBase64: string, procedureName: string, fileName: string): Promise<UploadResult> {
        if (!GAS_URL) {
            console.error("GAS_URL is not configured.");
            return { success: false, error: "System Configuration Error: Google Apps Script URL is missing." };
        }

        // Remove data URL prefix if present
        const base64Content = imageBase64.split(',')[1] || imageBase64;

        const payload = {
            action: 'uploadImage',
            data: {
                imageBase64: base64Content,
                procedureName: procedureName,
                fileName: fileName
            }
        };

        try {
            // We use 'no-cors' mode which is standard for GAS POST requests from client-side 
            // BUT 'no-cors' means we can't read the response. 
            // To read the response, GAS must support CORS (return appropriate headers).
            // The script I provided should generate a JSON response. 
            // Typically with GAS, you might run into CORS issues.
            // A common workaround is using `fetch` with `redirect: 'follow'`.
            // However, straightforward POST to GAS usually works if the script is 'Anyone, even anonymous' or 'Anyone'

            const response = await fetch(GAS_URL, {
                method: 'POST',
                body: JSON.stringify(payload),
                // Additional headers might trigger preflight which GAS doesn't like sometimes.
                // Keeping it simple.
            });

            const result = await response.json();
            return result as UploadResult;

        } catch (error: any) {
            console.error("Drive upload error:", error);
            // Fallback for CORS opaque response if applicable, 
            // but we really need the URL back, so we hope CORS is set up or we get a readable response.
            return { success: false, error: error.message || "Upload failed due to network or CORS error." };
        }
    }
};
