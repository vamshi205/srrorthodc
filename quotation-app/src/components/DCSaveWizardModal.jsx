import React, { useState } from 'react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  Calendar, 
  Building2, 
  User, 
  FileText, 
  Truck, 
  Download, 
  Printer,
  Mail, 
  Save, 
  Layers,
  Sparkles
} from 'lucide-react';

const DCSaveWizardModal = ({ 
  isOpen, 
  onClose, 
  formData, 
  onFormDataChange, 
  draftContent, 
  onSaveDC, 
  isGenerating 
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [dcMode, setDcMode] = useState('auto'); // 'auto' | 'manual'
  const [transportInfo, setTransportInfo] = useState({
    dispatchDate: formData?.date || new Date().toISOString().split('T')[0],
    vehicleNo: '',
    courierName: '',
    dcNotes: ''
  });

  if (!isOpen) return null;

  const totalItemsCount = Array.isArray(draftContent) 
    ? draftContent.reduce((acc, block) => acc + (block.rows ? block.rows.length : 0), 0)
    : 0;

  const handleNext = () => {
    if (currentStep < 3) setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(prev => prev - 1);
  };

  const handleCompleteSave = (action) => {
    const dcPayload = {
      ...formData,
      dcMode,
      transportInfo
    };
    onSaveDC(dcPayload, action);
  };

  return (
    <div className="fixed inset-0 z-[8000] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Save Delivery Challan (DC)</h2>
              <p className="text-xs text-teal-200/75">Step {currentStep} of 3 — Guided DC Save Wizard</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="bg-slate-100 border-b border-slate-200 px-8 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 flex-1">
            <div className={`flex items-center gap-2 text-xs font-bold ${currentStep >= 1 ? 'text-teal-700' : 'text-slate-400'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${currentStep >= 1 ? 'bg-teal-600 text-white' : 'bg-slate-300 text-slate-600'}`}>1</span>
              <span>Details & Date</span>
            </div>
            <div className={`h-1 flex-1 rounded-full ${currentStep >= 2 ? 'bg-teal-500' : 'bg-slate-200'}`} />
            <div className={`flex items-center gap-2 text-xs font-bold ${currentStep >= 2 ? 'text-teal-700' : 'text-slate-400'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${currentStep >= 2 ? 'bg-teal-600 text-white' : 'bg-slate-300 text-slate-600'}`}>2</span>
              <span>Items Review</span>
            </div>
            <div className={`h-1 flex-1 rounded-full ${currentStep >= 3 ? 'bg-teal-500' : 'bg-slate-200'}`} />
            <div className={`flex items-center gap-2 text-xs font-bold ${currentStep >= 3 ? 'text-teal-700' : 'text-slate-400'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${currentStep >= 3 ? 'bg-teal-600 text-white' : 'bg-slate-300 text-slate-600'}`}>3</span>
              <span>Save & Actions</span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6">
          
          {/* STEP 1: DC Mode, Header Info & Date Selection */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* DC Mode Selection */}
              <div>
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block mb-2">DC Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDcMode('auto')}
                    className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all ${dcMode === 'auto' ? 'border-teal-500 bg-teal-50/70 ring-2 ring-teal-500/20 text-teal-950 font-bold' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                  >
                    <Sparkles className={dcMode === 'auto' ? 'text-teal-600' : 'text-slate-400'} size={18} />
                    <div className="text-left">
                      <p className="text-sm">Auto DC</p>
                      <p className="text-[11px] text-slate-500 font-normal">Auto-linked from template items</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDcMode('manual')}
                    className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all ${dcMode === 'manual' ? 'border-teal-500 bg-teal-50/70 ring-2 ring-teal-500/20 text-teal-950 font-bold' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                  >
                    <Layers className={dcMode === 'manual' ? 'text-teal-600' : 'text-slate-400'} size={18} />
                    <div className="text-left">
                      <p className="text-sm">Manual DC</p>
                      <p className="text-[11px] text-slate-500 font-normal">Custom item entry mode</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Date & Ref Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mb-1.5">
                    <Calendar size={14} className="text-teal-600" /> DC Date
                  </label>
                  <input
                    type="text"
                    value={formData?.date || ''}
                    onChange={(e) => onFormDataChange('date', e.target.value)}
                    placeholder="DD/MM/YYYY"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mb-1.5">
                    <FileText size={14} className="text-teal-600" /> DC Ref Number
                  </label>
                  <input
                    type="text"
                    value={formData?.referenceNumber || ''}
                    readOnly
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 cursor-not-allowed opacity-80"
                  />
                </div>
              </div>

              {/* Hospital & Doctor Info */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mb-1.5">
                    <Building2 size={14} className="text-teal-600" /> Hospital Name
                  </label>
                  <input
                    type="text"
                    value={formData?.hospitalName || ''}
                    onChange={(e) => onFormDataChange('hospitalName', e.target.value)}
                    placeholder="e.g. Yashoda Hospital"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mb-1.5">
                    <User size={14} className="text-teal-600" /> Doctor Name
                  </label>
                  <input
                    type="text"
                    value={formData?.doctorName || ''}
                    onChange={(e) => onFormDataChange('doctorName', e.target.value)}
                    placeholder="e.g. Dr. A. K. Sharma"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Dispatch / Transport optional info */}
              <div className="pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mb-2">
                  <Truck size={14} className="text-teal-600" /> Dispatch Details (Optional)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={transportInfo.vehicleNo}
                    onChange={(e) => setTransportInfo({ ...transportInfo, vehicleNo: e.target.value })}
                    placeholder="Vehicle / Courier No."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                  />
                  <input
                    type="text"
                    value={transportInfo.courierName}
                    onChange={(e) => setTransportInfo({ ...transportInfo, courierName: e.target.value })}
                    placeholder="Transport / Dispatcher Name"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                  />
                </div>
              </div>

            </div>
          )}

          {/* STEP 2: Items Summary Review */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between bg-teal-50 border border-teal-200/80 rounded-2xl p-4">
                <div>
                  <p className="text-sm font-extrabold text-teal-950">DC Mode: {dcMode === 'auto' ? 'Auto DC' : 'Manual DC'}</p>
                  <p className="text-xs text-teal-700 font-medium">Recipient: {formData?.hospitalName || formData?.doctorName || 'Client'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-teal-700 font-bold">Total Items</p>
                  <p className="text-lg font-black text-teal-900">{totalItemsCount}</p>
                </div>
              </div>

              {/* Items List Preview */}
              <div>
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block mb-2">Itemized Content Preview</label>
                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100 bg-slate-50/50">
                  {Array.isArray(draftContent) && draftContent.map((block, bIdx) => (
                    <div key={bIdx} className="p-3">
                      <p className="text-xs font-bold text-slate-700 mb-1.5">{block.title || `Block #${bIdx + 1}`}</p>
                      <div className="space-y-1">
                        {Array.isArray(block.rows) && block.rows.map((row, rIdx) => (
                          <div key={rIdx} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-100">
                            <span className="font-medium text-slate-800">{row[1] || row[0] || `Item ${rIdx + 1}`}</span>
                            <span className="font-bold text-teal-700">{row[row.length - 1] || ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional DC Remarks */}
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">DC Notes / Remarks</label>
                <textarea
                  rows="2"
                  value={transportInfo.dcNotes}
                  onChange={(e) => setTransportInfo({ ...transportInfo, dcNotes: e.target.value })}
                  placeholder="e.g. Returnable instruments box included..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Confirm & Action Choices */}
          {currentStep === 3 && (
            <div className="space-y-6 text-center animate-in fade-in duration-200 py-4">
              <div className="w-16 h-16 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">Ready to Save Delivery Challan</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  DC #{formData?.referenceNumber} for <span className="font-bold text-slate-700">{formData?.hospitalName || formData?.doctorName || 'Client'}</span> will be archived to Cloud & History. Select your preferred next action:
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => handleCompleteSave('print')}
                  className="p-4 rounded-2xl border border-indigo-200 hover:border-indigo-500 bg-indigo-50/60 hover:bg-indigo-100/60 flex flex-col items-center justify-center gap-2 group transition-all cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                    <Printer size={20} />
                  </div>
                  <span className="text-xs font-extrabold text-indigo-900">Save & Print DC</span>
                </button>

                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => handleCompleteSave('download')}
                  className="p-4 rounded-2xl border border-slate-200 hover:border-teal-500 bg-slate-50 hover:bg-teal-50/50 flex flex-col items-center justify-center gap-2 group transition-all cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-200 group-hover:bg-teal-600 group-hover:text-white flex items-center justify-center text-slate-700 transition-colors">
                    <Download size={20} />
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-teal-900">Download PDF</span>
                </button>

                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => handleCompleteSave('email')}
                  className="p-4 rounded-2xl border border-teal-500 bg-teal-600 hover:bg-teal-700 text-white flex flex-col items-center justify-center gap-2 shadow-lg shadow-teal-600/20 transition-all cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
                    <Mail size={20} />
                  </div>
                  <span className="text-xs font-extrabold">Email DC PDF</span>
                </button>

                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => handleCompleteSave('justSave')}
                  className="p-4 rounded-2xl border border-slate-200 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center gap-2 group transition-all cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-200 group-hover:bg-slate-800 group-hover:text-white flex items-center justify-center text-slate-700 transition-colors">
                    <Save size={20} />
                  </div>
                  <span className="text-xs font-bold text-slate-800">Save to History</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 1}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${currentStep === 1 ? 'opacity-0 pointer-events-none' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
          >
            <ChevronLeft size={16} /> Back
          </button>

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-teal-600/20 transition-all"
            >
              Next Step <ChevronRight size={16} />
            </button>
          ) : (
            <span className="text-[11px] text-slate-400 font-medium">Click an action above to finish</span>
          )}
        </div>

      </div>
    </div>
  );
};

export default DCSaveWizardModal;
