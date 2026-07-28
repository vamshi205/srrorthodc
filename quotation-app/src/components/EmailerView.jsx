import React, { useState, useEffect, useRef } from 'react';
import { Mail, FileText, FileCheck, CheckSquare, ChevronRight, HardDrive, Plus, Search, Eye, Upload, User, Building, FolderOpen, Folder } from 'lucide-react';
import { sendEmailWithResend } from '../utils/emailService';

const EmailerView = ({ 
  driveFiles = {}, 
  priceLists = [], 
  emailHistory = [], 
  quotationHistory = [], 
  onEmailSent, 
  showAlert, 
  initialForm = null, 
  isModal = false 
}) => {
  const [emailForm, setEmailForm] = useState(() => {
    if (initialForm) {
      return {
        to: initialForm.to || '',
        subject: initialForm.subject || '',
        body: initialForm.body || '',
        selectedDriveFiles: initialForm.selectedDriveFiles || []
      };
    }
    return {
      to: '',
      subject: 'Documents from Sri Raja Rajeshwari Ortho Plus',
      body: 'Dear Sir/Madam,\n\nPlease find the attached documents for your reference.\n\nRegards,\nSri Raja Rajeshwari Ortho Plus',
      selectedDriveFiles: []
    };
  });

  useEffect(() => {
    if (initialForm) {
      setEmailForm({
        to: initialForm.to || '',
        subject: initialForm.subject || 'Documents from Sri Raja Rajeshwari Ortho Plus',
        body: initialForm.body || '',
        selectedDriveFiles: initialForm.selectedDriveFiles || []
      });
    }
  }, [initialForm]);

  const [activeTab, setActiveTab] = useState('srr');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRecs, setShowRecs] = useState(false);
  const [contactRecs, setContactRecs] = useState([]);
  
  const localFileInputRef = useRef(null);

  // Extract recipient recommendations from emailHistory & quotationHistory
  useEffect(() => {
    const contactMap = new Map();

    // 1. From email history
    (emailHistory || []).forEach(item => {
      if (item.to) {
        const emails = item.to.split(',').map(e => e.trim());
        emails.forEach(email => {
          if (email && !contactMap.has(email.toLowerCase())) {
            contactMap.set(email.toLowerCase(), {
              email,
              label: item.hospital || item.recipient || ''
            });
          }
        });
      }
    });

    // 2. From quotation history
    (quotationHistory || []).forEach(item => {
      const hosp = (item.formData?.hospitalName || '').trim();
      const doc = (item.formData?.doctorName || '').trim();
      const label = hosp ? (doc ? `${hosp} (Dr. ${doc})` : hosp) : (doc ? `Dr. ${doc}` : (item.hospital || ''));
      const email = item.lastEmailedTo || item.formData?.email || '';
      if (email && !contactMap.has(email.toLowerCase())) {
        contactMap.set(email.toLowerCase(), { email, label });
      }
    });

    setContactRecs(Array.from(contactMap.values()));
  }, [emailHistory, quotationHistory]);

  // Compute matching autocomplete items based on typed text
  const currentTypedTerm = (() => {
    const terms = (emailForm.to || '').split(',');
    return (terms[terms.length - 1] || '').trim().toLowerCase();
  })();

  const matchingRecs = currentTypedTerm
    ? contactRecs.filter(r => 
        r.email.toLowerCase().includes(currentTypedTerm) || 
        r.label.toLowerCase().includes(currentTypedTerm)
      )
    : [];

  const handleSelectRec = (selectedEmail) => {
    const terms = (emailForm.to || '').split(',').map(t => t.trim()).filter(Boolean);
    // Replace incomplete last term or append
    if (terms.length > 0 && !terms[terms.length - 1].includes('@')) {
      terms.pop();
    }
    if (!terms.includes(selectedEmail)) {
      terms.push(selectedEmail);
    }
    setEmailForm(prev => ({ ...prev, to: terms.join(', ') }));
    setShowRecs(false);
  };

  const handleLocalFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 12 * 1024 * 1024) {
      if (showAlert) showAlert('File Too Large', 'Please select a file smaller than 12MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result;
      const newFile = {
        id: 'local-' + Date.now(),
        fileName: file.name,
        label: file.name,
        data: dataUrl,
        isLocalUpload: true,
        isTemp: true
      };

      setEmailForm(prev => ({
        ...prev,
        selectedDriveFiles: [...prev.selectedDriveFiles, newFile]
      }));

      if (showAlert) showAlert('File Attached', `"${file.name}" has been attached. It will be sent via email without saving in the database.`, 'success');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const getFileLabel = (file) => {
    return file.label || file.name || file.title || file.fileName || 'Document.pdf';
  };

  const toggleFile = (file, isSRR) => {
    const fileLabel = getFileLabel(file);
    const fileWithTag = { 
      ...file, 
      label: fileLabel, 
      fileName: file.fileName || (fileLabel.endsWith('.pdf') ? fileLabel : `${fileLabel}.pdf`), 
      isSRR 
    };

    const exists = emailForm.selectedDriveFiles.find(f => f.id === file.id);
    if (exists) {
      setEmailForm(prev => ({
        ...prev,
        selectedDriveFiles: prev.selectedDriveFiles.filter(f => f.id !== file.id)
      }));
    } else {
      setEmailForm(prev => ({
        ...prev,
        selectedDriveFiles: [...prev.selectedDriveFiles, fileWithTag]
      }));
    }
  };

  const [isSending, setIsSending] = useState(false);
  const handleSendEmail = async () => {
    const recipientInput = (emailForm.to || '').trim();
    const emailList = recipientInput
      .split(',')
      .map(e => e.trim())
      .filter(Boolean);

    if (emailList.length === 0) {
      if (showAlert) showAlert('Email ID Required', 'Please enter at least one Email ID before sending.', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emailList.filter(e => !emailRegex.test(e));

    if (invalidEmails.length > 0) {
      if (showAlert) showAlert('Invalid Email Address', `The following email address(es) are invalid:\n• ${invalidEmails.join('\n• ')}\n\nPlease enter valid comma-separated email addresses.`, 'error');
      return;
    }

    setIsSending(true);
    
    const filesToAttach = (emailForm.selectedDriveFiles || []).map(f => ({
      fileName: f.fileName || f.label || 'Document.pdf',
      url: f.data
    }));

    try {
      const result = await sendEmailWithResend({
        to: emailList.length === 1 ? emailList[0] : emailList,
        subject: emailForm.subject,
        body: emailForm.body,
        files: filesToAttach
      });

      if (result.success) {
        const sentStr = emailList.join(', ');
        if (showAlert) showAlert('Email Dispatched', `Successfully sent to ${sentStr} via Resend.`, 'success');
        
        // Save to History via callback
        if (onEmailSent) {
          onEmailSent({
            id: Date.now().toString(),
            to: sentStr,
            subject: emailForm.subject,
            body: emailForm.body,
            sentAt: new Date().toISOString(),
            attachments: filesToAttach.map(f => f.fileName),
            status: 'success'
          });
        }

        setEmailForm(prev => ({ ...prev, selectedDriveFiles: [] }));
      } else {
        if (showAlert) showAlert('Dispatch Error', result.message || 'The email service returned an error.', 'error');
      }
    } catch (err) {
      console.error('Email error:', err);
      if (showAlert) showAlert('Connection Error', 'Failed to transmit email. Please check your internet connection.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const innerLayout = (
    <div className="flex flex-col lg:flex-row gap-6 w-full font-sans items-stretch">
        
        {/* Left Side: Composer */}
        <div className="flex-1 min-w-0 space-y-6">
          <div className="bg-white shadow-xl border border-slate-200 flex flex-col overflow-hidden rounded-2xl">
            <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-teal-600 flex items-center justify-center rounded-xl shadow-2xs">
                  <Mail className={`${isSending ? 'animate-bounce' : ''} text-white`} size={18} />
                </div>
                <div>
                  <h3 className="text-[15px] font-extrabold text-slate-900">Resend Dispatch</h3>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                    {isSending ? 'Sending Message...' : 'Premium Email Service'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Service Status</p>
                <p className="text-[11px] font-semibold text-emerald-600">Active • High Deliverability</p>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              {/* Recipient */}
              <div className="relative">
                <div className="flex items-center gap-3 border-2 border-red-500 bg-red-50/20 px-3.5 py-2.5 rounded-xl focus-within:border-red-600 focus-within:ring-2 focus-within:ring-red-200 transition-all shadow-2xs">
                  <span className="text-[12px] font-bold text-red-600 w-8 uppercase tracking-wider">To</span>
                  <input 
                    type="text" 
                    value={emailForm.to} 
                    onChange={(e) => {
                      setEmailForm({...emailForm, to: e.target.value});
                      setShowRecs(true);
                    }}
                    onFocus={() => setShowRecs(true)}
                    placeholder="Enter Email ID (comma-separated for multiple)" 
                    className="flex-1 bg-transparent no-internal-border text-[14px] font-semibold text-slate-900 placeholder:text-red-400 focus:outline-none" 
                  />
                </div>

                {/* Autocomplete Recommendations Dropdown */}
                {showRecs && matchingRecs.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-52 overflow-y-auto">
                    <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      Recent Recipients & Contacts
                    </div>
                    {matchingRecs.map((rec, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectRec(rec.email)}
                        className="w-full text-left px-3.5 py-2 hover:bg-teal-50 flex items-center justify-between border-b border-slate-50 transition-colors"
                      >
                        <span className="text-[12.5px] font-bold text-slate-800">{rec.email}</span>
                        {rec.label && (
                          <span className="text-[10.5px] font-medium text-teal-700 bg-teal-100/60 px-2 py-0.5 rounded-full truncate max-w-[180px]">
                            {rec.label}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Subject */}
              <div className="flex items-center gap-3 border border-slate-200 px-3.5 py-2.5 bg-white rounded-xl focus-within:border-teal-600 focus-within:ring-1 focus-within:ring-teal-600 transition-all">
                <span className="text-[12px] font-bold text-slate-500 w-8 uppercase tracking-wider">Sub</span>
                <input 
                  type="text" 
                  value={emailForm.subject} 
                  onChange={(e) => setEmailForm({...emailForm, subject: e.target.value})}
                  className="flex-1 bg-transparent no-internal-border text-[14px] font-semibold text-slate-900" 
                />
              </div>

              {/* Body */}
              <div className="border border-slate-200 p-3.5 bg-white rounded-xl focus-within:border-teal-600 focus-within:ring-1 focus-within:ring-teal-600 transition-all">
                <textarea 
                  value={emailForm.body} 
                  onChange={(e) => setEmailForm({...emailForm, body: e.target.value})}
                  placeholder="Type your message here..."
                  className="w-full min-h-[220px] bg-transparent no-internal-border text-[13.5px] leading-relaxed resize-y font-medium text-slate-800" 
                />
              </div>

              {/* Attachment Badges - Scrollable Shelf */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                    Attached Files ({emailForm.selectedDriveFiles.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={() => localFileInputRef.current?.click()}
                      className="flex items-center gap-1 text-[10.5px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-lg hover:bg-teal-100 transition-all shadow-2xs"
                      title="Upload local file to attach to email without saving in database"
                    >
                      <Upload size={11} /> Upload File
                    </button>
                    <input 
                      type="file" 
                      ref={localFileInputRef} 
                      onChange={handleLocalFileUpload} 
                      className="hidden" 
                    />

                    {emailForm.selectedDriveFiles.some(f => !f.isGenerated) && (
                      <button 
                        type="button"
                        onClick={() => setEmailForm(prev => ({ 
                          ...prev, 
                          selectedDriveFiles: prev.selectedDriveFiles.filter(f => f.isGenerated) 
                        }))}
                        className="text-[10px] font-bold text-red-500 hover:underline"
                        title="Clear additional attached files (keeps primary quotation)"
                      >
                        Clear Extra Files
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-[140px] overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {emailForm.selectedDriveFiles.map(file => (
                    <div 
                      key={file.id} 
                      className={`flex items-center justify-between gap-2 p-2 rounded-xl border text-[11px] font-semibold transition-all ${
                        file.isGenerated 
                          ? 'bg-emerald-50/90 border-emerald-400 text-slate-900 shadow-2xs' 
                          : file.isLocalUpload
                          ? 'bg-cyan-50/80 border-cyan-300 text-cyan-950'
                          : 'bg-amber-50/80 border-amber-300 text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {file.isGenerated ? <FileText size={13} className="text-emerald-600 shrink-0" /> : <FileCheck size={13} className="text-amber-600 shrink-0" />}
                        <span className="truncate">{file.label || file.fileName}</span>
                        {file.isGenerated && (
                          <span className="text-[8.5px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded shrink-0">Quotation</span>
                        )}
                        {file.isLocalUpload && (
                          <span className="text-[8.5px] font-bold bg-cyan-100 text-cyan-800 px-1.5 py-0.5 rounded shrink-0">Local</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Eye Button to Preview Attachment */}
                        <button 
                          type="button"
                          onClick={() => {
                            if (file.data || file.url) {
                              window.open(file.data || file.url, '_blank');
                            } else if (showAlert) {
                              showAlert('View Error', 'File URL is not available for preview.', 'error');
                            }
                          }}
                          className="p-1 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors"
                          title="View / Preview Attachment"
                        >
                          <Eye size={13} />
                        </button>

                        {/* X Button only for additional files (Generated Quotation cannot be removed) */}
                        {!file.isGenerated && (
                          <button 
                            type="button"
                            onClick={() => setEmailForm(prev => ({ 
                              ...prev, 
                              selectedDriveFiles: prev.selectedDriveFiles.filter(f => f.id !== file.id) 
                            }))}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                            title="Remove Attachment"
                          >
                            <Plus className="rotate-45" size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {emailForm.selectedDriveFiles.length === 0 && (
                    <p className="text-[11px] text-slate-400 font-medium col-span-full text-center py-2">No files attached yet</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button 
                  type="button"
                  onClick={handleSendEmail} 
                  disabled={isSending}
                  className={`btn-primary w-full !py-3 text-[14px] ${isSending ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isSending ? 'Processing...' : <><Mail size={16} /> Send with Attachments</>}
                </button>
                <p className="text-[10.5px] text-slate-400 text-center italic">
                  {isSending 
                    ? 'Processing Attachments & Sending via Resend...' 
                    : 'Supports multiple comma-separated email addresses & local file attachments.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Selection */}
        <div className="w-full lg:w-[360px] xl:w-[400px] bg-white border border-slate-200 shadow-xl p-5 flex flex-col rounded-2xl min-h-[480px] shrink-0">
          <div className="flex items-center justify-between mb-4 border-b border-[var(--apple-gray-2)] pb-4">
            <h4 className="text-[14px] font-bold text-[var(--apple-black)] flex items-center gap-2">
              <HardDrive size={18} className="text-[var(--apple-gray-6)]" /> Attachments
            </h4>
            <span className="text-[10px] font-bold bg-[var(--apple-gray-2)] px-2.5 py-1 rounded-full text-[var(--apple-gray-6)]">
              {emailForm.selectedDriveFiles.length} Selected
            </span>
          </div>

          {/* Segmented Control (Tabs) */}
          <div className="flex p-1 bg-[var(--apple-gray-1)] rounded-xl mb-4">
            {[
              { id: 'srr', label: 'SRR Docs' },
              { id: 'vendor', label: 'Manufacturer' },
              { id: 'pricelists', label: 'Price Lists' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setActiveTab(tab.id); setSearchQuery(''); }}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider text-center rounded-lg transition-all ${
                  activeTab === tab.id 
                    ? 'bg-white text-[var(--apple-black)] shadow-sm' 
                    : 'text-[var(--apple-gray-5)] hover:text-[var(--apple-black)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--apple-gray-4)]" />
            <input
              type="text"
              placeholder={`Search in ${activeTab === 'srr' ? 'SRR Docs' : activeTab === 'vendor' ? 'Manufacturer Docs' : 'Price Lists'}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 border border-[var(--apple-gray-3)] rounded-xl text-[13px] bg-[var(--apple-gray-1)] focus:bg-white focus:border-[var(--accent)] focus:outline-none transition-all"
            />
            {searchQuery && (
              <button 
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--apple-gray-4)] hover:text-[var(--apple-black)]"
              >
                <Plus className="rotate-45" size={16} />
              </button>
            )}
          </div>

          {/* Scrollable list area */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-0">
            {activeTab === 'srr' && (
              <div className="space-y-2">
                {(driveFiles.srr || [])
                  .filter(file => !searchQuery || (file.label || '').toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(file => {
                    const isSelected = emailForm.selectedDriveFiles.some(f => f.id === file.id);
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => toggleFile(file, true)}
                        className={`w-full flex items-center gap-3 p-3 border rounded-2xl text-left transition-all ${
                          isSelected 
                            ? 'bg-emerald-50 border-[var(--accent)] shadow-sm' 
                            : 'bg-white border-[var(--apple-gray-2)] hover:border-[var(--apple-gray-4)]'
                        }`}
                      >
                        <div className={`w-5 h-5 border rounded flex items-center justify-center transition-all ${
                          isSelected ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--apple-gray-3)]'
                        }`}>
                          {isSelected && <CheckSquare size={12} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-[var(--apple-black)] truncate">{file.label}</p>
                          <p className="text-[11px] text-[var(--apple-gray-5)] font-medium">SRR Document</p>
                        </div>
                        <ChevronRight size={14} className="text-[var(--apple-gray-4)] shrink-0" />
                      </button>
                    );
                  })}
              </div>
            )}

            {activeTab === 'vendor' && (
              <div className="space-y-3">
                {(() => {
                  const vendorItems = driveFiles.vendor || driveFiles.manufacturer || [];
                  if (vendorItems.length === 0) {
                    return <p className="text-[12px] text-slate-400 font-medium text-center py-6">No manufacturer documents available</p>;
                  }

                  return vendorItems.map(item => {
                    // Case A: Item is a Vendor Folder containing files array
                    if (item.files && Array.isArray(item.files)) {
                      const folderFiles = item.files.filter(f => {
                        const name = getFileLabel(f);
                        return !searchQuery || name.toLowerCase().includes(searchQuery.toLowerCase());
                      });
                      if (folderFiles.length === 0 && searchQuery) return null;

                      return (
                        <div key={item.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                          {/* Folder Header */}
                          <div className="px-3.5 py-2 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-[12px] font-extrabold text-slate-800 flex items-center gap-1.5">
                              <FolderOpen size={14} className="text-amber-500" />
                              {item.name || item.label || 'Vendor Folder'}
                            </span>
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                              {folderFiles.length} {folderFiles.length === 1 ? 'file' : 'files'}
                            </span>
                          </div>

                          {/* Files inside Vendor Folder */}
                          <div className="p-2 space-y-1.5">
                            {folderFiles.map(file => {
                              const isSelected = emailForm.selectedDriveFiles.some(f => f.id === file.id);
                              const displayName = getFileLabel(file);

                              return (
                                <div
                                  key={file.id}
                                  onClick={() => toggleFile(file, false, item.name)}
                                  className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                                    isSelected 
                                      ? 'bg-amber-50 border-amber-300 shadow-2xs' 
                                      : 'bg-white border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div className={`w-4 h-4 border rounded flex items-center justify-center transition-all shrink-0 ${
                                      isSelected ? 'bg-amber-500 border-amber-500' : 'border-slate-300'
                                    }`}>
                                      {isSelected && <CheckSquare size={11} className="text-white" />}
                                    </div>
                                    <span className="text-[12.5px] font-bold text-slate-800 truncate">{displayName}</span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (file.data || file.url) window.open(file.data || file.url, '_blank');
                                    }}
                                    className="p-1 text-slate-400 hover:text-amber-600 rounded transition-colors shrink-0"
                                    title="Preview File"
                                  >
                                    <Eye size={13} />
                                  </button>
                                </div>
                              );
                            })}
                            {folderFiles.length === 0 && (
                              <p className="text-[11px] text-slate-400 italic text-center py-1">No files in folder</p>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // Case B: Item is a single direct file object
                    const isSelected = emailForm.selectedDriveFiles.some(f => f.id === item.id);
                    const displayName = getFileLabel(item);
                    if (searchQuery && !displayName.toLowerCase().includes(searchQuery.toLowerCase())) return null;

                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleFile(item, false)}
                        className={`flex items-center justify-between gap-2 p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-amber-50 border-amber-300 shadow-2xs' 
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className={`w-4 h-4 border rounded flex items-center justify-center transition-all shrink-0 ${
                            isSelected ? 'bg-amber-500 border-amber-500' : 'border-slate-300'
                          }`}>
                            {isSelected && <CheckSquare size={11} className="text-white" />}
                          </div>
                          <span className="text-[13px] font-bold text-slate-800 truncate">{displayName}</span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (item.data || item.url) window.open(item.data || item.url, '_blank');
                          }}
                          className="p-1 text-slate-400 hover:text-amber-600 rounded transition-colors shrink-0"
                          title="Preview File"
                        >
                          <Eye size={13} />
                        </button>
                      </div>
                    );
                  });
                })()}
              </div>
            )}

            {activeTab === 'pricelists' && (
              <div className="space-y-2">
                {(priceLists || [])
                  .filter(file => {
                    const name = getFileLabel(file);
                    return !searchQuery || name.toLowerCase().includes(searchQuery.toLowerCase());
                  })
                  .map(file => {
                    const isSelected = emailForm.selectedDriveFiles.some(f => f.id === file.id);
                    const displayName = getFileLabel(file);
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => {
                          const itemToToggle = { 
                            id: file.id, 
                            fileName: displayName.endsWith('.pdf') ? displayName : `${displayName}.pdf`, 
                            label: displayName, 
                            data: file.data || file.url 
                          };
                          toggleFile(itemToToggle, false);
                        }}
                        className={`w-full flex items-center gap-3 p-3 border rounded-2xl text-left transition-all ${
                          isSelected 
                            ? 'bg-emerald-50 border-[var(--accent)] shadow-sm' 
                            : 'bg-white border-[var(--apple-gray-2)] hover:border-[var(--apple-gray-4)]'
                        }`}
                      >
                        <div className={`w-5 h-5 border rounded flex items-center justify-center transition-all ${
                          isSelected ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--apple-gray-3)]'
                        }`}>
                          {isSelected && <CheckSquare size={12} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-[var(--apple-black)] truncate">{displayName}</p>
                          <p className="text-[11px] text-[var(--apple-gray-5)] font-medium">Price List PDF</p>
                        </div>
                        <ChevronRight size={14} className="text-[var(--apple-gray-4)] shrink-0" />
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
    </div>
  );

  if (isModal) {
    return innerLayout;
  }

  return (
    <div className="h-full w-full overflow-y-auto p-4 md:p-8 max-w-7xl mx-auto">
      {innerLayout}
    </div>
  );
};

export default EmailerView;
