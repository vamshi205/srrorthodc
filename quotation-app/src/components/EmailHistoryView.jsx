import React from 'react';
import { Mail, Clock, User, FileText, ChevronRight, Search, Trash2 } from 'lucide-react';

const EmailHistoryView = ({ history = [], onDelete }) => {
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredHistory = history.filter(item => 
    item.to.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full overflow-y-auto px-8 py-12 md:px-16 md:py-16">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <h1 className="apple-title-1 mb-2">Email History</h1>
            <p className="apple-subtitle">Logs of all communications dispatched via Resend.</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--apple-gray-4)] w-4 h-4" />
            <input
              type="search"
              placeholder="Search recipient or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              className="apple-input !pl-10 !py-2.5 w-full md:w-[280px]"
            />
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="apple-card py-20 flex flex-col items-center justify-center border-dashed">
            <Mail size={48} className="text-[var(--apple-gray-3)] mb-4" />
            <p className="text-[17px] font-medium text-[var(--apple-gray-5)]">No email history found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map((item) => (
              <div key={item.id} className="apple-card p-6 hover:border-[var(--apple-gray-4)] transition-all group">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Left: Info */}
                  <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[var(--apple-gray-1)] rounded-full flex items-center justify-center shrink-0">
                          <User size={18} className="text-[var(--apple-gray-6)]" />
                        </div>
                        <div>
                          <p className="text-[15px] font-bold text-[var(--apple-black)] leading-tight">{item.to}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock size={12} className="text-[var(--apple-gray-4)]" />
                            <span className="text-[12px] text-[var(--apple-gray-5)] font-medium">
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
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${item.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {item.status || 'success'}
                      </span>
                    </div>

                    <div className="pl-[52px]">
                      <h4 className="text-[15px] font-bold text-[var(--apple-black)] mb-1">{item.subject}</h4>
                      <p className="text-[13px] text-[var(--apple-gray-6)] line-clamp-2 leading-relaxed">
                        {item.body}
                      </p>
                    </div>

                    <div className="pl-[52px] flex flex-wrap gap-2 pt-2">
                      {(item.attachments || []).map((file, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-[var(--apple-gray-1)] rounded text-[11px] font-semibold text-[var(--apple-gray-6)] border border-[var(--apple-gray-2)]">
                          <FileText size={12} />
                          {file}
                        </div>
                      ))}
                      {(!item.attachments || item.attachments.length === 0) && (
                        <span className="text-[11px] text-[var(--apple-gray-4)] italic">No attachments</span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex md:flex-col items-center justify-end gap-2 md:border-l md:border-[var(--apple-gray-2)] md:pl-6">
                    <button 
                      onClick={() => onDelete && onDelete(item.id)}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--apple-gray-4)] hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                      title="Delete log"
                    >
                      <Trash2 size={18} />
                    </button>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--apple-gray-4)]">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailHistoryView;
