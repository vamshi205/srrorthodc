const fs = require("fs");
const path = "c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx";
let code = fs.readFileSync(path, "utf8");

const oldCode = `                                                {dc.status === "completed" && dc.cashAmount && (
                                                  <span 
                                                    className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full whitespace-nowrap" 
                                                    title={
                                                      dc.billedAmount && dc.billedAmount > (dc.cashAmount || 0)
                                                        ? \`Paid Cash: ₹\${dc.cashAmount} (Printed Bill: ₹\${dc.billedAmount} | Hospital Cut: ₹\${dc.hospitalMargin || (dc.billedAmount - (dc.cashAmount || 0))})\`
                                                        : "Cash Memo Paid"
                                                    }
                                                  >
                                                    ✓ PAID ₹{dc.cashAmount}`;

const newCode = `                                                {dc.status === "completed" && (
                                                  <span 
                                                    className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full whitespace-nowrap" 
                                                    title={
                                                      dc.billedAmount && dc.billedAmount > (dc.cashAmount || 0)
                                                        ? \`Paid Cash: ₹\${dc.cashAmount} (Printed Bill: ₹\${dc.billedAmount} | Hospital Cut: ₹\${dc.hospitalMargin || (dc.billedAmount - (dc.cashAmount || 0))})\`
                                                        : "Cash Memo Paid"
                                                    }
                                                  >
                                                    {(dc.isPartialPayment || (dc.paidAmount && dc.originalInvoiceTotal && dc.paidAmount < dc.originalInvoiceTotal) || (dc.cashRemarks && dc.cashRemarks.includes("Part Payment Received")))
                                                      ? \`⚡ PARTLY PAID ₹\${(dc.paidAmount || 0).toLocaleString('en-IN')} / ₹\${(dc.originalInvoiceTotal || dc.cashAmount || 0).toLocaleString('en-IN')}\`
                                                      : \`✓ PAID ₹\${(dc.cashAmount || 0).toLocaleString('en-IN')}\`}`;

if (code.includes("✓ PAID ₹{dc.cashAmount}")) {
  code = code.replace("✓ PAID ₹{dc.cashAmount}", `{(dc.isPartialPayment || (dc.paidAmount && dc.originalInvoiceTotal && dc.paidAmount < dc.originalInvoiceTotal) || (dc.cashRemarks && dc.cashRemarks.includes("Part Payment Received")))\n                                                      ? \`⚡ PARTLY PAID ₹\${(dc.paidAmount || 0).toLocaleString('en-IN')} / ₹\${(dc.originalInvoiceTotal || dc.cashAmount || 0).toLocaleString('en-IN')}\`\n                                                      : \`✓ PAID ₹\${(dc.cashAmount || 0).toLocaleString('en-IN')}\`}`);
  fs.writeFileSync(path, code, "utf8");
  console.log("REPLACED SUCCESS");
} else {
  console.log("STRING NOT FOUND");
}
