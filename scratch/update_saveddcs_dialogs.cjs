const fs = require('fs');
const path = 'c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\pages\\SavedDcs.tsx';
let content = fs.readFileSync(path, 'utf8');

// The goal is to replace complex DialogContent inline classes with simple flat classes.
content = content.replace(
  /className="sm:max-w-\[500px\] p-0 overflow-hidden border border-slate-200\/90 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 gap-0"/g,
  'className="sm:max-w-[500px] p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm rounded-lg bg-white dark:bg-slate-900 gap-0"'
);

content = content.replace(
  /className="max-w-4xl max-h-\[92vh\] overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-900 border-border"/g,
  'className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-white dark:bg-slate-900 border-border"'
);

content = content.replace(
  /className="max-w-4xl max-h-\[90vh\] overflow-y-auto p-3 sm:p-6 bg-slate-100 dark:bg-slate-900"/g,
  'className="max-w-4xl max-h-[90vh] overflow-y-auto p-3 sm:p-6 bg-white dark:bg-slate-900"'
);

content = content.replace(
  /className="sm:max-w-\[440px\] p-0 overflow-hidden border border-slate-200\/90 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 gap-0"/g,
  'className="sm:max-w-[440px] p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm rounded-lg bg-white dark:bg-slate-900 gap-0"'
);

content = content.replace(
  /className="sm:max-w-\[420px\] p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 gap-0"/g,
  'className="sm:max-w-[420px] p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm rounded-lg bg-white dark:bg-slate-900 gap-0"'
);

content = content.replace(
  /className="sm:max-w-\[420px\] p-0 overflow-hidden border border-slate-200\/90 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 gap-0"/g,
  'className="sm:max-w-[420px] p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm rounded-lg bg-white dark:bg-slate-900 gap-0"'
);

content = content.replace(
  /className="sm:max-w-4xl lg:max-w-5xl w-full p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 gap-0"/g,
  'className="sm:max-w-4xl lg:max-w-5xl w-full p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm rounded-lg bg-white dark:bg-slate-900 gap-0"'
);

content = content.replace(
  /className="sm:max-w-md w-full p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 gap-0"/g,
  'className="sm:max-w-md w-full p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm rounded-lg bg-white dark:bg-slate-900 gap-0"'
);

content = content.replace(
  /className="max-w-lg max-h-\[90vh\] overflow-y-auto p-0 gap-0 rounded-2xl bg-white shadow-2xl border-0"/g,
  'className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-lg bg-white shadow-sm border border-slate-200"'
);

content = content.replace(
  /className="sm:max-w-\[540px\] p-0 overflow-hidden border border-slate-200\/90 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 gap-0"/g,
  'className="sm:max-w-[540px] p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm rounded-lg bg-white dark:bg-slate-900 gap-0"'
);

// Specifically remove the bold gradient header on one of the dialogs (Dc Tracker details)
content = content.replace(
  /<div className="bg-gradient-to-r from-teal-800 via-teal-900 to-slate-900 text-white p-5 rounded-t-2xl relative">/g,
  '<div className="bg-slate-50 border-b border-slate-200 text-slate-800 p-5 rounded-t-lg relative">'
);

fs.writeFileSync(path, content);
console.log("Updated SavedDcs dialog styles to flat Eyris style.");
