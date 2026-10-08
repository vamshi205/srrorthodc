import React from 'react';
import { Award, Folder, Trash2, Download, FileCheck, Share2, Plus, UploadCloud, FolderOpen, HardDrive, FileText, ChevronRight } from 'lucide-react';

const DriveView = ({ driveFiles, handleDriveUpload, handleDeleteDriveFile, handleCreateFolder, handleDeleteFolder, downloadFolderAsZip, openVendorFolder, setOpenVendorFolder, confirmDelete }) => {
  return (
    <div className="h-full overflow-y-auto px-3 py-3 md:px-5 md:py-4 w-full">
      <div className="w-full space-y-4">
        {/* Secondary Header Card matching NativeCashInvoice & Customers */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-400 flex items-center justify-center font-bold shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold font-sans text-slate-900 dark:text-slate-100 tracking-tight">
                  Document Vault &amp; Drive
                </h1>
                <span className="text-[11px] font-bold bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800 px-2.5 py-0.5 rounded-full">
                  {(driveFiles.srr || []).length + (driveFiles.vendor || []).length} Folders &amp; Docs
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Manage official business certificates, company licenses, and manufacturer vendor folders.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => handleDriveUpload(e, 'drive_srr')} className="hidden" id="srr-upload" />
            <label htmlFor="srr-upload" className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-2xs cursor-pointer transition-all">
              <Plus size={15} /> Upload Certificate
            </label>
          </div>
        </div>

        {/* ── SRR DRIVE (BUSINESS CERTIFICATES) ── */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                <Award size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">SRR Corporate Certificates</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{(driveFiles.srr || []).length} official business documents</p>
              </div>
            </div>
          </div>

          {(driveFiles.srr || []).length === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50">
              <p className="text-xs text-slate-400 font-medium">No certificates uploaded yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {(driveFiles.srr || []).map(file => (
                <div key={file.id} className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 hover:border-teal-500/60 rounded-xl p-4 flex flex-col justify-between group transition-all shadow-2xs">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="w-8 h-8 bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 rounded-lg flex items-center justify-center shrink-0">
                      <FileCheck size={16} />
                    </div>
                    <button 
                      onClick={() => handleDeleteDriveFile('drive_srr', file)} 
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      title="Delete file"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold text-slate-900 dark:text-slate-100 truncate">{file.label}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 truncate">{file.uploadedAt} • {file.fileName}</p>
                  </div>
                  <a href={file.data} target="_blank" rel="noreferrer" className="mt-3 text-[12px] font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1 hover:underline pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    <Download size={13} /> View / Download Document
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── VENDOR DRIVE ── */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <FolderOpen size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Vendor &amp; Manufacturer Folders</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{(driveFiles.vendor || []).length} registered vendor folders</p>
              </div>
            </div>
            <button 
              onClick={handleCreateFolder} 
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-300 text-amber-900 dark:text-amber-300 bg-amber-50 hover:bg-amber-100 dark:hover:bg-amber-950 text-xs font-bold transition-all shadow-2xs"
            >
              <Plus size={14} /> New Folder
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {(driveFiles.vendor || []).map(folder => (
              <div key={folder.id} className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden group hover:border-amber-400 transition-all shadow-2xs">
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="w-9 h-9 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded-lg flex items-center justify-center shrink-0">
                      <Folder size={18} />
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => downloadFolderAsZip(folder)} className="p-1 text-slate-400 hover:text-teal-600 transition-colors" title="Download ZIP"><Download size={14} /></button>
                      <button onClick={() => handleDeleteFolder(folder)} className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="Delete Folder"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-slate-900 dark:text-slate-100 truncate">{folder.name}</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{(folder.files || []).length} items • Manufacturer Docs</p>
                  </div>
                  
                  <button 
                    onClick={() => setOpenVendorFolder(openVendorFolder === folder.id ? null : folder.id)}
                    className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    {openVendorFolder === folder.id ? 'Close Folder' : <><FolderOpen size={14} /> Open Folder</>}
                  </button>
                </div>

                {openVendorFolder === folder.id && (
                  <div className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 p-3 space-y-2 max-h-[300px] overflow-y-auto">
                    <div className="flex items-center justify-between gap-2 mb-1.5 sticky top-0 bg-white dark:bg-slate-950 pb-1.5 z-10 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Files</span>
                      <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleDriveUpload(e, 'drive_vendor_files', folder.id)} className="hidden" id={`file-upload-${folder.id}`} />
                      <label htmlFor={`file-upload-${folder.id}`} className="text-[11px] font-bold text-teal-600 dark:text-teal-400 cursor-pointer hover:underline">+ Add Files</label>
                    </div>
                    {(folder.files || []).length === 0 ? (
                      <p className="text-[11px] text-center text-slate-400 py-3">No files yet.</p>
                    ) : (
                      (folder.files || []).map(file => (
                        <div key={file.id} className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileCheck size={14} className="text-teal-600 dark:text-teal-400 shrink-0" />
                            <span className="text-[11.5px] font-semibold text-slate-800 dark:text-slate-200 truncate">{file.label}</span>
                          </div>
                          <button onClick={() => handleDeleteDriveFile('drive_vendor_files', file)} className="p-1 text-slate-400 hover:text-red-500 shrink-0">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(DriveView);
