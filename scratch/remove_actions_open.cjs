const fs = require('fs');
const path = 'c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\pages\\SavedDcs.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

for (let i = 3130; i < 3150; i++) {
    if (lines[i] && lines[i].includes('{!selectedDc && (')) {
        console.log("Removing line", i + 1, ":", lines[i]);
        lines.splice(i, 1);
        break;
    }
}
fs.writeFileSync(path, lines.join('\n'));
console.log("Done");
