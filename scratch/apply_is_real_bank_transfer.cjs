const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx');
let content = fs.readFileSync(targetFile, 'utf8').replace(/\r\n/g, '\n');

// 1. Add isRealBankTransfer helper
const helperFunc = `  const isRealBankTransfer = (
    dc: SavedDc | null,
    linkedBankTx: BankTransaction | null
  ): boolean => {
    if (!dc) return false;
    if (dc.paymentMethod === "cash") return false;
    if (dc.paymentMethod === "bank_transfer") return true;

    const utr = (dc.utrNo || linkedBankTx?.referenceNumber || "").trim().toUpperCase();
    if (utr.startsWith("CASH-")) return false;

    if (linkedBankTx) {
      const accName = (linkedBankTx.accountName || linkedBankTx.description || "").toLowerCase();
      const accId = (linkedBankTx.bankAccountId || "").toLowerCase();
      if (accId === "cash_in_hand" || accName.includes("petty cash") || accName.includes("cash in hand")) {
        return false;
      }
      return true;
    }

    if (utr && utr !== "N/A") return true;

    return false;
  };

  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));`;

if (!content.includes('const isRealBankTransfer')) {
  content = content.replace('  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));', helperFunc);
  console.log("Added isRealBankTransfer helper function.");
}

// 2. Update Details Header Badge (Line ~6058)
const oldHeaderBadge = `: selectedDc.paymentMethod === "bank_transfer" ||
                                linkedBankTx ||
                                selectedDc.utrNo
                              ? "🏦 Bank Transfer / UPI"
                              : "💵 Physical Cash (Hand Collected)"`;

const newHeaderBadge = `: isRealBankTransfer(selectedDc, linkedBankTx)
                              ? "🏦 Bank Transfer / UPI"
                              : "💵 Physical Cash (Hand Collected)"`;

if (content.includes(oldHeaderBadge)) {
  content = content.replace(oldHeaderBadge, newHeaderBadge);
  console.log("Updated Header Badge condition.");
}

// 3. Update Payment Info Tab single payment card (Line ~6444-6500)
const oldCardTitle = `{selectedDc.paymentMethod ===
                                          "bank_transfer" ||
                                        linkedBankTx ||
                                        selectedDc.utrNo
                                          ? "Payment & Bank Transaction Details"
                                          : "Cash Collection Record (Physical Cash)"}`;

const newCardTitle = `{isRealBankTransfer(selectedDc, linkedBankTx)
                                          ? "Payment & Bank Transaction Details"
                                          : "Cash Collection Record (Physical Cash)"}`;

const oldCardBadge = `{selectedDc.paymentMethod ===
                                          "bank_transfer" ||
                                        linkedBankTx ||
                                        selectedDc.utrNo
                                          ? "🏦 Bank Transfer / UPI"
                                          : "💵 Physical Cash (Hand Collected)"}`;

const newCardBadge = `{isRealBankTransfer(selectedDc, linkedBankTx)
                                          ? "🏦 Bank Transfer / UPI"
                                          : "💵 Physical Cash (Hand Collected)"}`;

const oldCardDesc = `{selectedDc.paymentMethod === "bank_transfer" ||
                                      linkedBankTx ||
                                      selectedDc.utrNo
                                        ? \`Reconciled bank transaction record for DC #\${selectedDc.dcNo}\`
                                        : \`Physical cash collected in hand for DC #\${selectedDc.dcNo} • Unlinked to bank statement\`}`;

const newCardDesc = `{isRealBankTransfer(selectedDc, linkedBankTx)
                                        ? \`Reconciled bank transaction record for DC #\${selectedDc.dcNo}\`
                                        : \`Physical cash collected in hand for DC #\${selectedDc.dcNo} • Unlinked to bank statement\`}`;

const oldCardBank = `{selectedDc.paymentMethod === "bank_transfer" ||
                                    linkedBankTx ||
                                    selectedDc.utrNo
                                      ? selectedDc.bankName || "Operating Account"
                                      : selectedDc.bankName ||
                                        "Physical Cash Treasury (In Hand)"}`;

const newCardBank = `{isRealBankTransfer(selectedDc, linkedBankTx)
                                      ? selectedDc.bankName || "Operating Account"
                                      : selectedDc.bankName ||
                                        "Physical Cash Treasury (In Hand)"}`;

content = content.replace(oldCardTitle, newCardTitle);
content = content.replace(oldCardBadge, newCardBadge);
content = content.replace(oldCardDesc, newCardDesc);
content = content.replace(oldCardBank, newCardBank);
console.log("Updated Payment Info card conditions.");

// 4. Update Next Steps Banner (Line ~7360-7420)
const oldNextStepsBlock = `{selectedDc.paymentMethod ===
                                         "bank_transfer" ||
                                       linkedBankTx ||
                                       selectedDc.utrNo
                                         ? "⚡ Bank Payment Linked & Settled"
                                         : "💵 Physical Cash Collected (Unlinked to Bank Deposit)"}
                                     </span>
                                     <Badge className="bg-emerald-700 text-white text-[10px] font-bold py-0.5 px-2">
                                       {selectedDc.paymentMethod ===
                                         "bank_transfer" ||
                                       linkedBankTx ||
                                       selectedDc.utrNo
                                         ? "BANK SETTLED"
                                         : "CASH COLLECTED"}
                                     </Badge>
                                   </div>
                                   <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                                     {selectedDc.invoiceRef
                                       ? \`Cash Memo: \${selectedDc.invoiceRef} • \`
                                       : ""}
                                     {selectedDc.paymentMethod ===
                                       "bank_transfer" ||
                                     linkedBankTx ||
                                     selectedDc.utrNo
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
                                 {!(
                                   selectedDc.paymentMethod ===
                                     "bank_transfer" ||
                                   linkedBankTx ||
                                   selectedDc.utrNo
                                 ) && (`;

const newNextStepsBlock = `{isRealBankTransfer(selectedDc, linkedBankTx)
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
                                 {!isRealBankTransfer(selectedDc, linkedBankTx) && (`;

if (content.includes(oldNextStepsBlock)) {
  content = content.replace(oldNextStepsBlock, newNextStepsBlock);
  console.log("Updated Next Steps Banner condition.");
} else {
  console.log("oldNextStepsBlock not found");
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log("File written successfully.");
