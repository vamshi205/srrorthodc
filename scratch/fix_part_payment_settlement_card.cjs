const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'SavedDcs.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. In IIFE for Part Payment Settlement, return null if paid === 0 and partPayments list is empty
const oldIIFECheck = `                          if (!isPart && due <= 0 && (!selectedDc.partPayments || selectedDc.partPayments.length === 0)) return null;`;

const newIIFECheck = `                          // If zero amount paid and no active part payment installments exist, do not show Part Payment Settlement box
                          if (paid <= 0 && (!selectedDc.partPayments || selectedDc.partPayments.length === 0)) return null;
                          if (!isPart && due <= 0 && (!selectedDc.partPayments || selectedDc.partPayments.length === 0)) return null;`;

content = content.replace(oldIIFECheck, newIIFECheck);

// 2. In handleDeletePartPaymentInstallment, reset cashRemarks to clean string when all installments deleted
const oldCashRemarksInDelete = `cashRemarks: newCashRemarks,`;
const newCashRemarksInDelete = `cashRemarks: updatedPartPayments.length === 0 ? "All part payments deleted. Awaiting re-collection." : newCashRemarks,`;

content = content.replace(oldCashRemarksInDelete, newCashRemarksInDelete);

fs.writeFileSync(filePath, content, 'utf8');
console.log('SavedDcs.tsx successfully updated for Part Payment Settlement card!');
