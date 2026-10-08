const fs = require('fs');

let content = fs.readFileSync('src/pages/SavedDcs.tsx', 'utf8');

// 1. Update imports
if (!content.includes('cleanOrphanedBankTransactionLinks')) {
  content = content.replace(
    '  unlinkBankTransactionFromCashInvoice,',
    '  unlinkBankTransactionFromCashInvoice,\n  cleanOrphanedBankTransactionLinks,\n  isBankTxMatchingDc,'
  );
}

// 2. Update handleDelete
if (!content.includes('cleanOrphanedBankTransactionLinks().catch')) {
  content = content.replace(
    'await deleteSavedDc(id);\n      const dcs = await loadSavedDcs();',
    'await deleteSavedDc(id);\n      cleanOrphanedBankTransactionLinks().catch(() => {});\n      const dcs = await loadSavedDcs();'
  );
}

// 3. Update handleDeletePartPaymentInstallment
const targetPattern = /const isUtrMatch = Boolean\(targetUtr && tRef && tRef === targetUtr\);[\s\S]*?\(invRefClean && \(tInv === invRefClean \|\| tInv === invRefClean\.replace\(\/\\\/\/g, "_"\)\)\)\s*\);/;

if (targetPattern.test(content)) {
  content = content.replace(
    targetPattern,
    'const isUtrMatch = Boolean(targetUtr && tRef && tRef === targetUtr);\n          const isDcMatch = updatedPartPayments.length === 0 && isBankTxMatchingDc(tx, dc);'
  );
}

fs.writeFileSync('src/pages/SavedDcs.tsx', content, 'utf8');
console.log('SavedDcs.tsx successfully updated!');
