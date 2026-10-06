import fs from 'fs';

const filePath = 'c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace shadow classes with flat equivalents
content = content.replace(/\bshadow-md\b/g, 'shadow-none');
content = content.replace(/\bshadow-sm\b/g, 'shadow-none');
content = content.replace(/\bshadow-2xs\b/g, 'shadow-none');
content = content.replace(/\bshadow-xs\b/g, 'shadow-none');
content = content.replace(/\bshadow-lg\b/g, 'shadow-none');
content = content.replace(/\bshadow-xl\b/g, 'shadow-none');

// Flatten desktop table wrapper
content = content.replace(
  /className="hidden md:block border border-border\/80 rounded-xl overflow-hidden shadow-md bg-background dark:bg-slate-900\/95\s*"/g,
  'className="hidden md:block border border-border rounded-xl overflow-hidden bg-card"'
);

// Flatten main Card container
content = content.replace(
  /className="bg-card text-card-foreground shadow-sm border rounded-xl"/g,
  'className="bg-card text-card-foreground border border-border rounded-xl shadow-none"'
);

// Flatten Sticky selection banner
content = content.replace(
  /className="sticky top-\[80px\] z-20 mb-4 mt-2 p-2 px-4 bg-background  border border-slate-200\/60 text-slate-800 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200 dark:bg-slate-900\/95 dark:border-slate-800 dark:text-slate-100"/g,
  'className="sticky top-[80px] z-20 mb-4 mt-2 p-2 px-4 bg-card border border-border text-foreground rounded-xl shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200"'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Flat design applied to SavedDcs.tsx');
