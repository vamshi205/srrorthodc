const fs = require('fs');
const filePath = 'c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx';

let content = fs.readFileSync(filePath, 'utf8');

// 1. Phone button rounded-full -> rounded-lg
content = content.replace(
  'rounded-full transition-all shadow-none border',
  'rounded-lg border shadow-2xs transition-all'
);

// 2. Eye button rounded-full -> rounded-lg
content = content.replace(
  'className="w-8 h-8 flex items-center justify-center bg-teal-50 border border-teal-200 rounded-full text-teal-700 hover:bg-teal-100 transition-all shadow-none"',
  'className="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:text-teal-600 hover:bg-teal-50 transition-all shadow-2xs"'
);
content = content.replace(
  '<Eye className="w-4 h-4 text-teal-700" />',
  '<Eye size={14} />'
);

// 3. Track Activity button rounded-full -> rounded-lg
content = content.replace(
  'className="w-8 h-8 flex items-center justify-center bg-blue-50 border border-blue-200 rounded-full text-blue-700 hover:bg-blue-100 transition-all shadow-none"',
  'className="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-blue-600 hover:border-blue-500 hover:bg-blue-50 transition-all shadow-2xs"'
);
content = content.replace(
  '<Activity className="w-4 h-4 text-blue-700" />',
  '<Activity size={14} />'
);

// 4. Print button rounded-full -> rounded-lg
content = content.replace(
  'className="w-8 h-8 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-full text-slate-700 hover:bg-slate-100 transition-all shadow-none"',
  'className="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100 transition-all shadow-2xs"'
);
content = content.replace(
  '<Printer className="w-4 h-4 text-slate-700" />',
  '<Printer size={14} />'
);

// 5. Actions DropdownTrigger button rounded-full / ghost button -> rounded-lg
content = content.replace(
  'className="h-8 w-8 p-0 hover:bg-slate-200"',
  'className="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:text-amber-600 hover:bg-amber-50 transition-all shadow-2xs p-0"'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('SavedDcs.tsx action buttons updated to rounded-lg square rounded styling!');
