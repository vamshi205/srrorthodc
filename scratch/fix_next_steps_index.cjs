const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx');
let content = fs.readFileSync(targetFile, 'utf8').replace(/\r\n/g, '\n');

const startMarker = `<div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">`;
const endMarker = `{/* Optional Cash Memo / Tax Invoice Card in Overview */}`;

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  const fullOriginal = content.substring(startIdx, endIdx);

  const replacement = `<div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                                  {selectedIsCashMemo && (
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-none"
                                      onClick={() => {
                                        setDetailsDialogOpen(false);
                                        setViewingCashMemoRef(
                                          selectedDc.invoiceRef!,
                                        );
                                        setCashMemoModalOpen(true);
                                      }}
                                    >
                                      <Receipt className="h-3.5 w-3.5 mr-1" />{" "}
                                      View Cash Memo
                                    </Button>
                                  )}
                                  {!isRealBankTransfer(selectedDc, linkedBankTx) && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs border-emerald-400 text-emerald-800 bg-white hover:bg-emerald-50 font-semibold shadow-none"
                                      onClick={() => {
                                        setDetailsDialogOpen(false);
                                        openPaymentDialog(selectedDc);
                                      }}
                                    >
                                      <Landmark className="h-3 w-3 mr-1 text-emerald-600" />{" "}
                                      Link Bank Deposit
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )
                          )}

                          {/* State: Cancelled */}
                          {selectedDc.status === "cancelled" && (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                                <div>
                                  <span className="text-xs text-slate-700">
                                    This case was cancelled.
                                  </span>
                                  {selectedDc.returnedBy && (
                                    <span className="text-[10px] text-slate-500 block">
                                      Cancelled by: {selectedDc.returnedBy}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-slate-300 text-slate-700 hover:bg-white"
                                onClick={() => restoreFromCancelled(selectedDc)}
                              >
                                <Undo2 className="h-3 w-3 mr-1" /> Restore DC
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      `;

  content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log("Replaced Next Steps block by index successfully!");
} else {
  console.log("Markers not found", startIdx, endIdx);
}
