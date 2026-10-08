const fs = require('fs');
const filePath = 'c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx';

let content = fs.readFileSync(filePath, 'utf8');

// 1. Add MoreVertical to lucide-react imports
if (!content.includes('MoreVertical,')) {
  content = content.replace('  Menu,', '  Menu,\n  MoreVertical,');
}

// 2. Replace Edit icon with MoreVertical in the Actions dropdown trigger
content = content.replace(
  '<Edit className="h-4 w-4 text-slate-600" />',
  '<MoreVertical className="w-3.5 h-3.5 text-slate-600" />'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Actions trigger icon changed to 3 dots (MoreVertical) in SavedDcs.tsx!');
