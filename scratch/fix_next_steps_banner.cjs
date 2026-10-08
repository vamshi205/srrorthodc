const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx');
let content = fs.readFileSync(targetFile, 'utf8').replace(/\r\n/g, '\n');

const startMarker = `⚡ Bank Payment Linked & Settled`;
const endMarker = `<Landmark className="h-3 w-3 mr-1 text-emerald-600" />`;

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  const sub = content.substring(startIdx - 100, endIdx + 100);
  
  // Find start of line for selectedDc.paymentMethod === "bank_transfer"
  const blockStart = content.lastIndexOf('{selectedDc.paymentMethod ===', startIdx);
  const blockEnd = content.indexOf('<Button', endIdx - 100);

  const fullOriginal = content.substring(blockStart, blockEnd);

  const newBlock = `{isRealBankTransfer(selectedDc, linkedBankTx)
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
                                   `;

  content = content.replace(fullOriginal, newBlock);
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log("Successfully replaced Next Steps block with isRealBankTransfer!");
} else {
  console.log("Markers not found", startIdx, endIdx);
}
