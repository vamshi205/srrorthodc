import fs from 'fs';
const file = 'c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx';
let code = fs.readFileSync(file, 'utf8');

const target = '✓ PAID ₹{dc.cashAmount}';
const replacement = `{(dc.isPartialPayment || (dc.paidAmount && dc.originalInvoiceTotal && dc.paidAmount < dc.originalInvoiceTotal) || (dc.cashRemarks && dc.cashRemarks.includes("Part Payment Received")))\n                                                      ? \`⚡ PARTLY PAID ₹\${(dc.paidAmount || 0).toLocaleString('en-IN')} / ₹\${(dc.originalInvoiceTotal || dc.cashAmount || 0).toLocaleString('en-IN')}\`\n                                                      : \`✓ PAID ₹\${(dc.cashAmount || 0).toLocaleString('en-IN')}\`}`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(file, code, 'utf8');
  console.log('REPLACED SUCCESS');
} else {
  console.log('TARGET NOT FOUND');
}
