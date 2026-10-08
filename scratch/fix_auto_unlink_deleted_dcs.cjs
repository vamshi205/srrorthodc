const fs = require('fs');
const path = require('path');

// 1. Update bankAccountFirebaseService.ts
const servicePath = path.join(__dirname, '..', 'src', 'services', 'bankAccountFirebaseService.ts');
let serviceContent = fs.readFileSync(servicePath, 'utf8');

// Include linkedDcNumbers: undefined in unlinkBankTransactionFromCashInvoice
serviceContent = serviceContent.replace(
  /linkedHospital: undefined,\r?\n\s*updatedAt: Date\.now\(\),/g,
  `linkedHospital: undefined,
      linkedDcNumbers: undefined,
      updatedAt: Date.now(),`
);

// Add cleanOrphanedBankTransactionLinks function
const cleanOrphanedFn = `
/**
 * Automatically find and unlink any bank transactions whose linked DC / Cash Invoice no longer exists (e.g. deleted DCs)
 */
export async function cleanOrphanedBankTransactionLinks(): Promise<number> {
  try {
    const txs = await fetchBankTransactionsFromFirestore();
    const linkedTxs = txs.filter((t) => Boolean(t.linkedInvoiceNumber || t.linkedInvoiceId));
    if (linkedTxs.length === 0) return 0;

    const invoices = await fetchCashInvoicesFromFirestore().catch(() => []);
    const dcs = await fetchDcsFromFirestore().catch(() => []);

    const validInvRefs = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.invNumber) validInvRefs.add(inv.invNumber.toLowerCase().trim());
      if (inv.invNumber) validInvRefs.add(inv.invNumber.replace(/\\//g, '_').toLowerCase().trim());
      if (inv.dcNumber) validInvRefs.add(inv.dcNumber.toLowerCase().trim());
      if (inv.dcNumber) validInvRefs.add(\`dc #\${inv.dcNumber.toLowerCase().trim()}\`);
    });

    dcs.forEach((dc) => {
      if (dc.dcNo) validInvRefs.add(dc.dcNo.toLowerCase().trim());
      if (dc.dcNo) validInvRefs.add(\`dc #\${dc.dcNo.toLowerCase().trim()}\`);
      if (dc.invoiceRef) validInvRefs.add(dc.invoiceRef.toLowerCase().trim());
    });

    let unlinkedCount = 0;
    for (const tx of linkedTxs) {
      const ref1 = (tx.linkedInvoiceNumber || '').toLowerCase().trim();
      const ref2 = (tx.linkedInvoiceId || '').toLowerCase().trim();
      const dcNos = (tx.linkedDcNumbers || []).map((n) => n.toLowerCase().trim());

      const isRef1Valid = ref1 ? validInvRefs.has(ref1) : false;
      const isRef2Valid = ref2 ? validInvRefs.has(ref2) : false;
      const isDcNoValid = dcNos.some((n) => validInvRefs.has(n) || validInvRefs.has(\`dc #\${n}\`));

      if (!isRef1Valid && !isRef2Valid && !isDcNoValid) {
        await unlinkBankTransactionFromCashInvoice(tx.id, false);
        unlinkedCount++;
      }
    }

    if (unlinkedCount > 0) {
      try {
        window.dispatchEvent(new CustomEvent('srrortho:bank_transactions_updated'));
      } catch {
        // ignore if server environment
      }
    }
    return unlinkedCount;
  } catch (err) {
    console.warn('Error cleaning orphaned bank transaction links:', err);
    return 0;
  }
}
`;

serviceContent += cleanOrphanedFn;
fs.writeFileSync(servicePath, serviceContent, 'utf8');
console.log('bankAccountFirebaseService.ts updated with cleanOrphanedBankTransactionLinks!');

// 2. Update savedDcStorage.ts deleteSavedDc
const storagePath = path.join(__dirname, '..', 'src', 'lib', 'savedDcStorage.ts');
let storageContent = fs.readFileSync(storagePath, 'utf8');

