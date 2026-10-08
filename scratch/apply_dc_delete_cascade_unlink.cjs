const fs = require('fs');
const path = require('path');

// 1. Update bankAccountFirebaseService.ts cleanOrphanedBankTransactionLinks
const servicePath = path.join(__dirname, '..', 'src', 'services', 'bankAccountFirebaseService.ts');
let serviceContent = fs.readFileSync(servicePath, 'utf8');

const oldCleanFn = `export async function cleanOrphanedBankTransactionLinks(): Promise<number> {
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
}`;

const newCleanFn = `export async function cleanOrphanedBankTransactionLinks(): Promise<number> {
  try {
    const txs = await fetchBankTransactionsFromFirestore();
    const linkedTxs = txs.filter((t) => Boolean(t.linkedInvoiceNumber || t.linkedInvoiceId));
    if (linkedTxs.length === 0) return 0;

    const dcs = await fetchDcsFromFirestore().catch(() => []);
    const invoices = await fetchCashInvoicesFromFirestore().catch(() => []);

    // Create a strict set of active DC numbers and Invoice Refs
    const activeDcNos = new Set<string>();
    const activeInvoiceRefs = new Set<string>();

    dcs.forEach((dc) => {
      if (dc.dcNo) {
        activeDcNos.add(dc.dcNo.toLowerCase().trim());
        activeDcNos.add(\`dc #\${dc.dcNo.toLowerCase().trim()}\`);
      }
      if (dc.invoiceRef) {
        activeInvoiceRefs.add(dc.invoiceRef.toLowerCase().trim());
        activeInvoiceRefs.add(dc.invoiceRef.replace(/\\//g, '_').toLowerCase().trim());
      }
    });

    // An invoice ref is valid ONLY if it belongs to an active DC or an active standalone invoice
    invoices.forEach((inv) => {
      const dcNoClean = inv.dcNumber ? inv.dcNumber.toLowerCase().trim() : '';
      if (!dcNoClean || activeDcNos.has(dcNoClean)) {
        if (inv.invNumber) {
          activeInvoiceRefs.add(inv.invNumber.toLowerCase().trim());
          activeInvoiceRefs.add(inv.invNumber.replace(/\\//g, '_').toLowerCase().trim());
        }
      }
    });

    let unlinkedCount = 0;
    for (const tx of linkedTxs) {
      const ref1 = (tx.linkedInvoiceNumber || '').toLowerCase().trim();
      const ref2 = (tx.linkedInvoiceId || '').toLowerCase().trim();
      const dcNos = (tx.linkedDcNumbers || []).map((n) => n.toLowerCase().trim());

      const matchesActiveDc = dcNos.some((n) => activeDcNos.has(n));
      const matchesActiveInvoice = (ref1 && activeInvoiceRefs.has(ref1)) || (ref2 && activeInvoiceRefs.has(ref2)) || (ref1 && activeDcNos.has(ref1));

      if (!matchesActiveDc && !matchesActiveInvoice) {
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
}`;

serviceContent = serviceContent.replace(oldCleanFn, newCleanFn);
fs.writeFileSync(servicePath, serviceContent, 'utf8');
console.log('bankAccountFirebaseService.ts updated with strict DC matching in cleanOrphanedBankTransactionLinks!');

// 2. Update savedDcStorage.ts deleteSavedDc
const storagePath = path.join(__dirname, '..', 'src', 'lib', 'savedDcStorage.ts');
let storageContent = fs.readFileSync(storagePath, 'utf8');

const oldDeleteDc = `export const deleteSavedDc = async (id: string): Promise<void> => {
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

const newDeleteDc = `export const deleteSavedDc = async (id: string): Promise<void> => {
  const currentDcs = getLocalSavedDcs();
  const dcToDelete = currentDcs.find((d) => d.id === id);
  const filtered = currentDcs.filter((d) => d.id !== id);
  saveLocalDcs(filtered);

  if (dcToDelete) {
    try {
      const { fetchBankTransactionsFromFirestore, unlinkBankTransactionFromCashInvoice } = require('@/services/bankAccountFirebaseService');
      const { deleteCashInvoiceFromFirestore } = require('@/services/cashInvoiceFirebaseService');

      // 1. Delete associated cash invoice if it exists
      if (dcToDelete.invoiceRef) {
        deleteCashInvoiceFromFirestore(dcToDelete.invoiceRef).catch(() => {});
      }

      // 2. Unlink all matching bank transactions
      const txs = await fetchBankTransactionsFromFirestore().catch(() => []);
      const dcNoClean = dcToDelete.dcNo ? dcToDelete.dcNo.trim().toLowerCase() : '';
      const invRefClean = dcToDelete.invoiceRef ? dcToDelete.invoiceRef.trim().toLowerCase() : '';

      for (const tx of txs) {
        const tInvNum = (tx.linkedInvoiceNumber || tx.linkedInvoiceId || '').trim().toLowerCase();
        const tDcNos = (tx.linkedDcNumbers || []).map((n: string) => n.trim().toLowerCase());
        const isMatch =
          (dcNoClean && (tInvNum === dcNoClean || tInvNum === \`dc #\${dcNoClean}\` || tDcNos.includes(dcNoClean))) ||
          (invRefClean && (tInvNum === invRefClean || tInvNum === invRefClean.replace(/\\//g, '_')));

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

storageContent = storageContent.replace(oldDeleteDc, newDeleteDc);
fs.writeFileSync(storagePath, storageContent, 'utf8');
console.log('savedDcStorage.ts updated with full deletion cascade!');
