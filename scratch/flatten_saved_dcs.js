import fs from 'fs';

const filePath = 'c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove bg-gradient-hero from main wrapper
content = content.replace(
  'className="min-h-screen bg-gradient-hero overflow-x-hidden flex flex-col"',
  'className="min-h-screen bg-background text-foreground overflow-x-hidden flex flex-col"'
);

// 2. Flatten outer main containers
content = content.replace(/bg-gradient-to-[a-z]+/g, 'bg-background');

// 3. Make metrics cards completely flat
content = content.replace(
  /<Card>/g,
  '<Card className="bg-card border border-border shadow-none rounded-xl">'
);

// 4. Make main control toolbar card flat
content = content.replace(
  /className="bg-card text-card-foreground border border-border rounded-xl shadow-none"/g,
  'className="bg-card text-card-foreground border border-border rounded-xl p-0 shadow-none"'
);

// 5. Flatten sticky selection banner
content = content.replace(
  /className="sticky top-\[80px\] z-20 mb-4 mt-2 p-2 px-4 bg-card border border-border text-foreground rounded-xl shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200"/g,
  'className="sticky top-[70px] z-20 mb-4 p-3 bg-card border border-border text-card-foreground rounded-xl shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-3"'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated SavedDcs.tsx to flat design');