const oldDeleteSavedDc = `export const deleteSavedDc = async (id: string): Promise<void> => {
  const currentDcs = getLocalSavedDcs();
  const filtered = currentDcs.filter((d) => d.id !== id);
  saveLocalDcs(filtered);

  // Sync with Firestore asynchronously in background
  deleteDcFromFirestore(id).catch((error) => {
    console.warn('Background Firestore delete failed:', error);
  });
};`;

const newDeleteSavedDc = `export const deleteSavedDc = async (id: string): Promise<void> => {
  const currentDcs = getLocalSavedDcs();
  const dcToDelete = currentDcs.find((d) => d.id === id);
  const filtered = currentDcs.filter((d) => d.id !== id);
  saveLocalDcs(filtered);

  if (dcToDelete) {
    try {
      const { fetchBankTransactionsFromFirestore, unlinkBankTransactionFromCashInvoice } = require('@/services/bankAccountFirebaseService');
      const txs = await fetchBankTransactionsFromFirestore().catch(() => []);
      const dcNoClean = dcToDelete.dcNo ? dcToDelete.dcNo.trim().toLowerCase() : '';
      const invRefClean = dcToDelete.invoiceRef ? dcToDelete.invoiceRef.trim().toLowerCase() : '';

      for (const tx of txs) {
        const tInvNum = (tx.linkedInvoiceNumber || tx.linkedInvoiceId || '').trim().toLowerCase();
        const tDcNos = (tx.linkedDcNumbers || []).map((n: string) => n.trim().toLowerCase());
        const isMatch =
          (dcNoClean && (tInvNum === dcNoClean || tInvNum === \`dc #\${dcNoClean}\` || tDcNos.includes(dcNoClean))) ||
          (invRefClean && tInvNum === invRefClean);

        if (isMatch) {
          await unlinkBankTransactionFromCashInvoice(tx.id, false).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('Auto-unlink bank transactions on DC delete warning:', e);
    }
  }

  // Sync with Firestore asynchronously in background
  deleteDcFromFirestore(id).catch((error) => {
    console.warn('Background Firestore delete failed:', error);
  });
};`;

storageContent = storageContent.replace(oldDeleteSavedDc, newDeleteSavedDc);
fs.writeFileSync(storagePath, storageContent, 'utf8');
console.log('savedDcStorage.ts updated with auto-unlinking on deleteSavedDc!');

// 3. Update BankAccountsView.tsx to call cleanOrphanedBankTransactionLinks on load
const viewPath = path.join(__dirname, '..', 'src', 'components', 'bank-accounts', 'BankAccountsView.tsx');
let viewContent = fs.readFileSync(viewPath, 'utf8');

// Add import of cleanOrphanedBankTransactionLinks
viewContent = viewContent.replace(
  /unlinkBankTransactionFromCashInvoice,\r?\n/g,
  `unlinkBankTransactionFromCashInvoice,
  cleanOrphanedBankTransactionLinks,
`
);

// Call cleanOrphanedBankTransactionLinks inside loadAllData
const oldLoadAllData = `      setAccounts(accs);
      setTransactions(txs);
      setCashInvoices(invs);`;

const newLoadAllData = `      setAccounts(accs);
      setTransactions(txs);
      setCashInvoices(invs);

      // Clean up any orphaned links from deleted DCs or Cash Invoices
      cleanOrphanedBankTransactionLinks().then((cleaned) => {
        if (cleaned > 0) {
          fetchBankTransactionsFromFirestore(undefined, limitToUse).then((refreshed) => setTransactions(refreshed));
        }
      }).catch(() => {});`;

viewContent = viewContent.replace(oldLoadAllData, newLoadAllData);
fs.writeFileSync(viewPath, viewContent, 'utf8');
console.log('BankAccountsView.tsx updated to auto-clean orphaned links on load!');
