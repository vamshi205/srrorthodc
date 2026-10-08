const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'SavedDcs.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const regexTarget = /await transitionSavedDc\(dc\.id, \{\r?\n\s*toStatus: nextStatus,\r?\n\s*action: "DELETE_PART_PAYMENT_INSTALLMENT",/g;

const replacement = `// Unlink matching bank transactions if UTR is attached or if all installments are deleted
      try {
        const txs = await fetchBankTransactionsFromFirestore(undefined, 250).catch(() => []);
        const targetUtr = (deletedItem.utrNo || "").trim().toLowerCase();
        const dcNoClean = (dc.dcNo || "").trim().toLowerCase();
        const invRefClean = (dc.invoiceRef || "").trim().toLowerCase();

        for (const tx of txs) {
          const tRef = (tx.referenceNumber || "").trim().toLowerCase();
          const tInv = (tx.linkedInvoiceNumber || tx.linkedInvoiceId || "").trim().toLowerCase();
          const tDcNos = (tx.linkedDcNumbers || []).map((n: string) => n.trim().toLowerCase());

          const isUtrMatch = Boolean(targetUtr && tRef && tRef === targetUtr);
          const isDcMatch =
            updatedPartPayments.length === 0 &&
            Boolean(
              (dcNoClean && (tInv === dcNoClean || tInv === \`dc #\${dcNoClean}\` || tDcNos.includes(dcNoClean))) ||
              (invRefClean && (tInv === invRefClean || tInv === invRefClean.replace(/\\//g, "_")))
            );

          if (isUtrMatch || isDcMatch) {
            await unlinkBankTransactionFromCashInvoice(tx.id, false).catch(() => {});
          }
        }
      } catch (unlinkErr) {
        console.warn("Failed to unlink bank transaction on installment delete:", unlinkErr);
      }

      setLinkedBankTx(null);

      await transitionSavedDc(dc.id, {
        toStatus: nextStatus,
        action: "DELETE_PART_PAYMENT_INSTALLMENT",`;

content = content.replace(regexTarget, replacement);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully inserted bank unlinking before transitionSavedDc!');
