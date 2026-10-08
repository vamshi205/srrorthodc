const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx');
let content = fs.readFileSync(targetFile, 'utf8').replace(/\r\n/g, '\n');

const startMarker = `{/* State: Cash Queue - Awaiting Payment */}`;
const endMarker = `{/* State: Cancelled */}`;

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `{/* State: Cash Queue - Awaiting Payment */}
                        {selectedDc.status === "cash" && (
                          <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                                <Wallet className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                  <span>Cash Memo Linked:</span>
                                  <span className="font-mono text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded text-[11px] font-bold">
                                    {selectedDc.invoiceRef || "Cash Memo"}
                                  </span>
                                  <Badge className="bg-amber-500/15 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0 font-bold">
                                    ● Awaiting Payment (
                                    {getCashMemoAgingDays(selectedDc)}d)
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-slate-600 mt-0.5">
                                  Unpaid in Cash Queue. Remaining Due:{" "}
                                  <span className="font-bold text-slate-800">
                                    ₹
                                    {Math.max(
                                      0,
                                      (selectedDc.originalInvoiceTotal ||
                                        selectedDc.cashAmount ||
                                        0) - (selectedDc.paidAmount || 0),
                                    ).toLocaleString("en-IN")}
                                  </span>
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
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
                              <Button
                                size="sm"
                                className="h-7 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-none"
                                onClick={() => openPaymentDialog(selectedDc)}
                              >
                                <Wallet className="h-3.5 w-3.5 mr-1" /> Mark as Paid / Record Payment
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* State: Completed / Paid */}
                        {(selectedDc.status === "completed" ||
                          (selectedDc.status !== "cash" &&
                            selectedDc.invoiceRef)) && (
                          <div className="rounded-xl border border-emerald-300/90 bg-emerald-50/70 dark:bg-emerald-950/40 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-none">
                            <div className="flex items-center gap-2.5">
                              <div className="h-9 w-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-none">
                                <CheckCircle2 className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-2 flex-wrap">
                                  <span>
                                    {isRealBankTransfer(selectedDc, linkedBankTx)
                                      ? "⚡ Bank Payment Linked & Settled"
                                      : "💵 Physical Cash Collected (Unlinked to Bank Deposit)"}
                                  </span>
                                  <Badge className="bg-emerald-700 text-white text-[10px] font-bold py-0.5 px-2">
                                    {isRealBankTransfer(selectedDc, linkedBankTx)
                                      ? "BANK SETTLED"
                                      : "CASH COLLECTED"}
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                                  {selectedDc.invoiceRef
                                    ? \`Cash Memo: \${selectedDc.invoiceRef} • \`
                                    : ""}
                                  {isRealBankTransfer(selectedDc, linkedBankTx)
                                    ? \`Reconciled with Bank Deposit (UTR: \${selectedDc.utrNo || linkedBankTx?.referenceNumber || "Verified"})\`
                                    : \`Cash payment of ₹\${((selectedDc as any).cashAmount || 0).toLocaleString("en-IN")} collected\${selectedDc.collectedBy ? \` by \${selectedDc.collectedBy}\` : ""}. Optional bank deposit link pending.\`}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
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
                        )}

                        `;

  content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log("Successfully restored all Next Steps state cards!");
} else {
  console.log("Markers not found", startIdx, endIdx);
}
