const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'SavedDcs.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /action:\s*"DELETE_PART_PAYMENT_INSTALLMENT",\r?\n\s*updates:\s*\{[\s\S]*?\},/g,
  `action: "DELETE_PART_PAYMENT_INSTALLMENT",
        clear: updatedPartPayments.length === 0 ? ["paymentMethod", "utrNo", "bankName", "bankAccountId", "paidAmount"] : [],
        updates: {
          partPayments: updatedPartPayments,
          paidAmount: updatedPartPayments.length === 0 ? 0 : newPaidAmount,
          isPartialPayment: isStillPartial,
          cashRemarks: newCashRemarks,
          ...(updatedPartPayments.length === 0
            ? {
                paymentMethod: undefined,
                utrNo: undefined,
                bankName: undefined,
                bankAccountId: undefined,
              }
            : {}),
        },`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Regex update applied successfully!');
