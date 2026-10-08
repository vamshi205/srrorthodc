const fs = require('fs');

let content = fs.readFileSync('src/services/bankAccountFirebaseService.ts', 'utf8');

const oldMatcher = `export function isBankTxMatchingDc(tx: Partial<BankTransaction>, dc: Partial<SavedDc>): boolean {
  if (!tx || !dc) return false;

  const dcId = (dc.id || '').trim().toLowerCase();
  const dcNoClean = (dc.dcNo || '').trim().toLowerCase();
  const rawDcNo = dcNoClean.replace(/^dc\\s*#?\\s*/i, '');
  const invRefClean = (dc.invoiceRef || '').trim().toLowerCase();
  const invRefCleanUnderscore = invRefClean.replace(/\\//g, '_');
  const utrClean = ((dc as any).utrNo || '').trim().toLowerCase();

  const tInvNum = (tx.linkedInvoiceNumber || '').trim().toLowerCase();
  const cleanTInvNum = tInvNum
    .replace(/^cash memo:\\s*/i, '')
    .replace(/^memo:\\s*/i, '')
    .replace(/^dc\\s*#?\\s*/i, '')
    .trim();

  const tInvId = (tx.linkedInvoiceId || '').trim().toLowerCase();
  const cleanTInvId = tInvId
    .replace(/^cash_memo_\\s*/i, '')
    .replace(/^memo_\\s*/i, '')
    .replace(/^dc_\\s*/i, '')
    .trim();

  const tRefNo = (tx.referenceNumber || '').trim().toLowerCase();
  const tDcNos = (tx.linkedDcNumbers || []).map((n: string) =>
    (n || '').replace(/^dc\\s*#?\\s*/i, '').trim().toLowerCase()
  );`;

const newMatcher = `export function isBankTxMatchingDc(tx: Partial<BankTransaction>, dc: Partial<SavedDc>): boolean {
  if (!tx || !dc) return false;

  const dcId = String(dc.id || '').trim().toLowerCase();
  const dcNoClean = String(dc.dcNo || '').trim().toLowerCase();
  const rawDcNo = dcNoClean.replace(/^dc\\s*#?\\s*/i, '');
  const invRefClean = String(dc.invoiceRef || '').trim().toLowerCase();
  const invRefCleanUnderscore = invRefClean.replace(/\\//g, '_');
  const utrClean = String((dc as any).utrNo || '').trim().toLowerCase();

  const tInvNum = String(tx.linkedInvoiceNumber || '').trim().toLowerCase();
  const cleanTInvNum = tInvNum
    .replace(/^cash memo:\\s*/i, '')
    .replace(/^memo:\\s*/i, '')
    .replace(/^dc\\s*#?\\s*/i, '')
    .trim();

  const tInvId = String(tx.linkedInvoiceId || '').trim().toLowerCase();
  const cleanTInvId = tInvId
    .replace(/^cash_memo_\\s*/i, '')
    .replace(/^memo_\\s*/i, '')
    .replace(/^dc_\\s*/i, '')
    .trim();

  const tRefNo = String(tx.referenceNumber || '').trim().toLowerCase();
  const tDcNos = (tx.linkedDcNumbers || []).map((n: any) =>
    String(n || '').replace(/^dc\\s*#?\\s*/i, '').trim().toLowerCase()
  );`;

if (content.includes('const dcId = (dc.id || \'\').trim().toLowerCase();')) {
  content = content.replace(oldMatcher, newMatcher);
}

fs.writeFileSync('src/services/bankAccountFirebaseService.ts', content, 'utf8');
console.log('bankAccountFirebaseService.ts updated with safe String conversions!');
