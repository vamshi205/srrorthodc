import React, { useState, useMemo } from 'react';
import { Search, LayoutDashboard, Download, Mail, Eye, Printer, Edit2, History, Clock, Database, FileText, ChevronRight } from 'lucide-react';

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
    <div className="h-full overflow-y-auto px-3 py-3 md:px-5 md:py-4 w-full">
      <div className="w-full space-y-4">
        {/* Secondary Header Card matching NativeCashInvoice & Customers */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-400 flex items-center justify-center font-bold shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold font-sans text-slate-900 dark:text-slate-100 tracking-tight">
                  Quotation History & Revisions
                </h1>
                <span className="text-[11px] font-bold bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800 px-2.5 py-0.5 rounded-full">
                  {quotationHistory.length} Total
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Generated quotations, PDF downloads, revision histories, and dispatch status.
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-80 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="search" 
              placeholder="Search hospital, ref, or template..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-2xs"
            />
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <Database size={40} className="mx-auto mb-3 text-slate-400 opacity-60" />
            <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">No quotation history matches found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your search query.</p>
          </div>
        ) : (
          <div className="space-y-4 w-full">
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs w-full">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                    <th className="text-left py-3 px-4 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ref No.</th>
                    <th className="text-left py-3 px-4 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Hospital / Client</th>
                    <th className="text-left py-3 px-4 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Template</th>
                    <th className="text-left py-3 px-4 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Grand Total</th>
                    <th className="text-left py-3 px-4 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Date</th>
                    <th className="text-right py-3 px-4 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredHistory.map((item) => {
                    const childCount = quotationHistory.filter(h => h.parentRef === item.ref).length;
                    const amountFormatted = formatQuotationAmount(item);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[12px] font-black text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 px-2.5 py-0.5 rounded-lg whitespace-nowrap font-mono">
                                {(item.ref || '').replace('SRR/QUOT/', '')}
                              </span>
                              {item.parentRef && (
                                <span className="text-[9.5px] font-extrabold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  Rev #{item.revisionCount || 1}
                                </span>
                              )}
                              {childCount > 0 && (
                                <span className="text-[9.5px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  Modified {childCount}x
                                </span>
                              )}
                            </div>
                            {item.parentRef && (
                              <span className="text-[10px] text-slate-400 font-medium">From: {item.parentRef}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[14px] font-bold text-slate-900 dark:text-slate-100">{item.hospital}</span>
                            {(item.isEmailed || item.lastEmailedTo) && (
                              <EmailSentTooltip item={item} emailHistory={emailHistory} />
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-[12.5px] text-slate-600 dark:text-slate-300 font-medium">{item.templateName}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          {amountFormatted ? (
                            <span className="text-[13px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg inline-block whitespace-nowrap shadow-2xs font-mono">
                              {amountFormatted}
                            </span>
                          ) : (
                            <span className="text-[12px] text-slate-400 font-medium">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-[12.5px] text-slate-600 dark:text-slate-400 font-medium">{item.date}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button 
                              onClick={() => setRegeneratingItem({ ...item, _viewMode: true })}
                              disabled={isGenerating || regeneratingItem}
                              className="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:text-teal-600 hover:bg-teal-50 transition-all disabled:opacity-50 shadow-2xs"
                              title="View PDF"
                            >
                              <Eye size={14} />
                            </button>
                            {onEdit && (
                              <button 
                                onClick={() => onEdit(item)}
                                className="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-blue-600 hover:border-blue-500 hover:bg-blue-50 transition-all shadow-2xs"
                                title="Edit details"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                            <button 
                              onClick={() => setRegeneratingItem(item)}
                              disabled={isGenerating || regeneratingItem}
                              className="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-emerald-600 hover:border-emerald-500 hover:bg-emerald-50 transition-all disabled:opacity-50 shadow-2xs"
                              title="Download PDF"
                            >
                              <Download size={14} />
                            </button>
                            {onHistory && (
                              <button 
                                onClick={() => onHistory(item)}
                                className="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-amber-700 hover:border-amber-500 hover:bg-amber-50 transition-all shadow-2xs"
                                title="Revision History"
                              >
                                <History size={14} />
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

            {/* Mobile View Cards */}
            <div className="md:hidden space-y-3">
              {filteredHistory.map((item) => {
                const amountFormatted = formatQuotationAmount(item);
                return (
                  <div key={item.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 shadow-2xs">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[15px] font-bold text-slate-900 dark:text-slate-100 leading-tight">{item.hospital}</p>
                          {(item.isEmailed || item.lastEmailedTo) && (
                            <EmailSentTooltip item={item} emailHistory={emailHistory} />
                          )}
                        </div>
                        <p className="text-[12px] text-slate-500 font-medium">{item.templateName}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {amountFormatted ? (
                          <span className="text-[12px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 px-2 py-0.5 rounded-lg shadow-2xs font-mono">
                            {amountFormatted}
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded uppercase tracking-wider font-mono">{(item.ref || '').replace('SRR/QUOT/', '')}</span>
                        )}
                        {item.parentRef && (
                          <span className="text-[9px] font-extrabold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                            Rev #{item.revisionCount || 1}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[12px] text-slate-500 font-medium pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span>{item.date}</span>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button 
                        onClick={() => setRegeneratingItem({ ...item, _viewMode: true })}
                        disabled={isGenerating || regeneratingItem}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold text-xs transition-all"
                        title="View"
                      >
                        <Eye size={15} /> View
                      </button>
                      {onEdit && (
                        <button 
                          onClick={() => onEdit(item)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-semibold text-xs transition-all"
                          title="Edit"
                        >
                          <Edit2 size={15} /> Edit
                        </button>
                      )}
                      <button 
                        onClick={() => setRegeneratingItem(item)}
                        disabled={isGenerating || regeneratingItem}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-semibold text-xs transition-all"
                        title="Download"
                      >
                        <Download size={15} /> PDF
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
