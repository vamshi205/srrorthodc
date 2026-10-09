const fs = require('fs');
const path = 'c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = '? "bg-gradient-to-r from-teal-50/90 via-teal-50/50 to-transparent dark:from-teal-950/50 dark:via-teal-950/20 dark:to-transparent border-l-4 border-l-teal-600 font-semibold shadow-2xs"';
const replacement = '? "bg-gradient-to-r from-teal-50/90 via-teal-50/50 to-transparent dark:from-teal-950/50 dark:via-teal-950/20 dark:to-transparent font-semibold shadow-2xs"';

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log("Successfully removed duplicate border-l-4 border-l-teal-600 from table row!");
} else {
  console.error("Target string not found in SavedDcs.tsx!");
}
