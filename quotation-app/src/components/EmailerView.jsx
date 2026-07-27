import React, { useState, useEffect } from 'react';
import { Mail, FileText, FileCheck, CheckSquare, ChevronRight, HardDrive, Plus, Search } from 'lucide-react';
import { sendEmailWithResend } from '../utils/emailService';

const EmailerView = ({ driveFiles, priceLists, onEmailSent, showAlert, initialForm = null, isModal = false }) => {
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

  const [activeTab, setActiveTab] = useState('srr');
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-generate subject and body based on selection
  useEffect(() => {
    if (emailForm.selectedDriveFiles.length === 0) {
      setEmailForm(prev => ({
        ...prev,
        subject: 'Documents from Sri Raja Rajeshwari Ortho Plus',
        body: 'Dear Sir/Madam,\n\nPlease find the attached documents for your reference.\n\nRegards,\nSri Raja Rajeshwari Ortho Plus'
      }));
      return;
    }

    const srrFiles = emailForm.selectedDriveFiles.filter(f => f.isSRR && !f.isGenerated);
    const vendorFiles = emailForm.selectedDriveFiles.filter(f => !f.isSRR && !f.isGenerated);
    
    let subject = 'Documents: ';
    if (srrFiles.length > 0 && vendorFiles.length > 0) {
      subject += `SRR & Manufacturer Documents`;
    } else if (srrFiles.length > 0) {
      subject += `SRR Documents`;
    } else if (vendorFiles.length > 0) {
      subject += `Manufacturer Documents`;
    } else if (emailForm.selectedDriveFiles.some(f => f.isGenerated)) {
      subject = `Quotation from Sri Raja Rajeshwari Ortho Plus`;
    }

    let body = `Dear Sir/Madam,\n\nPlease find the attached documents for your reference:\n\n`;
    
    const hasAdditionalDocs = srrFiles.length > 0 || vendorFiles.length > 0;
    
    if (srrFiles.length > 0) {
      body += `SRR Documents:\n`;
      srrFiles.forEach((f, i) => {
        body += `${i + 1}. ${f.label || f.fileName}\n`;
      });
      body += `\n`;
    }

    if (vendorFiles.length > 0) {
      body += `Manufacturer Documents:\n`;
      vendorFiles.forEach((f, i) => {
        body += `${i + 1}. ${f.label || f.fileName}\n`;
      });
      body += `\n`;
    }

    if (!hasAdditionalDocs) {
      body = `Dear Sir/Madam,\n\nPlease find the attached Quotation from Sri Raja Rajeshwari Ortho Plus for your kind reference.\n\n`;
    }

    body += `Thank you for your business.\n\nRegards,\nSri Raja Rajeshwari Ortho Plus`;

    setEmailForm(prev => ({ ...prev, subject, body }));
  }, [emailForm.selectedDriveFiles]);

  const toggleFile = (file, isSRR) => {
    const fileWithTag = { ...file, isSRR };
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
    if (!emailForm.to) {
      showAlert('Recipient Missing', 'Please enter a valid recipient email address.', 'error');
      return;
    }
    setIsSending(true);
    
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
        showAlert('Email Dispatched', `Successfully sent to ${emailForm.to} via Resend.`, 'success');
        
        // Save to History via callback
        if (onEmailSent) {
          onEmailSent({
            id: Date.now().toString(),
            to: emailForm.to,
            subject: emailForm.subject,
            body: emailForm.body,
            sentAt: new Date().toISOString(),
            attachments: filesToAttach.map(f => f.fileName),
            status: 'success'
          });
        }

        setEmailForm(prev => ({ ...prev, selectedDriveFiles: [] }));
      } else {
        showAlert('Dispatch Error', result.message || 'The email service returned an error.', 'error');
      }
    } catch (err) {
      console.error('Email error:', err);
      showAlert('Connection Error', 'Failed to transmit email. Please check your internet connection.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const innerLayout = (
    <div className="flex flex-col lg:flex-row gap-8 w-full">
        
        {/* Left Side: Composer */}
        <div className="flex-1 space-y-6">
          <div className="bg-white shadow-2xl border border-[var(--apple-gray-3)] flex flex-col overflow-hidden">
            <div className="bg-[var(--apple-gray-1)] px-8 py-6 border-b border-[var(--apple-gray-2)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[var(--accent)] flex items-center justify-center">
                  <Mail className={`${isSending ? 'animate-bounce' : ''} text-white`} size={20} />
                </div>
                <div>
                  <h3 className="text-[17px] font-bold">Resend Dispatch</h3>
                  <p className="text-[11px] text-[var(--apple-gray-5)] uppercase font-bold tracking-wider">
                    {isSending ? 'Sending Message...' : 'Premium Email Service'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-[var(--apple-gray-4)] uppercase tracking-widest">Service Status</p>
                <p className="text-[12px] font-semibold text-[var(--emerald)]">Active • High Deliverability</p>
              </div>
            </div>

            <div className="p-8 space-y-6">
              {/* Recipient */}
              <div className="flex items-center gap-4 border border-[var(--apple-gray-3)] px-4 py-3 bg-white focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)] transition-all">
                <span className="text-[13px] font-bold text-[var(--apple-gray-5)] w-10 uppercase tracking-wider">To</span>
                <input 
                  type="email" 
                  value={emailForm.to} 
                  onChange={(e) => setEmailForm({...emailForm, to: e.target.value})}
                  placeholder="hospital-representative@email.com" 
                  className="flex-1 bg-transparent no-internal-border text-[15px] placeholder:text-[var(--apple-gray-4)]" 
                />
              </div>

              {/* Subject */}
              <div className="flex items-center gap-4 border border-[var(--apple-gray-3)] px-4 py-3 bg-white focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)] transition-all">
                <span className="text-[13px] font-bold text-[var(--apple-gray-5)] w-10 uppercase tracking-wider">Sub</span>
                <input 
                  type="text" 
                  value={emailForm.subject} 
                  onChange={(e) => setEmailForm({...emailForm, subject: e.target.value})}
                  className="flex-1 bg-transparent no-internal-border text-[15px] font-semibold" 
                />
              </div>

              {/* Body */}
              <div className="border border-[var(--apple-gray-3)] p-4 bg-white focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)] transition-all">
                <textarea 
                  value={emailForm.body} 
                  onChange={(e) => setEmailForm({...emailForm, body: e.target.value})}
                  placeholder="Type your message here..."
                  className="w-full min-h-[350px] bg-transparent no-internal-border text-[15px] leading-relaxed resize-none" 
                />
              </div>

              {/* Attachment Badges - Scrollable Shelf */}
              <div className="border border-[var(--apple-gray-2)] rounded-xl p-3 bg-[var(--apple-gray-1)]/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-[var(--apple-gray-5)] uppercase tracking-wider">
                    Attached Files ({emailForm.selectedDriveFiles.length})
                  </span>
                  {emailForm.selectedDriveFiles.length > 0 && (
                    <button 
                      onClick={() => setEmailForm(prev => ({ ...prev, selectedDriveFiles: [] }))}
                      className="text-[10px] font-bold text-red-500 hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <div className="max-h-[140px] overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {emailForm.selectedDriveFiles.map(file => (
                    <div 
                      key={file.id} 
                      className={`flex items-center justify-between gap-2 p-2 rounded-lg border text-[11px] font-semibold transition-all ${
                        file.isGenerated 
                          ? 'bg-emerald-50/50 border-[var(--accent)] text-[var(--text)]' 
                          : 'bg-amber-50/50 border-amber-300 text-[var(--text)]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {file.isGenerated ? <FileText size={13} className="text-[var(--emerald)]" /> : <FileCheck size={13} className="text-amber-500" />}
                        <span className="truncate">{file.label || file.fileName}</span>
                      </div>
                      <button 
                        onClick={() => setEmailForm(prev => ({ 
                          ...prev, 
                          selectedDriveFiles: prev.selectedDriveFiles.filter(f => f.id !== file.id) 
                        }))}
                        className="hover:text-red-500 transition-colors"
                      >
                        <Plus className="rotate-45" size={14} />
                      </button>
                    </div>
                  ))}
                  {emailForm.selectedDriveFiles.length === 0 && (
                    <p className="text-[11px] text-[var(--apple-gray-5)] font-medium col-span-full text-center py-2">No files attached yet</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleSendEmail} 
                  disabled={isSending}
                  className={`btn-primary w-full !py-4 text-[15px] ${isSending ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isSending ? 'Processing...' : <><Mail size={18} /> Send with Attachments</>}
                </button>
                <p className="text-[11px] text-[var(--apple-gray-4)] text-center italic">
                  {isSending 
                    ? 'Processing Attachments & Sending via Resend...' 
                    : 'Documents are converted to Base64 for instant delivery.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Selection */}
        <div className="w-full lg:w-[420px] bg-white border border-[var(--apple-gray-3)] shadow-2xl p-6 flex flex-col h-[700px] rounded-3xl">
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
                          <p className="text-[13px] font-semibold truncate text-[var(--apple-black)]">{file.label}</p>
                          <p className="text-[10px] text-[var(--apple-gray-5)] mt-0.5">{file.uploadedAt || 'Cloud File'}</p>
                        </div>
                      </button>
                    );
                  })}
                {(driveFiles.srr || []).filter(file => !searchQuery || (file.label || '').toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                  <p className="text-[13px] text-[var(--apple-gray-4)] italic py-8 text-center bg-[var(--apple-gray-1)] rounded-xl">No documents match search</p>
                )}
              </div>
            )}

            {activeTab === 'vendor' && (
              <div className="space-y-4">
                {(driveFiles.vendor || []).map(folder => {
                  const filteredFiles = (folder.files || []).filter(file => 
                    !searchQuery || 
                    (file.fileName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (folder.name || '').toLowerCase().includes(searchQuery.toLowerCase())
                  );

                  if (filteredFiles.length === 0) return null;

                  return (
                    <div key={folder.id} className="space-y-2">
                      <p className="text-[11px] font-bold text-amber-600 uppercase flex items-center gap-1">
                        <ChevronRight size={12} /> {folder.name}
                      </p>
                      <div className="space-y-2 pl-2 border-l border-[var(--apple-gray-3)]">
                        {filteredFiles.map(file => {
                          const isSelected = emailForm.selectedDriveFiles.some(f => f.id === file.id);
                          return (
                            <button
                              key={file.id}
                              onClick={() => toggleFile(file, false)}
                              className={`w-full flex items-center gap-3 p-2.5 border rounded-xl text-left transition-all ${
                                isSelected 
                                  ? 'bg-amber-50 border-amber-400 shadow-sm' 
                                  : 'bg-white border-[var(--apple-gray-2)] hover:border-[var(--apple-gray-4)]'
                              }`}
                            >
                              <div className={`w-4 h-4 border rounded flex items-center justify-center transition-all ${
                                isSelected ? 'bg-amber-500 border-amber-500' : 'border-[var(--apple-gray-3)]'
                              }`}>
                                {isSelected && <CheckSquare size={10} className="text-white" />}
                              </div>
                              <span className="text-[12px] font-medium truncate text-[var(--apple-black)] flex-1">{file.fileName}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {(driveFiles.vendor || []).every(folder => 
                  ((folder.files || []).filter(file => 
                    !searchQuery || 
                    (file.fileName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (folder.name || '').toLowerCase().includes(searchQuery.toLowerCase())
                  ).length === 0)
                ) && (
                  <p className="text-[13px] text-[var(--apple-gray-4)] italic py-8 text-center bg-[var(--apple-gray-1)] rounded-xl">No manufacturer files match search</p>
                )}
              </div>
            )}

            {activeTab === 'pricelists' && (
              <div className="space-y-2">
                {(priceLists || [])
                  .filter(file => !searchQuery || (file.label || '').toLowerCase().includes(searchQuery.toLowerCase()) || (file.fileName || '').toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(file => {
                    const isSelected = emailForm.selectedDriveFiles.some(f => f.id === file.id);
                    return (
                      <button
                        key={file.id}
                        onClick={() => toggleFile(file, false)}
                        className={`w-full flex items-center gap-3 p-3 border rounded-2xl text-left transition-all ${
                          isSelected 
                            ? 'bg-blue-50 border-blue-400 shadow-sm' 
                            : 'bg-white border-[var(--apple-gray-2)] hover:border-[var(--apple-gray-4)]'
                        }`}
                      >
                        <div className={`w-4 h-4 border rounded flex items-center justify-center transition-all ${
                          isSelected ? 'bg-blue-500 border-blue-500' : 'border-[var(--apple-gray-3)]'
                        }`}>
                          {isSelected && <CheckSquare size={10} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold truncate text-[var(--apple-black)]">{file.label}</p>
                          <span className="text-[10px] text-[var(--apple-gray-5)] block truncate mt-0.5">{file.fileName}</span>
                        </div>
                      </button>
                    );
                  })}
                {(priceLists || []).filter(file => !searchQuery || (file.label || '').toLowerCase().includes(searchQuery.toLowerCase()) || (file.fileName || '').toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                  <p className="text-[13px] text-[var(--apple-gray-4)] italic py-8 text-center bg-[var(--apple-gray-1)] rounded-xl">No price lists match search</p>
                )}
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
    <div className="h-full overflow-y-auto px-8 py-12 md:px-16 md:py-16 bg-[var(--apple-gray-2)]">
      <div className="max-w-7xl mx-auto w-full">
        {innerLayout}
      </div>
    </div>
  );
};

export default EmailerView;
