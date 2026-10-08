const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'SavedDcs.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace hardcoded status: "completed" with status: nextStatus inside handleRecordPayment
content = content.replace(
  /setSavedDcs\(\(prev\) =>\r?\n\s*prev\.map\(\(d\) =>\r?\n\s*d\.id === dc\.id\r?\n\s*\?\s*\{\r?\n\s*\.\.\.d,\r?\n\s*status:\s*"completed",/g,
  `setSavedDcs((prev) =>
        prev.map((d) =>
          d.id === dc.id
            ? {
                ...d,
                status: nextStatus,`
);

// Replace hardcoded setActiveQueue("completed") and setSearchParams({ queue: "completed" })
content = content.replace(
  /setActiveQueue\("completed"\);\r?\n\s*setSearchParams\(\{ queue: "completed" \}\);/g,
  `setActiveQueue(nextStatus);
      setSearchParams({ queue: nextStatus });`
);

// Replace successDesc toast calculation
content = content.replace(
  /const successDesc = matchedBankTx\r?\n\s*\?\s*`DC #\${dc\.dcNo} linked to Bank Credit \(Ref: \${utrNo}\) & moved to Completed!`\r?\n\s*:\s*`DC #\${dc\.dcNo} marked as Bank Transfer \(Link later from Bank Accounts\) & moved to Completed!`;/g,
  `const remainingBalance = Math.max(0, originalInvoiceTotal - paidAmount);
      const successDesc =
        nextStatus === "cash"
          ? \`Part payment of ₹\${currentInstallment.toLocaleString("en-IN")} recorded for DC #\${dc.dcNo}. Balance due: ₹\${remainingBalance.toLocaleString("en-IN")}. Updated in Cash Queue.\`
          : matchedBankTx
            ? \`DC #\${dc.dcNo} linked to Bank Credit (Ref: \${utrNo}) & moved to Completed!\`
            : \`DC #\${dc.dcNo} payment settled & moved to Completed!\`;`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('SavedDcs.tsx updated successfully!');
