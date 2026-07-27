/**
 * Utility service for sending emails via Resend API
 */

/**
 * Converts a file URL to a Base64 string
 * @param {string} url - The URL of the file to convert
 * @returns {Promise<string|null>} - Base64 string or null if failed
 */
export const fileToBase64 = async (url) => {
  try {
    if (!url) return null;

    // 1. If it's already a Data URL, just strip the header
    if (url.startsWith('data:')) {
      return url.substring(url.indexOf(',') + 1);
    }

    // 2. Handle Blob URLs (often used for locally generated PDFs)
    if (url.startsWith('blob:')) {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    
    // 2. Fetch the file with CORS and no-cache to ensure we get fresh binary data
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache'
    });

    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (err) => {
        console.error('FileReader error:', err);
        reject(err);
      };
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('Base64 conversion failed for URL:', url, err);
    // If a direct fetch fails, we can't attach it without a proxy.
    return null;
  }
};

/**
 * Sends an email using the Resend API
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.body - Email body (text)
 * @param {Array} options.files - Array of { fileName, url } objects
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export const sendEmailWithResend = async ({ to, subject, body, files = [] }) => {
  const proxyUrl = import.meta.env.VITE_RESEND_PROXY_URL;
  const fromEmail = import.meta.env.VITE_EMAIL_FROM || 'Sri Raja Rajeshwari Ortho Plus <onboarding@resend.dev>';

  if (!proxyUrl) {
    return { success: false, message: 'Resend Proxy URL is missing. Please add VITE_RESEND_PROXY_URL to .env.local' };
  }

  try {
    // Convert all attachments to Base64
    const attachments = await Promise.all(
      files.map(async (f) => {
        const base64 = await fileToBase64(f.url);
        if (!base64) return null;
        return {
          filename: f.fileName || 'Document.pdf',
          content: base64
        };
      })
    );

    const validAttachments = attachments.filter(a => a !== null);

    // DEBUG: Warn if attachments were requested but failed to convert (CORS issue)
    if (files.length > 0 && validAttachments.length === 0) {
      const proceed = confirm("Warning: Attachments could not be processed (likely due to Firebase CORS settings). Send email without attachments anyway?");
      if (!proceed) return { success: false, message: 'Attachment processing failed. Check CORS settings.' };
    }

    const payload = {
      from: fromEmail,
      to,
      cc: 'srrorthoplus999@gmail.com',
      reply_to: 'srrorthoplus999@gmail.com',
      subject,
      text: body,
      attachments: validAttachments
    };

    console.log('Dispatching to Resend Proxy with', validAttachments.length, 'attachments');

    // We send the request to the PROXY instead of direct Resend to avoid CORS
    const response = await fetch(proxyUrl, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      return { success: true };
    } else {
      const errText = await response.text();
      console.error('Proxy Error Response:', errText);
      let errorMessage = 'Failed to send email via proxy.';
      try {
        const errJson = JSON.parse(errText);
        errorMessage = errJson.message || errorMessage;
      } catch (e) {
        errorMessage = errText || errorMessage;
      }
      return { success: false, message: errorMessage };
    }
  } catch (err) {
    console.error('Resend proxy service error:', err);
    return { success: false, message: 'Proxy connection failed. Ensure your script is deployed and accessible.' };
  }
};
