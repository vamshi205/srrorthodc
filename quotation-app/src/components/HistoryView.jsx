import React, { useState, useMemo } from 'react';
import { Search, LayoutDashboard, Download, Mail, Eye, Printer, Edit2, History, Clock } from 'lucide-react';

const formatQuotationAmount = (item) => {
  if (!item) return null;
  if (typeof item.totalAmount === 'number' && item.totalAmount > 0) {
    return '₹' + item.totalAmount.toLocaleString('en-IN');
  }
  const content = item.content || item.formData?.content;
  if (!content || !Array.isArray(content)) return null;

  let total = 0;
  let foundAmount = false;

  content.forEach(block => {
    if (block && block.type === 'table' && Array.isArray(block.headers) && Array.isArray(block.rows)) {
      const headers = block.headers.map(h => String(h || '').toLowerCase());
      const amountIdx = headers.findIndex(h => h === 'amount' || h === 'total' || h.includes('amount') || h.includes('total'));
      const rateIdx = headers.findIndex(h => h === 'rate' || h === 'mrp' || h === 'price');
      const qtyIdx = headers.findIndex(h => h === 'qty' || h === 'quantity');

      block.rows.forEach(row => {
        if (!Array.isArray(row)) return;
        let val = 0;
        if (amountIdx !== -1 && row[amountIdx]) {
          const rawVal = String(row[amountIdx]).replace(/[^0-9.]/g, '');
          val = parseFloat(rawVal) || 0;
        } else if (rateIdx !== -1 && row[rateIdx]) {
          const rawRate = String(row[rateIdx]).replace(/[^0-9.]/g, '');
          const rate = parseFloat(rawRate) || 0;
          const rawQty = qtyIdx !== -1 ? String(row[qtyIdx]).replace(/[^0-9.]/g, '') : '1';
          const qty = parseFloat(rawQty) || 1;
          val = rate * qty;
        }
        if (val > 0) {
          total += val;
          foundAmount = true;
        }
      });
    }
  });

  if (!foundAmount || total === 0) return null;

  const gstStr = item.formData?.gst || item.gst || '0';
  const gstMatch = String(gstStr).match(/\d+(\.\d+)?/);
  const gstPercent = gstMatch ? parseFloat(gstMatch[0]) : 0;
  if (gstPercent > 0) {
    total += total * (gstPercent / 100);
  }

  return '₹' + Math.round(total).toLocaleString('en-IN');
};

