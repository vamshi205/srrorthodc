const fs = require('fs');
const filePath = 'c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Return button replacement
content = content.replace(
  /<Button\s+size="sm"\s+className="group h-8 text-xs font-semibold bg-teal-600[\s\S]*?<RotateCcw[\s\S]*?>\s*Return\s*<\/Button>/,
  `<div className="relative group inline-flex">
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
                                </div>`
);

// Cash Memo button replacement
content = content.replace(
  /<Button\s+size="sm"\s+className="group h-8 text-xs font-semibold bg-blue-600[\s\S]*?<Receipt[\s\S]*?>\s*Cash Memo\s*<\/Button>/,
  `<div className="relative group inline-flex">
                                      <span className="absolute -inset-0.5 rounded-lg bg-blue-500/40 animate-pulse pointer-events-none blur-[2px]" />
                                      <Button
                                        size="sm"
                                        className="relative z-10 group h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg gap-1.5 shadow-md shadow-blue-500/20 hover:shadow-blue-500/40 ring-2 ring-blue-400/50 hover:ring-blue-400/90 transition-all duration-200 ease-out hover:scale-105 hover:-translate-y-0.5 active:scale-95 cursor-pointer hover:brightness-110"
                                        onClick={() =>
                                          handleCreateCashMemoForDc(selectedDc)
                                        }
                                      >
                                        <Receipt className="w-3.5 h-3.5 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-200" /> Cash Memo
                                      </Button>
                                    </div>`
);

// Link Invoice button replacement
content = content.replace(
  /<Button\s+size="sm"\s+className="group h-8 text-xs font-semibold bg-indigo-600[\s\S]*?<Link[\s\S]*?>\s*Link Invoice\s*<\/Button>/,
  `<div className="relative group inline-flex">
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
                                    </div>`
);

// Pay button replacement
content = content.replace(
  /<Button\s+size="sm"\s+className="group h-8 text-xs font-bold bg-emerald-600[\s\S]*?<Wallet[\s\S]*?>\s*Pay\s*<\/Button>/,
  `<div className="relative group inline-flex">
                                <span className="absolute -inset-0.5 rounded-lg bg-emerald-500/50 animate-ping opacity-75 pointer-events-none blur-[2px]" />
                                <span className="absolute -inset-0.5 rounded-lg bg-emerald-500/40 animate-pulse pointer-events-none blur-[2px]" />
                                <Button
                                  size="sm"
                                  className="relative z-10 group h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg gap-1.5 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 ring-2 ring-emerald-400/60 hover:ring-emerald-400/90 transition-all duration-200 ease-out hover:scale-105 hover:-translate-y-0.5 active:scale-95 cursor-pointer hover:brightness-110"
                                  onClick={() => openPaymentDialog(selectedDc)}
                                >
                                  <Wallet className="w-3.5 h-3.5 group-hover:scale-125 transition-transform duration-200 animate-bounce" /> Pay
                                </Button>
                              </div>`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully replaced button animations!");
