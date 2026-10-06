import fs from 'fs';

const filePath = 'c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Flatten TabsList
content = content.replace(
  /className="grid h-auto min-h-\[52px\] grid-cols-5 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1\.5"/g,
  'className="grid h-11 grid-cols-5 gap-1 rounded-lg border border-border bg-muted/60 p-1"'
);

// Flatten TabsTriggers to use crisp Shadcn active states
content = content.replace(
  /className="relative flex h-10 w-full items-center justify-center gap-1\.5 rounded-lg px-2 text-xs leading-none sm:text-sm data-\[state=active\]:bg-rose-600 data-\[state=active\]:text-white font-bold transition-all shadow-none"/g,
  'className="flex h-9 items-center justify-center gap-1.5 rounded-md px-2 text-xs sm:text-sm font-semibold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"'
);
content = content.replace(
  /className="relative flex h-10 w-full items-center justify-center gap-1\.5 rounded-lg px-2 text-xs leading-none sm:text-sm data-\[state=active\]:bg-teal-600 data-\[state=active\]:text-white font-bold transition-all shadow-none"/g,
  'className="flex h-9 items-center justify-center gap-1.5 rounded-md px-2 text-xs sm:text-sm font-semibold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"'
);
content = content.replace(
  /className="relative flex h-10 w-full items-center justify-center gap-1\.5 rounded-lg px-2 text-xs leading-none sm:text-sm data-\[state=active\]:bg-teal-700 data-\[state=active\]:text-white font-bold transition-all shadow-none"/g,
  'className="flex h-9 items-center justify-center gap-1.5 rounded-md px-2 text-xs sm:text-sm font-semibold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"'
);
content = content.replace(
  /className="relative flex h-10 w-full items-center justify-center gap-1\.5 rounded-lg px-2 text-xs leading-none sm:text-sm data-\[state=active\]:bg-blue-600 data-\[state=active\]:text-white font-bold transition-all shadow-none"/g,
  'className="flex h-9 items-center justify-center gap-1.5 rounded-md px-2 text-xs sm:text-sm font-semibold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"'
);
content = content.replace(
  /className="relative flex h-10 w-full items-center justify-center gap-1\.5 rounded-lg px-2 text-xs leading-none sm:text-sm data-\[state=active\]:bg-slate-600 data-\[state=active\]:text-white font-bold transition-all shadow-none"/g,
  'className="flex h-9 items-center justify-center gap-1.5 rounded-md px-2 text-xs sm:text-sm font-semibold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"'
);

// Flatten Search Input and Filter Bar
content = content.replace(
  /className="pl-9 h-9 text-xs sm:text-sm border-slate-300 bg-white focus:border-teal-600 focus:ring-teal-600 rounded-lg"/g,
  'className="pl-9 h-9 text-xs sm:text-sm border-border bg-background focus:border-primary focus:ring-primary rounded-md"'
);

content = content.replace(
  /className="flex items-center gap-1 bg-slate-200\/70 dark:bg-slate-800 p-1 rounded-lg"/g,
  'className="flex items-center gap-1 bg-muted p-1 rounded-md border border-border"'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated SavedDcs.tsx tabs and filters to flat Shadcn design');
