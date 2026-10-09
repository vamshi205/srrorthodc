const fs = require('fs');
const filePath = 'c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Sticky row Cash Memo button label -> Cash Invoice
content = content.replace(
  /<Receipt className="w-3.5 h-3.5 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-200" \/> Cash Memo/,
  '<Receipt className="w-3.5 h-3.5 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-200" /> Cash Invoice'
);

// 2. Sticky row View Memo button label -> View Cash Invoice (and wrap in ambient ring like other sticky buttons)
const oldViewMemoBlock = `<Button
                                size="sm"
                                className="group h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg gap-1.5 shadow-sm hover:shadow-md transition-all duration-200 ease-out hover:scale-105 hover:-translate-y-0.5 active:scale-95 active:translate-y-0 cursor-pointer hover:brightness-110"
                                onClick={() => {
                                  setViewingCashMemoRef(selectedDc.invoiceRef!);
                                  setCashMemoModalOpen(true);
                                }}
                              >
                                <Receipt className="w-3.5 h-3.5 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-200" /> View Memo
                              </Button>`;

const newViewMemoBlock = `<div className="relative group inline-flex">
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

if (content.includes(oldViewMemoBlock)) {
  content = content.replace(oldViewMemoBlock, newViewMemoBlock);
} else {
  content = content.replace('View Memo', 'View Cash Invoice');
}

// 3. Details popup "View Cash Memo" -> "View Cash Invoice"
content = content.replace('View Cash Memo', 'View Cash Invoice');

// 4. Pay button: Stop icon bounce and remove ping background, keeping clean steady button with subtle hover scale
const oldPayBlock = `<div className="relative group inline-flex">
                                <span className="absolute -inset-0.5 rounded-lg bg-emerald-500/50 animate-ping opacity-75 pointer-events-none blur-[2px]" />
                                <span className="absolute -inset-0.5 rounded-lg bg-emerald-500/40 animate-pulse pointer-events-none blur-[2px]" />
                                <Button
                                  size="sm"
                                  className="relative z-10 group h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg gap-1.5 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 ring-2 ring-emerald-400/60 hover:ring-emerald-400/90 transition-all duration-200 ease-out hover:scale-105 hover:-translate-y-0.5 active:scale-95 cursor-pointer hover:brightness-110"
                                  onClick={() => openPaymentDialog(selectedDc)}
                                >
                                  <Wallet className="w-3.5 h-3.5 group-hover:scale-125 transition-transform duration-200 animate-bounce" /> Pay
                                </Button>
                              </div>`;

const newPayBlock = `<div className="relative group inline-flex">
                                <span className="absolute -inset-0.5 rounded-lg bg-emerald-500/30 animate-pulse pointer-events-none blur-[2px]" />
                                <Button
                                  size="sm"
                                  className="relative z-10 group h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg gap-1.5 shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/40 ring-2 ring-emerald-400/50 hover:ring-emerald-400/90 transition-all duration-200 ease-out hover:scale-105 hover:-translate-y-0.5 active:scale-95 cursor-pointer hover:brightness-110"
                                  onClick={() => openPaymentDialog(selectedDc)}
                                >
                                  <Wallet className="w-3.5 h-3.5 group-hover:scale-110 transition-transform duration-200" /> Pay
                                </Button>
                              </div>`;

if (content.includes(oldPayBlock)) {
  content = content.replace(oldPayBlock, newPayBlock);
} else {
  // Regex fallback
  content = content.replace(
    /<Wallet className="w-3.5 h-3.5 group-hover:scale-125 transition-transform duration-200 animate-bounce" \/> Pay/,
    '<Wallet className="w-3.5 h-3.5 group-hover:scale-110 transition-transform duration-200" /> Pay'
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully updated Cash Invoice labels & stopped Pay button icon bouncing!");
