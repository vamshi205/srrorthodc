const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx');
let content = fs.readFileSync(targetFile, 'utf8').replace(/\r\n/g, '\n');

const startMarker = `{/* Render single-transaction payment details card ONLY if there are no multi-installment part payments */}`;
const endMarker = `No Payment Settlement Recorded`;

const targetBlockStart = content.indexOf(startMarker);
const targetBlockEnd = content.indexOf(endMarker, targetBlockStart);

if (targetBlockStart !== -1 && targetBlockEnd !== -1) {
  // Find the closing parent div before endMarker
  const sub = content.substring(targetBlockStart, targetBlockEnd);
  const lastCloseDiv = sub.lastIndexOf('</div>');
  const fullOriginalBlock = sub.substring(0, lastCloseDiv + 6);

  const replacementBlock = `{/* Render single-transaction payment details card ONLY if there are no multi-installment part payments AND active payment exists */}
                        {(!selectedDc.partPayments ||
                          selectedDc.partPayments.length === 0) && (
                          Boolean(
                            linkedBankTx ||
                              selectedDc.utrNo ||
                              (selectedDc.paidAmount && selectedDc.paidAmount > 0) ||
                              (selectedDc.cashAmount && selectedDc.cashAmount > 0) ||
                              selectedDc.paymentStatus === "PAID" ||
                              selectedDc.status === "PAID"
                          ) ? (
                            <>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="p-2 rounded-lg bg-emerald-700 text-white shadow-none">
                                    <Landmark className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                      <span>
                                        {selectedDc.paymentMethod ===
                                          "bank_transfer" ||
                                        linkedBankTx ||
                                        selectedDc.utrNo
                                          ? "Payment & Bank Transaction Details"
                                          : "Cash Collection Record (Physical Cash)"}
                                      </span>
                                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-[10px] py-0 px-1.5 font-bold border border-emerald-300">
                                        {selectedDc.paymentMethod ===
                                          "bank_transfer" ||
                                        linkedBankTx ||
                                        selectedDc.utrNo
                                          ? "🏦 Bank Transfer / UPI"
                                          : "💵 Physical Cash (Hand Collected)"}
                                      </Badge>
                                    </h4>
                                    <p className="text-[11px] text-slate-500">
                                      {selectedDc.paymentMethod === "bank_transfer" ||
                                      linkedBankTx ||
                                      selectedDc.utrNo
                                        ? \`Reconciled bank transaction record for DC #\${selectedDc.dcNo}\`
                                        : \`Physical cash collected in hand for DC #\${selectedDc.dcNo} • Unlinked to bank statement\`}
                                    </p>
                                  </div>
                                </div>
                                {selectedDc.paidAmount ||
                                selectedDc.cashAmount ||
                                linkedBankTx?.amount ? (
                                  <div className="text-right">
                                    <span className="text-[10px] text-slate-500 uppercase font-bold block">
                                      Paid Amount
                                    </span>
                                    <span className="text-base font-black font-mono text-emerald-700 dark:text-emerald-400">
                                      ₹
                                      {(
                                        selectedDc.paidAmount ||
                                        selectedDc.cashAmount ||
                                        linkedBankTx?.amount ||
                                        0
                                      ).toLocaleString("en-IN")}
                                    </span>
                                  </div>
                                ) : null}
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2.5 border-t border-emerald-200/90 dark:border-emerald-800/80 text-xs">
                                <div>
                                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                                    Bank Account
                                  </span>
                                  <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1 mt-0.5">
                                    <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    {selectedDc.paymentMethod === "bank_transfer" ||
                                    linkedBankTx ||
                                    selectedDc.utrNo
                                      ? selectedDc.bankName || "Operating Account"
                                      : selectedDc.bankName ||
                                        "Physical Cash Treasury (In Hand)"}{" "}
                                    {selectedDc.accountNumber
                                      ? \`(\${selectedDc.accountNumber})\`
                                      : ""}
                                  </span>
                                </div>

                                <div>
                                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                                    UTR / Ref #
                                  </span>
                                  {selectedDc.utrNo ||
                                  linkedBankTx?.referenceNumber ? (
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <code className="font-mono font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-[11px]">
                                        {selectedDc.utrNo ||
                                          linkedBankTx?.referenceNumber}
                                      </code>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const val =
                                            selectedDc.utrNo ||
                                            linkedBankTx?.referenceNumber ||
                                            "";
                                          navigator.clipboard.writeText(val);
                                          toast({
                                            title: "Copied UTR #",
                                            description: val,
                                          });
                                        }}
                                        className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                                        title="Copy UTR Number"
                                      >
                                        <Copy className="w-3.5 h-3.5 text-teal-700" />
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 mt-0.5 block">
                                      N/A
                                    </span>
                                  )}
                                </div>

                                <div>
                                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                                    Settlement Date
                                  </span>
                                  <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    {selectedDc.paidAt
                                      ? formatDate(selectedDc.paidAt)
                                      : linkedBankTx?.date
                                        ? \`\${linkedBankTx.date} \${linkedBankTx.time || ""}\`
                                        : formatDate(selectedDc.savedAt)}
                                  </span>
                                </div>

                                {selectedDc.invoiceRef && (
                                  <div>
                                    <span className="text-[10px] font-bold uppercase text-slate-500 block">
                                      Invoice / Memo Ref
                                    </span>
                                    <span className="font-mono font-bold text-teal-800 dark:text-teal-300 mt-0.5 block">
                                      {selectedDc.invoiceRef}
                                    </span>
                                  </div>
                                )}

                                {linkedBankTx?.description && (
                                  <div className="sm:col-span-2">
                                    <span className="text-[10px] font-bold uppercase text-slate-500 block">
                                      Bank Narration
                                    </span>
                                    <span
                                      className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 block truncate"
                                      title={linkedBankTx.description}
                                    >
                                      {linkedBankTx.description}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                              <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">No active payment record attached</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">DC is currently unpaid or awaiting payment collection.</p>
                            </div>
                          )
                        )}`;

  content = content.replace(fullOriginalBlock, replacementBlock);
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log("Successfully replaced single payment card guard block!");
} else {
  console.log("Markers not found", targetBlockStart, targetBlockEnd);
}
