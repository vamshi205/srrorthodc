const fs = require('fs');

const replacement = `
                          <div className="mb-5 mx-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 sticky top-2 z-30 transition-all">
                            <div className="p-3.5 sm:p-4">
                              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 relative pr-8 lg:pr-0">
                                {/* Left Info Section */}
                                <div className="flex items-center gap-3 sm:gap-4 flex-wrap min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">{selectedDc.dcNo}</span>
                                    <Badge
                                      variant="outline"
                                      className={\`text-[10px] sm:text-xs font-semibold uppercase tracking-wider px-2 py-0.5 \${
                                        selectedDc.status === "pending"
                                          ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400"
                                          : selectedDc.status === "returned"
                                          ? "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900/50 dark:bg-teal-900/20 dark:text-teal-400"
                                          : selectedDc.status === "cash"
                                          ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-400"
                                          : selectedDc.status === "completed"
                                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400"
                                          : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400"
                                      }\`}
                                    >
                                      {selectedDc.status}
                                    </Badge>
                                    {daysPending > 0 && (
                                      <Badge variant="secondary" className={\`text-[10px] font-medium \${daysPending > 7 && selectedDc.status === "pending" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800 animate-pulse" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-100"}\`}>
                                        {daysPending}d Pending
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
                                  
                                  <span className="font-medium text-sm text-slate-700 dark:text-slate-200 truncate max-w-[280px]" title={selectedDc.hospitalName}>
                                    {selectedDc.hospitalName}
                                  </span>
                                  
                                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 ml-auto lg:ml-0">
                                    <span className="flex items-center gap-1.5 font-medium">
                                      <Calendar className="w-3.5 h-3.5" />
                                      {formatDate(getDisplayDate(selectedDc))}
                                    </span>
                                    <span className="flex items-center gap-1.5 font-medium">
                                      <Package className="w-3.5 h-3.5" />
                                      {totalQty} Items
                                    </span>
                                  </div>
                                </div>

                                {/* Right Close Button */}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 shrink-0 absolute -top-1 -right-1 lg:static"
                                  onClick={() => setSelectedDcId(null)}
                                  title="Clear selection"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>

                              {/* Options Action Buttons Row */}
                              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                                {/* Workflow Actions */}
                                {selectedDc.status === "pending" && (
                                  <>
                                    <Button size="sm" className="h-8 text-xs font-semibold shadow-sm gap-1.5 rounded-lg" onClick={() => openActionDialog("return", selectedDc)}>
                                      <User className="w-3.5 h-3.5" /> Mark Returned
                                    </Button>
                                    <Button size="sm" variant="secondary" className="h-8 text-xs font-semibold shadow-sm gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700" onClick={() => handleCreateCashMemoForDc(selectedDc)}>
                                      <Receipt className="w-3.5 h-3.5" /> Cash Memo
                                    </Button>
                                    <Button size="sm" variant="secondary" className="h-8 text-xs font-semibold shadow-sm gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700" onClick={() => openActionDialog("invoice", selectedDc)}>
                                      <FileText className="w-3.5 h-3.5" /> Tax Invoice
                                    </Button>
                                    <Button size="sm" variant="outline" className="h-8 text-xs font-semibold gap-1.5 rounded-lg" onClick={() => openActionDialog("purchase", selectedDc)}>
                                      <ShoppingBag className="w-3.5 h-3.5" /> Purchase Options
                                    </Button>
                                  </>
                                )}

                                {selectedDc.status === "returned" && !selectedDc.invoiceRef && (
                                  <>
                                    <Button size="sm" className="h-8 text-xs font-semibold shadow-sm gap-1.5 rounded-lg" onClick={() => handleCreateCashMemoForDc(selectedDc)}>
                                      <Receipt className="w-3.5 h-3.5" /> Create Cash Memo
                                    </Button>
                                    <Button size="sm" variant="secondary" className="h-8 text-xs font-semibold shadow-sm gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700" onClick={() => openActionDialog("invoice", selectedDc)}>
                                      <FileText className="w-3.5 h-3.5" /> Link Tax Invoice
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-8 text-xs font-medium gap-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100" onClick={() => setMoveToPendingDialog({ open: true, dc: selectedDc })}>
                                      <Undo2 className="w-3.5 h-3.5" /> Back to Pending
                                    </Button>
                                  </>
                                )}

                                {selectedDc.invoiceRef && selectedIsTaxInvoice && (
                                  <>
                                    {selectedDc.invoiceUrl ? (
                                      <Button size="sm" className="h-8 text-xs font-semibold shadow-sm gap-1.5 rounded-lg" onClick={() => window.open(selectedDc.invoiceUrl, "_blank")}>
                                        <ExternalLink className="w-3.5 h-3.5" /> GoGSTBill ({selectedDc.invoiceRef})
                                      </Button>
                                    ) : (
                                      <Button size="sm" className="h-8 text-xs font-semibold shadow-sm gap-1.5 rounded-lg" onClick={() => openActionDialog("invoice", selectedDc)}>
                                        <Link2 className="w-3.5 h-3.5" /> URL ({selectedDc.invoiceRef})
                                      </Button>
                                    )}
                                    <Button size="sm" variant="outline" className="h-8 text-xs font-semibold gap-1.5 rounded-lg" onClick={() => openActionDialog("invoice", selectedDc)}>
                                      <Edit className="w-3.5 h-3.5" /> Edit Invoice
                                    </Button>
                                  </>
                                )}

                                {selectedDc.invoiceRef && selectedIsCashMemo && (
                                  <>
                                    <Button size="sm" variant="secondary" className="h-8 text-xs font-semibold shadow-sm gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700" onClick={() => { setViewingCashMemoRef(selectedDc.invoiceRef); setCashMemoModalOpen(true); }}>
                                      <Receipt className="w-3.5 h-3.5" /> View Cash Memo
                                    </Button>
                                    {selectedDc.status === "cash" && (
                                      <Button size="sm" className="h-8 text-xs font-semibold shadow-sm gap-1.5 rounded-lg" onClick={() => openPaymentDialog(selectedDc)}>
                                        <Wallet className="w-3.5 h-3.5" /> Record Payment
                                      </Button>
                                    )}
                                    {selectedDc.status === "completed" && (
                                      <Button size="sm" variant="outline" className="h-8 text-xs font-medium gap-1.5 rounded-lg" onClick={() => moveBackToReturned(selectedDc)}>
                                        <Undo2 className="w-3.5 h-3.5" /> Back to Returned
                                      </Button>
                                    )}
                                    <Button size="sm" variant="outline" className="h-8 text-xs font-medium gap-1.5 rounded-lg" onClick={() => handleShareWhatsApp(selectedDc)}>
                                      <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                                    </Button>
                                    <Button size="sm" variant="outline" className="h-8 text-xs font-medium gap-1.5 rounded-lg" onClick={() => openDelinkConfirmDialog(selectedDc)}>
                                      <Undo2 className="w-3.5 h-3.5" /> Delink Memo
                                    </Button>
                                  </>
                                )}

                                {/* Common Quick Action Utilities */}
                                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

                                <Button size="sm" variant="ghost" className="h-8 text-xs font-medium gap-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800" onClick={() => setDcDocumentModalOpen(true)}>
                                  <Eye className="w-3.5 h-3.5" /> View DC
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 text-xs font-medium gap-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800" onClick={() => setDetailsDialogOpen(true)}>
                                  <Activity className="w-3.5 h-3.5" /> Track Status
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 text-xs font-medium gap-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800" onClick={() => handlePrint(selectedDc)}>
                                  <Printer className="w-3.5 h-3.5" /> Print
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 text-xs font-medium gap-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800" onClick={() => handleShare(selectedDc)}>
                                  <Share2 className="w-3.5 h-3.5" /> Share
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 text-xs font-medium gap-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800" onClick={() => openEditDcModal(selectedDc)}>
                                  <Edit className="w-3.5 h-3.5" /> Edit
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 text-xs font-medium gap-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800" onClick={() => handleOpenHospitalContact(selectedDc.hospitalName, selectedDc, !contactSummary.hasPhone)}>
                                  <Phone className="w-3.5 h-3.5" /> <span className="truncate max-w-[100px]">{contactSummary.hasPhone ? "Call" : "Add Phone"}</span>
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 text-xs font-medium gap-1.5 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50 ml-auto" onClick={() => requestDelete(selectedDc)}>
                                  <Trash2 className="w-3.5 h-3.5" /> Delete
                                </Button>
                              </div>
                            </div>
                          </div>
`;

let content = fs.readFileSync('src/pages/SavedDcs.tsx', 'utf-8');

const startIdx = content.indexOf('<div className="mb-3.5 mx-2 sm:mx-3 p-3 bg-gradient-to-r from-slate-900');
const endIdx = content.indexOf('</div>\n                        );', startIdx) + 6; // Include closing div

if (startIdx !== -1 && endIdx !== -1) {
    const before = content.substring(0, startIdx);
    const after = content.substring(endIdx);
    fs.writeFileSync('src/pages/SavedDcs.tsx', before + replacement.trim() + after);
    console.log("Successfully replaced!");
} else {
    console.log("Could not find start or end index.");
}
