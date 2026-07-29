import React, { useState, useEffect, useRef } from 'react';
import QuotationTemplate from './components/QuotationTemplate';
import LibraryCard from './components/LibraryCard';
import jsPDF from 'jspdf';
import { toJpeg } from 'html-to-image';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import Login from './components/Login';
import EmailerView from './components/EmailerView';
import EmailHistoryView from './components/EmailHistoryView';
import LoadingSpinner from './components/LoadingSpinner';
import { sendEmailWithResend } from './utils/emailService';
import { saveDatabase, loadDatabase, saveTemplate, deleteTemplate, saveHistoryItem, saveCompanyData, saveEmailHistoryItem, syncItem } from './utils/databaseService';
import { auth, db, storage, hasFirebaseConfig } from './firebase';
import { onAuthStateChanged, signOut, signInAnonymously } from 'firebase/auth';
import { ref, getBlob } from 'firebase/storage';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, query, orderBy, writeBatch } from 'firebase/firestore';
import { validateFile } from './utils/fileValidation';
import { uploadFile, deleteFile, saveFileMetadata, deleteFileMetadata, getFileData, getFileMetadataFromStorage } from './utils/storageService';
import logoImg from './assets/logo.png';

import {
  Download,
  Plus,
  Minus,
  FileText,
  Settings,
  ChevronLeft,
  Database,
  ArrowRight,
  Type,
  Table as TableIcon,
  Trash2,
  Edit2,
  UploadCloud,
  LayoutDashboard,
  ShieldCheck,
  Search,
  Eye,
  EyeOff,
  FilePlus2,
  Printer,
  X,

  FileUp,
  Save,
  Share2,
  HardDrive,
  FolderOpen,
  Folder,
  Award,
  FileCheck,
  Mail,
  CheckSquare,
  Menu,
  RefreshCw,
  ChevronRight,
  RotateCcw
} from 'lucide-react';

