import React, { useMemo } from 'react';
import { Search, LayoutDashboard, Download, Mail, Eye, Printer } from 'lucide-react';

const HistoryView = ({ quotationHistory, searchQuery, setSearchQuery, isGenerating, regeneratingItem, setRegeneratingItem }) => {
  const filteredHistory = useMemo(() => {
    return quotationHistory.filter(item => 
      item.hospital.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
                    <th className="text-left py-3 px-5 text-[11px] font-bold uppercase tracking-wider text-[var(--apple-gray-5)]">Date</th>
                    <th className="text-right py-3 px-5 text-[11px] font-bold uppercase tracking-wider text-[var(--apple-gray-5)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((item) => (
                    <tr key={item.id} className="border-b border-[var(--apple-gray-2)] last:border-0 hover:bg-[var(--apple-gray-1)] transition-colors">
                      <td className="py-4 px-5">
                        <span className="text-[13px] font-bold text-[var(--emerald)] bg-[var(--emerald-light)] px-2.5 py-1 rounded-md whitespace-nowrap">{(item.ref || '').replace('SRR/QUOT/', '')}</span>
                      </td>
                      <td className="py-4 px-5">
                        <span className="text-[15px] font-semibold text-[var(--apple-black)]">{item.hospital}</span>
                      </td>
                      <td className="py-4 px-5">
                        <span className="text-[13px] text-[var(--apple-gray-5)] font-medium">{item.templateName}</span>
                      </td>
                      <td className="py-4 px-5">
                        <span className="text-[13px] text-[var(--apple-gray-5)] font-medium">{item.date}</span>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => setRegeneratingItem({ ...item, _viewMode: true })}
                            disabled={isGenerating || regeneratingItem}
                            className="w-9 h-9 flex items-center justify-center bg-white border border-[var(--apple-gray-2)] rounded-full text-[var(--apple-gray-6)] hover:border-[var(--apple-gray-4)] hover:bg-[var(--apple-gray-1)] transition-all disabled:opacity-50 shadow-sm"
                            title="View PDF"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={() => setRegeneratingItem(item)}
                            disabled={isGenerating || regeneratingItem}
                            className="w-9 h-9 flex items-center justify-center bg-white border border-[var(--apple-gray-2)] rounded-full text-[var(--emerald)] hover:border-[var(--emerald)] hover:bg-[var(--emerald-light)] transition-all disabled:opacity-50 shadow-sm"
                            title="Download PDF"
                          >
                            <Download size={16} />
                          </button>
                          <button 
                            onClick={() => setRegeneratingItem({ ...item, _printMode: true })}
                            disabled={isGenerating || regeneratingItem}
                            className="w-9 h-9 flex items-center justify-center bg-white border border-[var(--apple-gray-2)] rounded-full text-indigo-600 hover:border-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-50 shadow-sm"
                            title="Print Quotation"
                          >
                            <Printer size={16} />
                          </button>
                          <button 
                            onClick={() => setRegeneratingItem({ ...item, _shareMode: true })}
                            disabled={isGenerating || regeneratingItem}
                            className="w-9 h-9 flex items-center justify-center bg-white border border-[var(--apple-gray-2)] rounded-full text-[var(--coral)] hover:border-[var(--coral)] hover:bg-red-50 transition-all disabled:opacity-50 shadow-sm"
                            title="Email Quotation"
                          >
                            <Mail size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
              {filteredHistory.map((item) => (
                <div key={item.id} className="apple-card p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-[16px] font-bold text-[var(--apple-black)] leading-tight">{item.hospital}</p>
                      <p className="text-[12px] text-[var(--apple-gray-5)] font-medium">{item.templateName}</p>
                    </div>
                    <span className="text-[11px] font-bold text-[var(--emerald)] bg-[var(--emerald-light)] px-2 py-0.5 rounded uppercase tracking-wider">{(item.ref || '').replace('SRR/QUOT/', '')}</span>
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
                    <button 
                      onClick={() => setRegeneratingItem({ ...item, _shareMode: true })}
                      disabled={isGenerating || regeneratingItem}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-[var(--apple-gray-1)] rounded-xl text-[var(--coral)] active:scale-[0.98] transition-all"
                      title="Email"
                    >
                      <Mail size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(HistoryView);
