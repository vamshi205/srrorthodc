import React from 'react';
import { Mail, Clock, User, FileText, Search, Trash2, RotateCcw } from 'lucide-react';

const EmailHistoryView = ({ history = [], onDelete, onResend }) => {
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredHistory = history.filter(item => 
    item.to.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full space-y-4 px-2 sm:px-4 py-3 md:py-4">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Email History</h1>
          <p className="text-xs text-slate-500">Logs of all communications dispatched via Resend.</p>
        </div>
        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="search"
            placeholder="Search recipient or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* History List */}
      {filteredHistory.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Mail size={22} />
          </div>
          <p className="text-sm font-semibold text-slate-700">No email history found</p>
          <p className="text-xs text-slate-500 mt-1">Dispatched emails will appear here automatically.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs hover:border-slate-300 transition-all">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                {/* Left Info */}
                <div className="flex-1 space-y-3 min-w-0 w-full">
                  <div className="flex items-start justify-between gap-3 min-w-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 bg-slate-100 border border-slate-200/60 rounded-full flex items-center justify-center shrink-0 text-slate-600">
                        <User size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate" title={item.to}>{item.to}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500">
                          <Clock size={12} className="text-slate-400 shrink-0" />
                          <span>
                            {new Date(item.sentAt).toLocaleString('en-GB', { 
                              day: '2-digit', 
                              month: 'short', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border ${
                      item.status === 'success' || !item.status 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70' 
                        : 'bg-rose-50 text-rose-700 border-rose-200/70'
                    }`}>
                      {item.status || 'success'}
                    </span>
                  </div>

                  <div className="pl-0 sm:pl-[48px]">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 mb-1">{item.subject}</h4>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {item.body}
                    </p>
                  </div>

                  <div className="pl-0 sm:pl-[48px] flex flex-wrap gap-1.5 pt-1">
                    {(item.attachments || []).map((file, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded-md text-[11px] font-medium text-slate-600 border border-slate-200/80">
                        <FileText size={12} className="text-slate-400" />
                        {file}
                      </div>
                    ))}
                    {(!item.attachments || item.attachments.length === 0) && (
                      <span className="text-[11px] text-slate-400 italic">No attachments</span>
                    )}
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex md:flex-col items-center justify-end gap-2 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4 w-full md:w-auto">
                  <button 
                    type="button"
                    onClick={() => onResend && onResend(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-medium shadow-2xs transition-colors cursor-pointer"
                    title="Resend email with pre-filled details"
                  >
                    <RotateCcw size={14} />
                    <span>Resend</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => onDelete && onDelete(item.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200/60 transition-all"
                    title="Delete log"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmailHistoryView;

