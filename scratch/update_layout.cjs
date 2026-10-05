const fs = require('fs');

const path = 'c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\pages\\SavedDcs.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

const topBannerText = `                    <>
                      {/* Top Action Banner when a DC is selected */}
                      {selectedDc && (() => {
                        const daysPending = getDaysPending(selectedDc);
                        return (
                          <div className="sticky top-[80px] z-20 mb-4 mt-2 p-2 px-4 bg-slate-900 text-white rounded-xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                            {/* Left Status Info */}
                            <div className="flex items-center gap-3 flex-wrap min-w-0">
                              <Badge className="bg-white text-slate-900 text-xs font-black px-2.5 py-1">
                                {selectedDc.dcNo}
                              </Badge>
                              <Badge variant="outline" className={\`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 border-slate-500 text-slate-200\`}>
                                {selectedDc.status}
                              </Badge>
                              <span className="font-bold text-sm truncate max-w-[200px]" title={selectedDc.hospitalName}>
                                {selectedDc.hospitalName}
                              </span>
                            </div>

                            {/* Right Actions */}
                            <div className="flex items-center gap-2 flex-wrap shrink-0">
                              {/* Primary Actions based on status */}
                              {selectedDc.status === "pending" && (
                                <>
                                  <Button size="sm" className="h-8 text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white rounded-lg gap-1.5" onClick={() => openActionDialog("return", selectedDc)}>
                                    <User className="w-3.5 h-3.5" /> Return
                                  </Button>
                                  <Button size="sm" className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg gap-1.5" onClick={() => handleCreateCashMemoForDc(selectedDc)}>
                                    <Receipt className="w-3.5 h-3.5" /> Cash Memo
                                  </Button>
                                  <Button size="sm" className="h-8 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-lg gap-1.5" onClick={() => openActionDialog("invoice", selectedDc)}>
                                    <FileText className="w-3.5 h-3.5" /> Tax Invoice
                                  </Button>
                                </>
                              )}
                              
                              {selectedDc.status === "returned" && !selectedDc.invoiceRef && (
                                <>
                                  <Button size="sm" className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg gap-1.5" onClick={() => handleCreateCashMemoForDc(selectedDc)}>
                                    <Receipt className="w-3.5 h-3.5" /> Cash Memo
                                  </Button>
                                  <Button size="sm" className="h-8 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-lg gap-1.5" onClick={() => openActionDialog("invoice", selectedDc)}>
                                    <FileText className="w-3.5 h-3.5" /> Tax Invoice
                                  </Button>
                                </>
                              )}

                              {selectedDc.invoiceRef && selectedIsTaxInvoice && (
                                <Button size="sm" className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg gap-1.5" onClick={() => selectedDc.invoiceUrl ? window.open(selectedDc.invoiceUrl, '_blank') : openActionDialog("invoice", selectedDc)}>
                                  <ExternalLink className="w-3.5 h-3.5" /> GoGSTBill
                                </Button>
                              )}

                              {selectedDc.invoiceRef && selectedIsCashMemo && (
                                <Button size="sm" className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg gap-1.5" onClick={() => { setViewingCashMemoRef(selectedDc.invoiceRef!); setCashMemoModalOpen(true); }}>
                                  <Receipt className="w-3.5 h-3.5" /> View Memo
                                </Button>
                              )}
                              
                              <div className="h-4 w-px bg-slate-700 mx-1 hidden sm:block" />
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-white rounded-lg" onClick={() => setDcDocumentModalOpen(true)} title="View DC">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-white rounded-lg" onClick={() => setDetailsDialogOpen(true)} title="Track Status">
                                <Activity className="w-4 h-4" />
                              </Button>
                              
                              {/* Close Button */}
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-white rounded-lg ml-1 bg-slate-800" onClick={() => setSelectedDcId(null)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* DC Tracker Main View: Full Width Layout */}
                      <div className="w-full">
                        <div className="border-t-2 border-border/60">`;

// Find where to inject the top banner
let startIdx = lines.findIndex(l => l.includes('{/* DC Tracker Main View: Split Layout when a DC is selected */}'));
if (startIdx === -1) {
    console.log("Could not find start index");
    process.exit(1);
}

// Find right side panel start
let rightPanelStart = lines.findIndex(l => l.includes('{/* Right Side: Selected DC Action List Panel */}'));
if (rightPanelStart === -1) {
    console.log("Could not find right panel start");
    process.exit(1);
}

// Find the closing div of the grid which is just before </> (the closing fragment)
let rightPanelEnd = -1;
for (let i = rightPanelStart; i < lines.length; i++) {
    if (lines[i].includes('</>')) {
        rightPanelEnd = i - 2; // the </div> before </> and )}
        break;
    }
}
if (rightPanelEnd === -1) {
    console.log("Could not find right panel end");
    process.exit(1);
}

console.log("Removing right side panel from line", rightPanelStart + 1, "to", rightPanelEnd + 1);

// Remove right panel first to keep line numbers stable for earlier edits? No, actually doing it backwards is safer
lines.splice(rightPanelStart, rightPanelEnd - rightPanelStart + 1);

// Replace the grid start layout
const gridStartEnd = startIdx + 4; // covers up to <div className="border-t-2...
lines.splice(startIdx, 5, topBannerText);

fs.writeFileSync(path, lines.join('\n'));
console.log("Done");
