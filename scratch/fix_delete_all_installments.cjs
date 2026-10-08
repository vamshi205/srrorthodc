const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'SavedDcs.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update handleDeletePartPaymentInstallment transition call to clear payment fields when updatedPartPayments is empty
const oldTransition = `      await transitionSavedDc(dc.id, {
        toStatus: nextStatus,
        action: "DELETE_PART_PAYMENT_INSTALLMENT",
        updates: {
          partPayments: updatedPartPayments,
          paidAmount: newPaidAmount,
          isPartialPayment: isStillPartial,
          cashRemarks: newCashRemarks,
        },`;

const newTransition = `      const isAllDeleted = updatedPartPayments.length === 0;
      await transitionSavedDc(dc.id, {
        toStatus: nextStatus,
        action: "DELETE_PART_PAYMENT_INSTALLMENT",
        clear: isAllDeleted ? ["paymentMethod", "utrNo", "bankName", "bankAccountId", "paidAmount"] : [],
        updates: {
          partPayments: updatedPartPayments,
          paidAmount: isAllDeleted ? 0 : newPaidAmount,
          isPartialPayment: isStillPartial,
          cashRemarks: newCashRemarks,
          ...(isAllDeleted
            ? {
                paymentMethod: undefined,
                utrNo: undefined,
                bankName: undefined,
                bankAccountId: undefined,
              }
            : {}),
        },`;

content = content.replace(oldTransition, newTransition);

// 2. Update single-transaction card condition in Details Modal
const oldCardCheck = `                        {(!selectedDc.partPayments ||
                          selectedDc.partPayments.length === 0) && (`;

const newCardCheck = `                        {(!selectedDc.partPayments ||
                          selectedDc.partPayments.length === 0) &&
                          Boolean(
                            (selectedDc.paidAmount && selectedDc.paidAmount > 0) ||
                            (selectedDc.status === "completed") ||
                            linkedBankTx
                          ) && (`;

content = content.replace(oldCardCheck, newCardCheck);

// Also update second occurrence of oldCardCheck for the grid below it
content = content.replace(oldCardCheck, newCardCheck);

// 3. Update Paid Amount fallback in details modal so it doesn't print cashAmount when paidAmount is 0 on cash status DCs
const oldPaidAmtFallback = `                                  {(
                                    selectedDc.paidAmount ||
                                    selectedDc.cashAmount ||
                                    linkedBankTx?.amount ||
                                    0
                                  ).toLocaleString("en-IN")}`;

const newPaidAmtFallback = `                                  {(
                                    selectedDc.paidAmount ||
                                    (selectedDc.status === "completed" ? selectedDc.cashAmount : 0) ||
                                    linkedBankTx?.amount ||
                                    0
                                  ).toLocaleString("en-IN")}`;

content = content.replace(oldPaidAmtFallback, newPaidAmtFallback);

fs.writeFileSync(filePath, content, 'utf8');
console.log('SavedDcs.tsx successfully updated for deleting all installments!');