export const EmailSentTooltip = ({ item, emailHistory = [] }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const itemRef = item?.ref || item?.formData?.referenceNumber || '';
  const itemHospital = item?.hospital || item?.formData?.hospitalName || '';

  const matchingLogs = useMemo(() => {
    if (!emailHistory || !Array.isArray(emailHistory)) return [];
    return emailHistory.filter(e => {
      if (!e) return false;
      const logRef = e.ref || e.quotationRef || e.referenceNumber || '';
      const logHospital = e.hospital || e.hospitalName || '';
      if (itemRef && logRef && (logRef === itemRef || itemRef.includes(logRef) || logRef.includes(itemRef))) return true;
      if (itemHospital && logHospital && logHospital.toLowerCase() === itemHospital.toLowerCase()) return true;
      return false;
    });
  }, [emailHistory, itemRef, itemHospital]);

  const isEmailed = Boolean(item?.isEmailed || item?.lastEmailedTo || matchingLogs.length > 0);

  if (!isEmailed) return null;

  const primaryRecipient = item?.lastEmailedTo || (matchingLogs.length > 0 ? (matchingLogs[0].sentTo || matchingLogs[0].to) : 'Recipient');
  const rawTime = item?.lastEmailedAt || (matchingLogs.length > 0 ? (matchingLogs[0].sentAt || matchingLogs[0].sentDate) : null);
  const formattedTime = rawTime 
    ? (isNaN(new Date(rawTime).getTime()) ? rawTime : new Date(rawTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }))
    : 'Recently';

  const nativeTitleText = matchingLogs.length > 0
    ? matchingLogs.map(l => `To: ${l.sentTo || l.to || 'Recipient'} (${l.sentDate || l.sentAt || 'Recently'})`).join('\n')
    : `Sent to: ${primaryRecipient}\nTime: ${formattedTime}`;

  return (
    <div 
      className="relative inline-flex items-center ml-1.5 shrink-0 z-30"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div 
        className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center cursor-pointer shadow-2xs border border-emerald-300"
        title={nativeTitleText}
      >
        <Mail size={11} />
      </div>

      {/* Popover on Hover (React State Controlled) */}
      {showTooltip && (
        <div className="absolute left-0 top-full mt-1.5 w-64 md:w-72 bg-slate-900 text-white rounded-xl p-3 text-xs shadow-2xl z-50 pointer-events-none transition-all animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 mb-2">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400">
              <Mail size={13} />
              <span>Email Dispatch Details</span>
            </div>
            <span className="text-[9.5px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">
              {matchingLogs.length > 0 ? `${matchingLogs.length} ${matchingLogs.length === 1 ? 'Sent' : 'Times'}` : 'Emailed'}
            </span>
          </div>

          {matchingLogs.length > 0 ? (
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1 text-[11.5px]">
              {matchingLogs.map((log, idx) => (
                <div key={idx} className="border-b border-slate-800 last:border-0 pb-1.5 last:pb-0">
                  <div className="flex items-center justify-between text-slate-200 mb-0.5">
                    <span className="font-bold text-slate-100 truncate max-w-[190px]" title={log.sentTo || log.to}>
                      To: {log.sentTo || log.to || 'Recipient'}
                    </span>
                  </div>
                  {log.subject && (
                    <p className="text-[10.5px] text-slate-400 truncate mb-0.5" title={log.subject}>
                      Subject: {log.subject}
                    </p>
                  )}
                  <div className="text-[10px] text-teal-400 font-medium flex items-center gap-1">
                    <Clock size={10} className="shrink-0" />
                    <span>
                      {log.sentAt 
                        ? (isNaN(new Date(log.sentAt).getTime()) ? log.sentAt : new Date(log.sentAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }))
                        : (log.sentDate ? `${log.sentDate} ${log.sentTime || ''}` : 'Recently')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5 text-[11.5px]">
              <div className="flex items-start gap-1">
                <span className="font-bold text-slate-400 shrink-0">To:</span>
                <span className="font-semibold text-slate-100 break-all">{primaryRecipient}</span>
              </div>
              <div className="flex items-center gap-1 text-[10.5px] text-teal-400 pt-1.5 border-t border-slate-800 font-medium">
                <Clock size={10} className="shrink-0" />
                <span>{formattedTime}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const HistoryView = ({ quotationHistory = [], emailHistory = [], searchQuery, setSearchQuery, isGenerating, regeneratingItem, setRegeneratingItem, onEdit, onHistory }) => {
  const filteredHistory = useMemo(() => {
    return quotationHistory.filter(item => 
      (item.hospital || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (item.ref || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.templateName && item.templateName.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [quotationHistory, searchQuery]);

  return (
    <div className="h-full overflow-y-auto px-8 py-12 md:px-16 md:py-16">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <h1 className="apple-title-1 mb-2">History</h1>
            <p className="apple-subtitle">Recent quotations generated. <span className="font-semibold text-[var(--apple-black)]">{quotationHistory.length}</span> total</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--apple-gray-4)] w-4 h-4" />
            <input 
              type="search" 
              placeholder="Search hospital or ref..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              className="apple-input !pl-10 !py-2.5 w-full md:w-[280px]"
            />
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="text-center py-20 opacity-40">
            <LayoutDashboard size={48} className="mx-auto mb-4" />
            <p className="font-semibold text-lg">No history matches found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table */}
            <div className="hidden md:block apple-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--apple-gray-1)] border-b border-[var(--apple-gray-2)]">
                    <th className="text-left py-3 px-5 text-[11px] font-bold uppercase tracking-wider text-[var(--apple-gray-5)]">Ref No.</th>
                    <th className="text-left py-3 px-5 text-[11px] font-bold uppercase tracking-wider text-[var(--apple-gray-5)]">Hospital</th>
                    <th className="text-left py-3 px-5 text-[11px] font-bold uppercase tracking-wider text-[var(--apple-gray-5)]">Template</th>
                    <th className="text-left py-3 px-5 text-[11px] font-bold uppercase tracking-wider text-[var(--apple-gray-5)]">Amount</th>
                    <th className="text-left py-3 px-5 text-[11px] font-bold uppercase tracking-wider text-[var(--apple-gray-5)]">Date</th>
                    <th className="text-right py-3 px-5 text-[11px] font-bold uppercase tracking-wider text-[var(--apple-gray-5)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((item) => {
                    const childCount = quotationHistory.filter(h => h.parentRef === item.ref).length;
                    const amountFormatted = formatQuotationAmount(item);
                    return (
                      <tr key={item.id} className="border-b border-[var(--apple-gray-2)] last:border-0 hover:bg-[var(--apple-gray-1)] transition-colors">
                        <td className="py-4 px-5">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[13px] font-bold text-[var(--emerald)] bg-[var(--emerald-light)] px-2.5 py-1 rounded-md whitespace-nowrap">{(item.ref || '').replace('SRR/QUOT/', '')}</span>
                              {item.parentRef && (
                                <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  Rev #{item.revisionCount || 1}
                                </span>
                              )}
                              {childCount > 0 && (
                                <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  Modified {childCount}x
                                </span>
                              )}
                            </div>
                            {item.parentRef && (
                              <span className="text-[10.5px] text-slate-500 font-medium">From: {item.parentRef}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[15px] font-semibold text-[var(--apple-black)]">{item.hospital}</span>
                            {(item.isEmailed || item.lastEmailedTo) && (
                              <EmailSentTooltip item={item} emailHistory={emailHistory} />
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <span className="text-[13px] text-[var(--apple-gray-5)] font-medium">{item.templateName}</span>
                        </td>
                        <td className="py-4 px-5">
                          {amountFormatted ? (
                            <span className="text-[13.5px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg inline-block whitespace-nowrap shadow-2xs">
                              {amountFormatted}
                            </span>
                          ) : (
                            <span className="text-[13px] text-slate-400 font-medium">—</span>
                          )}
                        </td>
                        <td className="py-4 px-5">
                          <span className="text-[13px] text-[var(--apple-gray-5)] font-medium">{item.date}</span>
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button 
                              onClick={() => setRegeneratingItem({ ...item, _viewMode: true })}
                              disabled={isGenerating || regeneratingItem}
                              className="w-8 h-8 flex items-center justify-center bg-white border border-[var(--apple-gray-2)] rounded-lg text-[var(--apple-gray-6)] hover:border-teal-500 hover:text-teal-600 hover:bg-teal-50 transition-all disabled:opacity-50 shadow-2xs"
                              title="View PDF"
                            >
                              <Eye size={15} />
                            </button>
                            {onEdit && (
                              <button 
                                onClick={() => onEdit(item)}
                                className="w-8 h-8 flex items-center justify-center bg-white border border-[var(--apple-gray-2)] rounded-lg text-blue-600 hover:border-blue-500 hover:bg-blue-50 transition-all shadow-2xs"
                                title="Edit details"
                              >
                                <Edit2 size={15} />
                              </button>
                            )}
                            <button 
                              onClick={() => setRegeneratingItem(item)}
                              disabled={isGenerating || regeneratingItem}
                              className="w-8 h-8 flex items-center justify-center bg-white border border-[var(--apple-gray-2)] rounded-lg text-emerald-600 hover:border-emerald-500 hover:bg-emerald-50 transition-all disabled:opacity-50 shadow-2xs"
                              title="Download PDF"
                            >
                              <Download size={15} />
                            </button>
                            {onHistory && (
                              <button 
                                onClick={() => onHistory(item)}
                                className="w-8 h-8 flex items-center justify-center bg-white border border-[var(--apple-gray-2)] rounded-lg text-amber-700 hover:border-amber-500 hover:bg-amber-50 transition-all shadow-2xs"
                                title="Revision History"
                              >
                                <History size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
              {filteredHistory.map((item) => {
                const amountFormatted = formatQuotationAmount(item);
                return (
                  <div key={item.id} className="apple-card p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[16px] font-bold text-[var(--apple-black)] leading-tight">{item.hospital}</p>
                          {(item.isEmailed || item.lastEmailedTo) && (
                            <EmailSentTooltip item={item} emailHistory={emailHistory} />
                          )}
                        </div>
                        <p className="text-[12px] text-[var(--apple-gray-5)] font-medium">{item.templateName}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {amountFormatted ? (
                          <span className="text-[13px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                            {amountFormatted}
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-[var(--emerald)] bg-[var(--emerald-light)] px-2 py-0.5 rounded uppercase tracking-wider">{(item.ref || '').replace('SRR/QUOT/', '')}</span>
                        )}
                        {item.parentRef && (
                          <span className="text-[9px] font-extrabold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                            Rev #{item.revisionCount || 1}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[13px] text-[var(--apple-gray-5)] font-medium">
                      <span>{item.date}</span>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-[var(--apple-gray-2)]">
                      <button 
                        onClick={() => setRegeneratingItem({ ...item, _viewMode: true })}
                        disabled={isGenerating || regeneratingItem}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-[var(--apple-gray-1)] rounded-xl text-[var(--apple-gray-6)] active:scale-[0.98] transition-all"
                        title="View"
                      >
                        <Eye size={18} />
                      </button>
                      {onEdit && (
                        <button 
                          onClick={() => onEdit(item)}
                          className="flex-1 flex items-center justify-center gap-1 py-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 font-bold text-[12px] active:scale-[0.98] transition-all"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                      <button 
                        onClick={() => setRegeneratingItem(item)}
                        disabled={isGenerating || regeneratingItem}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-[var(--apple-gray-1)] rounded-xl text-[var(--emerald)] active:scale-[0.98] transition-all"
                        title="Download"
                      >
                        <Download size={18} />
                      </button>
                      <button 
                        onClick={() => setRegeneratingItem({ ...item, _printMode: true })}
                        disabled={isGenerating || regeneratingItem}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-[var(--apple-gray-1)] rounded-xl text-indigo-600 active:scale-[0.98] transition-all"
                        title="Print"
                      >
                        <Printer size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(HistoryView);
