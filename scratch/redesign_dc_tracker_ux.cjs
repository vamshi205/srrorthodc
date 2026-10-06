const fs = require('fs');
const path = 'c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\pages\\SavedDcs.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Page Header redesign (Lines ~2054)
const oldHeader = `<div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border shadow-sm">
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-700 flex items-center justify-center text-teal-800 dark:text-teal-200 shadow-sm shrink-0">
                <List className="w-5 h-5 text-teal-700 dark:text-teal-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-bold font-display text-foreground tracking-tight">
                    DC Operations &amp; Inventory Tracker
                  </h1>
                  <Badge variant="outline" className="bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300 border-teal-300 text-[11px] font-bold rounded-full">
                    Live Status
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                  Automated cutoff alerts, collection follow-ups &amp; cash invoices
                </p>
              </div>
            </div>`;

const newHeader = `<div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
                DC Operations
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Manage delivery challans, track collections, and view cash invoices.
              </p>
            </div>`;

if (content.includes('DC Operations &amp; Inventory Tracker')) {
    content = content.replace(oldHeader, newHeader);
}

// 2. The 4 Stats Cards
// Replace rounded-xl with rounded-lg to match Eyris
content = content.replace(/rounded-xl/g, 'rounded-lg');

// Simplify the stats cards
content = content.replace(
  /<p className="text-\[10px\] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">/g,
  '<p className="text-sm font-medium text-slate-500 dark:text-slate-400">'
);
content = content.replace(
  /<p className="text-xl sm:text-3xl font-extrabold/g,
  '<p className="text-2xl sm:text-3xl font-semibold'
);
// Remove background color from icons in stats widgets
content = content.replace(/bg-rose-50 border border-rose-200/g, 'bg-transparent border-0');
content = content.replace(/bg-amber-50 border border-amber-200/g, 'bg-transparent border-0');
content = content.replace(/bg-blue-50 border border-blue-200/g, 'bg-transparent border-0');
content = content.replace(/bg-teal-50 border border-teal-200/g, 'bg-transparent border-0');


// 3. Search Bar Area
const oldSearchBar = `bg-slate-50 dark:bg-slate-900/60 p-3 sm:p-4 rounded-lg border border-slate-200/80`;
const newSearchBar = `bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 pb-4 mb-2`;
content = content.replace(oldSearchBar, newSearchBar);

// 4. Sticky Sticky Row Banner (Selected DC)
const oldSticky = `bg-white/95 backdrop-blur-md border border-slate-200/60 text-slate-800 rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]`;
const newSticky = `bg-slate-50 border border-slate-200 text-slate-800 rounded-lg shadow-sm`;
content = content.replace(oldSticky, newSticky);

// 5. Table Header Row (thead)
content = content.replace(
  /className="h-10 sm:h-12 border-b-2 border-border\/60 bg-muted\/30 hover:bg-muted\/30"/g,
  'className="h-12 border-b border-slate-200 bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-50/80"'
);

// Update table th text
content = content.replace(
  /text-\[10px\] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider/g,
  'text-xs font-semibold text-slate-600 dark:text-slate-300 tracking-wide'
);

fs.writeFileSync(path, content);
console.log("Completely overhauled SavedDcs.tsx UI/UX to match Eyris dashboard.");
