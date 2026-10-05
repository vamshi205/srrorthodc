const fs = require('fs');
const path = 'c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\pages\\SavedDcs.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

for (let i = 3450; i < 3465; i++) {
    if (lines[i] && lines[i].includes(')}') && lines[i+1] && lines[i+1].includes('</tr>')) {
        console.log("Removing line", i + 1, ":", lines[i]);
        lines.splice(i, 1);
        break;
    }
}
fs.writeFileSync(path, lines.join('\n'));
console.log("Done");
