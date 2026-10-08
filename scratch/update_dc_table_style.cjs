const fs = require('fs');
const path = 'c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx';

let code = fs.readFileSync(path, 'utf8');

// 1. Remove border-r-2 border-slate-200 from table cells
code = code.replace(/className="([^"]*)\s*border-r-2 border-slate-200\s*([^"]*)"/g, (match, p1, p2) => {
  const clean = `${p1} ${p2}`.trim().replace(/\s+/g, ' ');
  return `className="${clean}"`;
});

// 2. Replace rounded-full button classes in action column with rounded-lg Shadcn UI style
code = code.replace(
  'bg-teal-50 border border-teal-200 rounded-full text-teal-700 hover:bg-teal-100 transition-all shadow-none',
  'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:text-teal-600 hover:bg-teal-50 transition-all shadow-2xs'
);

code = code.replace(
  'bg-blue-50 border border-blue-200 rounded-full text-blue-700 hover:bg-blue-100 transition-all shadow-none',
  'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-blue-600 hover:border-blue-500 hover:bg-blue-50 transition-all shadow-2xs'
);

code = code.replace(
  'bg-slate-50 border border-slate-200 rounded-full text-slate-700 hover:bg-slate-100 transition-all shadow-none',
  'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100 transition-all shadow-2xs'
);

code = code.replace(
  'rounded-full transition-all shadow-none border',
  'rounded-lg border shadow-2xs transition-all'
);

fs.writeFileSync(path, code, 'utf8');
console.log('SavedDcs.tsx updated successfully!');
