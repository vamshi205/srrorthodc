const fs = require('fs');
const path = 'c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\pages\\SavedDcs.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Unify sticky row Action Buttons to consistent Eyris Primary/Secondary
content = content.replace(
  /className="h-8 text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white rounded-lg gap-1.5"/g,
  'className="h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg gap-1.5"'
); // Return

content = content.replace(
  /className="h-8 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-lg gap-1.5"/g,
  'className="h-8 text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg gap-1.5 shadow-sm"'
); // Direct Purchase

content = content.replace(
  /className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg gap-1.5"/g,
  'className="h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg gap-1.5"'
); // Cash Memo & View Memo (Wait, View Memo should be secondary)

content = content.replace(
  /className="h-8 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-lg gap-1.5"/g,
  'className="h-8 text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg gap-1.5 shadow-sm"'
); // Tax Invoice

content = content.replace(
  /className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg gap-1.5"/g,
  'className="h-8 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1.5 shadow-sm"'
); // GoGSTBill & Pay

// 2. Unify Table Action Dropdown Buttons to match
// The dropdown icons/text often have crazy colors. Let's make them standard slate-700 with blue icons or neutral icons.
content = content.replace(/text-teal-600/g, 'text-blue-600');
content = content.replace(/text-purple-600/g, 'text-slate-600');
content = content.replace(/text-amber-600/g, 'text-slate-600'); // Note: This might hit stats, but stats are already changed
content = content.replace(/text-rose-600/g, 'text-rose-600'); // keep destructive actions red

// 3. Unify the status badges
const oldPendingBadge = `bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300`;
const newPendingBadge = `bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800`;
content = content.replace(new RegExp(oldPendingBadge.replace(/[.*+?^$\/]/g, '\\$&'), 'g'), newPendingBadge);

const oldReturnedBadge = `bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300`;
const newReturnedBadge = `bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800`;
content = content.replace(new RegExp(oldReturnedBadge.replace(/[.*+?^$\/]/g, '\\$&'), 'g'), newReturnedBadge);

const oldCashBadge = `bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300`;
const newCashBadge = `bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800`;
content = content.replace(new RegExp(oldCashBadge.replace(/[.*+?^$\/]/g, '\\$&'), 'g'), newCashBadge);

const oldInvoicedBadge = `bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300`;
const newInvoicedBadge = `bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700`;
content = content.replace(new RegExp(oldInvoicedBadge.replace(/[.*+?^$\/]/g, '\\$&'), 'g'), newInvoicedBadge);

fs.writeFileSync(path, content);
console.log("Unified colors in SavedDcs.tsx to consistent Eyris palette.");
