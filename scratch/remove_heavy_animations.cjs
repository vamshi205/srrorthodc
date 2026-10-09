const fs = require('fs');
const filePath = 'c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove background blur div and mix-blend-overlay in sticky banner
content = content.replace(
  /<div className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20 mix-blend-overlay">[\s\S]*?<\/div>/g,
  ''
);
content = content.replace(
  /<div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-teal-500\/10 dark:bg-teal-400\/15 blur-2xl pointer-events-none" \/>/g,
  ''
);
content = content.replace(/backdrop-blur-md/g, '');

// 2. Simplify Return button
const returnTarget = `<div className="relative group inline-flex">
                                  <span className="absolute -inset-0.5 rounded-lg bg-teal-500/40 animate-pulse pointer-events-none blur-[2px]" />
                                  <Button
                                    size="sm"
                                    className="relative z-10 group h-8 text-xs font-semibold bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-lg gap-1.5 shadow-md shadow-teal-500/20 hover:shadow-teal-500/40 ring-2 ring-teal-400/50 hover:ring-teal-400/90 transition-all duration-200 ease-out hover:scale-105 hover:-translate-y-0.5 active:scale-95 cursor-pointer hover:brightness-110"
                                    onClick={() =>
                                      openActionDialog("return", selectedDc)
                                    }
                                  >
                                    <RotateCcw className="w-3.5 h-3.5 group-hover:-rotate-180 transition-transform duration-500" /> Return
                                  </Button>
                                </div>`;

const returnReplacement = `<Button
                                  size="sm"
                                  className="h-8 text-xs font-semibold bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-lg gap-1.5 shadow-xs transition-colors cursor-pointer"
                                  onClick={() =>
                                    openActionDialog("return", selectedDc)
                                  }
                                >
                                  <RotateCcw className="w-3.5 h-3.5" /> Return
                                </Button>`;

if (content.includes(returnTarget)) {
  content = content.replace(returnTarget, returnReplacement);
}

// 3. Simplify Cash Invoice button
const cashInvTarget = `<div className="relative group inline-flex">
                                      <span className="absolute -inset-0.5 rounded-lg bg-blue-500/40 animate-pulse pointer-events-none blur-[2px]" />
                                      <Button
                                        size="sm"
                                        className="relative z-10 group h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg gap-1.5 shadow-md shadow-blue-500/20 hover:shadow-blue-500/40 ring-2 ring-blue-400/50 hover:ring-blue-400/90 transition-all duration-200 ease-out hover:scale-105 hover:-translate-y-0.5 active:scale-95 cursor-pointer hover:brightness-110"
                                        onClick={() =>
                                          handleCreateCashMemoForDc(selectedDc)
                                        }
                                      >
                                        <Receipt className="w-3.5 h-3.5 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-200" /> Cash Invoice
                                      </Button>
                                    </div>`;

const cashInvReplacement = `<Button
                                      size="sm"
                                      className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg gap-1.5 shadow-xs transition-colors cursor-pointer"
                                      onClick={() =>
                                        handleCreateCashMemoForDc(selectedDc)
                                      }
                                    >
                                      <Receipt className="w-3.5 h-3.5" /> Cash Invoice
                                    </Button>`;

if (content.includes(cashInvTarget)) {
  content = content.replace(cashInvTarget, cashInvReplacement);
}

// 4. Simplify Link Invoice button
const linkInvTarget = `<div className="relative group inline-flex">
                                      <span className="absolute -inset-0.5 rounded-lg bg-indigo-500/40 animate-pulse pointer-events-none blur-[2px]" />
                                      <Button
                                        size="sm"
                                        className="relative z-10 group h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg gap-1.5 shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/40 ring-2 ring-indigo-400/50 hover:ring-indigo-400/90 transition-all duration-200 ease-out hover:scale-105 hover:-translate-y-0.5 active:scale-95 cursor-pointer hover:brightness-110"
                                        onClick={() =>
                                          openActionDialog("invoice", selectedDc)
                                        }
                                      >
                                        <Link className="w-3.5 h-3.5 group-hover:rotate-45 group-hover:scale-110 transition-transform duration-300" /> Link Invoice
                                      </Button>
                                    </div>`;

const linkInvReplacement = `<Button
                                      size="sm"
                                      className="h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg gap-1.5 shadow-xs transition-colors cursor-pointer"
                                      onClick={() =>
                                        openActionDialog("invoice", selectedDc)
                                      }
                                    >
                                      <Link className="w-3.5 h-3.5" /> Link Invoice
                                    </Button>`;

if (content.includes(linkInvTarget)) {
  content = content.replace(linkInvTarget, linkInvReplacement);
}

// 5. Simplify View Cash Invoice button
const viewCashInvTarget = `<div className="relative group inline-flex">
                                <span className="absolute -inset-0.5 rounded-lg bg-blue-500/40 animate-pulse pointer-events-none blur-[2px]" />
                                <Button
                                  size="sm"
                                  className="relative z-10 group h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg gap-1.5 shadow-md shadow-blue-500/20 hover:shadow-blue-500/40 ring-2 ring-blue-400/50 hover:ring-blue-400/90 transition-all duration-200 ease-out hover:scale-105 hover:-translate-y-0.5 active:scale-95 cursor-pointer hover:brightness-110"
                                  onClick={() => {
                                    setViewingCashMemoRef(selectedDc.invoiceRef!);
                                    setCashMemoModalOpen(true);
                                  }}
                                >
                                  <Receipt className="w-3.5 h-3.5 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-200" /> View Cash Invoice
                                </Button>
                              </div>`;

const viewCashInvReplacement = `<Button
                                  size="sm"
                                  className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg gap-1.5 shadow-xs transition-colors cursor-pointer"
                                  onClick={() => {
                                    setViewingCashMemoRef(selectedDc.invoiceRef!);
                                    setCashMemoModalOpen(true);
                                  }}
                                >
                                  <Receipt className="w-3.5 h-3.5" /> View Cash Invoice
                                </Button>`;

if (content.includes(viewCashInvTarget)) {
  content = content.replace(viewCashInvTarget, viewCashInvReplacement);
}

// 6. Simplify Pay button
const payTarget = `<div className="relative group inline-flex">
                                <span className="absolute -inset-0.5 rounded-lg bg-emerald-500/30 animate-pulse pointer-events-none blur-[2px]" />
                                <Button
                                  size="sm"
                                  className="relative z-10 group h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg gap-1.5 shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/40 ring-2 ring-emerald-400/50 hover:ring-emerald-400/90 transition-all duration-200 ease-out hover:scale-105 hover:-translate-y-0.5 active:scale-95 cursor-pointer hover:brightness-110"
                                  onClick={() => openPaymentDialog(selectedDc)}
                                >
                                  <Wallet className="w-3.5 h-3.5 group-hover:scale-110 transition-transform duration-200" /> Pay
                                </Button>
                              </div>`;

const payReplacement = `<Button
                                  size="sm"
                                  className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg gap-1.5 shadow-xs transition-colors cursor-pointer"
                                  onClick={() => openPaymentDialog(selectedDc)}
                                >
                                  <Wallet className="w-3.5 h-3.5" /> Pay
                                </Button>`;

if (content.includes(payTarget)) {
  content = content.replace(payTarget, payReplacement);
}

// Remove remaining animate-pulse and blur filters across SavedDcs.tsx
content = content.replace(/animate-pulse/g, '');

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully removed all heavy animation loops and GPU blur filters!");
