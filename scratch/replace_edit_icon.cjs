const fs = require('fs');
const filePath = 'c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx';

const lines = fs.readFileSync(filePath, 'utf8').split('\n');

// Find line containing '<Edit className="h-4 w-4 text-slate-600" />' around line 4304
for (let i = 4290; i < 4320; i++) {
  if (lines[i] && lines[i].includes('<Edit className="h-4 w-4 text-slate-600" />')) {
    lines[i] = lines[i].replace('<Edit className="h-4 w-4 text-slate-600" />', '<MoreVertical className="w-3.5 h-3.5 text-slate-600" />');
    console.log(`Replaced at line ${i + 1}`);
  }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Script completed.');