function App() {
  const [isAdminOnlyMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('adminOnly') === 'true';
  });

  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('adminOnly') === 'true' || params.get('view') === 'settings') {
      return 'settings';
    }
    return 'library';
  });
  const DEFAULT_USER = { uid: 'srr-ortho-user', email: 'srrorthoplus999@gmail.com' };
  const [user, setUser] = useState(DEFAULT_USER);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [syncStatus, setSyncStatus] = useState('saved');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncingStorage, setIsSyncingStorage] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [previewingItem, setPreviewingItem] = useState(null);
  const [previewingDoc, setPreviewingDoc] = useState(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewPriceListUrl, setPreviewPriceListUrl] = useState(null);
  const [regeneratingItem, setRegeneratingItem] = useState(null);
  const [alertModal, setAlertModal] = useState(null); // { type, title, message, onConfirm, onCancel, confirmText, cancelText, showInput, onInput }
  const [isDataLoading, setIsDataLoading] = useState(false);

  const showAlert = (title, message, type = 'success') => {
    setAlertModal({ type, title, message });
  };

  const showConfirm = (title, message, onConfirm, onCancel = null, type = 'confirm', confirmText = 'Confirm', cancelText = 'Cancel') => {
    setAlertModal({ type, title, message, onConfirm, onCancel, confirmText, cancelText });
  };

  const showPrompt = (title, message, onInput, type = 'prompt', confirmText = 'Submit', cancelText = 'Cancel') => {
    setAlertModal({ type, title, message, onInput, showInput: true, confirmText, cancelText });
  };

  const printDocument = (docUrl, docName, docType) => {
    if (docType && docType.startsWith('image/')) {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      
      iframe.contentWindow.document.write(`
        <html>
          <head>
            <title>${docName || 'Print Document'}</title>
            <style>
              body { margin: 0; display: flex; justify-content: center; align-items: center; }
              img { max-width: 100%; max-height: 100vh; object-fit: contain; }
            </style>
          </head>
          <body>
            <img src="${docUrl}" onload="window.print();" />
          </body>
        </html>
      `);
      iframe.contentWindow.document.close();
      
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 5000);
    } else {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = docUrl;
      document.body.appendChild(iframe);
      
      iframe.onload = () => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          console.warn("Iframe print failed due to cross-origin restriction. Opening in a new tab.", e);
          const printWindow = window.open(docUrl, '_blank');
          if (printWindow) {
            printWindow.focus();
            printWindow.print();
          }
        }
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 5000);
      };
    }
  };

  const shareDocument = async (docUrl, docName) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: docName,
          text: `Shared Document: ${docName}`,
          url: docUrl
        });
        return { success: true, method: 'share' };
      } catch (err) {
        if (err.name === 'AbortError') return { success: true, method: 'cancelled' };
        console.error('Web Share failed, falling back to clipboard:', err);
      }
    }
    
    try {
      await navigator.clipboard.writeText(docUrl);
      return { success: true, method: 'clipboard' };
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      return { success: false, error: err };
    }
  };

  const [formData, setFormData] = useState({
    hospitalName: '',
    doctorName: '',
    address: '',
    subject: '',
    date: new Date().toLocaleDateString('en-GB'),
    referenceNumber: '',
    priceListId: '',
    payment: '30 days',
    gst: '5%',
    validity: '',
    warranty: '',
    make: '',
    delivery: '',
    selectedTemplateId: '',
    lineSpacing: 'compact'
  });

  const [draftContent, setDraftContent] = useState([]);
  const [showPreview, setShowPreview] = useState(true);

  // Persistent Storage
  const [companyData, setCompanyData] = useState(() => {
    const saved = localStorage.getItem('srr_company_data');
    const defaultData = {
      name: 'Sri Raja Rajeshwari Ortho Plus',
      address: 'H.No. 6-2-599 | Khairthabad | Hyderabad | Telangana - 500004',
      phone: '9396857455, 9397857455 | 040-65557455',
      email: 'srrorthoplus999@gmail.com',
      website: 'www.srrorthoplus.com',
      signatoryName: 'A. Padmavathi',
      signatoryRole: 'Proprietor',
      signature: ''
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultData, ...parsed };
      } catch (e) {
        return defaultData;
      }
    }
    return defaultData;
  });

  const [priceLists, setPriceLists] = useState(() => {
    const saved = localStorage.getItem('srr_price_lists');
    const parsed = saved ? JSON.parse(saved) : [];
    // CRITICAL: Filter out any legacy Google Drive links or truncated data
    return parsed.filter(a => a.data && a.data.startsWith('http') && !a.data.includes('drive.google.com') && !a.data.includes('googleusercontent'));
  });

  const [templates, setTemplates] = useState([]);

  const [quotationHistory, setQuotationHistory] = useState(() => {
    const saved = localStorage.getItem('srr_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [driveFiles, setDriveFiles] = useState(() => {
    const saved = localStorage.getItem('srr_drive');
    const parsed = saved ? JSON.parse(saved) : { srr: [], vendor: [], personal: [], personalFolders: [] };
    // Only filter out legacy TRUNCATED data, keep firebasestorage URLs
    // CRITICAL: Filter out legacy Google Drive links
    const srr = (parsed.srr || []).filter(f => f.data && f.data.startsWith('http') && !f.data.includes('drive.google.com'));
    const personal = (parsed.personal || []).filter(f => f.data && f.data.startsWith('http') && !f.data.includes('drive.google.com'));
    // Filter Vendor files
    const vendor = (parsed.vendor || []).map(folder => ({
      ...folder,
      files: (folder.files || []).filter(f => f.data && f.data.startsWith('http') && !f.data.includes('drive.google.com'))
    }));
    // Filter Personal folders
    const personalFolders = (parsed.personalFolders || []).map(folder => ({
      ...folder,
      files: (folder.files || []).filter(f => f.data && f.data.startsWith('http') && !f.data.includes('drive.google.com'))
    }));
    return { srr, vendor, personal, personalFolders };
  });

  const [pdfCache, setPdfCache] = useState({}); // Legacy, will use Ref for speed
  const pdfCacheRef = useRef({}); // { fileId/url: Uint8Array }
  const [isDesignerMaximized, setIsDesignerMaximized] = useState(false);
  const [isDraftingMaximized, setIsDraftingMaximized] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [isManagementActive, setIsManagementActive] = useState(false);
  const ADMIN_PASSWORD = "2025";

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Silent auth & Auto-load Firestore database data on startup
    const initAuthAndData = async () => {
      if (hasFirebaseConfig && !auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.warn("Silent auth fallback note:", e);
        }
      }
      await refreshData(auth.currentUser || DEFAULT_USER);
    };

    initAuthAndData();

    if (hasFirebaseConfig) {
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          await refreshData(currentUser);
        }
      });
      return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    setPreviewingItem(null);
    setPreviewPriceListUrl(null);
    setPreviewScale(1);
    setShowEmailComposer(false);
  }, [view]);

  useEffect(() => {
    if (previewingItem?.formData?.priceListId) {
      const pl = priceLists.find(p => p.id === previewingItem.formData.priceListId);
      if (pl) {
        getFileData(pl.data, pl.fileId).then(bytes => {
          if (bytes) {
            const blob = new Blob([bytes], { type: 'application/pdf' });
            setPreviewPriceListUrl(URL.createObjectURL(blob));
          }
        });
      }
    } else {
      setPreviewPriceListUrl(null);
    }
  }, [previewingItem, priceLists]);

  const refreshData = async (currentUser = user || DEFAULT_USER) => {
    setSyncStatus('syncing');
    setIsDataLoading(true);
    try {
      const data = await loadDatabase();
      if (data) {
        if (data.companyData) setCompanyData(data.companyData);
        
        // 1. Templates: Always trust the backend.
        if (data.templates && data.templates.length > 0) {
          setTemplates(data.templates);
        } else {
          // If Firestore is empty, seed it with a professional default template
          const defaultTemplate = {
            id: 'default-' + Date.now(),
            name: 'Standard Implants',
            description: 'Standard quotation for surgical implants.',
            subject: 'Quotation for Orthopedic Implants & instruments',
            defaultMake: '',
            defaultDelivery: 'Immediate',
            defaultDiscount: '',
            defaultGst: '5%',
            defaultPayment: '30 days',
            defaultValidity: '',
            defaultWarranty: '',
            content: [
              { type: 'text', value: 'With reference to the subject cited above we are herewith submitting our lowest quotation for the enclosed Orthopedic Implants & instruments under the following terms& conditions. Please find the same.' }
            ]
          };
          console.log("Seeding Firestore with default template...");
          await saveTemplate(defaultTemplate);
          setTemplates([defaultTemplate]);
        }

        if (data.history) setQuotationHistory(data.history);
        if (data.emailHistory) setEmailHistory(data.emailHistory);
        if (data.driveFiles) setDriveFiles(data.driveFiles);
        if (data.priceLists) setPriceLists(data.priceLists);
      }
      setSyncStatus('saved');
    } catch (e) {
      console.error("Refresh error:", e);
      setSyncStatus('error');
    } finally {
      setIsDataLoading(false);
    }
  };

  const getTodayFormatted = () => {
    const d = new Date();
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  };

  const getNextRefNumber = (history) => {
    const prefix = `SRR/QUOT/`;
    let maxNum = 0;
    (history || []).forEach(item => {
      if (item.ref && item.ref.startsWith(prefix)) {
        const num = parseInt(item.ref.replace(prefix, ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    return `${prefix}${String(maxNum + 1).padStart(6, '0')}`;
  };

  const getFileData = async (dataOrUrl, storagePath = null) => {
    if (!dataOrUrl) return null;
    
    // 1. Try to determine the best storage path
    let bestPath = storagePath;
    
    // If path looks like just a filename (no slash), try to extract it from the URL
    if (typeof dataOrUrl === 'string' && dataOrUrl.includes('firebasestorage') && (!bestPath || !bestPath.includes('/'))) {
      try {
        // Extract the part between /o/ and ?
        const match = dataOrUrl.match(/\/o\/([^?]+)/);
        if (match && match[1]) {
          bestPath = decodeURIComponent(match[1]);
        }
      } catch (e) {
        console.warn("Could not parse storage path from URL:", e);
      }
    }

    const cacheKey = bestPath || dataOrUrl;
    
    // 2. Check cache first
    if (pdfCacheRef.current[cacheKey]) {
      return pdfCacheRef.current[cacheKey];
    }
    
    try {
      // 3. If we have a storage path, use the SDK (Best for CORS)
      if (bestPath) {
        const fileRef = ref(storage, bestPath);
        const blob = await getBlob(fileRef);
        const arrayBuffer = await blob.arrayBuffer();
        const binary = new Uint8Array(arrayBuffer);
        pdfCacheRef.current[cacheKey] = binary;
        return binary;
      }

      // 4. Fallback for direct URLs
      if (typeof dataOrUrl === 'string' && dataOrUrl.startsWith('http')) {
        const response = await fetch(dataOrUrl);
        if (!response.ok) throw new Error('Network response was not ok');
        const arrayBuffer = await response.arrayBuffer();
        const binary = new Uint8Array(arrayBuffer);
        pdfCacheRef.current[cacheKey] = binary;
        return binary;
      }
      return dataOrUrl;
    } catch (err) {
      if (err.name === 'FirebaseError' && err.code === 'storage/unauthorized') {
        console.error('CORS/Security Block: Please run the gsutil command in the CORS_FIX_GUIDE.md file to enable file downloads.');
      } else {
        console.error('File retrieval error:', err);
      }
      // Final fallback: just return the URL if fetch/SDK both failed (might work in some contexts)
      return dataOrUrl;
    }
  };



  const [emailHistory, setEmailHistory] = useState([]);
  const [resendEmailForm, setResendEmailForm] = useState(null);

  const handleResendEmail = (item) => {
    setResendEmailForm({
      to: item.to || '',
      subject: item.subject || 'Documents from Sri Raja Rajeshwari Ortho Plus',
      body: item.body || '',
      selectedDriveFiles: item.selectedDriveFiles || []
    });
    setView('emailer');
    if (showAlert) showAlert('Resend Email', `Pre-filled details for ${item.to}. Review and click Send Email.`, 'success');
  };
  
  // Background Pre-fetching removed to save bandwidth (Egress costs)

  // Set initial ref number from history
  const refInitialized = React.useRef(false);
  useEffect(() => {
    if (!refInitialized.current && quotationHistory !== undefined) {
      refInitialized.current = true;
      setFormData(prev => ({ ...prev, referenceNumber: prev.referenceNumber || getNextRefNumber(quotationHistory) }));
    }
  }, [quotationHistory]);

  const syncItem = async (colName, item, isDelete = false, fileObject = null, onProgress = null) => {
    if (!user) return false;
    setSyncStatus('syncing');
    if (fileObject && !isDelete) {
      setIsUploading(true);
      setUploadProgress(0);
    }
    try {
      if (fileObject && !isDelete) {
        const validation = validateFile(fileObject);
        if (!validation.isValid) throw new Error(validation.error);

        const result = await uploadFile(fileObject, colName, (p) => {
          setUploadProgress(p);
          if (onProgress) onProgress(p);
        });

        if (!result || !result.success) {
          throw new Error("Failed to upload to Firebase Storage");
        }

        item.data = result.url || '';
        item.fileId = result.fileId || '';
        item.storagePath = result.path || '';
        item.size = result.size || 0;
      }

      if (isDelete && (item.storagePath || item.fileId)) {
        try {
          await deleteFile(item.storagePath || item.fileId);
        } catch (e) {
          console.warn('Firebase Storage deletion failed:', e);
        }
      }

      // Save metadata to Firestore
      // Standardize collection names to match databaseService.js
      let collectionName = colName;
      if (colName === 'drive_srr' || colName === 'drive_vendor_files' || colName === 'drive_personal' || colName === 'drive_personal_files') {
        collectionName = 'driveFiles';
      } else if (colName === 'price_lists') {
        collectionName = 'priceLists';
      } else if (colName === 'drive_folders' || colName === 'drive_personal_folders') {
        collectionName = 'driveFolders';
      }
      
      if (isDelete) {
        await deleteFileMetadata(collectionName, item.id);
      } else {
        // Prepare item for Firestore (ensure no binary data)
        const metadata = { ...item, type: colName };
        await saveFileMetadata(collectionName, metadata);
      }
      
      setSyncStatus('saved');
      if (fileObject && !isDelete) {
        setTimeout(() => setIsUploading(false), 800);
      }
      return true;
    } catch (err) {
      console.error(`Sync error:`, err);
      setSyncStatus('error');
      setIsUploading(false);
      showAlert('Sync Failed', err.message || 'Check your internet connection.', 'error');
      return false;
    }
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');
  const [docZoom, setDocZoom] = useState(1.1);
  const [showMobilePreviewModal, setShowMobilePreviewModal] = useState(false);
  const [openVendorFolder, setOpenVendorFolder] = useState(null);
  const [openPersonalFolder, setOpenPersonalFolder] = useState(null);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [emailForm, setEmailForm] = useState({
    to: '',
    subject: '',
    body: '',
    selectedDriveFiles: [] // Array of file objects
  });
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const handleGlobalSendEmail = async () => {
    if (!emailForm.to) {
      showAlert('Recipient Missing', 'Please enter a valid recipient email address.', 'error');
      return;
    }
    setIsSendingEmail(true);

    const filesToAttach = (emailForm.selectedDriveFiles || []).map(f => ({
      fileName: f.fileName || f.label || 'Document.pdf',
      url: f.data
    }));

    try {
      const result = await sendEmailWithResend({
        to: emailForm.to,
        subject: emailForm.subject,
        body: emailForm.body,
        files: filesToAttach
      });

      if (result.success) {
        // Save to History
        const historyItem = {
          id: Date.now().toString(),
          to: emailForm.to,
          subject: emailForm.subject,
          body: emailForm.body,
          sentAt: new Date().toISOString(),
          attachments: filesToAttach.map(f => f.fileName),
          status: 'success'
        };
        setEmailHistory(prev => [historyItem, ...prev]);
        await saveEmailHistoryItem(historyItem);
        
        // Find and mark the quotation in history as emailed if applicable
        const generatedFile = (emailForm.selectedDriveFiles || []).find(f => f.isGenerated);
        if (generatedFile) {
          setQuotationHistory(prev => prev.map(h => {
            if (`Quotation_${h.hospital}.pdf` === generatedFile.fileName || h.ref === formData.referenceNumber) {
              const updated = { 
                ...h, 
                isEmailed: true,
                lastEmailedAt: new Date().toISOString(),
                lastEmailedTo: emailForm.to
              };
              saveHistoryItem(updated); // Persist status to Firestore
              return updated;
            }
            return h;
          }));
        }

        setShowEmailComposer(false);
        setView('history');
        showAlert('Email Sent', `Quotation has been successfully sent to ${emailForm.to} and recorded in history.`, 'success');
      } else {
        showAlert('Dispatch Failed', result.message || 'Could not send email.', 'error');
      }
    } catch (err) {
      console.error('Email error:', err);
      showAlert('Error', err.message || 'An unexpected error occurred during dispatch.', 'error');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const confirmDelete = (callback) => {
    showPrompt('Admin Required', 'Enter admin password to perform this action:', (pw) => {
      if (pw === 'srrortho' || pw === '2025') {
        callback();
      } else {
        showAlert('Access Denied', 'Incorrect admin password.', 'error');
      }
    });
  };

  const downloadFolderAsZip = async (folder) => {
    if (!folder.files || folder.files.length === 0) return showAlert('Empty Folder', 'This folder does not contain any files to download.', 'error');
    const zip = new JSZip();
    for (const file of folder.files) {
      const base64 = file.data.includes('base64,') ? file.data.split(',')[1] : file.data;
      zip.file(file.fileName, base64, { base64: true });
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `${folder.name}.zip`; link.click();
  };

  const getSignature = () => {
    return `\n\nFrom\nSri Raja Rajeshwari Ortho Plus, \nHyderabad, India\nMobile : +91 9396857455, +91 8686559393\nWebsite : srrorthoplus.com`;
  };

  const updateEmailBody = (templateId, selectedFiles = []) => {
    const template = templates.find(t => t.id === templateId);
    const templateName = template?.name || 'Orthopedic Implants';
    const emailSubject = `Submission for ${templateName} Quotation`;

    let baseMessage = `Dear Sir/Madam,\n\nPlease find attached the official quotation for ${templateName} for your kind reference.`;

    if (selectedFiles.length > 0) {
      const generatedFiles = selectedFiles.filter(f => f.isGenerated);
      const additionalFiles = selectedFiles.filter(f => !f.isGenerated);

      baseMessage += `\n\nAttached Documents:`;

      if (generatedFiles.length > 0) {
        generatedFiles.forEach(f => {
          baseMessage += `\n• Quotation: ${f.fileName || templateName + ' Quotation.pdf'}`;
        });
      } else {
        baseMessage += `\n• Quotation: ${templateName} Quotation.pdf`;
      }

      if (additionalFiles.length > 0) {
        const srrFiles = additionalFiles.filter(f => f.col === 'drive_srr' || (!f.folderId && !f.fileId && !f.id?.startsWith('pl-')));
        const priceListFiles = additionalFiles.filter(f => f.fileId || f.id?.startsWith('pl-') || (f.type && f.type.includes('price')));
        const vendorFiles = additionalFiles.filter(f => f.folderId || f.col === 'drive_vendor_files');

        if (srrFiles.length > 0) {
          baseMessage += `\n\nSRR Documents & Certificates:\n` + srrFiles.map((f, i) => `  ${i + 1}. ${f.label || f.name || f.fileName}`).join('\n');
        }

        if (priceListFiles.length > 0) {
          baseMessage += `\n\nAttached Price List:\n` + priceListFiles.map((f, i) => `  ${i + 1}. ${f.label || f.name || f.fileName}`).join('\n');
        }

        if (vendorFiles.length > 0) {
          baseMessage += `\n\nManufacturer Certificates:\n` + vendorFiles.map((f, i) => `  ${i + 1}. ${f.label || f.name || f.fileName}`).join('\n');
        }
      }
    }

    baseMessage += `\n\nWe look forward to your positive response.`;

    setEmailForm(prev => ({
      ...prev,
      subject: emailSubject,
      body: baseMessage + getSignature()
    }));
  };

  useEffect(() => {
    if (showEmailComposer) {
      setEmailForm(prev => ({
        ...prev,
        subject: formData.subject,
        to: prev.to || ''
      }));
      updateEmailBody(formData.selectedTemplateId, emailForm.selectedDriveFiles);
    }
  }, [showEmailComposer, formData.selectedTemplateId]);

  useEffect(() => {
    if (showEmailComposer) {
      updateEmailBody(formData.selectedTemplateId, emailForm.selectedDriveFiles);
    }
  }, [emailForm.selectedDriveFiles]);

  // Preview PDF for Price List
  useEffect(() => {
    if (!formData.priceListId) {
      setPreviewPdfUrl(null);
      return;
    }
    const fetchPreview = async () => {
      const selected = priceLists.find(pl => pl.id === formData.priceListId);
      if (selected && (selected.data || selected.fileId)) {
        const bytes = await getFileData(selected.data, selected.fileId);
        if (bytes) {
          const blob = new Blob([bytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          setPreviewPdfUrl(url);
        }
      }
    };
    fetchPreview();
    return () => { if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl); };
  }, [formData.priceListId, priceLists]); // Removed pdfCache dependency


  useEffect(() => {
    if (!regeneratingItem) return;
    const generateHistoryPDF = async () => {
      setIsGenerating(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 150));
        const element = document.getElementById('history-quotation-template');
        if (!element) throw new Error("History quotation template element not found.");
        const dataUrl = await toJpeg(element, { quality: 0.98, backgroundColor: '#ffffff', pixelRatio: 2, filter: (node) => !node.classList?.contains('no-pdf') });
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297);
        let finalPdfBytes = pdf.output('arraybuffer');

        // MERGE PRICE LIST IF IT WAS SELECTED IN HISTORY
        if (regeneratingItem.formData?.priceListId) {
          const selectedPriceList = priceLists.find(pl => pl.id === regeneratingItem.formData.priceListId);
          if (selectedPriceList && (selectedPriceList.data || selectedPriceList.fileId)) {
            try {
              const priceListBytes = await getFileData(selectedPriceList.data, selectedPriceList.fileId);
              if (priceListBytes) {
                const mainPdfDoc = await PDFDocument.load(finalPdfBytes);
                const priceListPdfDoc = await PDFDocument.load(priceListBytes);
                const mergedPdfDoc = await PDFDocument.create();
                
                const mainPages = await mergedPdfDoc.copyPages(mainPdfDoc, mainPdfDoc.getPageIndices());
                mainPages.forEach(p => mergedPdfDoc.addPage(p));
                
                const priceListPages = await mergedPdfDoc.copyPages(priceListPdfDoc, priceListPdfDoc.getPageIndices());
                priceListPages.forEach(p => mergedPdfDoc.addPage(p));
                
                finalPdfBytes = await mergedPdfDoc.save();
              }
            } catch (err) {
              console.error("Historical PDF Merge failed:", err);
            }
          }
        }

        const rawSubject = (regeneratingItem.formData?.subject || 'Quotation for Orthopedic Implants')
          .replace(/^Sub\s*:\s*/i, '')
          .replace(/[/\\?%*:|"<>]/g, '')
          .trim();
        const fileName = `${rawSubject || 'Quotation'}.pdf`;
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);

        if (regeneratingItem._viewMode) {
          setPreviewingDoc({
            id: regeneratingItem.id,
            label: `Quotation - ${regeneratingItem.formData.hospitalName}`,
            fileName: fileName,
            uploadedAt: regeneratingItem.date,
            data: blobUrl,
            type: 'application/pdf'
          });
          setRegeneratingItem(null);
          setIsGenerating(false);
          return;
        }

        if (regeneratingItem._printMode) {
          printDocument(blobUrl, fileName, 'application/pdf');
          setRegeneratingItem(null);
          setIsGenerating(false);
          return;
        }

        if (regeneratingItem._shareMode) {
          // If native share is available and user is likely on mobile, try it first
          if (navigator.share && navigator.canShare) {
            const file = new File([blob], fileName, { type: 'application/pdf' });
            if (navigator.canShare({ files: [file] })) {
              try {
                await navigator.share({
                  title: `Quotation - ${regeneratingItem.formData.hospitalName}`,
                  text: `Quotation ${regeneratingItem.formData.referenceNumber} for ${regeneratingItem.formData.hospitalName}`,
                  files: [file]
                });
                setIsGenerating(false);
                setRegeneratingItem(null);
                return;
              } catch (shareErr) {
                if (shareErr.name !== 'AbortError') console.error('Share failed:', shareErr);
              }
            }
          }
          // Fallback if share fails or is not available: open download
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = fileName;
          link.click();
        } else if (regeneratingItem._emailMode) {
          // Prepare Email Composer from History
          setFormData(regeneratingItem.formData);
          setDraftContent(regeneratingItem.content || []);
          const itemHosp = (regeneratingItem.formData?.hospitalName || '').trim();
          const itemDoc = (regeneratingItem.formData?.doctorName || '').trim();
          const itemRecipient = itemHosp ? (itemDoc ? `${itemHosp} (Dr. ${itemDoc})` : itemHosp) : (itemDoc ? `Dr. ${itemDoc}` : 'Client');
          const tName = regeneratingItem.templateName || templates.find(t => t.id === regeneratingItem.formData?.selectedTemplateId)?.name || 'Orthopedic Implants';
          const dynSubject = `Submission for ${tName} Quotation`;

          const generatedFile = {
            id: 'gen-' + Date.now(),
            name: fileName,
            fileName: fileName,
            data: blobUrl,
            isGenerated: true
          };

          const priceListObj = regeneratingItem.formData?.priceListId 
            ? priceLists.find(pl => pl.id === regeneratingItem.formData.priceListId)
            : null;

          const initialSelectedFiles = [generatedFile];
          if (priceListObj) {
            initialSelectedFiles.push(priceListObj);
          }

          let dynBody = `Dear Sir/Madam,\n\nPlease find attached the official quotation for ${tName} for your kind reference.\n\nAttached Documents:\n• Quotation: ${fileName}`;
          
          if (priceListObj) {
            dynBody += `\n• Price List: ${priceListObj.label || priceListObj.fileName || 'Price List.pdf'}`;
          }

          dynBody += `\n\nWe look forward to your positive response.\n\nFrom\nSri Raja Rajeshwari Ortho Plus, \nHyderabad, India\nMobile : +91 9396857455, +91 8686559393\nWebsite : srrorthoplus.com`;

          setResendEmailForm({
            to: regeneratingItem.lastEmailedTo || regeneratingItem.formData?.email || '',
            subject: dynSubject,
            body: dynBody,
            selectedDriveFiles: initialSelectedFiles
          });
          setView('emailer');
          if (showAlert) showAlert('Resend Quotation', `Loaded quotation PDF for ${itemRecipient} into email composer.`, 'success');
        } else {
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = fileName;
          link.click();
        }
        
        // Close preview modal after action is triggered
        setPreviewingItem(null);
      } catch (e) {
        console.error(e);
      } finally {
        setIsGenerating(false);
        setRegeneratingItem(null);
      }
    };

    setTimeout(generateHistoryPDF, 150);
  }, [regeneratingItem]);

  // Global Sync to Firebase (Granular saves)
  useEffect(() => {
    if (!user) return;
    const saveToFirebase = async () => {
      setSyncStatus('syncing');
      const success = await saveCompanyData(companyData);
      setSyncStatus(success ? 'saved' : 'error');
    };
    const timer = setTimeout(saveToFirebase, 5000);
    return () => clearTimeout(timer);
  }, [companyData, user]);

  // Template Save Logic moved to the button handler for immediate persistence
  // History Save Logic moved to generatePDF for immediate persistence

  // Local Storage backups (Truncated)
  useEffect(() => {
    localStorage.setItem('srr_company_data', JSON.stringify(companyData));
  }, [companyData]);

  useEffect(() => {
    localStorage.setItem('srr_price_lists', JSON.stringify(priceLists.map(a => ({ ...a, data: 'TRUNCATED_FOR_QUOTA' }))));
  }, [priceLists]);

  useEffect(() => {
    localStorage.setItem('srr_templates', JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    localStorage.setItem('srr_history', JSON.stringify(quotationHistory.slice(0, 10)));
  }, [quotationHistory]);

  useEffect(() => {
    localStorage.setItem('srr_drive', JSON.stringify({
      srr: (driveFiles.srr || []).map(f => ({ ...f, data: 'TRUNCATED_FOR_QUOTA' })),
      personal: (driveFiles.personal || []).map(f => ({ ...f, data: 'TRUNCATED_FOR_QUOTA' })),
      vendor: (driveFiles.vendor || []).map(folder => ({
        ...folder,
        files: (folder.files || []).map(f => ({ ...f, data: 'TRUNCATED_FOR_QUOTA' }))
      })),
      personalFolders: (driveFiles.personalFolders || []).map(folder => ({
        ...folder,
        files: (folder.files || []).map(f => ({ ...f, data: 'TRUNCATED_FOR_QUOTA' }))
      }))
    }));
  }, [driveFiles]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const useTemplate = (template) => {
    setFormData({
      hospitalName: '',
      doctorName: '',
      address: '',
      date: getTodayFormatted(),
      referenceNumber: getNextRefNumber(quotationHistory),
      selectedTemplateId: template.id,
      priceListId: template.defaultPriceListId || '',
      subject: template.subject || 'Quotation for Orthopedic Implants & instruments',
      make: template.defaultMake || '',
      delivery: template.defaultDelivery || '',
      discount: template.defaultDiscount || '',
      gst: template.defaultGst || '5%',
      payment: template.defaultPayment || '30 days',
      validity: template.defaultValidity || '',
      warranty: template.defaultWarranty || '',
      lineSpacing: template.defaultSpacing || 'compact'
    });
    setDraftContent(JSON.parse(JSON.stringify(template.content)));
    setView('drafting');
  };

  const editHistoryItem = (item) => {
    setFormData(JSON.parse(JSON.stringify(item.formData)));
    setDraftContent(JSON.parse(JSON.stringify(item.content)));
    setView('drafting');
  };

  const handleDuplicateTemplate = async (template) => {
    setSyncStatus('syncing');
    const newTemplate = {
      ...JSON.parse(JSON.stringify(template)),
      id: Date.now().toString(),
      name: `${template.name} (Copy)`
    };
    
    const success = await saveTemplate(newTemplate);
    if (success) {
      setTemplates(prev => [newTemplate, ...prev]);
      setSyncStatus('saved');
    } else {
      setSyncStatus('error');
      showAlert('Sync Error', 'Failed to duplicate template to cloud.', 'error');
    }
  };

  const handleTogglePin = async (id) => {
    const updated = templates.map(t => t.id === id ? { ...t, isPinned: !t.isPinned } : t);
    setTemplates(updated);
    const target = updated.find(t => t.id === id);
    if (target) {
      await saveTemplate(target);
    }
  };

  const handleDriveUpload = (e, colName, folderId = null) => {
    const files = Array.from(e.target.files);
    files.forEach(async (file) => {
      if (colName === 'drive_srr' || colName === 'drive_personal') {
        const promptMsg = colName === 'drive_personal' ? `Enter a name for PRIVATE file: ${file.name}` : `Enter a name for: ${file.name}`;
        showPrompt('Document Name', promptMsg, async (label) => {
          if (!label) return;
          const newFile = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            label: label,
            fileName: file.name,
            type: file.type,
            folderId: folderId,
            uploadedAt: new Date().toLocaleDateString('en-GB')
          };
          const success = await syncItem(colName, newFile, false, file);
          if (success) {
            if (colName === 'drive_srr') {
              setDriveFiles(prev => ({ ...prev, srr: [...(prev.srr || []), newFile] }));
            } else {
              setDriveFiles(prev => ({ ...prev, personal: [...(prev.personal || []), newFile] }));
            }
          }
        });
      } else {
        const newFile = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          label: file.name,
          fileName: file.name,
          type: file.type,
          folderId: folderId,
          uploadedAt: new Date().toLocaleDateString('en-GB')
        };
        const success = await syncItem(colName, newFile, false, file);
        if (success) {
          if (colName === 'drive_vendor_files') {
            setDriveFiles(prev => ({
              ...prev,
              vendor: prev.vendor.map(f => f.id === folderId ? { ...f, files: [...(f.files || []), newFile] } : f)
            }));
          } else {
            setDriveFiles(prev => ({
              ...prev,
              personalFolders: (prev.personalFolders || []).map(f => f.id === folderId ? { ...f, files: [...(f.files || []), newFile] } : f)
            }));
          }
        }
      }
    });
    e.target.value = '';
  };

  const handleDeleteDriveFile = async (colName, file) => {
    confirmDelete(async () => {
      const success = await syncItem(colName, file, true);
      if (success) {
        if (colName === 'drive_srr') {
          setDriveFiles(prev => ({ ...prev, srr: prev.srr.filter(f => f.id !== file.id) }));
        } else if (colName === 'drive_personal') {
          setDriveFiles(prev => ({ ...prev, personal: prev.personal.filter(f => f.id !== file.id) }));
        } else if (colName === 'drive_vendor_files') {
          setDriveFiles(prev => ({
            ...prev,
            vendor: prev.vendor.map(folder => ({ ...folder, files: (folder.files || []).filter(f => f.id !== file.id) }))
          }));
        } else {
          setDriveFiles(prev => ({
            ...prev,
            personalFolders: (prev.personalFolders || []).map(folder => ({ ...folder, files: (folder.files || []).filter(f => f.id !== file.id) }))
          }));
        }
      }
    });
  };

  const handleDeleteFolder = (folder, colName = 'drive_folders') => {
    confirmDelete(async () => {
      const fileType = colName === 'drive_folders' ? 'drive_vendor_files' : 'drive_personal_files';
      for (const file of (folder.files || [])) {
        await syncItem(fileType, file, true);
      }
      const success = await syncItem(colName, folder, true);
      if (success) {
        if (colName === 'drive_folders') {
          setDriveFiles(prev => ({ ...prev, vendor: prev.vendor.filter(f => f.id !== folder.id) }));
        } else {
          setDriveFiles(prev => ({ ...prev, personalFolders: prev.personalFolders.filter(f => f.id !== folder.id) }));
        }
      }
    });
  };

  const syncLegacyStorageSizes = async () => {
    setIsSyncingStorage(true);
    try {
      const allFilesToSync = [
        ...(driveFiles.srr || []).map(f => ({ ...f, col: 'drive_srr' })),
        ...(driveFiles.personal || []).map(f => ({ ...f, col: 'drive_personal' })),
        ...(driveFiles.vendor || []).flatMap(folder => (folder.files || []).map(f => ({ ...f, col: 'drive_vendor_files' }))),
        ...(driveFiles.personalFolders || []).flatMap(folder => (folder.files || []).map(f => ({ ...f, col: 'drive_personal_files' })))
      ].filter(f => !f.size && (f.storagePath || f.fileId));

      if (allFilesToSync.length === 0) {
        showAlert('Up to Date', 'All file sizes are already synchronized.', 'success');
        setIsSyncingStorage(false);
        return;
      }

      let successCount = 0;
      for (const file of allFilesToSync) {
        const path = file.storagePath || `documents/${file.fileId}`;
        const metadata = await getFileMetadataFromStorage(path);
        if (metadata && metadata.size) {
          file.size = metadata.size;
          // Update Firestore
          await syncItem(file.col, file);
          successCount++;
        }
      }

      // Refresh everything
      await refreshData();
      showAlert('Sync Complete', `Updated ${successCount} files with correct sizes.`, 'success');
    } catch (err) {
      console.error(err);
      showAlert('Sync Error', 'Failed to synchronize storage sizes.', 'error');
    } finally {
      setIsSyncingStorage(false);
    }
  };


  const generatePDF = async () => {
    const hasHospital = (formData.hospitalName || '').trim();
    const hasDoctor = (formData.doctorName || '').trim();
    if (!hasHospital && !hasDoctor) return showAlert('Missing Info', 'Please enter either Hospital Name or Doctor Name.', 'error');
    
    setIsGenerating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 150));
      const element = document.getElementById('pdf-export-template') || document.getElementById('quotation-template');
      if (!element) throw new Error("Quotation template element not found.");
      const dataUrl = await toJpeg(element, { quality: 0.98, backgroundColor: '#ffffff', pixelRatio: 2, filter: (node) => !node.classList?.contains('no-pdf') });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297);
      let finalPdfBytes = pdf.output('arraybuffer');

      // MERGE PRICE LIST IF SELECTED
      if (formData.priceListId) {
        const selectedPriceList = priceLists.find(pl => pl.id === formData.priceListId);
        if (selectedPriceList && (selectedPriceList.data || selectedPriceList.fileId)) {
          try {
            const priceListBytes = await getFileData(selectedPriceList.data, selectedPriceList.fileId);
            if (priceListBytes) {
              const mainPdfDoc = await PDFDocument.load(finalPdfBytes);
              const priceListPdfDoc = await PDFDocument.load(priceListBytes);
              const mergedPdfDoc = await PDFDocument.create();
              
              const mainPages = await mergedPdfDoc.copyPages(mainPdfDoc, mainPdfDoc.getPageIndices());
              mainPages.forEach(p => mergedPdfDoc.addPage(p));
              
              const priceListPages = await mergedPdfDoc.copyPages(priceListPdfDoc, priceListPdfDoc.getPageIndices());
              priceListPages.forEach(p => mergedPdfDoc.addPage(p));
              
              finalPdfBytes = await mergedPdfDoc.save();
            } else {
              throw new Error("Could not retrieve Price List from Firebase Storage.");
            }
          } catch (err) {
            console.error("PDF Merge failed:", err);
            showAlert('Merge Warning', 'Price List merge failed. The document was generated without the attachment. Error: ' + err.message, 'error');
          }
        }
      }

      // Handle History (Save or Update)
      const existingHistoryItem = quotationHistory.find(h => h.ref === formData.referenceNumber);
      const displayTitle = hasHospital ? (hasDoctor ? `${hasHospital} (Dr. ${hasDoctor})` : hasHospital) : `Dr. ${hasDoctor}`;
      
      const historyItem = {
        id: existingHistoryItem ? existingHistoryItem.id : Date.now().toString(),
        hospital: displayTitle,
        date: formData.date,
        ref: formData.referenceNumber,
        templateName: templates.find(t => t.id === formData.selectedTemplateId)?.name || 'Custom',
        formData: JSON.parse(JSON.stringify(formData)),
        content: JSON.parse(JSON.stringify(draftContent))
      };

      if (existingHistoryItem) {
        setQuotationHistory(prev => prev.map(h => h.id === existingHistoryItem.id ? historyItem : h));
      } else {
        setQuotationHistory(prev => [historyItem, ...prev]);
      }
      
      await saveHistoryItem(historyItem);

      const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const cleanSubject = (formData.subject || 'Quotation for Orthopedic Implants')
        .replace(/^Sub\s*:\s*/i, '')
        .replace(/[/\\?%*:|"<>]/g, '')
        .trim();
      const pdfFileName = `${cleanSubject || 'Quotation'}.pdf`;
      return { blob, blobUrl: url, fileName: pdfFileName };
    } catch (e) { 
      console.error(e); 
      showAlert('PDF Error', 'Error generating PDF: ' + e.message, 'error');
      return null;
    } finally { 
      setIsGenerating(false); 
    }
  };

  const handleSubmitQuotation = async () => {
    const hasHospital = (formData.hospitalName || '').trim();
    const hasDoctor = (formData.doctorName || '').trim();

    if (!hasHospital && !hasDoctor) {
      showAlert('Required Fields', 'Please enter either a Hospital Name or Doctor Name.', 'error');
      return;
    }

    showConfirm(
      "Confirm Save",
      "Are you sure you want to save invoice?",
      () => {
        setIsGenerating(true);
        
        // Allow UI to render the overlay before heavy PDF processing
        setTimeout(async () => {
          try {
            const result = await generatePDF();
            if (!result) {
              setIsGenerating(false);
              return;
            }

            const { blobUrl, fileName } = result;

            showConfirm(
              "Quotation Saved", 
              "Quotation saved successfully! Do you want to send it via Email now?",
              () => {
                // Setup Email Composer
                const itemHosp = (formData.hospitalName || '').trim();
                const itemDoc = (formData.doctorName || '').trim();
                const itemRecipient = itemHosp ? (itemDoc ? `${itemHosp} (Dr. ${itemDoc})` : itemHosp) : (itemDoc ? `Dr. ${itemDoc}` : 'Client');
                const template = templates.find(t => t.id === formData.selectedTemplateId);
                const tName = template?.name || 'Orthopedic Implants';
                const dynSubject = `Submission for ${tName} Quotation`;

                const priceListObj = formData.priceListId 
                  ? priceLists.find(pl => pl.id === formData.priceListId)
                  : null;

                const attachedFiles = [
                  {
                    id: 'draft-' + Date.now(),
                    fileName: fileName,
                    data: blobUrl,
                    isGenerated: true
                  }
                ];
                if (priceListObj) attachedFiles.push(priceListObj);

                let dynBody = `Dear Sir/Madam,\n\nPlease find attached the official quotation for ${tName} for your kind reference.\n\nAttached Documents:\n• Quotation: ${fileName}`;
                if (priceListObj) {
                  dynBody += `\n• Price List: ${priceListObj.label || priceListObj.fileName || 'Price List.pdf'}`;
                }
                dynBody += `\n\nWe look forward to your positive response.\n\nFrom\nSri Raja Rajeshwari Ortho Plus, \nHyderabad, India\nMobile : +91 9396857455, +91 8686559393\nWebsite : srrorthoplus.com`;

                setEmailForm(prev => ({
                  ...prev,
                  subject: dynSubject,
                  body: dynBody,
                  selectedDriveFiles: attachedFiles
                }));
                setShowEmailComposer(true);
              },
              () => {
                // Download and go to history
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = fileName;
                link.click();
                
                setView('history');
                setTimeout(() => {
                  showAlert('Saved to History', `Quotation ${formData.referenceNumber} has been safely archived.`, 'success');
                }, 500);
              },
              'confirm',
              'Yes, Email Now',
              'No, Just Download'
            );
          } catch (err) {
            console.error(err);
            showAlert('Error', 'An unexpected error occurred during generation.', 'error');
          } finally {
            setIsGenerating(false);
          }
        }, 100);
      },
      null,
      'confirm',
      'Yes',
      'Back'
    );
  };

  const NavItem = ({ id, label, icon }) => (
    <button
      type="button"
      onClick={() => setView(id)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] md:text-[12.5px] font-bold transition-all shrink-0 whitespace-nowrap ${
        view === id 
          ? 'bg-teal-600 text-white shadow-2xs' 
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
  };

  if (isAuthLoading || (isDataLoading && syncStatus === 'syncing')) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center w-full font-sans">
        <LoadingSpinner message="Refreshing Files & Database..." subtext="Fetching latest documents from Google Drive & Cloud storage" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen text-[var(--apple-black)] font-sans overflow-hidden bg-[var(--apple-bg)] relative">
      {/* Ambient background blobs matching whatsappconnect */}
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>

      {/* ─────────────────────────────────────────
          WORKSPACE SUB-HEADER (CASH INVOICE MATCHING TOOLBAR)
          ───────────────────────────────────────── */}
      {!isAdminOnlyMode && (
        <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-3 md:px-6 py-2 flex items-center justify-between gap-2 z-40 shrink-0 shadow-2xs">
          {/* Left: Nav Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 min-w-0 flex-1">
            <NavItem id="library" label="Library" icon={<LayoutDashboard size={14} />} />
            <NavItem id="history" label="History" icon={<Database size={14} />} />
            <NavItem id="drive" label="Drive" icon={<HardDrive size={14} />} />
            <NavItem id="emailer" label="Emailer" icon={<Mail size={14} />} />
            <NavItem id="emailHistory" label="Email History" icon={<RefreshCw size={14} />} />
            <NavItem id="pricelists" label="Price List" icon={<FileText size={14} />} />
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Icon-Only Admin Status Indicator Button */}
            <button 
              onClick={() => {
                if (isManagementActive) {
                  setIsManagementActive(false);
                  showAlert('Admin Disabled', 'Management tools are now inactive.', 'info');
                } else {
                  showPrompt('Admin Access', 'Enter Admin Password to enable management tools:', (pass) => {
                    if (pass === ADMIN_PASSWORD) {
                      setIsManagementActive(true);
                      showAlert('Access Granted', 'Management tools are now active.', 'success');
                    } else if (pass !== null) {
                      showAlert('Access Denied', 'The password you entered is incorrect.', 'error');
                    }
                  });
                }
              }}
              className={`p-2 rounded-xl border transition-all shadow-2xs flex items-center justify-center ${
                isManagementActive 
                  ? 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100' 
                  : 'bg-red-50 border-red-300 hover:bg-red-100'
              }`}
              title={isManagementActive ? "Admin Mode: Active (Click to Disable)" : "Admin Mode: Disabled (Click to Enable)"}
            >
              {/* Green (Active) / Red (Off) Status Dot */}
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isManagementActive ? 'bg-emerald-500 animate-pulse shadow-sm ring-2 ring-emerald-300' : 'bg-red-500 ring-2 ring-red-300'
              }`} />
            </button>

            <button
              onClick={() => refreshData()}
              className="btn-outline !py-1.5 !px-3 text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:bg-slate-100"
              title="Refresh Database"
            >
              <RefreshCw size={13} className={isDataLoading ? "animate-spin text-teal-600" : "text-slate-500"} />
              <span className="hidden sm:inline">Sync</span>
            </button>

            {isManagementActive && (
              <button
                onClick={() => {
                  setEditingTemplate({
                    id: Date.now().toString(),
                    name: 'New Template',
                    description: '',
                    requiresPriceList: false,
                    subject: '',
                    defaultMake: '',
                    defaultDelivery: '',
                    defaultDiscount: '',
                    defaultGst: '',
                    defaultPayment: '',
                    defaultValidity: '',
                    defaultWarranty: '',
                    content: []
                  });
                  setView('builder');
                }}
                className="btn-primary !py-1.5 !px-3.5 text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Plus size={14} /> New Template
              </button>
            )}

            {/* Mobile Menu Button */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              {isMobileMenuOpen ? <Plus className="rotate-45" size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </header>
      )}

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[2000] bg-white lg:hidden flex flex-col p-6 animate-in slide-in-from-top duration-300">
          <div className="flex justify-between items-center mb-10">
            <span className="font-bold text-xl">Menu</span>
            <button onClick={() => setIsMobileMenuOpen(false)}><Plus className="rotate-45" size={32} /></button>
          </div>
          <div className="flex flex-col gap-2">
            {['library', 'history', 'drive', 'emailer', 'emailHistory', 'pricelists', 'settings'].map(id => (
              <button
                key={id}
                onClick={() => { setView(id); setIsMobileMenuOpen(false); }}
                className={`text-left p-4 rounded-2xl text-lg font-semibold uppercase tracking-wide transition-all ${
                  view === id ? 'bg-[var(--apple-gray-1)] text-[var(--emerald)]' : 'text-[var(--apple-gray-5)]'
                }`}
              >
                {id}
              </button>
            ))}
            <button onClick={handleLogout} className="text-left p-4 rounded-2xl text-lg font-semibold text-red-500 uppercase tracking-wide mt-4 border-t border-[var(--apple-gray-2)] pt-8">
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────
          MAIN CONTENT AREA
          ───────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden mt-[var(--nav-height)]">

        {/* VIEW: LIBRARY */}
        {view === 'library' && (
          <div className="h-full overflow-y-auto px-4 py-4 md:px-8 md:py-6">
            <div className="max-w-7xl mx-auto space-y-4">
              
              {/* Sleek Workspace Header & Quick Metrics Banner */}
              <header className="bg-white/80 backdrop-blur-sm border border-slate-200/90 rounded-2xl p-4 md:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">Quotations & Templates</h1>
                    <span className="text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-0.5 rounded-full">
                      {templates.length} {templates.length === 1 ? 'Template' : 'Templates'}
                    </span>
                  </div>
                  <p className="text-[13px] text-slate-500 font-medium">Select a template to generate a quotation, or manage custom templates.</p>
                </div>

                {/* Quick Metrics & Actions */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-bold text-slate-700 shrink-0">
                    <FileText size={14} className="text-teal-600" />
                    <span>{quotationHistory.length} Generated</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-bold text-slate-700 shrink-0">
                    <Mail size={14} className="text-emerald-600" />
                    <span>{emailHistory.length} Emails</span>
                  </div>
                  {isManagementActive && (
                    <button
                      onClick={() => {
                        setEditingTemplate({
                          id: Date.now().toString(),
                          name: 'New Template',
                          description: '',
                          requiresPriceList: false,
                          defaultPriceListId: '',
                          subject: '',
                          defaultMake: '',
                          defaultDelivery: '',
                          defaultDiscount: '',
                          defaultGst: '',
                          defaultPayment: '',
                          defaultValidity: '',
                          defaultWarranty: '',
                          content: []
                        });
                        setView('builder');
                      }}
                      className="btn-primary !py-2 !px-4 text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:shadow-xs shrink-0"
                    >
                      <Plus size={15} /> New Template
                    </button>
                  )}
                </div>
              </header>

              {/* Search Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search size={15} />
                  </div>
                  <input
                    type="text"
                    placeholder="Search templates..."
                    value={templateSearchQuery}
                    onChange={(e) => setTemplateSearchQuery(e.target.value)}
                    autoComplete="off"
                    className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-2xs"
                  />
                  {templateSearchQuery && (
                    <button 
                      onClick={() => setTemplateSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Templates Grid */}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isDataLoading ? (
                  <div className="col-span-full py-8">
                    <LoadingSpinner message="Fetching Templates & Database..." subtext="Synchronizing from Cloud Firestore" />
                  </div>
                ) : (
                  <>
                    {templates
                      .filter(t => 
                        t.name.toLowerCase().includes(templateSearchQuery.toLowerCase()) || 
                        (t.description || '').toLowerCase().includes(templateSearchQuery.toLowerCase())
                      )
                      .sort((a, b) => {
                        if (a.isPinned && !b.isPinned) return -1;
                        if (!a.isPinned && b.isPinned) return 1;
                        return a.name.localeCompare(b.name);
                      })
                      .map(t => (
                        <LibraryCard
                          key={t.id}
                          template={t}
                          showAdminTools={isManagementActive}
                          onUse={useTemplate}
                          onEdit={(t) => { setEditingTemplate(JSON.parse(JSON.stringify(t))); setView('builder'); }}
                          onDuplicate={handleDuplicateTemplate}
                          onTogglePin={handleTogglePin}
                          onDelete={async (id) => {
                            confirmDelete(async () => {
                              await deleteTemplate(id);
                              setTemplates(templates.filter(temp => temp.id !== id));
                            });
                          }}
                        />
                      ))}
                    {templates.length === 0 && (
                      <div className="col-span-full py-20 flex flex-col items-center justify-center border border-dashed border-[var(--apple-gray-3)] rounded-3xl">
                        <Database size={48} className="text-[var(--apple-gray-4)] mb-4" />
                        <p className="text-[17px] font-medium text-[var(--apple-gray-5)]">No templates found.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW: BUILDER (Template Designer) */}
        {view === 'builder' && (
          <div className="flex flex-col lg:flex-row h-full overflow-hidden">
            {/* Left Properties Panel */}
            <div className={`${isDesignerMaximized ? 'w-0 overflow-hidden opacity-0 p-0' : (showPreview ? 'w-full lg:w-[450px]' : 'flex-1')} bg-white border-r border-[var(--apple-gray-2)] flex flex-col overflow-y-auto transition-all duration-300`}>
              <div className="p-8 pb-4">
                <div className="flex justify-between items-center mb-8">
                  <button
                    onClick={() => { setEditingTemplate(null); setView('library'); }}
                    className="flex items-center gap-1 text-[13px] font-semibold text-[var(--emerald)] hover:opacity-80"
                  >
                    <ChevronLeft size={16} /> Library
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowPreview(!showPreview)}
                      className="px-3 py-1.5 border border-[var(--apple-gray-3)] rounded-lg text-[11px] font-semibold text-[var(--apple-gray-6)] hover:bg-[var(--apple-gray-1)] transition-colors"
                    >
                      {showPreview ? 'Hide Canvas' : 'Show Canvas'}
                    </button>
                    <button
                      onClick={() => setIsDesignerMaximized(!isDesignerMaximized)}
                      className="px-3 py-1.5 border border-[var(--apple-gray-3)] rounded-lg text-[11px] font-semibold text-[var(--apple-gray-6)] hover:bg-[var(--apple-gray-1)] transition-colors"
                      title={isDesignerMaximized ? "Restore Sidebar" : "Maximize Table"}
                    >
                      {isDesignerMaximized ? 'Minimize' : 'Maximize'}
                    </button>
                  </div>
                </div>
                <h2 className="text-[28px] font-bold tracking-tight leading-tight mb-8">Designer</h2>

                <div className="space-y-6">
                  <div>
                    <label className="apple-label">Template Name</label>
                    <input
                      type="text"
                      value={editingTemplate?.name || ''}
                      onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                      className="apple-input"
                      placeholder="e.g. Standard Implants"
                    />
                  </div>
                  <div>
                    <label className="apple-label">Description</label>
                    <textarea
                      rows="2"
                      value={editingTemplate?.description || ''}
                      onChange={e => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                      className="apple-input"
                      placeholder="Brief description..."
                    />
                  </div>
                  <div>
                    <label className="apple-label">Default Subject</label>
                    <textarea
                      rows="2"
                      value={editingTemplate?.subject || ''}
                      onChange={e => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                      className="apple-input"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-[var(--apple-gray-1)] rounded-2xl border border-[var(--apple-gray-2)]">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${editingTemplate?.requiresPriceList ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-[var(--apple-gray-4)]'}`}>
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className="text-[14px] font-bold text-[var(--apple-black)]">Price List Needed</p>
                        <p className="text-[11px] text-[var(--apple-gray-5)] font-medium">Require selecting a price list when drafting</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const nextVal = !editingTemplate?.requiresPriceList;
                        setEditingTemplate({
                          ...editingTemplate,
                          requiresPriceList: nextVal,
                          defaultPriceListId: nextVal ? (editingTemplate?.defaultPriceListId || '') : ''
                        });
                      }}
                      className={`w-12 h-6 rounded-full transition-all duration-300 relative ${editingTemplate?.requiresPriceList ? 'bg-emerald-500' : 'bg-[var(--apple-gray-3)]'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${editingTemplate?.requiresPriceList ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  {editingTemplate?.requiresPriceList && (
                    <div className="p-4 bg-[var(--apple-gray-1)] rounded-2xl border border-[var(--apple-gray-2)]">
                      <label className="text-[11px] font-semibold text-[var(--apple-gray-5)] uppercase block mb-1">Default Price List</label>
                      <select
                        value={editingTemplate?.defaultPriceListId || ''}
                        onChange={e => setEditingTemplate({ ...editingTemplate, defaultPriceListId: e.target.value })}
                        className="apple-input cursor-pointer bg-white"
                      >
                        <option value="">-- No Default Price List --</option>
                        {priceLists
                          .filter(pl => !pl.hidden || pl.id === editingTemplate?.defaultPriceListId)
                          .map(pl => (
                            <option key={pl.id} value={pl.id}>
                              {pl.label} {pl.hidden ? '(Hidden)' : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  <div className="pt-6 border-t border-[var(--apple-gray-2)]">
                    <label className="apple-label mb-4">Default Terms</label>
                    <div className="grid grid-cols-2 gap-4">
                      {['Make', 'Delivery', 'Discount', 'GST', 'Payment', 'Validity', 'Warranty'].map(term => {
                        const key = `default${term}`;
                        return (
                          <div key={term}>
                            <span className="text-[11px] font-semibold text-[var(--apple-gray-5)] uppercase block mb-1">{term}</span>
                            <input
                              type="text"
                              value={editingTemplate?.[key] || ''}
                              onChange={e => setEditingTemplate({ ...editingTemplate, [key]: e.target.value })}
                              placeholder={term === 'Validity' ? 'DD/MM/YYYY' : ''}
                              className="apple-input !py-2 !px-3"
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-[var(--apple-gray-2)]">
                    <label className="apple-label mb-4">Default Spacing</label>
                    <div className="flex gap-2">
                      {['compact', 'standard', 'relaxed'].map(s => (
                        <button
                          key={s}
                          onClick={() => setEditingTemplate({ ...editingTemplate, defaultSpacing: s })}
                          className={`flex-1 py-2 text-[12px] font-bold border transition-all rounded-xl capitalize ${ (editingTemplate?.defaultSpacing === s || (!editingTemplate?.defaultSpacing && s === 'compact')) ? 'bg-[var(--apple-black)] text-white border-[var(--apple-black)]' : 'bg-white text-[var(--apple-gray-5)] border-[var(--apple-gray-2)] hover:border-[var(--apple-gray-4)]'}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>



                  <div className="pt-6 border-t border-[var(--apple-gray-2)]">
                    <label className="apple-label mb-4">Add Section</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setEditingTemplate({ ...editingTemplate, content: [...(editingTemplate?.content || []), { type: 'text', value: '' }] })}
                        className="btn-outline flex-col !gap-2 !py-4"
                      >
                        <Type size={18} />
                        <span className="text-[11px]">TEXT</span>
                      </button>
                      <button
                        onClick={() => setEditingTemplate({ ...editingTemplate, content: [...(editingTemplate?.content || []), { type: 'table', headers: ['S.No', 'Item', 'HSN Code', 'Qty', 'Rate', 'Amount'], rows: [['1', '', '', '1', '', '']] }] })}
                        className="btn-outline flex-col !gap-2 !py-4"
                      >
                        <TableIcon size={18} />
                        <span className="text-[11px]">TABLE</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 mt-auto pt-4 bg-white border-t border-[var(--apple-gray-2)] sticky bottom-0 flex flex-col gap-3">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[11px] font-bold text-[var(--apple-gray-5)] uppercase tracking-wider">Storage Status</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${syncStatus === 'syncing' ? 'bg-amber-400 animate-pulse' : syncStatus === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                    <span className="text-[12px] font-medium text-[var(--apple-gray-6)]">
                      {syncStatus === 'syncing' ? 'Saving to Cloud...' : syncStatus === 'error' ? 'Sync Error' : 'All Changes Saved'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!editingTemplate) return;
                    setSyncStatus('syncing');
                    
                    // Prepare the update
                    const updated = templates.some(t => t.id === editingTemplate.id)
                      ? templates.map(t => t.id === editingTemplate.id ? editingTemplate : t)
                      : [...templates, editingTemplate];
                    
                    try {
                      const success = await saveTemplate(editingTemplate);
                      if (success) {
                        // 1. Update local state
                        setTemplates(updated);
                        // 2. Clear editor
                        setSyncStatus('saved');
                        setEditingTemplate(null);
                        setView('library');
                      } else {
                        throw new Error("Firestore rejection");
                      }
                    } catch (err) {
                      setSyncStatus('error');
                      showAlert('Cloud Save Failed', 'Your changes are saved locally but not in the cloud. Check your internet connection.', 'error');
                      // Still update local state so they don't lose work
                      setTemplates(updated);
                      setEditingTemplate(null);
                      setView('library');
                    }
                  }}
                  className="btn-primary w-full py-4"
                >
                  <Save size={18} /> Save & Close
                </button>
              </div>
            </div>

            {/* Right Canvas */}
            {showPreview && (
              <div className="flex-1 bg-[var(--apple-bg)] overflow-y-auto p-4 md:p-12 relative">
                {isDesignerMaximized && (
                  <button 
                    onClick={() => setIsDesignerMaximized(false)}
                    className="fixed top-8 left-8 z-50 bg-white border border-[var(--apple-gray-3)] rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--emerald)] shadow-lg hover:bg-[var(--apple-gray-1)] transition-all flex items-center gap-2"
                  >
                    <ChevronLeft size={14} /> Restore Sidebar
                  </button>
                )}
                <div className={`${isDesignerMaximized ? 'max-w-none px-4' : 'max-w-6xl'} mx-auto space-y-8 transition-all duration-300`}>
                  {(editingTemplate?.content || []).length === 0 && (
                    <div className="text-center py-32 opacity-40">
                      <Database size={48} className="mx-auto mb-4" />
                      <p className="font-semibold tracking-tight text-lg">No sections yet</p>
                    </div>
                  )}

                  {(editingTemplate?.content || []).map((block, idx) => (
                    <div key={idx} className="apple-card p-8 relative group">
                      <button
                        onClick={() => {
                          const nc = [...editingTemplate.content]; nc.splice(idx, 1);
                          setEditingTemplate({ ...editingTemplate, content: nc });
                        }}
                        className="absolute -top-3 -right-3 w-8 h-8 bg-white border border-[var(--apple-gray-2)] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:text-red-500 shadow-sm transition-all"
                      >
                        <Trash2 size={14} />
                      </button>

                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <span className="badge-gray">SECTION {idx + 1}</span>
                          <span className="text-[13px] font-medium text-[var(--apple-gray-5)]">
                            {block.type === 'text' ? 'Text Block' : 'Table Block'}
                          </span>
                        </div>
                        {block.type === 'table' && (
                          <button
                            onClick={() => setIsDesignerMaximized(!isDesignerMaximized)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--apple-gray-1)] hover:bg-[var(--apple-gray-2)] rounded-lg text-[11px] font-bold text-[var(--apple-gray-6)] transition-all"
                          >
                            <LayoutDashboard size={14} />
                            {isDesignerMaximized ? 'Minimize View' : 'Maximize Table'}
                          </button>
                        )}
                      </div>

                      {block.type === 'text' ? (
                        <textarea
                          value={block.value}
                          onChange={e => {
                            const nc = [...editingTemplate.content];
                            nc[idx] = { ...nc[idx], value: e.target.value };
                            setEditingTemplate({ ...editingTemplate, content: nc });
                          }}
                          className="apple-input min-h-[140px]"
                          placeholder="Type paragraph content..."
                        />
                      ) : (
                        <div className="border border-[var(--apple-gray-2)] rounded-xl overflow-x-auto shadow-sm bg-white">
                          <table className="w-full border-collapse">
                            <thead className="bg-[var(--apple-gray-1)] border-b border-[var(--apple-gray-2)]">
                              <tr>
                                {block.headers.map((h, hi) => (
                                  <th key={hi} className="p-3 border-r border-[var(--apple-gray-2)] last:border-none relative group">
                                    <input
                                      value={h}
                                      onChange={e => {
                                        const nc = [...editingTemplate.content];
                                        const newHeaders = [...nc[idx].headers];
                                        newHeaders[hi] = e.target.value;
                                        nc[idx] = { ...nc[idx], headers: newHeaders };
                                        setEditingTemplate({ ...editingTemplate, content: nc });
                                      }}
                                      className="w-full bg-transparent outline-none font-semibold text-center text-[11px] uppercase tracking-wider text-[var(--apple-gray-6)]"
                                    />
                                    <button
                                      onClick={() => {
                                        if (block.headers.length <= 1) return;
                                        const nc = [...editingTemplate.content];
                                        nc[idx].headers.splice(hi, 1);
                                        nc[idx].rows.forEach(r => r.splice(hi, 1));
                                        setEditingTemplate({ ...editingTemplate, content: nc });
                                      }}
                                      className="absolute -top-2 -right-2 w-5 h-5 bg-white border border-[var(--apple-gray-2)] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:text-red-500 shadow-sm transition-all z-10"
                                      title="Delete Column"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  </th>
                                ))}
                                <th className="w-8 bg-[var(--apple-gray-1)]"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {block.rows.map((row, ri) => (
                                <tr key={ri} className="border-b border-[var(--apple-gray-2)] last:border-none hover:bg-[var(--apple-gray-1)] transition-colors">
                                  {row.map((cell, ci) => (
                                    <td key={ci} className="p-0 border-r border-[var(--apple-gray-2)] last:border-none">
                                      {block.headers[ci]?.toLowerCase().includes('item') || block.headers[ci]?.toLowerCase().includes('desc') || block.headers[ci]?.toLowerCase().includes('hsn') ? (
                                        <textarea
                                          value={cell}
                                          rows={cell.toString().split('\n').length || 1}
                                          onChange={e => {
                                            const nc = [...editingTemplate.content];
                                            const newRows = nc[idx].rows.map(r => [...r]);
                                            newRows[ri][ci] = e.target.value;
                                            nc[idx] = { ...nc[idx], rows: newRows };
                                            setEditingTemplate({ ...editingTemplate, content: nc });
                                          }}
                                          className={`w-full py-2.5 px-3 bg-transparent outline-none ${block.headers[ci]?.toLowerCase().includes('hsn') ? 'text-center' : 'text-left'} text-[13px] hover:bg-black/5 focus:bg-white focus:ring-1 focus:ring-[var(--emerald)] transition-all resize-none overflow-hidden`}
                                          placeholder={block.headers[ci]?.toLowerCase().includes('hsn') ? "HSN..." : "Enter set details..."}
                                        />
                                      ) : (
                                        <input
                                          value={cell}
                                          onChange={e => {
                                            const nc = [...editingTemplate.content];
                                            const newRows = nc[idx].rows.map(r => [...r]);
                                            newRows[ri][ci] = e.target.value;
                                            
                                            const headers = nc[idx].headers.map(h => h.toLowerCase());
                                            const qtyIdx = headers.findIndex(h => h === 'qty' || h === 'quantity');
                                            const rateIdx = headers.findIndex(h => h === 'rate' || h === 'mrp' || h === 'price');
                                            const amountIdx = headers.findIndex(h => h === 'amount' || h === 'total');

                                            if (qtyIdx !== -1 && rateIdx !== -1 && amountIdx !== -1 && (ci === qtyIdx || ci === rateIdx)) {
                                              const qty = parseFloat(newRows[ri][qtyIdx]) || 0;
                                              const rate = parseFloat(newRows[ri][rateIdx]) || 0;
                                              newRows[ri][amountIdx] = (qty * rate).toFixed(2);
                                            }

                                            nc[idx] = { ...nc[idx], rows: newRows };
                                            setEditingTemplate({ ...editingTemplate, content: nc });
                                          }}
                                            className={`w-full py-2.5 px-3 bg-transparent outline-none ${((block.headers[ci] || '').toLowerCase().includes('amount') || (block.headers[ci] || '').toLowerCase().includes('rate') || (block.headers[ci] || '').toLowerCase().includes('price') || (block.headers[ci] || '').toLowerCase().includes('qty')) ? 'text-right' : 'text-center'} text-[13px] hover:bg-black/5 focus:bg-white focus:ring-1 focus:ring-[var(--emerald)] transition-all`}
                                          />
                                        )}
                                      </td>
                                  ))}
                                  <td className="p-0 text-center w-8">
                                    <button
                                      onClick={() => {
                                        const nc = [...editingTemplate.content]; nc[idx].rows.splice(ri, 1);
                                        setEditingTemplate({ ...editingTemplate, content: nc });
                                      }}
                                      className="w-full h-full flex items-center justify-center text-[var(--apple-gray-4)] hover:text-red-500 hover:bg-red-50 py-2.5 transition-colors"
                                      title="Delete Row"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="flex border-t border-[var(--apple-gray-2)]">
                            <button
                              onClick={() => {
                                const nc = [...editingTemplate.content];
                                const newRows = [...nc[idx].rows, Array(block.headers.length).fill('')];
                                nc[idx] = { ...nc[idx], rows: newRows };
                                setEditingTemplate({ ...editingTemplate, content: nc });
                              }}
                              className="flex-1 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--emerald)] hover:bg-[var(--emerald-light)] transition-colors border-r border-[var(--apple-gray-2)]"
                            >
                              + Add Row
                            </button>
                            <button
                              onClick={() => {
                                const nc = [...editingTemplate.content];
                                const newHeaders = [...nc[idx].headers, 'NEW COL'];
                                const newRows = nc[idx].rows.map(row => [...row, '']);
                                nc[idx] = { ...nc[idx], headers: newHeaders, rows: newRows };
                                setEditingTemplate({ ...editingTemplate, content: nc });
                              }}
                              className="flex-1 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--coral)] hover:bg-red-50 transition-colors"
                            >
                              + Add Col
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW: DRAFTING */}
        {view === 'drafting' && (
          <div className="flex flex-col lg:flex-row h-full overflow-hidden">
            {/* Left Input Form */}
            <div className={`${isDraftingMaximized ? 'flex-1' : (showPreview ? 'w-full lg:w-[450px]' : 'flex-1')} bg-white border-r border-[var(--apple-gray-2)] flex flex-col overflow-y-auto transition-all duration-500 ${showEmailComposer ? 'blur-md opacity-30 pointer-events-none' : ''}`}>
              <div className="p-4 sm:p-5 pb-3">
                <div className="flex justify-between items-center mb-3">
                  <button
                    onClick={() => setView('library')}
                    className="flex items-center gap-1 text-[13px] font-bold text-[var(--emerald)] hover:opacity-80 transition-opacity"
                  >
                    <ChevronLeft size={16} /> Library
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowPreview(!showPreview)}
                      className="px-2.5 py-1 border border-[var(--apple-gray-3)] rounded-lg text-[11px] font-bold text-[var(--apple-gray-6)] hover:bg-[var(--apple-gray-1)] transition-colors"
                    >
                      {showPreview ? 'Hide Preview' : 'Show Preview'}
                    </button>
                    <button
                      onClick={() => setIsDraftingMaximized(!isDraftingMaximized)}
                      className="px-2.5 py-1 border border-[var(--apple-gray-3)] rounded-lg text-[11px] font-bold text-[var(--apple-gray-6)] hover:bg-[var(--apple-gray-1)] transition-colors"
                      title={isDraftingMaximized ? "Restore Sidebar" : "Maximize Table"}
                    >
                      {isDraftingMaximized ? 'Minimize' : 'Maximize'}
                    </button>
                  </div>
                </div>
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight mb-4">Draft Quotation</h2>

                <div className="space-y-6">
                  {/* Client Details */}
                  <div className="space-y-4">
                    <h3 className="apple-label border-b border-[var(--apple-gray-2)] pb-2">Client Details</h3>
                    <div>
                      <input name="hospitalName" value={formData.hospitalName} onChange={handleInputChange} className="apple-input" placeholder="Hospital Name (Optional if Dr Name entered)" />
                    </div>
                    <div>
                      <input name="doctorName" value={formData.doctorName || ''} onChange={handleInputChange} className="apple-input" placeholder="Doctor Name (e.g. Dr. A. Sharma)" />
                    </div>
                    <div>
                      <textarea name="address" value={formData.address} onChange={handleInputChange} rows="2" className="apple-input" placeholder="Full Address" />
                    </div>
                  </div>

                  {/* Document Details */}
                  <div className="space-y-4 pt-4">
                    <h3 className="apple-label border-b border-[var(--apple-gray-2)] pb-2">Document Info</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[11px] font-semibold text-[var(--apple-gray-5)] uppercase block mb-1">Date</span>
                        <input type="text" name="date" value={formData.date} onChange={handleInputChange} placeholder="DD/MM/YYYY" className="apple-input !px-3" />
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-[var(--apple-gray-5)] uppercase block mb-1">Ref No.</span>
                        <input type="text" name="referenceNumber" value={formData.referenceNumber} readOnly className="apple-input !px-3 bg-[var(--apple-gray-1)] cursor-not-allowed opacity-70" title="Reference number is automatically generated" />
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-[var(--apple-gray-5)] uppercase block mb-1">Subject</span>
                      <textarea name="subject" value={formData.subject} onChange={handleInputChange} rows="2" className="apple-input" />
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-[var(--apple-gray-5)] uppercase block mb-1">Attached Price List / Attachment</span>
                      <div className="flex gap-2">
                        <select 
                          name="priceListId" 
                          value={formData.priceListId || ''} 
                          onChange={handleInputChange}
                          className="apple-input cursor-pointer bg-[var(--apple-gray-1)] flex-grow"
                        >
                          <option value="">-- No Attachment --</option>
                          {priceLists
                            .filter(pl => !pl.hidden || pl.id === formData.priceListId)
                            .map(pl => (
                              <option key={pl.id} value={pl.id}>
                                {pl.label} {pl.hidden ? '(Hidden)' : ''}
                              </option>
                            ))}
                        </select>
                        {formData.priceListId && (
                          <button 
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, priceListId: '' }))}
                            className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-all font-bold text-xs flex items-center gap-1.5 shrink-0"
                            title="Remove attachment from this document"
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        )}
                        <input 
                          type="file" 
                          accept="application/pdf"
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            showConfirm(
                              'Save to Database?', 
                              'Do you want to save this document to the Price List database for future use?',
                              () => {
                                showPrompt(
                                  'New Price List', 
                                  'Enter a name for this Price List (e.g. Stryker 2024):', 
                                  async (label) => {
                                    if (!label) return;
                                    const newItem = { 
                                      id: Date.now().toString(), 
                                      label: label, 
                                      fileName: file.name, 
                                      uploadedAt: new Date().toLocaleDateString('en-GB'),
                                      hidden: false
                                    };
                                    const success = await syncItem('price_lists', newItem, false, file);
                                    if (success) {
                                      setPriceLists(prev => [...prev, newItem]);
                                      setFormData(prev => ({ ...prev, priceListId: newItem.id }));
                                    }
                                  }
                                );
                              },
                              async () => {
                                const newItem = { 
                                  id: Date.now().toString(), 
                                  label: file.name || 'Temporary Attachment', 
                                  fileName: file.name, 
                                  uploadedAt: new Date().toLocaleDateString('en-GB'),
                                  hidden: true
                                };
                                const success = await syncItem('price_lists', newItem, false, file);
                                if (success) {
                                  setPriceLists(prev => [...prev, newItem]);
                                  setFormData(prev => ({ ...prev, priceListId: newItem.id }));
                                }
                              },
                              'confirm',
                              'Yes, Save permanently',
                              'No, just attach to this doc'
                            );
                            e.target.value = '';
                          }} 
                          className="hidden" 
                          id="quick-price-list-upload" 
                        />
                        <label 
                          htmlFor="quick-price-list-upload" 
                          className="btn-outline cursor-pointer flex items-center gap-1.5 shrink-0 hover:border-[var(--emerald)] hover:bg-[var(--emerald-light)] hover:text-[var(--emerald)] active:scale-95 transition-all select-none"
                          title="Attach a new PDF"
                        >
                          <Plus size={15} /> Attach
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Layout Controls */}
                  <div className="space-y-4 pt-4">
                    <h3 className="apple-label border-b border-[var(--apple-gray-2)] pb-2">Layout & Spacing</h3>
                    <div className="flex gap-2">
                      {['compact', 'standard', 'relaxed'].map(s => (
                        <button
                          key={s}
                          onClick={() => setFormData({ ...formData, lineSpacing: s })}
                          className={`flex-1 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all border ${
                            formData.lineSpacing === s 
                              ? 'bg-[var(--emerald)] text-white border-[var(--emerald)]' 
                              : 'bg-white text-[var(--apple-gray-5)] border-[var(--apple-gray-2)] hover:bg-[var(--apple-gray-1)]'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Template Editor */}
                  <div className="space-y-4 pt-4">
                    <h3 className="apple-label border-b border-[var(--apple-gray-2)] pb-2">Content Blocks</h3>
                    {draftContent.map((block, idx) => (
                      <div key={idx} className="bg-[var(--apple-gray-1)] p-4 rounded-xl border border-[var(--apple-gray-2)]">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded flex items-center justify-center bg-[var(--coral)] text-white text-[10px] font-bold">{idx + 1}</span>
                            <span className="text-[11px] font-bold text-[var(--apple-gray-5)] uppercase tracking-wider">
                              {block.type === 'text' ? 'Text' : 'Table'}
                            </span>
                          </div>
                          {block.type === 'table' && (
                            <button
                              onClick={() => setIsDraftingMaximized(!isDraftingMaximized)}
                              className="flex items-center gap-2 px-3 py-1 bg-white hover:bg-[var(--apple-gray-1)] border border-[var(--apple-gray-2)] rounded-lg text-[10px] font-bold text-[var(--apple-gray-5)] transition-all"
                            >
                              <LayoutDashboard size={12} />
                              {isDraftingMaximized ? 'MINIMIZE' : 'MAXIMIZE'}
                            </button>
                          )}
                        </div>
                        {block.type === 'text' ? (
                          <textarea
                            value={block.value}
                            onChange={e => {
                              const nc = [...draftContent]; nc[idx].value = e.target.value;
                              setDraftContent(nc);
                            }}
                            className="apple-input !bg-white !p-3 text-[13px]"
                            rows={3}
                          />
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-[var(--apple-gray-2)] bg-white shadow-sm mt-2">
                            <table className="w-full border-collapse">
                              <thead className="bg-[var(--apple-gray-1)] border-b border-[var(--apple-gray-2)]">
                                <tr>
                                  {block.headers.map((h, hi) => (
                                    <th key={hi} className="p-3 border-r border-[var(--apple-gray-2)] last:border-none relative group">
                                      <input
                                        value={h}
                                        onChange={e => {
                                          const nc = [...draftContent]; nc[idx].headers[hi] = e.target.value;
                                          setDraftContent(nc);
                                        }}
                                        className="w-full bg-transparent outline-none uppercase font-bold text-[var(--apple-gray-6)] text-center text-[11px] tracking-wider"
                                        placeholder={`Col ${hi + 1}`}
                                      />
                                      <button
                                        onClick={() => {
                                          if (block.headers.length <= 1) return;
                                          const nc = [...draftContent];
                                          nc[idx].headers.splice(hi, 1);
                                          nc[idx].rows.forEach(r => r.splice(hi, 1));
                                          setDraftContent(nc);
                                        }}
                                        className="absolute -top-2 -right-2 w-5 h-5 bg-white border border-[var(--apple-gray-2)] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:text-red-500 shadow-sm transition-all z-10"
                                        title="Delete Column"
                                      >
                                        <Trash2 size={10} />
                                      </button>
                                    </th>
                                  ))}
                                  <th className="w-8 bg-[var(--apple-gray-1)]"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {block.rows.map((row, ri) => (
                                  <tr key={ri} className="border-b border-[var(--apple-gray-2)] last:border-none hover:bg-[var(--apple-gray-1)] transition-colors">
                                    {row.map((cell, ci) => (
                                      <td key={ci} className="p-0 border-r border-[var(--apple-gray-2)] last:border-none">
                                        {block.headers[ci]?.toLowerCase().includes('item') || block.headers[ci]?.toLowerCase().includes('desc') || block.headers[ci]?.toLowerCase().includes('hsn') ? (
                                          <textarea
                                            value={cell}
                                            rows={cell.toString().split('\n').length || 1}
                                            onChange={e => {
                                              const nc = [...draftContent];
                                              const newRows = nc[idx].rows.map(r => [...r]);
                                              newRows[ri][ci] = e.target.value;
                                              nc[idx] = { ...nc[idx], rows: newRows };
                                              setDraftContent(nc);
                                            }}
                                            className={`w-full py-2.5 px-3 bg-transparent outline-none ${block.headers[ci]?.toLowerCase().includes('hsn') ? 'text-center' : 'text-left'} text-[13px] hover:bg-black/5 focus:bg-white focus:ring-1 focus:ring-[var(--emerald)] transition-all resize-none overflow-hidden`}
                                            placeholder={block.headers[ci]?.toLowerCase().includes('hsn') ? "HSN..." : "Enter set details..."}
                                          />
                                        ) : (
                                          <input
                                            value={cell}
                                            onChange={e => {
                                              const nc = [...draftContent];
                                              const newRows = nc[idx].rows.map(r => [...r]);
                                              newRows[ri][ci] = e.target.value;

                                              const headers = nc[idx].headers.map(h => h.toLowerCase());
                                              const qtyIdx = headers.findIndex(h => h === 'qty' || h === 'quantity');
                                              const rateIdx = headers.findIndex(h => h === 'rate' || h === 'mrp' || h === 'price');
                                              const amountIdx = headers.findIndex(h => h === 'amount' || h === 'total');

                                              if (qtyIdx !== -1 && rateIdx !== -1 && amountIdx !== -1 && (ci === qtyIdx || ci === rateIdx)) {
                                                const qty = parseFloat(newRows[ri][qtyIdx]) || 0;
                                                const rate = parseFloat(newRows[ri][rateIdx]) || 0;
                                                newRows[ri][amountIdx] = (qty * rate).toFixed(2);
                                              }

                                              nc[idx] = { ...nc[idx], rows: newRows };
                                              setDraftContent(nc);
                                            }}
                                            className={`w-full py-2.5 px-3 bg-transparent outline-none ${((block.headers[ci] || '').toLowerCase().includes('amount') || (block.headers[ci] || '').toLowerCase().includes('rate') || (block.headers[ci] || '').toLowerCase().includes('price') || (block.headers[ci] || '').toLowerCase().includes('qty')) ? 'text-right' : 'text-center'} text-[13px] hover:bg-black/5 focus:bg-white focus:ring-1 focus:ring-[var(--emerald)] transition-all`}
                                          />
                                        )}
                                      </td>
                                    ))}
                                    <td className="p-0 text-center w-8">
                                      <button
                                        onClick={() => {
                                          const nc = [...draftContent];
                                          const newRows = nc[idx].rows.filter((_, i) => i !== ri);
                                          nc[idx] = { ...nc[idx], rows: newRows };
                                          setDraftContent(nc);
                                        }}
                                        className="w-full h-full flex items-center justify-center text-[var(--apple-gray-4)] hover:text-red-500 hover:bg-red-50 py-2.5 transition-colors"
                                        title="Delete Row"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div className="flex border-t border-[var(--apple-gray-2)]">
                              <button
                                onClick={() => {
                                  const nc = [...draftContent];
                                  const newRows = [...nc[idx].rows, Array(block.headers.length).fill('')];
                                  nc[idx] = { ...nc[idx], rows: newRows };
                                  setDraftContent(nc);
                                }}
                                className="flex-1 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--emerald)] hover:bg-[var(--emerald-light)] transition-colors border-r border-[var(--apple-gray-2)]"
                              >
                                + Add Row
                              </button>
                              <button
                                onClick={() => {
                                  const nc = [...draftContent];
                                  nc[idx].headers.push('New Col');
                                  nc[idx].rows.forEach(row => row.push(''));
                                  setDraftContent(nc);
                                }}
                                className="flex-1 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--coral)] hover:bg-red-50 transition-colors"
                              >
                                + Add Column
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Terms */}
                  <div className="space-y-4 pt-4">
                    <h3 className="apple-label border-b border-[var(--apple-gray-2)] pb-2">Terms & Conditions</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {['make', 'delivery', 'discount', 'gst', 'payment', 'validity', 'warranty'].map(term => (
                        <div key={term}>
                          <span className="text-[11px] font-semibold text-[var(--apple-gray-5)] uppercase block mb-1">{term}</span>
                          <input
                            type="text"
                            name={term}
                            value={formData[term]}
                            onChange={handleInputChange}
                            placeholder={term === 'validity' ? 'DD/MM/YYYY' : ''}
                            className="apple-input !px-3"
                          />
                        </div>
                      ))}
                    </div>
                  </div>



                </div>
              </div>

              <div className="p-4 sm:p-6 mt-auto bg-white border-t border-[var(--apple-gray-2)] sticky bottom-0 flex items-center gap-3 z-20">
                {/* Mobile Preview Trigger Button (Visible < lg) */}
                <button 
                  type="button"
                  onClick={() => setShowMobilePreviewModal(true)}
                  className="lg:hidden flex items-center justify-center gap-2 px-4 py-3 bg-teal-50 text-teal-800 border border-teal-200 rounded-xl text-[13px] font-bold hover:bg-teal-100 transition-all shadow-2xs"
                >
                  <Eye size={17} className="text-teal-600" />
                  <span>Preview</span>
                </button>

                <button 
                  onClick={handleSubmitQuotation} 
                  disabled={isGenerating} 
                  className="btn-primary flex-1 !py-3 text-[14px]"
                >
                  {isGenerating ? 'Processing...' : (
                    <div className="flex items-center justify-center gap-2">
                      <ShieldCheck size={18} />
                      Finish & Save Quotation
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Right Live Preview Area (Desktop Only, Hidden on Mobile) */}
            {(showPreview && !isDraftingMaximized) && (
              <div className="hidden lg:flex flex-1 bg-[var(--apple-bg)] overflow-y-auto p-2 sm:p-4 relative flex-col items-center">

                <div className="flex flex-col items-center gap-8 w-full flex-1 pb-16">
                  <div className="origin-top transition-transform duration-200">
                    <QuotationTemplate id="quotation-template" data={formData} content={draftContent} company={companyData} forceScale={docZoom} onContentChange={setDraftContent} isPdfPrinting={isGenerating} />
                  </div>

                  {formData.priceListId && (
                    <div className="scale-[0.85] origin-top flex flex-col gap-4">
                      <div className="w-[210mm] min-h-[500px] bg-white shadow-2xl flex flex-col items-center justify-center border border-[var(--apple-gray-3)] relative overflow-hidden">
                        <div className="absolute top-4 left-4 bg-[var(--emerald)] text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-sm z-10">
                          Attached Price List
                        </div>
                        {previewPdfUrl ? (
                          <iframe 
                            src={previewPdfUrl + '#toolbar=0&navpanes=0&view=FitH'} 
                            className="w-full h-[1100px] border-none" 
                            title="Price List Preview" 
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-4 py-20 px-12 text-center">
                            <div className="w-20 h-20 bg-[var(--apple-gray-1)] rounded-3xl flex items-center justify-center mb-4">
                              <FileCheck size={40} className="text-[var(--emerald)] animate-pulse" />
                            </div>
                            <h3 className="text-[20px] font-bold text-[var(--apple-black)] tracking-tight">
                              Loading Price List...
                            </h3>
                            <p className="text-[14px] text-[var(--apple-gray-5)]">
                              Fetching the document from Google Drive.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sticky Bottom-Right Floating Zoom Bar for Desktop */}
                <div className="sticky bottom-1 sm:bottom-2 ml-auto mr-2 z-30 flex items-center gap-2 bg-slate-900/95 text-white backdrop-blur-md border border-slate-700/80 shadow-2xl rounded-full px-3 py-1 font-sans max-w-[calc(100%-1.5rem)] shrink-0">
                  <Search size={13} className="text-teal-400 shrink-0 ml-1" />
                  <span className="text-[12px] font-extrabold text-teal-300 min-w-[36px] text-center shrink-0">
                    {Math.round(docZoom * 100)}%
                  </span>

                  <button
                    type="button"
                    onClick={() => setDocZoom(prev => Math.max(0.5, parseFloat((prev - 0.1).toFixed(2))))}
                    className="w-5 h-5 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-full text-white font-bold transition-all text-[11px] shrink-0"
                    title="Zoom Out (-)"
                  >
                    -
                  </button>

                  <input 
                    type="range" 
                    min="50" 
                    max="250" 
                    step="5"
                    value={Math.round(docZoom * 100)} 
                    onChange={(e) => setDocZoom(Number(e.target.value) / 100)}
                    className="w-20 sm:w-24 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-400 shrink min-w-[60px]"
                    title="Drag to zoom document"
                  />

                  <button
                    type="button"
                    onClick={() => setDocZoom(prev => Math.min(2.5, parseFloat((prev + 0.1).toFixed(2))))}
                    className="w-5 h-5 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-full text-white font-bold transition-all text-[11px] shrink-0"
                    title="Zoom In (+)"
                  >
                    +
                  </button>

                  <button
                    type="button"
                    onClick={() => setDocZoom(1.0)}
                    className="text-[9.5px] font-bold uppercase text-slate-300 hover:text-white px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 shrink-0 ml-0.5"
                    title="Reset to 100%"
                  >
                    100%
                  </button>
                </div>

              </div>
            )}
          </div>
        )}

        {/* VIEW: HISTORY */}
        {view === 'history' && (
          <div className="h-full overflow-y-auto px-4 py-4 md:px-8 md:py-6">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-4 md:mb-6 gap-4">
                <div>
                  <h1 className="apple-title-1 mb-2">History</h1>
                  <p className="apple-subtitle">Recent quotations generated. <span className="font-semibold text-[var(--apple-black)]">{quotationHistory.length}</span> total</p>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10 text-slate-400">
                    <Search size={16} />
                  </div>
                  <input
                    type="text"
                    placeholder="Search hospital or ref..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoComplete="off"
                    className="w-full md:w-[280px] bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 transition-all shadow-sm"
                  />
                </div>
              </div>

              {(() => {
                const filtered = quotationHistory.filter(item =>
                  (item.hospital || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (item.ref || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (item.templateName || '').toLowerCase().includes(searchQuery.toLowerCase())
                );
                if (filtered.length === 0) return (
                  <div className="text-center py-20 opacity-40">
                    <LayoutDashboard size={48} className="mx-auto mb-4" />
                    <p className="font-semibold text-lg">No history matches found</p>
                  </div>
                );
                return (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden lg:block apple-card overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-[var(--apple-gray-1)] border-b border-[var(--apple-gray-2)]">
                              <th className="text-left py-3 px-5 text-[11px] font-bold uppercase tracking-wider text-[var(--apple-gray-5)]">Ref No.</th>
                              <th className="text-left py-3 px-5 text-[11px] font-bold uppercase tracking-wider text-[var(--apple-gray-5)]">Hospital</th>
                              <th className="text-left py-3 px-5 text-[11px] font-bold uppercase tracking-wider text-[var(--apple-gray-5)]">Template</th>
                              <th className="text-left py-3 px-5 text-[11px] font-bold uppercase tracking-wider text-[var(--apple-gray-5)]">Date</th>
                              <th className="text-right py-3 px-5 text-[11px] font-bold uppercase tracking-wider text-[var(--apple-gray-5)]">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((item) => (
                              <tr key={item.id} className="border-b border-[var(--apple-gray-2)] last:border-0 hover:bg-[var(--apple-gray-1)] transition-colors">
                                <td className="py-4 px-5">
                                  <span className="text-[13px] font-bold text-[var(--emerald)] bg-[var(--emerald-light)] px-2.5 py-1 rounded-md whitespace-nowrap">{(item.ref || '').replace('SRR/QUOT/', '')}</span>
                                </td>
                                <td className="py-4 px-5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[15px] font-semibold text-[var(--apple-black)]">{item.hospital}</span>
                                    {item.isEmailed && (
                                      <div 
                                        title={`Sent to: ${item.lastEmailedTo || 'Unknown'}\nOn: ${item.lastEmailedAt ? new Date(item.lastEmailedAt).toLocaleString() : 'Recently'}`}
                                        className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[10px] font-bold uppercase tracking-wider border border-blue-100 cursor-help"
                                      >
                                        <Mail size={10} /> SENT
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="py-4 px-5">
                                  <span className="text-[13px] text-[var(--apple-gray-5)] font-medium">{item.templateName}</span>
                                </td>
                                <td className="py-4 px-5">
                                  <span className="text-[13px] text-[var(--apple-gray-5)] font-medium">{item.date}</span>
                                </td>
                                <td className="py-4 px-5">
                                  <div className="flex items-center justify-end gap-2">
                                    {item.formData && (
                                      <>
                                        <button
                                          onClick={() => setPreviewingItem(item)}
                                          className="w-9 h-9 flex items-center justify-center bg-white border border-[var(--apple-gray-2)] rounded-full text-[var(--apple-gray-6)] hover:border-[var(--apple-gray-4)] hover:bg-[var(--apple-gray-1)] transition-all shadow-sm"
                                          title="View Entire Quotation"
                                        >
                                          <Eye size={16} />
                                        </button>
                                        <button
                                          onClick={() => setRegeneratingItem(item)}
                                          disabled={isGenerating || (regeneratingItem && regeneratingItem.id === item.id)}
                                          className="w-9 h-9 flex items-center justify-center bg-white border border-[var(--apple-gray-2)] rounded-full text-[var(--emerald)] hover:border-[var(--emerald)] hover:bg-[var(--emerald-light)] transition-all disabled:opacity-50 shadow-sm"
                                          title="Download PDF"
                                        >
                                          <Download size={16} />
                                        </button>

                                        <button 
                                          onClick={() => setRegeneratingItem({ ...item, _emailMode: true })}
                                          disabled={isGenerating || (regeneratingItem && regeneratingItem.id === item.id)}
                                          className="flex items-center gap-1 px-3 py-1.5 bg-teal-50 border border-teal-200 rounded-full text-teal-700 hover:bg-teal-100 font-bold text-[11.5px] transition-all disabled:opacity-50 shadow-2xs cursor-pointer"
                                          title="Resend email for this quotation"
                                        >
                                          <RotateCcw size={13} />
                                          <span>Resend</span>
                                        </button>
                                        
                                        {isManagementActive && (
                                          <>
                                            <button
                                              onClick={() => {
                                                setFormData(item.formData);
                                                setDraftContent(item.content || []);
                                                setView('drafting');
                                              }}
                                              className="w-9 h-9 flex items-center justify-center bg-white border border-[var(--apple-gray-2)] rounded-full text-[var(--apple-black)] hover:border-[var(--apple-gray-4)] hover:bg-[var(--apple-gray-1)] transition-all shadow-sm"
                                              title="Edit as Draft"
                                            >
                                              <Edit2 size={16} />
                                            </button>
                                            <button
                                              onClick={() => confirmDelete(async () => {
                                                setQuotationHistory(prev => prev.filter(h => h.id !== item.id));
                                                await syncItem('history', item, true);
                                              })}
                                              className="w-9 h-9 flex items-center justify-center text-[var(--apple-gray-4)] hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                                              title="Delete History Item"
                                            >
                                              <Trash2 size={18} />
                                            </button>
                                          </>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Mobile Card View */}
                    <div className="lg:hidden space-y-4">
                      {filtered.map((item) => (
                        <div key={item.id} className="apple-card p-5 space-y-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <p className="text-[16px] font-bold text-[var(--apple-black)] leading-tight">{item.hospital}</p>
                              <p className="text-[12px] text-[var(--apple-gray-5)] font-medium">{item.templateName}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className="text-[11px] font-bold text-[var(--emerald)] bg-[var(--emerald-light)] px-2 py-0.5 rounded uppercase tracking-wider">{(item.ref || '').replace('SRR/QUOT/', '')}</span>
                              {item.isEmailed && (
                                <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[9px] font-bold uppercase tracking-wider border border-blue-100">
                                  <Mail size={9} /> SENT
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[13px] text-[var(--apple-gray-5)] font-medium">
                            <span>{item.date}</span>
                          </div>
                          <div className="flex gap-2 pt-4 border-t border-[var(--apple-gray-2)]">
                            <button 
                              onClick={() => setPreviewingItem(item)}
                              className="flex-1 flex items-center justify-center gap-2 py-3 bg-[var(--apple-gray-1)] rounded-xl text-[var(--apple-gray-6)] active:scale-[0.95] transition-all"
                            >
                              <Eye size={18} />
                            </button>
                            <button 
                              onClick={() => setRegeneratingItem(item)}
                              disabled={isGenerating || (regeneratingItem && regeneratingItem.id === item.id)}
                              className="flex-1 flex items-center justify-center gap-2 py-3 bg-[var(--apple-gray-1)] rounded-xl text-[var(--emerald)] active:scale-[0.95] transition-all disabled:opacity-50"
                            >
                              <Download size={18} />
                            </button>
                            <button 
                              onClick={() => setRegeneratingItem({ ...item, _emailMode: true })}
                              disabled={isGenerating || (regeneratingItem && regeneratingItem.id === item.id)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-teal-50 border border-teal-200 rounded-xl text-teal-700 font-bold text-[12px] active:scale-[0.95] transition-all disabled:opacity-50 cursor-pointer"
                              title="Resend Email"
                            >
                              <RotateCcw size={16} />
                              <span>Resend</span>
                            </button>
                            {isManagementActive && (
                              <button 
                                onClick={() => {
                                  setFormData(item.formData);
                                  setDraftContent(item.content || []);
                                  setView('drafting');
                                }}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[var(--apple-gray-1)] rounded-xl text-[var(--apple-black)] active:scale-[0.95] transition-all"
                              >
                                <Edit2 size={18} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* VIEW: EMAIL HISTORY */}
        {view === 'emailHistory' && (
          <EmailHistoryView 
            history={emailHistory} 
            onResend={handleResendEmail}
            onDelete={async (id) => {
              confirmDelete(async () => {
                setEmailHistory(prev => prev.filter(h => h.id !== id));
                await deleteFileMetadata('emailHistory', id);
              });
            }}
          />
        )}



        {/* VIEW: DRIVE */}
        {view === 'drive' && (
          <div className="h-full overflow-y-auto px-4 py-4 md:px-8 md:py-6">
            <div className="max-w-4xl mx-auto">
              <header className="mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div>
                    <h1 className="apple-title-1 mb-2">Drive</h1>
                    <p className="apple-subtitle">Manage your business documents and vendor files.</p>
                  </div>
                  
                  {/* Storage Usage Bar */}
                  <div className="w-full md:w-72 bg-white rounded-2xl p-4 border border-[var(--apple-gray-2)] shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-[var(--apple-gray-5)] uppercase tracking-wider">Cloud Storage</span>
                        <button 
                          onClick={syncLegacyStorageSizes}
                          disabled={isSyncingStorage}
                          className={`p-1 hover:bg-[var(--apple-gray-1)] rounded-md transition-all ${isSyncingStorage ? 'animate-spin text-[var(--emerald)]' : 'text-[var(--apple-gray-4)]'}`}
                          title="Sync existing file sizes"
                        >
                          <RefreshCw size={12} />
                        </button>
                      </div>
                      <span className="text-[11px] font-bold text-[var(--apple-black)]">
                        {(() => {
                          const totalBytes = [
                            ...(driveFiles.srr || []),
                            ...(driveFiles.personal || []),
                            ...(driveFiles.vendor || []).flatMap(f => f.files || []),
                            ...(driveFiles.personalFolders || []).flatMap(f => f.files || [])
                          ].reduce((sum, f) => sum + (f.size || 0), 0);
                          
                          const formatBytes = (bytes) => {
                            if (bytes === 0) return '0 B';
                            const k = 1024;
                            const sizes = ['B', 'KB', 'MB', 'GB'];
                            const i = Math.floor(Math.log(bytes) / Math.log(k));
                            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                          };
                          
                          const limit = 5 * 1024 * 1024 * 1024; // 5GB
                          const percent = Math.min((totalBytes / limit) * 100, 100);
                          
                          return `${formatBytes(totalBytes)} / 5 GB`;
                        })()}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-[var(--apple-gray-1)] rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${
                          (() => {
                            const totalBytes = [
                              ...(driveFiles.srr || []),
                              ...(driveFiles.personal || []),
                              ...(driveFiles.vendor || []).flatMap(f => f.files || []),
                              ...(driveFiles.personalFolders || []).flatMap(f => f.files || [])
                            ].reduce((sum, f) => sum + (f.size || 0), 0);
                            const limit = 5 * 1024 * 1024 * 1024;
                            const percent = (totalBytes / limit) * 100;
                            if (percent > 90) return 'bg-red-500';
                            if (percent > 70) return 'bg-amber-500';
                            return 'bg-[var(--emerald)]';
                          })()
                        }`}
                        style={{ 
                          width: `${Math.min((([
                            ...(driveFiles.srr || []),
                            ...(driveFiles.personal || []),
                            ...(driveFiles.vendor || []).flatMap(f => f.files || []),
                            ...(driveFiles.personalFolders || []).flatMap(f => f.files || [])
                          ].reduce((sum, f) => sum + (f.size || 0), 0) / (5 * 1024 * 1024 * 1024)) * 100), 100)}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </header>

              {/* ── SRR DRIVE (HIGHLIGHTED) ── */}
              <div className="mb-12">
                <div className="relative overflow-hidden rounded-2xl border-2 border-[var(--emerald)] bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 mb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-[var(--emerald)] rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
                        <Award size={22} className="text-white" />
                      </div>
                      <div>
                        <h2 className="text-[20px] font-bold tracking-tight">SRR Drive</h2>
                        <p className="text-[13px] text-[var(--apple-gray-5)]">Business certificates & documents • {(driveFiles.srr || []).length} files</p>
                      </div>
                    </div>
                    <div>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => handleDriveUpload(e, 'drive_srr')} className="hidden" id="srr-drive-upload" />
                      <label htmlFor="srr-drive-upload" className="btn-primary cursor-pointer !bg-[var(--emerald)] !text-[13px] !py-2 !px-4">
                        <Plus size={16} /> Upload
                      </label>
                    </div>
                  </div>
                </div>

                {(driveFiles.srr || []).length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-emerald-200 rounded-xl bg-emerald-50/20">
                    <p className="text-[14px] text-[var(--apple-gray-4)]">No certificates uploaded yet</p>
                  </div>
                ) : (
                  <div className="apple-card overflow-hidden border-2 border-emerald-100">
                    {(driveFiles.srr || []).map((file, idx) => (
                      <div key={file.id} className="flex items-center justify-between px-5 py-3.5 border-b border-emerald-100 last:border-0 hover:bg-emerald-50/40 transition-colors">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <FileCheck size={18} className="text-[var(--emerald)] flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold text-[var(--apple-black)] truncate">{file.label}</p>
                            <p className="text-[11px] text-[var(--apple-gray-4)]">{file.fileName} • {file.uploadedAt}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                          <button 
                            onClick={() => setPreviewingDoc(file)}
                            className="w-8 h-8 flex items-center justify-center text-[var(--apple-gray-4)] hover:text-[var(--emerald)] rounded-lg transition-colors"
                            title="View Document"
                          >
                            <Eye size={15} />
                          </button>
                          <button 
                            onClick={() => printDocument(file.data, file.label || file.fileName, file.type)}
                            className="w-8 h-8 flex items-center justify-center text-[var(--apple-gray-4)] hover:text-[var(--emerald)] rounded-lg transition-colors"
                            title="Print Document"
                          >
                            <Printer size={15} />
                          </button>
                          <button 
                            onClick={async () => {
                              const res = await shareDocument(file.data, file.label || file.fileName);
                              if (res && res.success) {
                                if (res.method === 'clipboard') {
                                  showAlert('Copied to Clipboard', 'Document link has been copied to your clipboard.', 'success');
                                }
                              } else {
                                showAlert('Share Failed', 'Could not copy link or share.', 'error');
                              }
                            }}
                            className="w-8 h-8 flex items-center justify-center text-[var(--apple-gray-4)] hover:text-[var(--emerald)] rounded-lg transition-colors"
                            title="Share Document"
                          >
                            <Share2 size={15} />
                          </button>
                          <a href={file.data} download={file.fileName} className="w-8 h-8 flex items-center justify-center text-[var(--apple-gray-4)] hover:text-[var(--emerald)] rounded-lg transition-colors" title="Download">
                            <Download size={15} />
                          </a>
                          {isManagementActive && (
                            <button onClick={() => confirmDelete(async () => {
                              setDriveFiles(prev => ({ ...prev, srr: prev.srr.filter(f => f.id !== file.id) }));
                              await syncItem('drive_srr', file, true);
                            })} className="w-8 h-8 flex items-center justify-center text-[var(--apple-gray-4)] hover:text-red-500 rounded-lg transition-colors" title="Delete">
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── VENDOR DOCUMENTS (FOLDER BASED) ── */}
              <div className="mb-12">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[var(--apple-gray-1)] rounded-xl flex items-center justify-center">
                      <FolderOpen size={20} className="text-[var(--apple-gray-6)]" />
                    </div>
                    <div>
                      <h2 className="text-[20px] font-bold tracking-tight">Vendor Documents</h2>
                      <p className="text-[13px] text-[var(--apple-gray-5)]">{(driveFiles.vendor || []).length} vendors</p>
                    </div>
                  </div>
                  {!openVendorFolder && (
                    <button onClick={async () => {
                      const name = prompt('Enter vendor/folder name:');
                      if (!name) return;
                      const newFolder = { id: Date.now().toString(), name, createdAt: new Date().toLocaleDateString('en-GB'), files: [] };
                      setDriveFiles(prev => ({ ...prev, vendor: [...(prev.vendor || []), newFolder] }));
                      await syncItem('drive_folders', newFolder);
                    }} className="btn-outline !text-[13px] !py-2 !px-4">
                      <Plus size={16} /> New Folder
                    </button>
                  )}
                </div>

                {!openVendorFolder ? (
                  /* ── FOLDER GRID ── */
                  (driveFiles.vendor || []).length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-[var(--apple-gray-3)] rounded-xl">
                      <p className="text-[14px] text-[var(--apple-gray-4)]">No vendor folders yet. Create one to get started.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {(driveFiles.vendor || []).map(folder => (
                        <div key={folder.id} className="apple-card p-5 cursor-pointer hover:border-[var(--apple-gray-4)] transition-all group" onClick={() => setOpenVendorFolder(folder.id)}>
                          <div className="flex flex-col items-center text-center">
                            <Folder size={44} className="text-amber-400 mb-3 group-hover:scale-110 transition-transform" fill="currentColor" />
                            <p className="text-[14px] font-semibold text-[var(--apple-black)] truncate w-full">{folder.name}</p>
                            <p className="text-[11px] text-[var(--apple-gray-4)] mt-1">{(folder.files || []).length} files</p>
                          </div>
                          <div className="flex items-center justify-center gap-1 mt-3 pt-3 border-t border-[var(--apple-gray-2)]">
                            <button onClick={(e) => { e.stopPropagation(); downloadFolderAsZip(folder); }} className="w-8 h-8 flex items-center justify-center text-[var(--apple-gray-4)] hover:text-[var(--apple-black)] rounded-lg transition-colors" title="Download folder as ZIP">
                              <Download size={14} />
                            </button>
                            {isManagementActive && (
                              <button onClick={(e) => {
                                e.stopPropagation(); confirmDelete(async () => {
                                  setDriveFiles(prev => ({ ...prev, vendor: prev.vendor.filter(f => f.id !== folder.id) }));
                                  await syncItem('drive_folders', folder, true);
                                });
                              }} className="w-8 h-8 flex items-center justify-center text-[var(--apple-gray-4)] hover:text-red-500 rounded-lg transition-colors" title="Delete folder">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  /* ── INSIDE A FOLDER ── */
                  (() => {
                    const folder = (driveFiles.vendor || []).find(f => f.id === openVendorFolder);
                    if (!folder) { setOpenVendorFolder(null); return null; }
                    return (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <button onClick={() => setOpenVendorFolder(null)} className="flex items-center gap-1 text-[13px] font-semibold text-[var(--emerald)] hover:opacity-80">
                            <ChevronLeft size={16} /> Back to folders
                          </button>
                          <div className="flex items-center gap-2">
                            <button onClick={() => downloadFolderAsZip(folder)} className="btn-outline !text-[12px] !py-1.5 !px-3">
                              <Download size={14} /> Download All
                            </button>
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => handleDriveUpload(e, 'drive_vendor_files', folder.id)} className="hidden" id="vendor-folder-upload" />
                            <label htmlFor="vendor-folder-upload" className="btn-primary cursor-pointer !text-[12px] !py-1.5 !px-3">
                              <Plus size={14} /> Add File
                            </label>
                          </div>
                        </div>

                        <div className="apple-card p-5 mb-4 flex items-center gap-3 bg-amber-50/50 border-amber-200">
                          <Folder size={28} className="text-amber-400" fill="currentColor" />
                          <div>
                            <p className="text-[17px] font-bold">{folder.name}</p>
                            <p className="text-[12px] text-[var(--apple-gray-5)]">{(folder.files || []).length} files • Created {folder.createdAt}</p>
                          </div>
                        </div>

                        {(folder.files || []).length === 0 ? (
                          <div className="text-center py-10 border border-dashed border-[var(--apple-gray-3)] rounded-xl">
                            <p className="text-[14px] text-[var(--apple-gray-4)]">This folder is empty. Add files above.</p>
                          </div>
                        ) : (
                          <div className="apple-card overflow-hidden">
                            {(folder.files || []).map(file => (
                              <div key={file.id} className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--apple-gray-2)] last:border-0 hover:bg-[var(--apple-gray-1)] transition-colors">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <FileText size={18} className="text-[var(--apple-gray-5)] flex-shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-[14px] font-semibold text-[var(--apple-black)] truncate">{file.fileName}</p>
                                    <p className="text-[11px] text-[var(--apple-gray-4)]">{file.uploadedAt}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                                  <button 
                                    onClick={() => setPreviewingDoc(file)}
                                    className="w-8 h-8 flex items-center justify-center text-[var(--apple-gray-4)] hover:text-[var(--apple-black)] rounded-lg transition-colors"
                                    title="View Document"
                                  >
                                    <Eye size={15} />
                                  </button>
                                  <button 
                                    onClick={() => printDocument(file.data, file.label || file.fileName, file.type)}
                                    className="w-8 h-8 flex items-center justify-center text-[var(--apple-gray-4)] hover:text-[var(--apple-black)] rounded-lg transition-colors"
                                    title="Print Document"
                                  >
                                    <Printer size={15} />
                                  </button>
                                  <button 
                                    onClick={async () => {
                                      const res = await shareDocument(file.data, file.label || file.fileName);
                                      if (res && res.success) {
                                        if (res.method === 'clipboard') {
                                          showAlert('Copied to Clipboard', 'Document link has been copied to your clipboard.', 'success');
                                        }
                                      } else {
                                        showAlert('Share Failed', 'Could not copy link or share.', 'error');
                                      }
                                    }}
                                    className="w-8 h-8 flex items-center justify-center text-[var(--apple-gray-4)] hover:text-[var(--apple-black)] rounded-lg transition-colors"
                                    title="Share Document"
                                  >
                                    <Share2 size={15} />
                                  </button>
                                  <a href={file.data} download={file.fileName} className="w-8 h-8 flex items-center justify-center text-[var(--apple-gray-4)] hover:text-[var(--apple-black)] rounded-lg transition-colors" title="Download">
                                    <Download size={15} />
                                  </a>
                                  {isManagementActive && (
                                    <button onClick={() => confirmDelete(async () => {
                                      setDriveFiles(prev => ({ ...prev, vendor: prev.vendor.map(f => f.id === folder.id ? { ...f, files: f.files.filter(fi => fi.id !== file.id) } : f) }));
                                      await syncItem('drive_vendor_files', file, true);
                                    })} className="w-8 h-8 flex items-center justify-center text-[var(--apple-gray-4)] hover:text-red-500 rounded-lg transition-colors" title="Delete">
                                      <Trash2 size={15} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>

              {/* ── PERSONAL DRIVE ── */}
              <div className="mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="relative overflow-hidden rounded-2xl border-2 border-indigo-500 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-6 mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
                          <ShieldCheck size={22} className="text-white" />
                        </div>
                        <div>
                          <h2 className="text-[18px] md:text-[20px] font-bold tracking-tight text-indigo-900">Personal Space</h2>
                          <p className="text-[12px] md:text-[13px] text-indigo-600 font-medium">Private storage for personal documents</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {!openPersonalFolder && (
                          <button onClick={async () => {
                            const name = prompt('Enter folder name:');
                            if (!name) return;
                            const newFolder = { id: Date.now().toString(), name, type: 'drive_personal_folders', createdAt: new Date().toLocaleDateString('en-GB'), files: [] };
                            setDriveFiles(prev => ({ ...prev, personalFolders: [...(prev.personalFolders || []), newFolder] }));
                            await syncItem('drive_personal_folders', newFolder);
                          }} className="btn-outline !text-indigo-600 !border-indigo-200 !bg-indigo-50/50 !py-2 !px-4 hover:!bg-indigo-100 transition-all text-[13px]">
                            <Plus size={16} /> New Folder
                          </button>
                        )}
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => handleDriveUpload(e, 'drive_personal')} className="hidden" id="personal-drive-upload" />
                        <label htmlFor="personal-drive-upload" className="btn-primary cursor-pointer !bg-indigo-600 !text-[13px] !py-2 !px-4">
                          <Plus size={16} /> Upload Private
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Personal Folders Grid */}
                  {!openPersonalFolder ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                      {(driveFiles.personalFolders || []).map(folder => (
                        <div key={folder.id} className="apple-card p-5 cursor-pointer border-indigo-100 hover:border-indigo-400 transition-all group" onClick={() => setOpenPersonalFolder(folder.id)}>
                          <div className="flex flex-col items-center text-center">
                            <Folder size={44} className="text-indigo-400 mb-3 group-hover:scale-110 transition-transform" fill="currentColor" />
                            <p className="text-[14px] font-semibold text-indigo-900 truncate w-full">{folder.name}</p>
                            <p className="text-[11px] text-indigo-400 mt-1">{(folder.files || []).length} files</p>
                          </div>
                          <div className="flex items-center justify-center gap-1 mt-3 pt-3 border-t border-indigo-50">
                            <button onClick={(e) => { e.stopPropagation(); downloadFolderAsZip(folder); }} className="w-8 h-8 flex items-center justify-center text-indigo-300 hover:text-indigo-600 rounded-lg transition-colors" title="Download ZIP">
                              <Download size={14} />
                            </button>
                            <button onClick={(e) => {
                              e.stopPropagation(); handleDeleteFolder(folder, 'drive_personal_folders');
                            }} className="w-8 h-8 flex items-center justify-center text-indigo-200 hover:text-red-500 rounded-lg transition-colors" title="Delete folder">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Inside Personal Folder */
                    (() => {
                      const folder = (driveFiles.personalFolders || []).find(f => f.id === openPersonalFolder);
                      if (!folder) { setOpenPersonalFolder(null); return null; }
                      return (
                        <div className="mb-8 animate-in fade-in slide-in-from-left-4 duration-300">
                          <div className="flex items-center justify-between mb-4">
                            <button onClick={() => setOpenPersonalFolder(null)} className="flex items-center gap-1 text-[13px] font-semibold text-indigo-600 hover:opacity-80">
                              <ChevronLeft size={16} /> Back to Space
                            </button>
                            <div className="flex items-center gap-2">
                              <button onClick={() => downloadFolderAsZip(folder)} className="btn-outline !text-indigo-600 !border-indigo-200 !py-1.5 !px-3">
                                <Download size={14} /> Download All
                              </button>
                              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => handleDriveUpload(e, 'drive_personal_files', folder.id)} className="hidden" id="personal-folder-upload" />
                              <label htmlFor="personal-folder-upload" className="btn-primary cursor-pointer !bg-indigo-600 !text-[12px] !py-1.5 !px-3">
                                <Plus size={14} /> Add Private File
                              </label>
                            </div>
                          </div>

                          <div className="apple-card p-5 mb-4 flex items-center gap-3 bg-indigo-50/50 border-indigo-200">
                            <Folder size={28} className="text-indigo-400" fill="currentColor" />
                            <div>
                              <p className="text-[17px] font-bold text-indigo-900">{folder.name}</p>
                              <p className="text-[12px] text-indigo-500">{(folder.files || []).length} files • Created {folder.createdAt}</p>
                            </div>
                          </div>

                          {(folder.files || []).length === 0 ? (
                            <div className="text-center py-10 border border-dashed border-indigo-200 rounded-xl">
                              <p className="text-[14px] text-indigo-300">This folder is empty. Add files above.</p>
                            </div>
                          ) : (
                            <div className="apple-card overflow-hidden border-indigo-100">
                              {(folder.files || []).map(file => (
                                <div key={file.id} className="flex items-center justify-between px-5 py-3.5 border-b border-indigo-50 last:border-0 hover:bg-indigo-50/30 transition-colors">
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <FileText size={18} className="text-indigo-400 flex-shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-[14px] font-semibold text-indigo-900 truncate">{file.fileName}</p>
                                      <p className="text-[11px] text-indigo-400">{file.uploadedAt}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                                    <button 
                                      onClick={() => setPreviewingDoc(file)}
                                      className="w-8 h-8 flex items-center justify-center text-indigo-300 hover:text-indigo-600 rounded-lg transition-colors"
                                      title="View Document"
                                    >
                                      <Eye size={15} />
                                    </button>
                                    <button 
                                      onClick={() => printDocument(file.data, file.label || file.fileName, file.type)}
                                      className="w-8 h-8 flex items-center justify-center text-indigo-300 hover:text-indigo-600 rounded-lg transition-colors"
                                      title="Print Document"
                                    >
                                      <Printer size={15} />
                                    </button>
                                    <button 
                                      onClick={async () => {
                                        const res = await shareDocument(file.data, file.label || file.fileName);
                                        if (res && res.success) {
                                          if (res.method === 'clipboard') {
                                            showAlert('Copied to Clipboard', 'Document link has been copied to your clipboard.', 'success');
                                          }
                                        } else {
                                          showAlert('Share Failed', 'Could not copy link or share.', 'error');
                                        }
                                      }}
                                      className="w-8 h-8 flex items-center justify-center text-indigo-300 hover:text-indigo-600 rounded-lg transition-colors"
                                      title="Share Document"
                                    >
                                      <Share2 size={15} />
                                    </button>
                                    <a href={file.data} download={file.fileName} className="w-8 h-8 flex items-center justify-center text-indigo-300 hover:text-indigo-600 rounded-lg transition-colors" title="Download">
                                      <Download size={15} />
                                    </a>
                                    <button onClick={() => handleDeleteDriveFile('drive_personal_files', file)} className="w-8 h-8 flex items-center justify-center text-indigo-200 hover:text-red-500 rounded-lg transition-colors" title="Delete">
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}

                  {/* Standalone Personal Files */}
                  {!openPersonalFolder && (
                    <>
                      <h3 className="text-[14px] font-bold text-indigo-900/60 uppercase tracking-widest mb-4 px-1">Independent Files</h3>
                      {(driveFiles.personal || []).length === 0 ? (
                        <div className="text-center py-10 border-2 border-dashed border-indigo-100 rounded-xl bg-indigo-50/10">
                          <p className="text-[14px] text-indigo-200">No independent files</p>
                        </div>
                      ) : (
                        <div className="apple-card overflow-hidden border-2 border-indigo-100">
                          {(driveFiles.personal || []).map((file, idx) => (
                            <div key={file.id} className="flex items-center justify-between px-5 py-3.5 border-b border-indigo-100 last:border-0 hover:bg-indigo-50/40 transition-colors">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                                  <FileText size={16} className="text-indigo-600" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[14px] font-semibold text-indigo-900 truncate">{file.label}</p>
                                  <p className="text-[11px] text-indigo-400 font-medium">{file.fileName} • {file.uploadedAt}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                                <button 
                                  onClick={() => setPreviewingDoc(file)}
                                  className="w-8 h-8 flex items-center justify-center text-indigo-300 hover:text-indigo-600 rounded-lg transition-colors"
                                  title="View Document"
                                >
                                  <Eye size={15} />
                                </button>
                                <button 
                                  onClick={() => printDocument(file.data, file.label || file.fileName, file.type)}
                                  className="w-8 h-8 flex items-center justify-center text-indigo-300 hover:text-indigo-600 rounded-lg transition-colors"
                                  title="Print Document"
                                >
                                  <Printer size={15} />
                                </button>
                                <button 
                                  onClick={async () => {
                                    const res = await shareDocument(file.data, file.label || file.fileName);
                                    if (res && res.success) {
                                      if (res.method === 'clipboard') {
                                        showAlert('Copied to Clipboard', 'Document link has been copied to your clipboard.', 'success');
                                      }
                                    } else {
                                      showAlert('Share Failed', 'Could not copy link or share.', 'error');
                                    }
                                  }}
                                  className="w-8 h-8 flex items-center justify-center text-indigo-300 hover:text-indigo-600 rounded-lg transition-colors"
                                  title="Share Document"
                                >
                                  <Share2 size={15} />
                                </button>
                                <a href={file.data} download={file.fileName} className="w-8 h-8 flex items-center justify-center text-indigo-300 hover:text-indigo-600 rounded-lg transition-colors" title="Download">
                                  <Download size={15} />
                                </a>
                                <button onClick={() => confirmDelete(async () => {
                                  setDriveFiles(prev => ({ ...prev, personal: prev.personal.filter(f => f.id !== file.id) }));
                                  await syncItem('drive_personal', file, true);
                                })} className="w-8 h-8 flex items-center justify-center text-indigo-300 hover:text-red-500 rounded-lg transition-colors" title="Delete">
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

        {/* VIEW: PRICE LISTS */}
        {view === 'pricelists' && (
          <div className="h-full overflow-y-auto px-4 py-4 md:px-8 md:py-6">
            <div className="max-w-6xl mx-auto">
              <header className="flex flex-col md:flex-row md:items-end justify-between mb-4 md:mb-6 gap-4">
                <div>
                  <h1 className="apple-title-1 mb-2">Price Lists</h1>
                  <p className="apple-subtitle">Manage and access manufacturer price lists. <span className="font-semibold text-[var(--apple-black)]">{priceLists.filter(p => isManagementActive || !p.hidden).length}</span> total</p>
                </div>
                <div>
                  <input type="file" onChange={(e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const label = prompt('Enter a name for this Price List (e.g. Stryker 2024):');
                    if (!label) { e.target.value = ''; return; }
                    const newItem = { id: Date.now().toString(), label, fileName: file.name, uploadedAt: new Date().toLocaleDateString('en-GB') };
                    syncItem('price_lists', newItem, false, file).then(success => {
                      if (success) setPriceLists(prev => [...prev, newItem]);
                    });
                    e.target.value = '';
                  }} className="hidden" id="price-list-upload" />
                  <label htmlFor="price-list-upload" className="btn-primary cursor-pointer">
                    <Plus size={18} /> Upload List
                  </label>
                </div>
              </header>

              <div>
                <div className="grid gap-3">
                  {priceLists
                    .filter(item => isManagementActive || !item.hidden)
                    .map(item => (
                      <div 
                        key={item.id} 
                        className={`apple-card p-5 flex items-center justify-between hover:border-[var(--apple-gray-4)] transition-all ${
                          item.hidden ? 'opacity-60 bg-[var(--apple-gray-1)]' : ''
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 bg-[var(--apple-gray-1)] rounded-xl flex items-center justify-center">
                            <FileText size={22} className="text-[var(--apple-black)]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-[16px] font-bold text-[var(--apple-black)] leading-tight">{item.label}</p>
                              {item.hidden && (
                                <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">Hidden</span>
                              )}
                            </div>
                            <p className="text-[12px] text-[var(--apple-gray-5)] mt-1">{item.fileName} • {item.uploadedAt}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setPreviewingDoc({ ...item, type: 'application/pdf' })} 
                            className="w-9 h-9 flex items-center justify-center text-[var(--apple-gray-5)] hover:text-[var(--apple-black)] hover:bg-[var(--apple-gray-1)] rounded-lg transition-all" 
                            title="View Document"
                          >
                            <Eye size={18} />
                          </button>
                          <a href={item.data} download={item.fileName} className="w-9 h-9 flex items-center justify-center text-[var(--apple-gray-5)] hover:text-[var(--apple-black)] hover:bg-[var(--apple-gray-1)] rounded-lg transition-all" title="Download">
                            <Download size={18} />
                          </a>
                          {isManagementActive && (
                            <>
                              <button 
                                onClick={async () => {
                                  const updatedItem = { ...item, hidden: !item.hidden };
                                  setPriceLists(prev => prev.map(p => p.id === item.id ? updatedItem : p));
                                  await syncItem('price_lists', updatedItem, false);
                                }}
                                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
                                  item.hidden 
                                    ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50' 
                                    : 'text-[var(--apple-gray-4)] hover:text-[var(--apple-black)] hover:bg-[var(--apple-gray-1)]'
                                }`}
                                title={item.hidden ? "Show in Menu" : "Hide from Menu"}
                              >
                                {item.hidden ? <EyeOff size={18} /> : <Eye size={18} />}
                              </button>
                              <button 
                                onClick={() => confirmDelete(async () => {
                                  setPriceLists(prev => prev.filter(p => p.id !== item.id));
                                  await syncItem('price_lists', item, true);
                                })}
                                className="w-9 h-9 flex items-center justify-center text-[var(--apple-gray-4)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                title="Delete"
                              >
                                <Trash2 size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  {priceLists.filter(item => isManagementActive || !item.hidden).length === 0 && (
                    <div className="text-center py-16 bg-white border border-dashed border-[var(--apple-gray-3)] rounded-2xl">
                      <p className="text-[15px] text-[var(--apple-gray-4)]">No price lists available.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: SETTINGS */}
        {view === 'settings' && (
          <div className="h-full overflow-y-auto px-4 py-4 md:px-8 md:py-6">
            <div className="max-w-4xl mx-auto">
              <header className="mb-4 md:mb-6">
                <h1 className="apple-title-1">Settings</h1>
                <p className="apple-subtitle">Manage your company profile and application preferences.</p>
              </header>

              <div className="apple-card p-8">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="apple-label">Company Name</label>
                      <input
                        type="text"
                        value={companyData.name}
                        onChange={e => setCompanyData({ ...companyData, name: e.target.value })}
                        className="apple-input"
                      />
                    </div>
                    <div>
                      <label className="apple-label">Email Address</label>
                      <input
                        type="email"
                        value={companyData.email}
                        onChange={e => setCompanyData({ ...companyData, email: e.target.value })}
                        className="apple-input"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="apple-label">Company Address</label>
                    <textarea
                      rows="3"
                      value={companyData.address}
                      onChange={e => setCompanyData({ ...companyData, address: e.target.value })}
                      className="apple-input"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="apple-label">Phone Numbers</label>
                      <input
                        type="text"
                        value={companyData.phone}
                        onChange={e => setCompanyData({ ...companyData, phone: e.target.value })}
                        className="apple-input"
                      />
                    </div>
                    <div>
                      <label className="apple-label">Website</label>
                      <input
                        type="text"
                        value={companyData.website}
                        onChange={e => setCompanyData({ ...companyData, website: e.target.value })}
                        className="apple-input"
                      />
                    </div>
                  </div>
                  <div className="pt-6 border-t border-[var(--apple-gray-2)] space-y-6">
                    <h3 className="text-[14px] font-bold text-[var(--apple-black)] uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Award size={16} className="text-[var(--accent)]" />
                      Authorized Signatory
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="apple-label">Signatory Name</label>
                        <input
                          type="text"
                          value={companyData.signatoryName || ''}
                          onChange={e => setCompanyData({ ...companyData, signatoryName: e.target.value })}
                          className="apple-input"
                          placeholder="e.g. A. Padmavathi"
                        />
                      </div>
                      <div>
                        <label className="apple-label">Signatory Designation / Role</label>
                        <input
                          type="text"
                          value={companyData.signatoryRole || ''}
                          onChange={e => setCompanyData({ ...companyData, signatoryRole: e.target.value })}
                          className="apple-input"
                          placeholder="e.g. Proprietor"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-6 p-6 bg-[var(--apple-gray-1)] rounded-2xl border border-[var(--apple-gray-2)]">
                      <div className="flex-1 space-y-3">
                        <div>
                          <p className="text-[14px] font-bold text-[var(--apple-black)]">Upload Signature Image</p>
                          <p className="text-[12px] text-[var(--apple-gray-5)] mt-1">
                            Recommended format: PNG with transparent background. Max size 200KB.
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <label className="btn-outline !py-2.5 cursor-pointer flex items-center gap-2 select-none">
                            <UploadCloud size={16} />
                            Choose Image
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if (!file) return;
                                if (file.size > 204800) {
                                  showAlert('File Too Large', 'Please upload a signature image under 200KB.', 'error');
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onload = () => {
                                  setCompanyData(prev => ({
                                    ...prev,
                                    signature: reader.result
                                  }));
                                };
                                reader.readAsDataURL(file);
                              }}
                            />
                          </label>
                          
                          {companyData.signature && (
                            <button
                              onClick={() => setCompanyData(prev => ({ ...prev, signature: '' }))}
                              className="text-[12px] font-bold text-red-500 hover:underline cursor-pointer"
                            >
                              Remove Image
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="w-48 h-20 bg-white border border-[var(--apple-gray-3)] rounded-xl flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                        {companyData.signature ? (
                          <img 
                            src={companyData.signature} 
                            alt="Signature Preview" 
                            className="max-w-full max-h-full object-contain p-2" 
                          />
                        ) : (
                          <span className="text-[11px] text-[var(--apple-gray-4)] italic">No signature uploaded</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-[var(--apple-gray-2)]">
                    <button
                      onClick={async () => {
                        setSyncStatus('syncing');
                        const success = await saveCompanyData(companyData);
                        if (success) {
                          setSyncStatus('saved');
                          showAlert('Settings Updated', 'Company settings have been saved to the cloud successfully.', 'success');
                        } else {
                          setSyncStatus('error');
                          showAlert('Sync Failed', 'Failed to save settings to the cloud. Please try again.', 'error');
                        }
                      }}
                      className="btn-primary"
                    >
                      <Save size={18} /> Save Settings
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* VIEW: EMAILER */}
        {view === 'emailer' && (
          <div className="h-full w-full overflow-y-auto relative">
            <button
              onClick={() => refreshData()}
              className="absolute top-6 right-8 z-10 flex items-center gap-2 px-4 py-2 bg-white border border-[var(--apple-gray-3)] rounded-full text-[13px] font-bold text-[var(--apple-gray-6)] hover:bg-[var(--apple-gray-1)] transition-all shadow-sm"
            >
              <ArrowRight className={syncStatus === 'syncing' ? 'animate-spin' : ''} size={16} />
              {syncStatus === 'syncing' ? 'Refreshing...' : 'Refresh Files'}
            </button>
            <EmailerView 
              driveFiles={driveFiles} 
              priceLists={priceLists} 
              emailHistory={emailHistory}
              quotationHistory={quotationHistory}
              initialForm={resendEmailForm}
              onEmailSent={async (item) => {
                setEmailHistory(prev => [item, ...prev]);
                await saveEmailHistoryItem(item);
                setResendEmailForm(null);
                setView('history');
              }}
              showAlert={showAlert}
              showConfirm={showConfirm}
              showPrompt={showPrompt}
            />
          </div>
        )}
      </main>

      {/* UPLOAD PROGRESS OVERLAY */}
      {isUploading && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
          <div className="bg-white/90 backdrop-blur-xl shadow-2xl border border-white rounded-[32px] p-6 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                  <UploadCloud size={24} strokeWidth={1.5} className="animate-bounce" />
                </div>
                <div>
                  <h4 className="text-[16px] font-bold text-[var(--apple-black)] tracking-tight">Syncing to Cloud</h4>
                  <p className="text-[12px] text-[var(--apple-gray-5)] font-medium">Securing your document...</p>
                </div>
              </div>
              <span className="text-[18px] font-black text-emerald-600 tabular-nums">{Math.round(uploadProgress)}%</span>
            </div>

            <div className="w-full h-1.5 bg-emerald-100/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300 ease-out shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>

            {uploadProgress === 100 && (
              <div className="flex items-center justify-center gap-2 text-[12px] font-bold text-emerald-600 animate-in zoom-in duration-300">
                <FileCheck size={16} /> Securely Uploaded
              </div>
            )}
          </div>
        </div>
      )}

      {/* HIDDEN EXPORT TEMPLATE FOR PDF GENERATION */}
      <div 
        aria-hidden="true"
        style={{ 
          position: 'fixed', 
          left: '-9999px', 
          top: '0px', 
          width: '794px', 
          height: '1123px', 
          overflow: 'hidden', 
          backgroundColor: '#ffffff', 
          zIndex: -9999, 
          pointerEvents: 'none' 
        }}
      >
        <QuotationTemplate 
          id="pdf-export-template" 
          data={formData} 
          content={draftContent} 
          company={companyData} 
          isPdfPrinting={true} 
          forceScale={1} 
        />
      </div>

      {/* HIDDEN REGENERATION TEMPLATE */}
      {regeneratingItem && (
        <div 
          aria-hidden="true"
          style={{ 
            position: 'fixed', 
            left: '-9999px', 
            top: '0px', 
            width: '794px', 
            height: '1123px', 
            overflow: 'hidden', 
            backgroundColor: '#ffffff', 
            zIndex: -9999, 
            pointerEvents: 'none' 
          }}
        >
          <QuotationTemplate 
            id="history-quotation-template" 
            data={regeneratingItem.formData} 
            content={regeneratingItem.content || []} 
            company={companyData} 
            isPdfPrinting={true} 
            forceScale={1} 
          />
        </div>
      )}
      {/* PREVIEW MODAL */}
      {previewingItem && (
        <div className="fixed inset-0 z-[6000] flex flex-col bg-[var(--apple-bg)] animate-in slide-in-from-bottom duration-500">
          <header className="flex-none flex items-center justify-between px-4 md:px-12 py-4 md:py-6 bg-white/80 backdrop-blur-md border-b border-[var(--apple-gray-3)] sticky top-0 z-10">
            <div>
              <h2 className="text-[18px] md:text-[24px] font-bold text-[var(--apple-black)] tracking-tight leading-none">Quotation Preview</h2>
              <p className="text-[11px] md:text-[13px] text-[var(--apple-gray-5)] mt-1 font-medium">{previewingItem.formData?.hospitalName} | {previewingItem.ref}</p>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              {/* Zoom Controls */}
              <div className="hidden md:flex items-center bg-white border border-[var(--apple-gray-3)] rounded-full px-2 py-1 mr-4 shadow-sm">
                <button 
                  onClick={() => setPreviewScale(prev => Math.max(0.5, prev - 0.1))}
                  className="w-8 h-8 flex items-center justify-center hover:bg-[var(--apple-gray-1)] rounded-full transition-all"
                >
                  <Plus className="rotate-45" size={16} />
                </button>
                <span className="text-[11px] font-bold w-12 text-center text-[var(--apple-gray-6)]">{Math.round(previewScale * 100)}%</span>
                <button 
                  onClick={() => setPreviewScale(prev => Math.min(2, prev + 0.1))}
                  className="w-8 h-8 flex items-center justify-center hover:bg-[var(--apple-gray-1)] rounded-full transition-all"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Mobile Zoom Toggle */}
              <button 
                onClick={() => setPreviewScale(prev => prev === 1 ? 0.5 : 1)}
                className="md:hidden w-10 h-10 flex items-center justify-center bg-white border border-[var(--apple-gray-3)] rounded-full text-[var(--apple-black)] hover:bg-[var(--apple-gray-1)] transition-all"
              >
                <Search size={18} />
              </button>

              <button 
                onClick={() => setRegeneratingItem(previewingItem)}
                className="w-10 h-10 flex items-center justify-center bg-white border border-[var(--apple-gray-3)] rounded-full text-[var(--emerald)] hover:bg-[var(--emerald-light)] transition-all"
                title="Download PDF"
              >
                <Download size={20} />
              </button>
              <button 
                onClick={() => {
                  setPreviewingItem(null);
                  setPreviewScale(1);
                }}
                className="w-10 h-10 flex items-center justify-center bg-white border border-[var(--apple-gray-3)] rounded-full text-[var(--apple-gray-5)] hover:bg-[var(--apple-gray-1)] transition-all"
              >
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-2 md:p-12 bg-[var(--apple-bg)]">
            <div className="min-w-fit md:max-w-5xl mx-auto flex flex-col items-center gap-12">
              <div className="shadow-2xl bg-white p-0 md:p-4 rounded-xl overflow-hidden">
                <QuotationTemplate 
                  data={previewingItem.formData} 
                  content={previewingItem.content || []} 
                  company={companyData} 
                  forceScale={previewScale}
                />
              </div>

              {/* Price List Attachment Visual Indicator (Matching Canvas Style) */}
              {previewingItem.formData?.priceListId && (
                <div className="w-[210mm] min-h-[500px] bg-white shadow-2xl flex flex-col items-center justify-center border border-[var(--apple-gray-3)] relative overflow-hidden mb-12">
                   <div className="absolute top-6 left-6 bg-[var(--emerald)] text-white text-[10px] font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm z-10">
                      Attached Price List
                   </div>
                   
                   {previewPriceListUrl ? (
                     <iframe 
                       src={previewPriceListUrl + '#toolbar=0&navpanes=0&view=FitH'} 
                       className="w-full h-[1100px] border-none" 
                       title="Price List Preview" 
                     />
                   ) : (
                     <div className="flex flex-col items-center gap-4 py-20 px-12 text-center">
                        <div className="w-20 h-20 bg-[var(--apple-gray-1)] rounded-3xl flex items-center justify-center mb-4">
                          <FileCheck size={40} className="text-[var(--emerald)] animate-pulse" />
                        </div>
                        <h3 className="text-[20px] font-bold text-[var(--apple-black)] tracking-tight">
                           {priceLists.find(pl => pl.id === previewingItem.formData.priceListId)?.label || 'Product Catalog'}
                        </h3>
                        <p className="text-[14px] text-[var(--apple-gray-5)] max-w-sm">
                           Loading actual PDF preview from Google Drive...
                        </p>
                        <div className="mt-8 px-6 py-2.5 bg-[var(--emerald-light)] text-[var(--emerald)] text-[12px] font-bold uppercase tracking-widest border border-[var(--emerald)] rounded-xl">
                           Ready for Dispatch
                        </div>
                     </div>
                   )}
                </div>
              )}
            </div>
          </main>
        </div>
      )}
      {/* GLOBAL EMAIL COMPOSER OVERLAY */}
      {showEmailComposer && (
        <div className="fixed inset-0 z-[2000] flex flex-col bg-slate-900/60 backdrop-blur-sm animate-in slide-in-from-bottom duration-300 overflow-y-auto p-3 sm:p-6 lg:p-8">
          <div className="w-full max-w-6xl mx-auto bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 my-auto">
            <header className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shadow-2xs shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center text-white shadow-xs">
                  <Mail size={18} />
                </div>
                <div>
                  <h3 className="text-[16px] font-extrabold text-slate-900">Compose Email</h3>
                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">New Dispatched Document</p>
                </div>
              </div>
              <button 
                onClick={() => setShowEmailComposer(false)}
                className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all shadow-xs"
                title="Close Modal"
              >
                <Plus className="rotate-45" size={20} />
              </button>
            </header>
            
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
              <EmailerView 
                key={emailForm.subject + '-' + emailForm.selectedDriveFiles.length}
                driveFiles={driveFiles}
                priceLists={priceLists}
                emailHistory={emailHistory}
                quotationHistory={quotationHistory}
                onEmailSent={async (item) => {
                  setEmailHistory(prev => [item, ...prev]);
                  await saveEmailHistoryItem(item);
                  setShowEmailComposer(false);
                  setView('history');
                }}
                showAlert={showAlert}
                initialForm={emailForm}
                isModal={true}
              />
            </main>
          </div>
        </div>
      )}

      {/* MOBILE DOCUMENT PREVIEW MODAL */}
      {showMobilePreviewModal && (
        <div className="fixed inset-0 z-[5000] flex flex-col bg-slate-900/95 backdrop-blur-md animate-in slide-in-from-bottom duration-300 font-sans">
          {/* Header */}
          <header className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-2">
              <Eye size={18} className="text-teal-400" />
              <h3 className="text-[15px] font-bold text-white">Quotation Preview</h3>
            </div>
            <button 
              type="button"
              onClick={() => setShowMobilePreviewModal(false)}
              className="w-8 h-8 flex items-center justify-center bg-slate-800 border border-slate-700 rounded-full text-slate-400 hover:text-white transition-all"
            >
              <Plus className="rotate-45" size={20} />
            </button>
          </header>

          {/* Main Mobile Preview Area with Pan & Scroll Support */}
          <main className="flex-1 overflow-auto p-3 sm:p-6 bg-slate-950 flex justify-center items-start w-full">
            <QuotationTemplate id="mobile-quotation-template" data={formData} content={draftContent} company={companyData} forceScale={docZoom} onContentChange={setDraftContent} isPdfPrinting={isGenerating} />
          </main>

          {/* Mobile Bottom Bar with Zoom Slider + Submit Button */}
          <footer className="p-3 bg-slate-900 border-t border-slate-800 flex flex-col gap-2.5 shrink-0">
            {/* Dragger Zoom Bar */}
            <div className="flex items-center justify-between gap-3 bg-slate-800/90 border border-slate-700 rounded-full px-4 py-2 text-white">
              <div className="flex items-center gap-1.5">
                <Search size={14} className="text-teal-400" />
                <span className="text-[12px] font-extrabold text-teal-300 min-w-[40px]">
                  {Math.round(docZoom * 100)}%
                </span>
              </div>

              <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                <button
                  type="button"
                  onClick={() => setDocZoom(prev => Math.max(0.5, parseFloat((prev - 0.1).toFixed(2))))}
                  className="w-6 h-6 flex items-center justify-center bg-slate-700 rounded-full text-white font-bold text-xs"
                >
                  -
                </button>
                <input 
                  type="range" 
                  min="50" 
                  max="250" 
                  step="5"
                  value={Math.round(docZoom * 100)} 
                  onChange={(e) => setDocZoom(Number(e.target.value) / 100)}
                  className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-400"
                />
                <button
                  type="button"
                  onClick={() => setDocZoom(prev => Math.min(2.5, parseFloat((prev + 0.1).toFixed(2))))}
                  className="w-6 h-6 flex items-center justify-center bg-slate-700 rounded-full text-white font-bold text-xs"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={() => setDocZoom(1.0)}
                className="text-[10px] font-bold uppercase text-slate-300 bg-slate-700 px-2 py-0.5 rounded"
              >
                Reset
              </button>
            </div>

            {/* Confirm Submit Button */}
            <button
              type="button"
              onClick={() => {
                setShowMobilePreviewModal(false);
                handleSubmitQuotation();
              }}
              disabled={isGenerating}
              className="btn-primary w-full !py-3 text-[14px] flex items-center justify-center gap-2"
            >
              <ShieldCheck size={18} /> Finish & Save Quotation
            </button>
          </footer>
        </div>
      )}
      {/* GENERATING QUOTATION OVERLAY */}
      {isGenerating && !regeneratingItem && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-500">
          <div className="apple-card flex flex-col items-center gap-8 p-12 !bg-[var(--apple-surface)]/95 backdrop-blur-xl rounded-[32px] shadow-2xl border border-[var(--apple-gray-3)]/60 animate-in zoom-in-95 duration-400">
            <div className="relative">
              <div className="w-24 h-24 bg-emerald-500/10 text-emerald-600 rounded-3xl flex items-center justify-center shadow-inner ring-4 ring-emerald-500/5">
                <FileText className="animate-bounce" size={40} strokeWidth={1.5} />
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-2 text-center">
              <h3 className="text-[24px] font-bold text-[var(--apple-black)] tracking-tight">
                Generating PDF
              </h3>
              <p className="text-[14px] text-[var(--apple-gray-5)] font-medium max-w-[280px]">
                We're preparing your high-quality document for download.
              </p>
            </div>

            <div className="w-[240px] h-1.5 bg-[var(--apple-gray-1)] rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 animate-progress-sweep"></div>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL DISPATCHING OVERLAY */}
      {isSendingEmail && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-500">
          <div className="apple-card flex flex-col items-center gap-8 p-12 !bg-[var(--apple-surface)]/95 backdrop-blur-xl rounded-[32px] shadow-2xl border border-[var(--apple-gray-3)]/60 animate-in zoom-in-95 duration-400">
            <div className="relative">
              <div className="w-24 h-24 bg-indigo-500/10 text-indigo-600 rounded-3xl flex items-center justify-center shadow-inner ring-4 ring-indigo-500/5">
                <Mail className="animate-pulse" size={40} strokeWidth={1.5} />
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-2 text-center">
              <h3 className="text-[24px] font-bold text-[var(--apple-black)] tracking-tight">
                Dispatching Email
              </h3>
              <p className="text-[14px] text-[var(--apple-gray-5)] font-medium max-w-[280px]">
                Sending your documents through our secure server.
              </p>
            </div>

            <div className="w-[240px] h-1.5 bg-[var(--apple-gray-1)] rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 animate-progress-sweep"></div>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT VIEWER OVERLAY */}
      {previewingDoc && (
        <div className="fixed inset-0 z-[6500] flex flex-col bg-[var(--apple-bg)] animate-in fade-in duration-300">
          <header className="flex-none flex items-center justify-between px-4 md:px-12 py-4 bg-white border-b border-[var(--apple-gray-3)] shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-[var(--accent)] text-white rounded-xl flex items-center justify-center shadow-md shrink-0">
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold text-[var(--apple-black)] truncate leading-tight">
                  {previewingDoc.label || previewingDoc.fileName}
                </h3>
                <p className="text-[11px] text-[var(--apple-gray-5)] mt-0.5 font-medium truncate">
                  {previewingDoc.uploadedAt} • {previewingDoc.fileName}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              {/* Print Button */}
              <button 
                onClick={() => printDocument(previewingDoc.data, previewingDoc.label || previewingDoc.fileName, previewingDoc.type)}
                className="w-10 h-10 flex items-center justify-center bg-white border border-[var(--apple-gray-3)] rounded-full text-[var(--apple-gray-5)] hover:text-[var(--apple-black)] hover:bg-[var(--apple-gray-1)] transition-all"
                title="Print Document"
              >
                <Printer size={18} />
              </button>
              
              {/* Share Button */}
              <button 
                onClick={async () => {
                  const res = await shareDocument(previewingDoc.data, previewingDoc.label || previewingDoc.fileName);
                  if (res && res.success) {
                    if (res.method === 'clipboard') {
                      showAlert('Copied to Clipboard', 'Document link has been copied to your clipboard.', 'success');
                    }
                  } else {
                    showAlert('Share Failed', 'Could not copy link or share.', 'error');
                  }
                }}
                className="w-10 h-10 flex items-center justify-center bg-white border border-[var(--apple-gray-3)] rounded-full text-[var(--apple-gray-5)] hover:text-[var(--apple-black)] hover:bg-[var(--apple-gray-1)] transition-all"
                title="Share Document"
              >
                <Share2 size={18} />
              </button>

              {/* Close Button */}
              <button 
                onClick={() => setPreviewingDoc(null)}
                className="w-10 h-10 flex items-center justify-center bg-white border border-[var(--apple-gray-3)] rounded-full text-[var(--apple-gray-5)] hover:text-red-500 hover:bg-red-50 transition-all"
                title="Close Viewer"
              >
                <X size={20} />
              </button>
            </div>
          </header>
          
          <main className="flex-1 bg-[var(--apple-gray-3)]/30 p-2 md:p-8 flex items-center justify-center overflow-hidden">
            <div className="w-full h-full max-w-5xl bg-white rounded-2xl border border-[var(--apple-gray-3)] shadow-2xl overflow-hidden flex items-center justify-center animate-in zoom-in-95 duration-300">
              {previewingDoc.type && previewingDoc.type.startsWith('image/') ? (
                <div className="w-full h-full p-4 flex items-center justify-center bg-[var(--apple-gray-1)]">
                  <img 
                    src={previewingDoc.data} 
                    alt={previewingDoc.label} 
                    className="max-w-full max-h-full object-contain rounded-xl shadow-md border border-[var(--apple-gray-2)]"
                  />
                </div>
              ) : (
                <iframe 
                  src={previewingDoc.data} 
                  className="w-full h-full border-none" 
                  title={previewingDoc.label}
                />
              )}
            </div>
          </main>
        </div>
      )}

      {alertModal && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-6">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" 
            onClick={() => {
              if (alertModal.onInput) return;
              const onCancel = alertModal.onCancel;
              setAlertModal(null);
              if (onCancel) onCancel();
            }}
          ></div>
          
          <div className="apple-card relative w-full max-w-[400px] !bg-[var(--apple-surface)]/95 backdrop-blur-2xl rounded-[32px] shadow-2xl border border-[var(--apple-gray-3)]/60 overflow-hidden animate-in zoom-in-95 fade-in duration-300 z-10">
            <div className="p-8 md:p-10">
              <div className="flex flex-col items-center text-center gap-6 mb-8">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ring-4 ${
                  alertModal.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/5' :
                  alertModal.type === 'error' ? 'bg-rose-500/10 text-rose-600 ring-rose-500/5' :
                  'bg-indigo-500/10 text-indigo-600 ring-indigo-500/5'
                }`}>
                  {alertModal.type === 'success' ? <FileCheck size={32} strokeWidth={1.5} /> :
                   alertModal.type === 'error' ? <Plus className="rotate-45" size={32} strokeWidth={1.5} /> :
                   <Mail size={32} strokeWidth={1.5} />}
                </div>
                
                <div>
                  <h3 className="text-[22px] font-bold text-[var(--apple-black)] tracking-tight mb-2">
                    {alertModal.title}
                  </h3>
                  <p className="text-[14px] text-[var(--apple-gray-5)] leading-relaxed font-medium px-2">
                    {alertModal.message}
                  </p>
                </div>
              </div>

              {alertModal.showInput && (
                <div className="mb-8">
                  <label className="text-[11px] font-bold text-[var(--apple-gray-4)] uppercase tracking-widest block mb-2 px-1">
                    {alertModal.title?.toLowerCase().includes('admin') || alertModal.title?.toLowerCase().includes('verification') ? 'Verification Required' : 'Input Required'}
                  </label>
                  <input 
                    id="admin-verification-input"
                    type={alertModal.title?.toLowerCase().includes('admin') || alertModal.title?.toLowerCase().includes('verification') ? 'password' : 'text'}
                    placeholder={alertModal.title?.toLowerCase().includes('admin') || alertModal.title?.toLowerCase().includes('verification') ? 'Enter Admin Password' : 'Enter a name/label...'}
                    autoComplete="off"
                    autoFocus
                    className={`apple-input w-full text-center p-4 focus:!bg-white ${
                      alertModal.title?.toLowerCase().includes('admin') || alertModal.title?.toLowerCase().includes('verification')
                        ? 'font-mono text-lg font-bold tracking-[0.3em] !bg-white/40' 
                        : '!bg-white/90 text-sm font-semibold'
                    }`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = e.target.value;
                        setAlertModal(null);
                        alertModal.onInput(val);
                      }
                    }}
                  />
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    const inputVal = document.getElementById('admin-verification-input')?.value;
                    const onConfirm = alertModal.onConfirm;
                    const onInput = alertModal.onInput;
                    setAlertModal(null);
                    if (onInput) onInput(inputVal);
                    if (onConfirm) onConfirm();
                  }}
                  className={`btn-primary w-full !py-3.5 rounded-xl text-[14px] font-bold transition-all shadow-md active:scale-95 ${
                    alertModal.type === 'error' ? '!bg-rose-600 hover:!bg-rose-700' : ''
                  }`}
                >
                  {alertModal.confirmText || 'Confirm'}
                </button>

                {(alertModal.onConfirm || alertModal.onInput || alertModal.onCancel) && (
                  <button 
                    onClick={() => {
                      const onCancel = alertModal.onCancel;
                      setAlertModal(null);
                      if (onCancel) onCancel();
                    }}
                    className="btn-outline w-full !py-3 rounded-xl text-[13px] font-bold text-[var(--text2)] transition-all hover:bg-white/60"
                  >
                    {alertModal.cancelText || 'Cancel'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
