const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'SavedDcs.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /action:\s*"DELETE_PART_PAYMENT_INSTALLMENT",/g,
  `action: "DELETE_PART_PAYMENT_INSTALLMENT",
      // Unlink matching bank transactions if UTR is attached or if all installments are deleted
      ...(async () => {
        try {
          const { fetchBankTransactionsFromFirestore, unlinkBankTransactionFromCashInvoice } = require("@/services/bankAccountFirebaseService");
          const txs = await fetchBankTransactionsFromFirestore(undefined, 250).catch(() => []);
          const targetUtr = (deletedItem.utrNo || "").trim().toLowerCase();
          const dcNoClean = (dc.dcNo || "").trim().toLowerCase();
          const invRefClean = (dc.invoiceRef || "").trim().toLowerCase();

          for (const tx of txs) {
            const tRef = (tx.referenceNumber || "").trim().toLowerCase();
            const tInv = (tx.linkedInvoiceNumber || tx.linkedInvoiceId || "").trim().toLowerCase();
            const tDcNos = (tx.linkedDcNumbers || []).map((n: string) => n.trim().toLowerCase());

            const isUtrMatch = targetUtr && tRef && tRef === targetUtr;
            const isDcMatch =
              updatedPartPayments.length === 0 &&
              ((dcNoClean && (tInv === dcNoClean || tInv === \`dc #\${dcNoClean}\` || tDcNos.includes(dcNoClean))) ||
                (invRefClean && (tInv === invRefClean || tInv === invRefClean.replace(/\\//g, "_"))));

            if (isUtrMatch || isDcMatch) {
              await unlinkBankTransactionFromCashInvoice(tx.id, false).catch(() => {});
            }
          }
        } catch (e) {
          console.warn("Auto-unlink bank transactions on installment delete warning:", e);
        }
      })(),`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Regex unlinking script executed successfully!');
