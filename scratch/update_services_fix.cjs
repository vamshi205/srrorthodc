const fs = require('fs');

// 1. Update bankAccountFirebaseService.ts
let bankService = fs.readFileSync('src/services/bankAccountFirebaseService.ts', 'utf8');

const oldCleanFunc = `export async function cleanOrphanedBankTransactionLinks(): Promise<number> {
  try {
    const txs = await fetchBankTransactionsFromFirestore();
    const linkedTxs = txs.filter((t) => Boolean(t.linkedInvoiceNumber || t.linkedInvoiceId || (t.linkedDcNumbers && t.linkedDcNumbers.length > 0)));
    if (linkedTxs.length === 0) return 0;

    const dcs = await fetchDcsFromFirestore().catch(() => []);
    const invoices = await fetchCashInvoicesFromFirestore().catch(() => []);

    let unlinkedCount = 0;
    for (const tx of linkedTxs) {
      const matchesActiveDc = dcs.some((dc) => isBankTxMatchingDc(tx, dc));

      let matchesActiveInvoice = false;
      if (!matchesActiveDc && (tx.linkedInvoiceNumber || tx.linkedInvoiceId)) {
        const ref1 = (tx.linkedInvoiceNumber || '').toLowerCase().trim();
        const ref2 = (tx.linkedInvoiceId || '').toLowerCase().trim();
        matchesActiveInvoice = invoices.some((inv) => {
          const invNo = (inv.invNumber || '').toLowerCase().trim();
          const invNoUnderscore = invNo.replace(/\\//g, '_');
          return Boolean(invNo) && (ref1.includes(invNo) || ref2.includes(invNoUnderscore));
        });
      }

      if (!matchesActiveDc && !matchesActiveInvoice) {
        await unlinkBankTransactionFromCashInvoice(tx.id, false);
        unlinkedCount++;
      }
    }`;

const newCleanFunc = `export async function cleanOrphanedBankTransactionLinks(): Promise<number> {
  try {
    const txs = await fetchBankTransactionsFromFirestore();
    const linkedTxs = txs.filter((t) => Boolean(t.linkedInvoiceNumber || t.linkedInvoiceId || (t.linkedDcNumbers && t.linkedDcNumbers.length > 0)));
    if (linkedTxs.length === 0) return 0;

    const dcs = await fetchDcsFromFirestore().catch(() => []);
    const invoices = await fetchCashInvoicesFromFirestore().catch(() => []);

    // Filter invoices to only ACTIVE invoices (standalone OR whose parent DC exists)
    const activeInvoices = invoices.filter((inv) => {
      const invDcNo = inv.dcNumber ? String(inv.dcNumber).trim().toLowerCase() : '';
      if (!invDcNo) return true; // Standalone invoice
      return dcs.some((dc) => {
        const dcNoClean = String(dc.dcNo || '').trim().toLowerCase();
        const dcInvRef = String(dc.invoiceRef || '').trim().toLowerCase();
        const invNoClean = String(inv.invNumber || '').trim().toLowerCase();
        return (dcNoClean && dcNoClean === invDcNo) || (dcInvRef && dcInvRef === invNoClean);
      });
    });

    let unlinkedCount = 0;
    for (const tx of linkedTxs) {
      const matchesActiveDc = dcs.some((dc) => isBankTxMatchingDc(tx, dc));

      let matchesActiveInvoice = false;
      if (!matchesActiveDc && (tx.linkedInvoiceNumber || tx.linkedInvoiceId)) {
        const ref1 = String(tx.linkedInvoiceNumber || '').toLowerCase().trim();
        const ref2 = String(tx.linkedInvoiceId || '').toLowerCase().trim();
        matchesActiveInvoice = activeInvoices.some((inv) => {
          const invNo = String(inv.invNumber || '').toLowerCase().trim();
          const invNoUnderscore = invNo.replace(/\\//g, '_');
          return Boolean(invNo) && (ref1.includes(invNo) || ref2.includes(invNoUnderscore));
        });
      }

      if (!matchesActiveDc && !matchesActiveInvoice) {
        await unlinkBankTransactionFromCashInvoice(tx.id, false);
        unlinkedCount++;
      }
    }`;

if (bankService.includes('cleanOrphanedBankTransactionLinks')) {
  bankService = bankService.replace(oldCleanFunc, newCleanFunc);
  fs.writeFileSync('src/services/bankAccountFirebaseService.ts', bankService, 'utf8');
  console.log('bankAccountFirebaseService.ts updated!');
}

// 2. Update cashInvoiceFirebaseService.ts
let cashService = fs.readFileSync('src/services/cashInvoiceFirebaseService.ts', 'utf8');

const oldDeleteInv = `export async function deleteCashInvoiceFromFirestore(invNumber: string): Promise<boolean> {
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_CASH_INVOICES_KEY);
    if (cached) {
      let list: CashInvoiceData[] = JSON.parse(cached);
      if (Array.isArray(list)) {
        list = list.filter((i) => i.invNumber !== invNumber);
        localStorage.setItem(LOCAL_STORAGE_CASH_INVOICES_KEY, JSON.stringify(list));
        window.dispatchEvent(new CustomEvent("srrortho:cash_invoices_updated", { detail: list }));
      }
    }
  } catch {}`;

const newDeleteInv = `export async function deleteCashInvoiceFromFirestore(invNumberOrDcNo: string): Promise<boolean> {
  if (!invNumberOrDcNo) return false;
  const cleanTarget = String(invNumberOrDcNo).trim().toLowerCase();
  const cleanRawNo = cleanTarget.replace(/^dc\\s*#?\\s*/i, '');

  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_CASH_INVOICES_KEY);
    if (cached) {
      let list: CashInvoiceData[] = JSON.parse(cached);
      if (Array.isArray(list)) {
        list = list.filter((i) => {
          const iNum = String(i.invNumber || '').trim().toLowerCase();
          const iDc = String(i.dcNumber || '').trim().toLowerCase();
          if (iNum === cleanTarget || iNum === cleanRawNo || iNum === \`dc #\${cleanRawNo}\`) return false;
          if (iDc === cleanTarget || iDc === cleanRawNo) return false;
          return true;
        });
        localStorage.setItem(LOCAL_STORAGE_CASH_INVOICES_KEY, JSON.stringify(list));
        window.dispatchEvent(new CustomEvent("srrortho:cash_invoices_updated", { detail: list }));
      }
    }
  } catch {}`;

if (cashService.includes('deleteCashInvoiceFromFirestore')) {
  cashService = cashService.replace(oldDeleteInv, newDeleteInv);
  fs.writeFileSync('src/services/cashInvoiceFirebaseService.ts', cashService, 'utf8');
  console.log('cashInvoiceFirebaseService.ts updated!');
}
