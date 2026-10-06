const fs = require('fs');
const path = 'c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\pages\\SavedDcs.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace the 4 stats cards
const statsRegex = /<Card className="glass-card border border-border\/60 bg-white\/70\s*dark:bg-slate-900\/70 backdrop-blur-md hover:shadow-lg transition-all duration-300 shadow-md rounded-2xl">/g;
content = content.replace(statsRegex, '<Card className="bg-white border border-slate-100 dark:bg-slate-900 dark:border-slate-800 hover:shadow-md transition-all duration-300 shadow-sm rounded-xl">');

// Replace the main table card
const mainCardRegex = /<Card className="glass-card border border-border\/60 bg-white\/75\s*dark:bg-slate-900\/75 backdrop-blur-md rounded-2xl shadow-xl">/g;
content = content.replace(mainCardRegex, '<Card className="bg-white border border-slate-100 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">');

fs.writeFileSync(path, content);
console.log("Replaced custom glass classes in SavedDcs.tsx!");
