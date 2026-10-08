const fs = require('fs');
const path = require('path');

// 1. Update bankAccountFirebaseService.ts to persist linkedDcNumbers when linking an invoice
const servicePath = path.join(__dirname, '..', 'src', 'services', 'bankAccountFirebaseService.ts');
let serviceContent = fs.readFileSync(servicePath, 'utf8');

const oldLinkTx = `    const updatedTx: BankTransaction = {
      ...targetTx,
      linkedInvoiceId: invoice.invNumber ? invoice.invNumber.replace(/\\//g, '_') : undefined,
      linkedInvoiceNumber: invoice.invNumber,
      linkedCustomerName: invoice.clientName || '',
      linkedHospital: invoice.clientName || '',
      updatedAt: Date.now(),
    };`;

const newLinkTx = `    const updatedTx: BankTransaction = {
      ...targetTx,
      linkedInvoiceId: invoice.invNumber ? invoice.invNumber.replace(/\\//g, '_') : undefined,
      linkedInvoiceNumber: invoice.invNumber,
      linkedCustomerName: invoice.clientName || '',
      linkedHospital: invoice.clientName || '',
      linkedDcNumbers: invoice.dcNumber ? [invoice.dcNumber] : targetTx.linkedDcNumbers,
      updatedAt: Date.now(),
    };`;

serviceContent = serviceContent.replace(oldLinkTx, newLinkTx);
fs.writeFileSync(servicePath, serviceContent, 'utf8');
console.log('bankAccountFirebaseService.ts updated!');

// 2. Update BankAccountsView.tsx to resolve and display DC numbers in linked transactions tables
const viewPath = path.join(__dirname, '..', 'src', 'components', 'bank-accounts', 'BankAccountsView.tsx');
let viewContent = fs.readFileSync(viewPath, 'utf8');

// Insert resolveDcNumber helper inside BankAccountsView component
const helperInsertionPoint = `  const sortedBankAccounts = useMemo(() => {`;
const helperCode = `  const resolveDcNumber = useCallback((tx: BankTransaction): string | null => {
    if (tx.linkedDcNumbers && tx.linkedDcNumbers.length > 0) {
      const raw = tx.linkedDcNumbers[0];
      return raw.replace(/^DC\\s*#?\\s*/i, '').trim();
    }
    const invRef = tx.linkedInvoiceNumber || tx.linkedInvoiceId || '';
    if (!invRef) return null;

    const directDcMatch = invRef.match(/^DC\\s*#?\\s*(.+)/i);
    if (directDcMatch) {
      return directDcMatch[1].trim();
    }

    const matchedInv = cashInvoices.find(
      (inv) =>
        (inv.invNumber && inv.invNumber.toLowerCase().trim() === invRef.toLowerCase().trim()) ||
        (inv.invNumber && inv.invNumber.replace(/\\//g, '_').toLowerCase() === invRef.toLowerCase())
    );
    if (matchedInv && matchedInv.dcNumber) {
      return matchedInv.dcNumber.replace(/^DC\\s*#?\\s*/i, '').trim();
    }

    const matchedDc = savedDcs.find(
      (dc) =>
        (dc.invoiceRef && dc.invoiceRef.toLowerCase().trim() === invRef.toLowerCase().trim()) ||
        (dc.dcNo && dc.dcNo.toLowerCase().trim() === invRef.toLowerCase().trim())
    );
    if (matchedDc && matchedDc.dcNo) {
      return matchedDc.dcNo.replace(/^DC\\s*#?\\s*/i, '').trim();
    }

    return null;
  }, [cashInvoices, savedDcs]);

  const sortedBankAccounts = useMemo(() => {`;

viewContent = viewContent.replace(helperInsertionPoint, helperCode);

// Update Linked Transactions Tab Table Cell (line ~2710)
const oldTabCell = `                          <td className="p-3 whitespace-nowrap">
                            <Badge className="bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200 border-teal-300 font-mono font-bold text-[11px]">
                              {invRef}
                            </Badge>
                          </td>`;

const newTabCell = `                          <td className="p-3 whitespace-nowrap">
                            {(() => {
                              const dcNo = resolveDcNumber(tx);
                              return (
                                <div className="flex flex-col gap-1 items-start">
                                  <Badge className="bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200 border-teal-300 font-mono font-bold text-[11px]">
                                    {invRef}
                                  </Badge>
                                  {dcNo && (
                                    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold font-mono bg-amber-100/90 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded border border-amber-300/80">
                                      <span className="text-[9.5px] uppercase opacity-75 font-semibold">DC:</span>
                                      <span>#{dcNo}</span>
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>`;

viewContent = viewContent.replace(oldTabCell, newTabCell);

// Update Main Ledger Table Cell (line ~2355)
const oldLedgerCell = `                                  <Receipt className="w-3 h-3 text-teal-700" />
                                  <span>{tx.linkedInvoiceNumber}</span>
                                  <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                                </button>
                                {tx.linkedCustomerName && (`;

const newLedgerCell = `                                  <Receipt className="w-3 h-3 text-teal-700" />
                                  <span>{tx.linkedInvoiceNumber}</span>
                                  <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                                </button>
                                {(() => {
                                  const dcNo = resolveDcNumber(tx);
                                  return dcNo ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono text-amber-900 dark:text-amber-200 bg-amber-100/80 dark:bg-amber-950/70 px-1.5 py-0.5 rounded border border-amber-300/70">
                                      <span className="text-[9px] uppercase opacity-75 font-semibold">DC:</span>
                                      <span>#{dcNo}</span>
                                    </span>
                                  ) : null;
                                })()}
                                {tx.linkedCustomerName && (`;

viewContent = viewContent.replace(oldLedgerCell, newLedgerCell);

fs.writeFileSync(viewPath, viewContent, 'utf8');
console.log('BankAccountsView.tsx updated with DC Number resolution and badges!');
